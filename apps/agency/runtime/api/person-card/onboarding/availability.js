import crypto from "node:crypto";
import pg from "pg";

const {Pool}=pg;
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined,
});

function clean(value,max=180){
  if(typeof value!=="string")return undefined;
  const out=value.replace(/\s+/g," ").trim();
  return out?out.slice(0,max):undefined;
}
function safeEqual(a,b){
  try{
    const aa=Buffer.from(a),bb=Buffer.from(b);
    return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
  }catch{return false}
}
function draftSecret(){
  const secret=(process.env.NEXUS_ONBOARDING_DRAFT_SECRET||process.env.NEXUS_ONBOARDING_INVITE_SECRET||"").trim();
  if(secret.length<32){const error=new Error("NEXUS_ONBOARDING_DRAFT_SECRET_NOT_CONFIGURED");error.status=503;throw error}
  return secret;
}
function verifyDraftToken(token){
  const parts=String(token||"").split(".");
  if(parts.length!==2){const error=new Error("NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID");error.status=401;throw error}
  const [body,signature]=parts;
  const expected=crypto.createHmac("sha256",draftSecret()).update("draft:"+body).digest("base64url");
  if(!safeEqual(signature,expected)){const error=new Error("NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID");error.status=401;throw error}
  let payload;
  try{payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"))}catch{const error=new Error("NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID");error.status=401;throw error}
  if(payload?.schema!=="nexus-person-onboarding-draft-token/v1"||!payload.inviteId||!payload.personId||!Number.isFinite(Number(payload.expiresAt))){const error=new Error("NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID");error.status=401;throw error}
  if(Number(payload.expiresAt)<=Date.now()){const error=new Error("NEXUS_ONBOARDING_DRAFT_TOKEN_EXPIRED");error.status=410;throw error}
  return payload;
}
function allowedOrigins(){
  const origins=new Set((process.env.NEXUS_ONBOARDING_PUBLIC_ORIGINS||"").split(",").map(v=>v.trim()).filter(Boolean));
  const workBase=process.env.WORK_APP_BASE_URL?.trim();
  if(workBase){try{origins.add(new URL(workBase).origin)}catch{}}
  return origins;
}
function applyCors(req,res){
  const origin=req.headers.origin;
  if(!origin)return true;
  if(!allowedOrigins().has(origin)){res.status(403).json({error:"NEXUS_ONBOARDING_ORIGIN_DENIED"});return false}
  res.setHeader("Access-Control-Allow-Origin",origin);
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Vary","Origin");
  return true;
}
function validReadyDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+"T00:00:00Z");
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function labelFor(state){return state==="busy"?"Busy":state==="from-date"?"Ready on date":"Available"}

export default async function handler(req,res){
  if(!applyCors(req,res))return;
  if(req.method==="OPTIONS"){res.status(204).end();return}
  if(req.method!=="POST"){res.status(405).json({error:"METHOD_NOT_ALLOWED"});return}

  const draftToken=clean(req.body?.draftToken,8000);
  if(!draftToken){res.status(401).json({error:"NEXUS_ONBOARDING_DRAFT_TOKEN_REQUIRED"});return}

  try{
    const authority=verifyDraftToken(draftToken);
    const state=clean(req.body?.state||req.body?.availability,40)||"";
    if(!new Set(["available","busy","from-date"]).has(state)){
      res.status(400).json({error:"NEXUS_WORK_AVAILABILITY_INVALID"});return;
    }
    const rawDate=clean(req.body?.date||req.body?.availableFrom,40)||"";
    if(state==="from-date"&&!validReadyDate(rawDate)){
      res.status(400).json({error:"NEXUS_WORK_AVAILABILITY_DATE_REQUIRED"});return;
    }
    const availableFrom=state==="from-date"?rawDate:null;
    const now=new Date();
    const client=await pool.connect();
    try{
      await client.query("begin");
      const result=await client.query(`select w.record_json as "workRecord"
        from nexus_person_work_profiles w
        join nexus_person_onboarding_invites i on i.invite_id=w.source_invite_id
        where w.person_id=$1 and w.source_invite_id=$2 and w.status='active'
          and i.claimed_person_id=$1 and i.status='CLAIMED'
        limit 2 for update of w`,[authority.personId,authority.inviteId]);
      if(result.rows.length!==1){
        const error=new Error("NEXUS_WORK_ACTIVE_PROFILE_NOT_FOUND");error.status=404;throw error;
      }
      const work=result.rows[0].workRecord&&typeof result.rows[0].workRecord==="object"?result.rows[0].workRecord:{};
      const previous=work.availability&&typeof work.availability==="object"?work.availability:{};
      work.availability={...previous,status:state,label:labelFor(state),availableFrom};
      work.updatedAt=now.toISOString();
      await client.query("update nexus_person_work_profiles set record_json=$3::jsonb,persisted_at=$4 where person_id=$1 and source_invite_id=$2 and status='active'",[authority.personId,authority.inviteId,JSON.stringify(work),now]);
      await client.query("insert into nexus_person_work_events (event_id,person_id,invite_id,event_type,actor_type,record_json,persisted_at) values ($1,$2,$3,'PERSON_WORK_AVAILABILITY_UPDATED','worker',$4::jsonb,$5)",[
        `person-work-event-${crypto.randomUUID()}`,
        authority.personId,
        authority.inviteId,
        JSON.stringify({schema:"nexus-person-work-availability-event/v1",availability:{status:state,label:labelFor(state),availableFrom},secretsPersisted:false,privateWorkerFieldsIncluded:false}),
        now
      ]);
      await client.query("commit");
      res.json({
        schema:"nexus-person-work-availability-sync/v1",
        personId:authority.personId,
        availability:{status:state,label:labelFor(state),availableFrom},
        persistedAt:now.toISOString(),
        agencyVisibilityDerivedFromExistingConsent:true,
        privateWorkerFieldsIncluded:false
      });
    }catch(error){await client.query("rollback");throw error}finally{client.release()}
  }catch(error){
    console.error("NOSMO Worker availability sync error",error);
    res.status(Number(error?.status)||500).json({error:error?.message||"NEXUS_WORK_AVAILABILITY_SYNC_FAILED"});
  }
}
