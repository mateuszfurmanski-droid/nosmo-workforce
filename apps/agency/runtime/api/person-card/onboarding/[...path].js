import crypto from "node:crypto";
import pg from "pg";

const {Pool}=pg;
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined,
});

const MAX_CV_TEXT=20_000;
const DRAFT_TOKEN_DAYS=30;

function clean(value,max=180){
  if(typeof value!=="string")return undefined;
  const out=value.replace(/\s+/g," ").trim();
  return out?out.slice(0,max):undefined;
}
function rawText(value,max){return typeof value==="string"?value.trim().slice(0,max):""}
function bool(value){return value===true}
function finiteInt(value,min,max,fallback=0){
  const num=Number(value);
  if(!Number.isFinite(num))return fallback;
  return Math.max(min,Math.min(max,Math.round(num)));
}
function digest(value){return crypto.createHash("sha256").update(value,"utf8").digest("hex")}
function safeEqual(a,b){
  try{
    const aa=Buffer.from(a),bb=Buffer.from(b);
    return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
  }catch{return false}
}
function inviteSecret(){
  const secret=process.env.NEXUS_ONBOARDING_INVITE_SECRET?.trim();
  if(!secret||secret.length<32){const error=new Error("NEXUS_ONBOARDING_INVITE_SECRET_NOT_CONFIGURED");error.status=503;throw error}
  return secret;
}
function draftSecret(){
  const secret=process.env.NEXUS_ONBOARDING_DRAFT_SECRET?.trim()||inviteSecret();
  if(secret.length<32){const error=new Error("NEXUS_ONBOARDING_DRAFT_SECRET_NOT_CONFIGURED");error.status=503;throw error}
  return secret;
}
function verifyInviteToken(token){
  const parts=String(token||"").split(".");
  if(parts.length!==2){const error=new Error("NEXUS_ONBOARDING_INVITE_INVALID");error.status=401;throw error}
  const [body,signature]=parts;
  const expected=crypto.createHmac("sha256",inviteSecret()).update(body).digest("base64url");
  if(!safeEqual(signature,expected)){const error=new Error("NEXUS_ONBOARDING_INVITE_INVALID");error.status=401;throw error}
  let payload;
  try{payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"))}catch{const error=new Error("NEXUS_ONBOARDING_INVITE_INVALID");error.status=401;throw error}
  if(payload?.schema!=="nexus-person-onboarding-invite/v1"||!payload.inviteId||!payload.agency||!Number.isFinite(Number(payload.expiresAt))){const error=new Error("NEXUS_ONBOARDING_INVITE_INVALID");error.status=401;throw error}
  if(Number(payload.expiresAt)<=Date.now()){const error=new Error("NEXUS_ONBOARDING_INVITE_EXPIRED");error.status=410;throw error}
  return payload;
}
function createDraftToken(payload){
  const body=Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");
  const signature=crypto.createHmac("sha256",draftSecret()).update("draft:"+body).digest("base64url");
  return `${body}.${signature}`;
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
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Vary","Origin");
  return true;
}
async function query(text,params=[]){return pool.query(text,params)}
function sendError(res,error,fallback){
  const status=Number(error?.status)||500;
  res.status(status).json({error:error?.message||fallback});
}
function actionFrom(req){
  const value=req.query?.path;
  return (Array.isArray(value)?value:[value]).filter(Boolean).join("/");
}

async function inviteInfo(req,res){
  const inviteToken=clean(req.body?.inviteToken,8000);
  if(!inviteToken){res.status(401).json({error:"NEXUS_ONBOARDING_INVITE_REQUIRED"});return}
  const invite=verifyInviteToken(inviteToken);
  res.json({
    schema:"nexus-person-onboarding-invite-info/v1",
    inviteId:invite.inviteId,
    agency:{agencyId:invite.agencyId||null,name:invite.agency},
    recruiter:{displayName:invite.recruiterName||"Recruiter",jobTitle:invite.recruiterTitle||null},
    suggestedTrade:invite.trade||null,
    suggestedLocation:invite.location||null,
    expiresAt:new Date(Number(invite.expiresAt)).toISOString(),
    verifiedSignedInvite:true,
    serverPersonMutationPerformed:false,
  });
}

async function claim(req,res){
  const inviteToken=clean(req.body?.inviteToken,8000);
  if(!inviteToken){res.status(401).json({error:"NEXUS_ONBOARDING_INVITE_REQUIRED"});return}
  const invite=verifyInviteToken(inviteToken);
  const now=new Date();
  const personId=`person-work-${crypto.randomUUID()}`;
  const stubPersonRecord={
    schema:"nexus-person-draft/v1",id:personId,source:"agency-invite",inviteId:invite.inviteId,
    displayName:"Person Card Draft",firstName:null,lastName:null,primaryRole:invite.trade||null,
    location:invite.location||null,contact:{phone:null,email:null},verification:"unverified-draft",createdAt:now.toISOString(),
  };
  const stubWorkProfileRecord={
    schema:"nexus-person-work-profile/v1",id:`work-profile:${personId}`,personId,version:"server-draft-v1",
    demoMode:false,source:"agency-invite",agency:invite.agency,updatedAt:now.toISOString(),
    availability:{status:"available",label:"Available",availableFrom:null,preferredRadiusKm:40,workAway:false,ownTransport:false,shifts:["day"]},
    preferences:{primaryTrade:invite.trade||"",targetRoles:invite.trade?[invite.trade]:[],locations:invite.location?[invite.location]:[],employmentTypes:["contract","temporary","permanent"],paymentPreferences:[],rate:{amount:null,currency:"GBP",unit:"hour",display:"Open to offers"}},
    readiness:{cv:{state:"missing",source:"onboarding"},certificates:{state:"missing",source:"onboarding"},references:{state:"missing",source:"onboarding"},vault:{state:"not-connected",source:"onboarding"}},
    cvText:"",
  };
  const client=await pool.connect();
  try{
    await client.query("begin");
    await client.query("insert into nexus_pm_people (person_id,display_name,person_type,status,record_json,persisted_at) values ($1,'Person Card Draft','worker','draft',$2::jsonb,$3)",[personId,JSON.stringify(stubPersonRecord),now]);
    const claimed=await client.query(`update nexus_person_onboarding_invites set status='CLAIMED',claimed_person_id=$3,claimed_at=$4 where invite_id=$1 and token_digest=$2 and status='ACTIVE' and claimed_person_id is null and expires_at>$4 returning agency,agency_id,created_by_user_id,expires_at`,[invite.inviteId,digest(inviteToken),personId,now]);
    if(claimed.rows.length!==1){const error=new Error("NEXUS_ONBOARDING_INVITE_NOT_CLAIMABLE");error.status=409;throw error}
    await client.query("insert into nexus_person_work_profiles (person_id,schema_version,status,source_invite_id,record_json,persisted_at) values ($1,'nexus-person-work-profile/v1','draft',$2,$3::jsonb,$4)",[personId,invite.inviteId,JSON.stringify(stubWorkProfileRecord),now]);
    await client.query("insert into nexus_person_work_events (event_id,person_id,invite_id,event_type,actor_type,record_json,persisted_at) values ($1,$2,$3,'PERSON_ONBOARDING_CLAIMED','worker',$4::jsonb,$5)",[`person-work-event-${crypto.randomUUID()}`,personId,invite.inviteId,JSON.stringify({schema:"nexus-person-work-event/v1",inviteId:invite.inviteId,status:"draft",secretsPersisted:false}),now]);
    await client.query("commit");
    const issuedAt=Date.now(),expiresAt=issuedAt+DRAFT_TOKEN_DAYS*24*60*60*1000;
    const draftToken=createDraftToken({schema:"nexus-person-onboarding-draft-token/v1",inviteId:invite.inviteId,personId,issuedAt,expiresAt});
    res.status(201).json({schema:"nexus-person-onboarding-claim/v1",inviteId:invite.inviteId,personId,agency:claimed.rows[0].agency,draftToken,draftTokenExpiresAt:new Date(expiresAt).toISOString(),serverPersonMutationPerformed:true});
  }catch(error){await client.query("rollback");throw error}finally{client.release()}
}

async function loadDraft(req,res){
  const draftToken=clean(req.body?.draftToken,8000);
  if(!draftToken){res.status(401).json({error:"NEXUS_ONBOARDING_DRAFT_TOKEN_REQUIRED"});return}
  const authority=verifyDraftToken(draftToken);
  const result=await query(`select p.record_json as person,p.status as "personStatus",w.record_json as "workProfile",w.status as "workProfileStatus",w.persisted_at as "persistedAt" from nexus_person_work_profiles w join nexus_pm_people p on p.person_id=w.person_id join nexus_person_onboarding_invites i on i.invite_id=w.source_invite_id where p.person_id=$1 and w.source_invite_id=$2 and i.claimed_person_id=$1 and i.status='CLAIMED' limit 2`,[authority.personId,authority.inviteId]);
  if(result.rows.length!==1){res.status(404).json({error:"NEXUS_ONBOARDING_DRAFT_NOT_FOUND"});return}
  const row=result.rows[0];
  res.json({schema:"nexus-person-onboarding-draft-load/v1",personId:authority.personId,person:row.person,workProfile:row.workProfile,personStatus:row.personStatus,workProfileStatus:row.workProfileStatus,persistedAt:new Date(row.persistedAt).toISOString(),serverPersonMutationPerformed:false});
}

async function saveDraft(req,res){
  const draftToken=clean(req.body?.draftToken,8000);
  if(!draftToken){res.status(401).json({error:"NEXUS_ONBOARDING_DRAFT_TOKEN_REQUIRED"});return}
  const authority=verifyDraftToken(draftToken);
  const firstName=clean(req.body?.firstName,80)||"";
  const lastName=clean(req.body?.lastName,80)||"";
  const trade=clean(req.body?.trade,140)||"";
  const location=clean(req.body?.location,140)||"";
  const phone=clean(req.body?.phone,80)||"";
  const email=clean(req.body?.email,160)||"";
  const cvText=rawText(req.body?.cvText,MAX_CV_TEXT);
  const finalize=req.body?.finalize===true;
  const shareWithInvitingAgency=bool(req.body?.shareWithInvitingAgency);
  if(finalize&&(!firstName||!lastName||!trade||!location)){res.status(400).json({error:"NEXUS_ONBOARDING_FINALIZE_FIELDS_REQUIRED",required:["firstName","lastName","trade","location"]});return}
  const experienceYears=finiteInt(req.body?.experienceYears,0,60,0);
  const radius=finiteInt(req.body?.radius,0,500,40);
  const availabilityRaw=clean(req.body?.availability,40)||"available";
  const availability=new Set(["available","busy","from-date"]).has(availabilityRaw)?availabilityRaw:"available";
  const availableFrom=clean(req.body?.availableFrom,40)||"";
  const dayShift=bool(req.body?.dayShift),nightShift=bool(req.body?.nightShift),ownTransport=bool(req.body?.ownTransport),workAway=bool(req.body?.workAway);
  const now=new Date();
  const displayName=[firstName,lastName].filter(Boolean).join(" ")||"Person Card Draft";
  const status=finalize?"active":"draft";
  const availabilityLabel=availability==="busy"?"Busy":availability==="from-date"?"Ready on date":"Available";
  const personRecord={schema:"nexus-person-draft/v1",id:authority.personId,source:"agency-invite",inviteId:authority.inviteId,displayName,firstName:firstName||null,lastName:lastName||null,primaryRole:trade||null,location:location||null,experienceYears,contact:{phone:phone||null,email:email||null},photo:{state:"local-only",serverBinaryPersisted:false},verification:finalize?"unverified":"unverified-draft",updatedAt:now.toISOString()};
  const workProfileRecord={schema:"nexus-person-work-profile/v1",id:`work-profile:${authority.personId}`,personId:authority.personId,version:finalize?"server-active-v1":"server-draft-v1",demoMode:false,source:"agency-invite",updatedAt:now.toISOString(),availability:{status:availability,label:availabilityLabel,availableFrom:availability==="from-date"&&availableFrom?availableFrom:null,preferredRadiusKm:radius,workAway,ownTransport,shifts:[dayShift?"day":null,nightShift?"night":null].filter(Boolean)},preferences:{primaryTrade:trade,targetRoles:trade?[trade]:[],locations:location?[location]:[],employmentTypes:["contract","temporary","permanent"],paymentPreferences:[],rate:{amount:null,currency:"GBP",unit:"hour",display:"Open to offers"}},readiness:{cv:{state:cvText.length>80?"draft":"missing",source:"onboarding"},certificates:{state:"missing",source:"onboarding"},references:{state:"missing",source:"onboarding"},vault:{state:"not-connected",source:"onboarding"}},cvText,visibility:{invitingAgencyRecruiterSafe:finalize&&shareWithInvitingAgency,privateDocumentsShared:false,contactDetailsShared:false,cvTextShared:false}};
  const client=await pool.connect();
  try{
    await client.query("begin");
    const inviteResult=await client.query(`select agency_id as "agencyId",created_by_user_id as "createdByUserId" from nexus_person_onboarding_invites where invite_id=$1 and claimed_person_id=$2 and status='CLAIMED' limit 2 for update`,[authority.inviteId,authority.personId]);
    if(inviteResult.rows.length!==1){const error=new Error("NEXUS_ONBOARDING_DRAFT_AUTHORITY_INVALID");error.status=403;throw error}
    const invite=inviteResult.rows[0];
    const personUpdate=await client.query("update nexus_pm_people set display_name=$2,person_type='worker',status=$3,record_json=$4::jsonb,persisted_at=$5 where person_id=$1 returning person_id",[authority.personId,displayName,status,JSON.stringify(personRecord),now]);
    if(personUpdate.rows.length!==1){const error=new Error("NEXUS_ONBOARDING_PERSON_NOT_FOUND");error.status=404;throw error}
    const profileUpdate=await client.query("update nexus_person_work_profiles set schema_version='nexus-person-work-profile/v1',status=$3,record_json=$4::jsonb,persisted_at=$5 where person_id=$1 and source_invite_id=$2 returning person_id",[authority.personId,authority.inviteId,status,JSON.stringify(workProfileRecord),now]);
    if(profileUpdate.rows.length!==1){const error=new Error("NEXUS_ONBOARDING_WORK_PROFILE_NOT_FOUND");error.status=404;throw error}
    if(finalize&&invite.agencyId){
      if(shareWithInvitingAgency){
        const grantRecord={schema:"nexus-person-agency-access-grant/v1",consent:"explicit",scope:"RECRUITER_SAFE",sourceInviteId:authority.inviteId,invitedByUserId:invite.createdByUserId||null,privateDocumentsIncluded:false,contactDetailsIncluded:false,cvTextIncluded:false};
        await client.query(`insert into nexus_person_agency_access_grants (agency_id,person_id,source_invite_id,scope,status,consent_source,record_json,granted_at,revoked_at,updated_at) values ($1,$2,$3,'RECRUITER_SAFE','ACTIVE','WORKER_INVITE_ONBOARDING',$4::jsonb,$5,null,$5) on conflict (agency_id,person_id) do update set source_invite_id=excluded.source_invite_id,scope='RECRUITER_SAFE',status='ACTIVE',consent_source='WORKER_INVITE_ONBOARDING',record_json=excluded.record_json,granted_at=excluded.granted_at,revoked_at=null,updated_at=excluded.updated_at`,[invite.agencyId,authority.personId,authority.inviteId,JSON.stringify(grantRecord),now]);
      }else{
        await client.query("update nexus_person_agency_access_grants set status='REVOKED',revoked_at=$3,updated_at=$3 where agency_id=$1 and person_id=$2",[invite.agencyId,authority.personId,now]);
      }
    }
    const eventRecord={schema:"nexus-person-work-event/v1",inviteId:authority.inviteId,personStatus:status,workProfileStatus:status,shareWithInvitingAgency:finalize?shareWithInvitingAgency:null,agencyAccessScope:finalize&&shareWithInvitingAgency&&invite.agencyId?"RECRUITER_SAFE":"NONE",secretsPersisted:false};
    await client.query("insert into nexus_person_work_events (event_id,person_id,invite_id,event_type,actor_type,record_json,persisted_at) values ($1,$2,$3,$4,'worker',$5::jsonb,$6)",[`person-work-event-${crypto.randomUUID()}`,authority.personId,authority.inviteId,finalize?"PERSON_WORK_PROFILE_FINALIZED":"PERSON_WORK_PROFILE_DRAFT_SAVED",JSON.stringify(eventRecord),now]);
    await client.query("commit");
    res.json({schema:"nexus-person-onboarding-draft-save/v1",personId:authority.personId,status:finalize?"ACTIVE":"DRAFT",persistedAt:now.toISOString(),serverPersonMutationPerformed:true,photoBinaryPersisted:false,agencyRecruiterSafeAccess:finalize&&shareWithInvitingAgency?"GRANTED":"NOT_GRANTED",privateDocumentsShared:false});
  }catch(error){await client.query("rollback");throw error}finally{client.release()}
}

export default async function handler(req,res){
  if(!applyCors(req,res))return;
  if(req.method==="OPTIONS"){res.status(204).end();return}
  const action=actionFrom(req);
  try{
    if(req.method==="GET"&&action==="_health"){
      res.json({schema:"nexus-person-onboarding-health/v1",status:"ok",inviteSigningConfigured:Boolean(process.env.NEXUS_ONBOARDING_INVITE_SECRET?.trim()),draftSigningConfigured:Boolean((process.env.NEXUS_ONBOARDING_DRAFT_SECRET||process.env.NEXUS_ONBOARDING_INVITE_SECRET)?.trim()),personPersistenceConfigured:Boolean(process.env.DATABASE_URL?.trim()),standaloneWorkerHandoff:true});return;
    }
    if(req.method!=="POST"){res.status(405).json({error:"METHOD_NOT_ALLOWED"});return}
    if(action==="invite-info"){await inviteInfo(req,res);return}
    if(action==="claim"){await claim(req,res);return}
    if(action==="drafts/load"){await loadDraft(req,res);return}
    if(action==="drafts/save"){await saveDraft(req,res);return}
    if(action==="ai-prefill"){res.status(503).json({error:"NEXUS_ONBOARDING_AI_NOT_CONFIGURED_IN_RUNTIME"});return}
    res.status(404).json({error:"NEXUS_ONBOARDING_ROUTE_NOT_FOUND"});
  }catch(error){console.error("NOSMO onboarding runtime error",error);sendError(res,error,"NEXUS_ONBOARDING_INTERNAL_ERROR")}
}
