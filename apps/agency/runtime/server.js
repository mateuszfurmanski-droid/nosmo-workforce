import { installAgencyCompat } from "./compat.js";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import pg from "pg";
import * as oidc from "openid-client";

const {Pool}=pg;
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined});
const SESSION_COOKIE="sid";
const SESSION_TTL_MS=7*24*60*60*1000;
const OIDC_COOKIE_TTL_MS=10*60*1000;
const ISSUER_URL=process.env.ISSUER_URL||"https://replit.com/oidc";
const OIDC_CLIENT_ID=process.env.OIDC_CLIENT_ID||process.env.REPL_ID||"";
const REQUEST_STATUSES=new Set(["DRAFT","OPEN","PAUSED","FILLED","CANCELLED"]);
const APPLICATION_STAGES=new Set(["NEW","SHORTLISTED","CONTACTED","INTERESTED","SUBMITTED","INTERVIEW","OFFERED","PLACED","REJECTED","WITHDRAWN"]);
const READINESS_STATUSES=new Set(["READY","CHECK","BLOCKED"]);
let oidcConfig=null;

app.disable("x-powered-by");
app.set("trust proxy",1);
app.use(cookieParser());
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:false,limit:"256kb"}));

function clean(value,max=180){
  if(typeof value!=="string") return undefined;
  const out=value.replace(/\s+/g," ").trim();
  return out?out.slice(0,max):undefined;
}
function record(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}
function array(value,max=32){return Array.isArray(value)?value.map((v)=>clean(String(v),180)).filter(Boolean).slice(0,max):[]}
function rows(result){return result?.rows||[]}
function uuid(prefix){return `${prefix}-${crypto.randomUUID()}`}
function normalizeEmail(value){const v=clean(value,240)?.toLowerCase();return v&&v.includes("@")?v:null}
function normalizePhone(value){const v=clean(value,80);if(!v)return null;const lead=v.trim().startsWith("+")?"+":"";const digits=v.replace(/\D/g,"");return digits.length>=7?lead+digits:null}
function norm(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function nameLocationKey(name,location){return `${norm(name)}|${norm(location)}`.slice(0,360)}
function bool(value){return value===true||String(value).toLowerCase()==="true"}
function safeInt(value,fallback=1,max=10000){const n=Number.parseInt(String(value??""),10);return Number.isFinite(n)&&n>0?Math.min(n,max):fallback}
function safeNumber(value){if(value===null||value===undefined||value==="")return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}

function getOrigin(req){
  const proto=String(req.headers["x-forwarded-proto"]||req.protocol||"https").split(",")[0].trim();
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}
function safeReturnTo(value){return typeof value==="string"&&value.startsWith("/")&&!value.startsWith("//")?value:"/"}
function setCookie(res,name,value,maxAge){res.cookie(name,value,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge})}
function sameOrigin(req){
  const expected=getOrigin(req);
  const source=req.headers.origin||req.headers.referer;
  if(!source)return false;
  try{return new URL(String(source)).origin===expected}catch{return false}
}
async function getOidc(){
  if(!OIDC_CLIENT_ID)throw new Error("OIDC_CLIENT_ID_REQUIRED");
  if(!oidcConfig)oidcConfig=await oidc.discovery(new URL(ISSUER_URL),OIDC_CLIENT_ID);
  return oidcConfig;
}
async function query(text,params=[]){return pool.query(text,params)}
async function createSession(data){
  const sid=crypto.randomBytes(32).toString("hex");
  await query("insert into sessions (sid,sess,expire) values ($1,$2::jsonb,$3)",[sid,JSON.stringify(data),new Date(Date.now()+SESSION_TTL_MS)]);
  return sid;
}
async function deleteSession(sid){if(sid)await query("delete from sessions where sid=$1",[sid])}
async function getSession(sid){
  if(!sid)return null;
  const result=await query("select sess,expire from sessions where sid=$1 limit 1",[sid]);
  const row=result.rows[0];
  if(!row)return null;
  if(new Date(row.expire).getTime()<Date.now()){await deleteSession(sid);return null}
  return row.sess;
}
async function updateSession(sid,data){await query("update sessions set sess=$2::jsonb,expire=$3 where sid=$1",[sid,JSON.stringify(data),new Date(Date.now()+SESSION_TTL_MS)])}
function sessionId(req){const auth=req.headers.authorization;return auth?.startsWith("Bearer ")?auth.slice(7):req.cookies?.[SESSION_COOKIE]}
async function authMiddleware(req,res,next){
  req.user=null;
  req.isAuthenticated=()=>Boolean(req.user?.id);
  const sid=sessionId(req);
  if(!sid){next();return}
  let session=await getSession(sid);
  if(!session?.user?.id){res.clearCookie(SESSION_COOKIE,{path:"/"});next();return}
  const now=Math.floor(Date.now()/1000);
  if(session.expires_at&&now>session.expires_at){
    if(!session.refresh_token){await deleteSession(sid);res.clearCookie(SESSION_COOKIE,{path:"/"});next();return}
    try{
      const config=await getOidc();
      const tokens=await oidc.refreshTokenGrant(config,session.refresh_token);
      session={...session,access_token:tokens.access_token,refresh_token:tokens.refresh_token||session.refresh_token,expires_at:tokens.expiresIn()?now+tokens.expiresIn():session.expires_at};
      await updateSession(sid,session);
    }catch{await deleteSession(sid);res.clearCookie(SESSION_COOKIE,{path:"/"});next();return}
  }
  req.user=session.user;
  next();
}
app.use(authMiddleware);

async function upsertUser(claims){
  const user={id:String(claims.sub),email:clean(claims.email,240)||null,firstName:clean(claims.first_name,120)||null,lastName:clean(claims.last_name,120)||null,profileImageUrl:clean(claims.profile_image_url||claims.picture,500)||null};
  const result=await query(`insert into users (id,email,first_name,last_name,profile_image_url,created_at,updated_at)
    values ($1,$2,$3,$4,$5,now(),now())
    on conflict (id) do update set email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name,profile_image_url=excluded.profile_image_url,updated_at=now()
    returning id,email,first_name as "firstName",last_name as "lastName",profile_image_url as "profileImageUrl"`,[user.id,user.email,user.firstName,user.lastName,user.profileImageUrl]);
  return result.rows[0];
}

app.get("/api/auth/user",(req,res)=>res.json({user:req.isAuthenticated()?req.user:null}));
app.get("/api/login",async(req,res)=>{
  try{
    const config=await getOidc();
    const callbackUrl=`${getOrigin(req)}/api/callback`;
    const state=oidc.randomState(),nonce=oidc.randomNonce(),codeVerifier=oidc.randomPKCECodeVerifier();
    const codeChallenge=await oidc.calculatePKCECodeChallenge(codeVerifier);
    const redirectTo=oidc.buildAuthorizationUrl(config,{redirect_uri:callbackUrl,scope:"openid email profile offline_access",code_challenge:codeChallenge,code_challenge_method:"S256",prompt:"login consent",state,nonce});
    setCookie(res,"agency_code_verifier",codeVerifier,OIDC_COOKIE_TTL_MS);
    setCookie(res,"agency_nonce",nonce,OIDC_COOKIE_TTL_MS);
    setCookie(res,"agency_state",state,OIDC_COOKIE_TTL_MS);
    setCookie(res,"agency_return_to",safeReturnTo(req.query.returnTo),OIDC_COOKIE_TTL_MS);
    res.redirect(redirectTo.href);
  }catch(error){console.error("Agency login init failed",error);res.status(503).send("NOSMO Agency sign-in is not configured.")}
});
app.get("/api/callback",async(req,res)=>{
  const verifier=req.cookies?.agency_code_verifier,nonce=req.cookies?.agency_nonce,expectedState=req.cookies?.agency_state;
  if(!verifier||!expectedState){res.redirect("/api/login");return}
  try{
    const config=await getOidc();
    const callbackUrl=`${getOrigin(req)}/api/callback`;
    const currentUrl=new URL(callbackUrl);Object.entries(req.query).forEach(([k,v])=>{if(typeof v==="string")currentUrl.searchParams.set(k,v)});
    const tokens=await oidc.authorizationCodeGrant(config,currentUrl,{pkceCodeVerifier:verifier,expectedNonce:nonce||undefined,expectedState,idTokenExpected:true});
    const claims=tokens.claims();if(!claims)throw new Error("OIDC_NO_CLAIMS");
    const user=await upsertUser(claims);
    const now=Math.floor(Date.now()/1000);
    const sid=await createSession({user,access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_at:tokens.expiresIn()?now+tokens.expiresIn():claims.exp});
    setCookie(res,SESSION_COOKIE,sid,SESSION_TTL_MS);
    const returnTo=safeReturnTo(req.cookies?.agency_return_to);
    for(const name of ["agency_code_verifier","agency_nonce","agency_state","agency_return_to"])res.clearCookie(name,{path:"/"});
    res.redirect(returnTo);
  }catch(error){console.error("Agency callback failed",error);res.status(401).send("NOSMO Agency sign-in failed. Please return and try again.")}
});
app.post("/api/logout",async(req,res)=>{
  if(!sameOrigin(req)){res.status(403).json({error:"FORBIDDEN"});return}
  const sid=sessionId(req);await deleteSession(sid);res.clearCookie(SESSION_COOKIE,{path:"/"});
  try{const config=await getOidc();const redirect=oidc.buildEndSessionUrl(config,{client_id:OIDC_CLIENT_ID,post_logout_redirect_uri:getOrigin(req)});res.json({redirectUrl:redirect.href})}
  catch{res.json({redirectUrl:"/"})}
});

async function agencyContext(userId){
  const result=await query(`select a.agency_id as "agencyId",a.name,a.website,a.registration_number as "registrationNumber",a.location,a.description,a.verification_status as "verificationStatus",m.role
    from nexus_person_agency_members m join nexus_person_agencies a on a.agency_id=m.agency_id
    where m.auth_user_id=$1 and m.status='ACTIVE' and a.status='ACTIVE' limit 2`,[userId]);
  return result.rows.length===1?result.rows[0]:null;
}
async function requireAgency(req,res){
  if(!req.isAuthenticated()){res.status(401).json({error:"NEXUS_AUTH_REQUIRED"});return null}
  const agency=await agencyContext(req.user.id);if(!agency){res.status(404).json({error:"NEXUS_AGENCY_ACCOUNT_REQUIRED",canCreate:true});return null}return agency;
}

app.get("/api/person-card/agency/v1/_health",async(_req,res)=>{
  const tables=["users","sessions","nexus_person_agencies","nexus_person_agency_members","nexus_person_agency_recruiter_profiles","nexus_person_agency_access_grants","nexus_person_agency_candidate_states","nexus_person_agency_actions","nexus_person_agency_roster_workers","nexus_person_agency_roster_events","nexus_person_agency_requests","nexus_person_agency_applications","nexus_person_agency_pipeline_events","nexus_person_agency_placements","nexus_person_work_profiles","nexus_pm_people"];
  try{
    const result=await query("select unnest($1::text[]) as name, to_regclass('public.'||unnest($1::text[]))::text as reg",[tables]);
    const present=new Set(result.rows.filter((r)=>r.reg).map((r)=>r.name));
    const missingTables=tables.filter((t)=>!present.has(t));
    res.status(missingTables.length?503:200).json({schema:"nosmo-agency-v1-health/v1",status:missingTables.length?"database-migration-required":"ok",databaseReady:missingTables.length===0,missingTables,standalone:true,tenantScopeSource:"authenticated-agency-membership",recruiterSafeConsentGate:true,importedRosterSupported:true,jobsPipelineSupported:true,placementsSupported:true,askNexusTenantContextSupported:true});
  }catch(error){console.error(error);res.status(503).json({schema:"nosmo-agency-v1-health/v1",status:"database-unavailable",databaseReady:false,missingTables:tables})}
});

app.get("/api/person-card/agency/account",async(req,res)=>{
  if(!req.isAuthenticated()){res.status(401).json({error:"NEXUS_AUTH_REQUIRED"});return}
  const agency=await agencyContext(req.user.id);if(!agency){res.status(404).json({error:"NEXUS_AGENCY_ACCOUNT_REQUIRED",canCreate:true});return}
  res.json({schema:"nexus-person-agency-account/v1",agency:{...agency,status:"ACTIVE"}});
});
app.post("/api/person-card/agency/account",async(req,res)=>{
  if(!req.isAuthenticated()){res.status(401).json({error:"NEXUS_AUTH_REQUIRED"});return}
  const name=clean(req.body?.agencyName,160);if(!name){res.status(400).json({error:"NEXUS_AGENCY_NAME_REQUIRED"});return}
  const existing=await agencyContext(req.user.id);
  if(existing){await query("update nexus_person_agencies set name=$2,updated_at=now() where agency_id=$1",[existing.agencyId,name]);res.json({schema:"nexus-person-agency-account/v1",agency:{...existing,name,status:"ACTIVE"},created:false});return}
  const agencyId=uuid("agency");
  const client=await pool.connect();
  try{
    await client.query("begin");
    await client.query("insert into nexus_person_agencies (agency_id,name,status,created_by_user_id,created_at,updated_at) values ($1,$2,'ACTIVE',$3,now(),now())",[agencyId,name,req.user.id]);
    await client.query("insert into nexus_person_agency_members (auth_user_id,agency_id,role,status,joined_at) values ($1,$2,'OWNER','ACTIVE',now())",[req.user.id,agencyId]);
    const display=[req.user.firstName,req.user.lastName].filter(Boolean).join(" ").trim()||req.user.email||"Recruiter";
    await client.query("insert into nexus_person_agency_recruiter_profiles (auth_user_id,agency_id,display_name,job_title,email,photo_url,verification_status,updated_at) values ($1,$2,$3,'Recruiter',$4,$5,'UNVERIFIED',now())",[req.user.id,agencyId,display,req.user.email||null,req.user.profileImageUrl||null]);
    await client.query("commit");res.status(201).json({schema:"nexus-person-agency-account/v1",agency:{agencyId,name,role:"OWNER",status:"ACTIVE"},created:true});
  }catch(error){await client.query("rollback");throw error}finally{client.release()}
});

app.get("/api/person-card/agency/profile",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;
  const result=await query(`select display_name as "displayName",job_title as "jobTitle",phone,email,bio,photo_url as "photoUrl",verification_status as "verificationStatus",updated_at as "updatedAt" from nexus_person_agency_recruiter_profiles where auth_user_id=$1 and agency_id=$2 limit 1`,[req.user.id,agency.agencyId]);
  const recruiter=result.rows[0]||{displayName:[req.user.firstName,req.user.lastName].filter(Boolean).join(" ").trim()||req.user.email||"Recruiter",jobTitle:null,phone:null,email:req.user.email||null,bio:null,photoUrl:req.user.profileImageUrl||null,verificationStatus:"UNVERIFIED",updatedAt:null};
  res.json({schema:"nexus-person-agency-profile/v1",agency,recruiter:{...recruiter,profileComplete:Boolean(clean(recruiter.displayName)&&clean(recruiter.jobTitle))}});
});
app.patch("/api/person-card/agency/profile",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;
  const a=record(req.body?.agency),r=record(req.body?.recruiter);
  if(agency.role==="OWNER"||agency.role==="ADMIN"){
    await query(`update nexus_person_agencies set name=coalesce($2,name),website=$3,registration_number=$4,location=$5,description=$6,updated_at=now() where agency_id=$1`,[agency.agencyId,clean(a.name,160)||null,clean(a.website,240)||null,clean(a.registrationNumber,120)||null,clean(a.location,180)||null,clean(a.description,800)||null]);
  }
  const displayName=clean(r.displayName,160)||[req.user.firstName,req.user.lastName].filter(Boolean).join(" ").trim()||req.user.email||"Recruiter";
  await query(`insert into nexus_person_agency_recruiter_profiles (auth_user_id,agency_id,display_name,job_title,phone,email,bio,photo_url,verification_status,updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,'UNVERIFIED',now())
    on conflict (auth_user_id) do update set agency_id=excluded.agency_id,display_name=excluded.display_name,job_title=excluded.job_title,phone=excluded.phone,email=excluded.email,bio=excluded.bio,photo_url=excluded.photo_url,updated_at=now()`,[req.user.id,agency.agencyId,displayName,clean(r.jobTitle,120)||null,clean(r.phone,80)||null,clean(r.email,160)||req.user.email||null,clean(r.bio,800)||null,clean(r.photoUrl,500)||req.user.profileImageUrl||null]);
  const refreshed=await agencyContext(req.user.id);
  res.json({schema:"nexus-person-agency-profile-updated/v1",agency:refreshed,recruiter:{displayName,jobTitle:clean(r.jobTitle,120)||null,phone:clean(r.phone,80)||null,email:clean(r.email,160)||req.user.email||null,bio:clean(r.bio,800)||null,photoUrl:clean(r.photoUrl,500)||req.user.profileImageUrl||null,verificationStatus:"UNVERIFIED",updatedAt:new Date().toISOString()}});
});

function safeCandidate(row){
  const person=record(row.personRecord),work=record(row.workRecord),availability=record(work.availability),preferences=record(work.preferences),rate=record(preferences.rate),readiness=record(work.readiness);
  const locations=array(preferences.locations,8);if(!locations.length&&clean(person.location,160))locations.push(clean(person.location,160));
  const readyState=(v)=>clean(record(v).state,40)||"unknown";
  return {schema:"nexus-agency-candidate-safe/v1",personId:row.personId,displayName:row.displayName,primaryTrade:clean(preferences.primaryTrade,160)||clean(person.primaryRole,160)||"Not set",locations,experienceYears:Number.isFinite(Number(person.experienceYears))?Number(person.experienceYears):null,verification:clean(person.verification,80)||"unverified",availability:{status:clean(availability.status,60)||"unknown",label:clean(availability.label,80)||clean(availability.status,80)||"Unknown",availableFrom:clean(availability.availableFrom,40)||null,workAway:availability.workAway===true,ownTransport:availability.ownTransport===true,shifts:array(availability.shifts,8)},preferences:{targetRoles:array(preferences.targetRoles,12),employmentTypes:array(preferences.employmentTypes,12),rate:{display:clean(rate.display,120)||"Not set",currency:clean(rate.currency,12)||null,unit:clean(rate.unit,24)||null}},readiness:{cv:readyState(readiness.cv),certificates:readyState(readiness.certificates),references:readyState(readiness.references)},pipeline:{stage:row.stage||"NEW",note:row.note||null,updatedAt:row.stateUpdatedAt||null},profileUpdatedAt:row.persistedAt||null,privateFieldsIncluded:false};
}
async function connectedRows(agencyId){
  const result=await query(`select p.person_id as "personId",p.display_name as "displayName",p.record_json as "personRecord",w.record_json as "workRecord",w.persisted_at as "persistedAt",s.stage,s.note,s.updated_at as "stateUpdatedAt"
    from nexus_person_work_profiles w join nexus_pm_people p on p.person_id=w.person_id
    join nexus_person_agency_access_grants g on g.person_id=p.person_id and g.agency_id=$1 and g.status='ACTIVE' and g.scope='RECRUITER_SAFE'
    left join nexus_person_agency_candidate_states s on s.person_id=p.person_id and s.agency_id=$1
    where p.person_type='worker' and p.status='active' and w.status='active' order by w.persisted_at desc`,[agencyId]);
  return result.rows;
}
app.get("/api/person-card/agency/candidates",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const q=norm(req.query.q);let candidates=(await connectedRows(agency.agencyId)).map(safeCandidate);if(q)candidates=candidates.filter((c)=>norm([c.displayName,c.primaryTrade,...c.locations,...c.preferences.targetRoles].join(" ")).includes(q));res.json({schema:"nexus-person-agency-candidate-list/v1",agency:{agencyId:agency.agencyId,name:agency.name},candidates,count:candidates.length,recruiterSafeProjection:true});
});
app.post("/api/person-card/agency/candidates/:personId/actions",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const personId=clean(req.params.personId,180),actionType=clean(req.body?.actionType,60)?.toUpperCase();
  const allowed=new Set(["PROFILE_VIEWED","SHORTLISTED","REMOVED_FROM_SHORTLIST","REQUEST_PACK_DRAFTED","OFFER_DRAFTED","CONTACTED","SHARED"]);if(!personId||!allowed.has(actionType)){res.status(400).json({error:"NEXUS_AGENCY_ACTION_INVALID"});return}
  const visible=(await connectedRows(agency.agencyId)).some((r)=>r.personId===personId);if(!visible){res.status(404).json({error:"NEXUS_AGENCY_CANDIDATE_NOT_FOUND"});return}
  const details=record(req.body?.details),actionId=uuid("agency-action");
  await query("insert into nexus_person_agency_actions (action_id,agency_id,person_id,actor_user_id,action_type,record_json,created_at) values ($1,$2,$3,$4,$5,$6::jsonb,now())",[actionId,agency.agencyId,personId,req.user.id,actionType,JSON.stringify({schema:"nexus-person-agency-action/v1",purpose:clean(details.purpose,240)||null,summary:clean(details.summary,240)||null,privateDocumentsIncluded:false})]);
  const nextStage=actionType==="SHORTLISTED"?"SHORTLISTED":actionType==="REMOVED_FROM_SHORTLIST"?"NEW":actionType==="CONTACTED"?"CONTACTED":actionType==="REQUEST_PACK_DRAFTED"?"REQUESTED":actionType==="OFFER_DRAFTED"?"OFFERED":null;
  if(nextStage)await query(`insert into nexus_person_agency_candidate_states (agency_id,person_id,stage,updated_by_user_id,updated_at) values ($1,$2,$3,$4,now()) on conflict (agency_id,person_id) do update set stage=excluded.stage,updated_by_user_id=excluded.updated_by_user_id,updated_at=now()`,[agency.agencyId,personId,nextStage,req.user.id]);
  res.status(201).json({schema:"nexus-person-agency-action-created/v1",actionId,personId,actionType,nextStage,privateDocumentsIncluded:false});
});
app.get("/api/person-card/agency/activity",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const limit=Math.min(100,safeInt(req.query.limit,50,100));
  const result=await query(`select a.action_id as "actionId",a.person_id as "personId",p.display_name as "displayName",a.action_type as "actionType",a.record_json as details,a.created_at as "createdAt" from nexus_person_agency_actions a join nexus_pm_people p on p.person_id=a.person_id where a.agency_id=$1 order by a.created_at desc limit $2`,[agency.agencyId,limit]);res.json({schema:"nexus-person-agency-activity/v1",agency:{agencyId:agency.agencyId,name:agency.name},activity:result.rows});
});

app.get("/api/person-card/agency/v1/dashboard",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;
  const summary=await query(`select
    (select count(*)::int from nexus_person_agency_roster_workers where agency_id=$1 and status='ACTIVE') as "rosterWorkers",
    (select count(*)::int from nexus_person_agency_access_grants where agency_id=$1 and status='ACTIVE' and scope='RECRUITER_SAFE') as "consentedWorkers",
    (select count(*)::int from nexus_person_agency_requests where agency_id=$1 and status='OPEN') as "openRequests",
    (select count(*)::int from nexus_person_agency_applications where agency_id=$1 and stage not in ('PLACED','REJECTED','WITHDRAWN')) as "candidatesInPipeline",
    (select count(*)::int from nexus_person_agency_applications where agency_id=$1 and readiness_status in ('CHECK','BLOCKED')) as "readinessAttention",
    (select count(*)::int from nexus_person_agency_placements where agency_id=$1 and status in ('PLACED','STARTED')) as "livePlacements"`,[agency.agencyId]);
  const pipeline=await query("select stage,count(*)::int as count from nexus_person_agency_applications where agency_id=$1 group by stage order by stage",[agency.agencyId]);
  res.json({schema:"nosmo-agency-dashboard/v1",agency:{agencyId:agency.agencyId,name:agency.name,role:agency.role,verificationStatus:agency.verificationStatus},summary:summary.rows[0]||{},pipeline:pipeline.rows,privacy:{workerOwnedDataRequiresConsent:true,recruiterSafeScope:"RECRUITER_SAFE",importedRosterIsAgencyOwned:true}});
});
app.get("/api/person-card/agency/v1/roster",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const q=norm(req.query.q),limit=Math.min(200,safeInt(req.query.limit,100,200));
  const result=await query(`select roster_worker_id as "rosterWorkerId",display_name as "displayName",record_json->>'trade' as trade,record_json->>'location' as location,record_json->'availability'->>'status' as "availabilityStatus",record_json->'availability'->>'availableFrom' as "availableFrom",record_json->'skills' as skills,record_json->'licences' as licences,record_json->>'expectedRate' as "expectedRate",connection_status as "connectionStatus",coalesce((record_json->>'workerAppConfirmed')::boolean,false) as "workerAppConfirmed",updated_at as "updatedAt" from nexus_person_agency_roster_workers where agency_id=$1 and status='ACTIVE' order by updated_at desc,display_name asc limit $2`,[agency.agencyId,limit]);
  let workers=result.rows;if(q)workers=workers.filter((w)=>norm([w.displayName,w.trade,w.location,JSON.stringify(w.skills),JSON.stringify(w.licences)].join(" ")).includes(q));res.json({schema:"nosmo-agency-roster-list/v1",agency:{agencyId:agency.agencyId,name:agency.name},workers,count:workers.length,contactValuesIncluded:false,importedRosterIsAgencyOwned:true});
});
app.post("/api/person-card/agency/v1/roster/import",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const input=Array.isArray(req.body?.records)?req.body.records.slice(0,500):[];if(!input.length){res.status(400).json({error:"NEXUS_AGENCY_IMPORT_RECORDS_REQUIRED"});return}
  const client=await pool.connect();let created=0,updated=0,skipped=0;const issues=[];
  try{
    await client.query("begin");
    for(let i=0;i<input.length;i++){
      const raw=record(input[i]),displayName=clean(raw.displayName||raw.name,160),location=clean(raw.location,180)||"Unknown",trade=clean(raw.trade||raw.role,160)||"Not set";
      if(!displayName){skipped++;issues.push({row:i+1,error:"DISPLAY_NAME_REQUIRED"});continue}
      const email=normalizeEmail(raw.email),phone=normalizePhone(raw.phone),key=nameLocationKey(displayName,location);
      const matches=await client.query(`select roster_worker_id from nexus_person_agency_roster_workers where agency_id=$1 and status='ACTIVE' and (($2::text is not null and normalized_email=$2) or ($3::text is not null and normalized_phone=$3) or name_location_key=$4) limit 3`,[agency.agencyId,email,phone,key]);
      if(matches.rows.length>1){skipped++;issues.push({row:i+1,error:"AMBIGUOUS_DUPLICATE"});continue}
      const availabilityStatus=clean(raw.availabilityStatus||record(raw.availability).status,60)||"Unknown",availableFrom=clean(raw.availableFrom||record(raw.availability).availableFrom,40)||null;
      const data={schema:"nosmo-agency-roster-worker/v1",trade,location,availability:{status:availabilityStatus,availableFrom},skills:array(raw.skills,32),licences:array(raw.licences||raw.licenses,32),expectedRate:clean(raw.expectedRate||raw.rate,120)||null,workerAppConfirmed:false,recruiterSafeSharing:"NOT_CONNECTED",importSource:clean(req.body?.source,120)||"FILE_IMPORT",importedAt:new Date().toISOString()};
      let rosterWorkerId;
      if(matches.rows.length===1){rosterWorkerId=matches.rows[0].roster_worker_id;await client.query(`update nexus_person_agency_roster_workers set display_name=$3,normalized_email=$4,normalized_phone=$5,name_location_key=$6,record_json=$7::jsonb,private_note=$8,updated_by_user_id=$2,updated_at=now() where agency_id=$1 and roster_worker_id=$9`,[agency.agencyId,req.user.id,displayName,email,phone,key,JSON.stringify(data),clean(raw.privateNote,500)||null,rosterWorkerId]);updated++}
      else{rosterWorkerId=uuid("roster");await client.query(`insert into nexus_person_agency_roster_workers (roster_worker_id,agency_id,display_name,normalized_email,normalized_phone,name_location_key,record_json,private_note,connection_status,status,created_by_user_id,updated_by_user_id,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'IMPORTED','ACTIVE',$9,$9,now(),now())`,[rosterWorkerId,agency.agencyId,displayName,email,phone,key,JSON.stringify(data),clean(raw.privateNote,500)||null,req.user.id]);created++}
      await client.query("insert into nexus_person_agency_roster_events (event_id,agency_id,roster_worker_id,actor_user_id,event_type,record_json,created_at) values ($1,$2,$3,$4,$5,$6::jsonb,now())",[uuid("roster-event"),agency.agencyId,rosterWorkerId,req.user.id,matches.rows.length?"IMPORT_UPDATED":"IMPORTED",JSON.stringify({schema:"nosmo-agency-roster-event/v1",source:data.importSource,demo:bool(req.body?.demo)})]);
    }
    await client.query("commit");res.status(201).json({schema:"nosmo-agency-roster-import-result/v1",created,updated,skipped,issues,tenantScoped:true,workerAppConfirmed:false});
  }catch(error){await client.query("rollback");console.error(error);res.status(409).json({error:"NEXUS_AGENCY_IMPORT_FAILED",detail:clean(error.message,240)})}finally{client.release()}
});

app.get("/api/person-card/agency/v1/requests",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const status=clean(req.query.status,24)?.toUpperCase();const params=[agency.agencyId];let where="agency_id=$1";if(status&&REQUEST_STATUSES.has(status)){params.push(status);where+=" and status=$2"}
  const result=await query(`select request_id as "requestId",role,client_name as "clientName",location,status,headcount,record_json as details,published_at as "publishedAt",created_at as "createdAt",updated_at as "updatedAt" from nexus_person_agency_requests where ${where} order by updated_at desc limit 200`,params);res.json({schema:"nosmo-agency-request-list/v1",agency:{agencyId:agency.agencyId,name:agency.name},requests:result.rows});
});
app.post("/api/person-card/agency/v1/requests",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const role=clean(req.body?.role,160),clientName=clean(req.body?.clientName,180),location=clean(req.body?.location,180),status=clean(req.body?.status,24)?.toUpperCase()||"DRAFT",headcount=safeInt(req.body?.headcount,1);
  if(!role||!clientName||!location||!REQUEST_STATUSES.has(status)){res.status(400).json({error:"NEXUS_AGENCY_REQUEST_INVALID"});return}
  const details={schema:"nosmo-agency-request/v1",startDate:clean(req.body?.startDate,32)||null,requiredSkills:array(req.body?.requiredSkills),requiredLicences:array(req.body?.requiredLicences),preferences:record(req.body?.preferences),rates:record(req.body?.rates),matchPolicy:{explainable:true,factors:["trade","skills","licences","location","availability","experience","preferences"]}};
  const requestId=uuid("agency-request");await query(`insert into nexus_person_agency_requests (request_id,agency_id,role,client_name,location,status,headcount,record_json,created_by_user_id,updated_by_user_id,published_at,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9,$10,now(),now())`,[requestId,agency.agencyId,role,clientName,location,status,headcount,JSON.stringify(details),req.user.id,status==="OPEN"?new Date():null]);res.status(201).json({schema:"nosmo-agency-request-created/v1",request:{requestId,role,clientName,location,status,headcount,details}});
});

function candidateFactsFromRoster(row){const r=record(row.record_json),a=record(r.availability);return {kind:"roster",id:row.roster_worker_id,name:row.display_name,trade:clean(r.trade,160)||"",location:clean(r.location,180)||"",availability:clean(a.status,60)||"Unknown",availableFrom:clean(a.availableFrom,40)||null,skills:array(r.skills),licences:array(r.licences),targetRoles:[],experienceYears:null}}
function candidateFactsFromConnected(row){const p=record(row.personRecord),w=record(row.workRecord),a=record(w.availability),pref=record(w.preferences);return {kind:"person",id:row.personId,name:row.displayName,trade:clean(pref.primaryTrade,160)||clean(p.primaryRole,160)||"",location:array(pref.locations,8).join(" · ")||clean(p.location,180)||"",availability:clean(a.label,60)||clean(a.status,60)||"Unknown",availableFrom:clean(a.availableFrom,40)||null,skills:array(w.skills||pref.skills||p.skills),licences:array(w.licences||w.licenses||pref.licences||p.licences),targetRoles:array(pref.targetRoles),experienceYears:Number.isFinite(Number(p.experienceYears))?Number(p.experienceYears):null}}
function matchFacts(candidate,requestRow){
  const details=record(requestRow.details),requiredSkills=array(details.requiredSkills),requiredLicences=array(details.requiredLicences),reasons=[],gaps=[];let blocked=false;
  const roleTerms=[candidate.trade,...candidate.targetRoles].map(norm);const role=norm(requestRow.role);const roleMatch=roleTerms.some((v)=>v&&(v.includes(role)||role.includes(v)));if(roleMatch)reasons.push(`Trade/role aligns with ${requestRow.role}`);else gaps.push(`Role match to ${requestRow.role} is not explicit`);
  const loc=norm(candidate.location),targetLoc=norm(requestRow.location);if(loc&&targetLoc&&(loc.includes(targetLoc)||targetLoc.includes(loc)))reasons.push(`Location aligns with ${requestRow.location}`);else gaps.push(`Location match to ${requestRow.location} needs review`);
  const skillSet=candidate.skills.map(norm),licSet=candidate.licences.map(norm);
  const missingSkills=requiredSkills.filter((need)=>!skillSet.some((have)=>have.includes(norm(need))||norm(need).includes(have)));if(missingSkills.length)gaps.push(`Missing/unconfirmed skills: ${missingSkills.join(", ")}`);else if(requiredSkills.length)reasons.push("Required skills are recorded");
  const missingLicences=requiredLicences.filter((need)=>!licSet.some((have)=>have.includes(norm(need))||norm(need).includes(have)));if(missingLicences.length){gaps.push(`Missing/unconfirmed licences: ${missingLicences.join(", ")}`);blocked=true}else if(requiredLicences.length)reasons.push("Required licences are recorded");
  const availability=norm(candidate.availability),start=clean(details.startDate,32);if(availability.includes("available")){reasons.push("Marked available")}else if(availability.includes("ready")){if(!start||!candidate.availableFrom||candidate.availableFrom<=start)reasons.push(`Ready from ${candidate.availableFrom||"recorded date"}`);else{gaps.push(`Ready from ${candidate.availableFrom}, after requested start ${start}`);blocked=true}}else if(availability.includes("busy")||availability.includes("unavailable")){gaps.push(`Availability is ${candidate.availability}`);blocked=true}else gaps.push("Availability needs confirmation");
  const readiness=blocked?"BLOCKED":roleMatch&&!missingSkills.length&&!missingLicences.length?"READY":"CHECK";const strength=readiness==="READY"?"STRONG":readiness==="CHECK"?"REVIEW":"WEAK";return {readiness,strength,reasons:reasons.slice(0,8),gaps:gaps.slice(0,8)};
}
app.post("/api/person-card/agency/v1/requests/:requestId/match",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const requestId=clean(req.params.requestId,180);const requestResult=await query(`select request_id as "requestId",role,client_name as "clientName",location,status,headcount,record_json as details from nexus_person_agency_requests where agency_id=$1 and request_id=$2 limit 1`,[agency.agencyId,requestId]);const requestRow=requestResult.rows[0];if(!requestRow){res.status(404).json({error:"NEXUS_AGENCY_REQUEST_NOT_FOUND"});return}
  const rosterResult=await query("select roster_worker_id,display_name,record_json from nexus_person_agency_roster_workers where agency_id=$1 and status='ACTIVE'",[agency.agencyId]);const connected=await connectedRows(agency.agencyId);const candidates=[...rosterResult.rows.map(candidateFactsFromRoster),...connected.map(candidateFactsFromConnected)];const client=await pool.connect();let created=0,updated=0;
  try{await client.query("begin");for(const c of candidates){const match=matchFacts(c,requestRow);const existing=await client.query(`select application_id,stage from nexus_person_agency_applications where agency_id=$1 and request_id=$2 and (($3='person' and person_id=$4) or ($3='roster' and roster_worker_id=$4)) limit 1`,[agency.agencyId,requestId,c.kind,c.id]);const matchJson={schema:"nosmo-agency-match/v1",match:{strength:match.strength,reasons:match.reasons,gaps:match.gaps,factors:["trade","skills","licences","location","availability","experience","preferences"]}};if(existing.rows[0]){await client.query("update nexus_person_agency_applications set readiness_status=$4,record_json=$5::jsonb,updated_at=now() where agency_id=$1 and request_id=$2 and application_id=$3",[agency.agencyId,requestId,existing.rows[0].application_id,match.readiness,JSON.stringify(matchJson)]);updated++}else{await client.query(`insert into nexus_person_agency_applications (application_id,agency_id,request_id,person_id,roster_worker_id,stage,readiness_status,owner_user_id,record_json,created_at,updated_at) values ($1,$2,$3,$4,$5,'NEW',$6,$7,$8::jsonb,now(),now())`,[uuid("agency-application"),agency.agencyId,requestId,c.kind==="person"?c.id:null,c.kind==="roster"?c.id:null,match.readiness,req.user.id,JSON.stringify(matchJson)]);created++}}await client.query("commit");res.json({schema:"nosmo-agency-match-generation/v1",requestId,candidateCount:candidates.length,created,updated,explainable:true,algorithm:"deterministic-v1",tenantScoped:true})}catch(error){await client.query("rollback");console.error(error);res.status(500).json({error:"NEXUS_AGENCY_MATCH_GENERATION_FAILED"})}finally{client.release()}
});
app.get("/api/person-card/agency/v1/requests/:requestId/applications",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const requestId=clean(req.params.requestId,180);const exists=await query("select 1 from nexus_person_agency_requests where agency_id=$1 and request_id=$2",[agency.agencyId,requestId]);if(!exists.rows.length){res.status(404).json({error:"NEXUS_AGENCY_REQUEST_NOT_FOUND"});return}
  const result=await query(`select a.application_id as "applicationId",a.person_id as "personId",a.roster_worker_id as "rosterWorkerId",coalesce(r.display_name,p.display_name,'Candidate') as "displayName",a.stage,a.readiness_status as "readinessStatus",a.next_action as "nextAction",a.last_contact_at as "lastContactAt",a.record_json->'match'->>'strength' as "matchStrength",a.record_json->'match'->'reasons' as "matchReasons",a.record_json->'match'->'gaps' as "matchGaps",a.updated_at as "updatedAt" from nexus_person_agency_applications a left join nexus_person_agency_roster_workers r on r.roster_worker_id=a.roster_worker_id and r.agency_id=a.agency_id left join nexus_pm_people p on p.person_id=a.person_id where a.agency_id=$1 and a.request_id=$2 order by case a.readiness_status when 'READY' then 1 when 'CHECK' then 2 else 3 end,a.updated_at desc`,[agency.agencyId,requestId]);res.json({schema:"nosmo-agency-application-list/v1",requestId,applications:result.rows,explainableMatching:true});
});
app.patch("/api/person-card/agency/v1/applications/:applicationId",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const applicationId=clean(req.params.applicationId,180),stage=clean(req.body?.stage,32)?.toUpperCase(),readiness=clean(req.body?.readinessStatus,24)?.toUpperCase(),nextAction=clean(req.body?.nextAction,400);if(!applicationId||(stage&&!APPLICATION_STAGES.has(stage))||(readiness&&!READINESS_STATUSES.has(readiness))){res.status(400).json({error:"NEXUS_AGENCY_APPLICATION_INVALID"});return}
  const current=(await query(`select request_id as "requestId",stage,readiness_status as "readinessStatus" from nexus_person_agency_applications where agency_id=$1 and application_id=$2 limit 1`,[agency.agencyId,applicationId])).rows[0];if(!current){res.status(404).json({error:"NEXUS_AGENCY_APPLICATION_NOT_FOUND"});return}const nextStage=stage||current.stage,nextReadiness=readiness||current.readinessStatus;await query("update nexus_person_agency_applications set stage=$3,readiness_status=$4,next_action=$5,updated_at=now() where agency_id=$1 and application_id=$2",[agency.agencyId,applicationId,nextStage,nextReadiness,nextAction||null]);await query("insert into nexus_person_agency_pipeline_events (event_id,agency_id,request_id,application_id,actor_user_id,event_type,record_json,created_at) values ($1,$2,$3,$4,$5,'APPLICATION_UPDATED',$6::jsonb,now())",[uuid("pipeline-event"),agency.agencyId,current.requestId,applicationId,req.user.id,JSON.stringify({fromStage:current.stage,toStage:nextStage,fromReadiness:current.readinessStatus,toReadiness:nextReadiness,nextAction:nextAction||null})]);res.json({schema:"nosmo-agency-application-updated/v1",applicationId,stage:nextStage,readinessStatus:nextReadiness,nextAction:nextAction||null});
});
app.post("/api/person-card/agency/v1/placements",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const applicationId=clean(req.body?.applicationId,180);if(!applicationId){res.status(400).json({error:"NEXUS_AGENCY_PLACEMENT_INVALID"});return}const application=(await query("select request_id as \"requestId\" from nexus_person_agency_applications where agency_id=$1 and application_id=$2 limit 1",[agency.agencyId,applicationId])).rows[0];if(!application){res.status(404).json({error:"NEXUS_AGENCY_APPLICATION_NOT_FOUND"});return}const placementId=uuid("agency-placement"),status=clean(req.body?.status,24)?.toUpperCase()||"PLACED";await query(`insert into nexus_person_agency_placements (placement_id,agency_id,request_id,application_id,status,start_date,end_date,currency,rate_unit,pay_rate_amount,bill_rate_amount,record_json,created_by_user_id,updated_by_user_id,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$13,now(),now()) on conflict (agency_id,application_id) do update set status=excluded.status,start_date=excluded.start_date,end_date=excluded.end_date,currency=excluded.currency,rate_unit=excluded.rate_unit,pay_rate_amount=excluded.pay_rate_amount,bill_rate_amount=excluded.bill_rate_amount,updated_by_user_id=excluded.updated_by_user_id,updated_at=now()`,[placementId,agency.agencyId,application.requestId,applicationId,status,clean(req.body?.startDate,32)||null,clean(req.body?.endDate,32)||null,clean(req.body?.currency,12)?.toUpperCase()||"GBP",clean(req.body?.rateUnit,24)?.toUpperCase()||null,safeNumber(req.body?.payRateAmount),safeNumber(req.body?.billRateAmount),JSON.stringify({notes:clean(req.body?.notes,600)||null}),req.user.id]);await query("update nexus_person_agency_applications set stage='PLACED',updated_at=now() where agency_id=$1 and application_id=$2",[agency.agencyId,applicationId]);res.status(201).json({schema:"nosmo-agency-placement-created/v1",placement:{placementId,applicationId,requestId:application.requestId,status}});
});

app.post("/api/person-card/agency/v1/ask-nexus/query",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;const question=clean(req.body?.question,500);if(!question){res.status(400).json({error:"NEXUS_AGENCY_QUESTION_REQUIRED"});return}const q=question.toLowerCase();let answerType="NEEDS_FILTER",answer="I can answer from the current agency-scoped roster, requests and pipeline, but this question needs a more specific filter.",evidence=[];
  if(q.includes("not connected")||q.includes("worker app")){const r=await query(`select display_name as "displayName",record_json->>'trade' as trade,record_json->>'location' as location,connection_status as "connectionStatus" from nexus_person_agency_roster_workers where agency_id=$1 and status='ACTIVE' and coalesce((record_json->>'workerAppConfirmed')::boolean,false)=false order by display_name limit 100`,[agency.agencyId]);evidence=r.rows;answerType="IMPORTED_NOT_CONNECTED";answer=`${evidence.length} imported worker${evidence.length===1?" is":"s are"} not yet confirmed through Worker App recruiter-safe sharing.`}
  else if(q.includes("cscs")){const r=await query(`select display_name as "displayName",record_json->>'trade' as trade,record_json->>'location' as location,record_json->'licences' as licences from nexus_person_agency_roster_workers x where agency_id=$1 and status='ACTIVE' and exists(select 1 from jsonb_array_elements_text(coalesce(x.record_json->'licences','[]'::jsonb)) i where i ilike 'CSCS%') order by display_name limit 100`,[agency.agencyId]);evidence=r.rows;answerType="CSCS_WORKERS";answer=`${evidence.length} agency roster worker${evidence.length===1?" has":"s have"} a CSCS entry in the current imported data.`}
  else if(q.includes("available")||q.includes("ready for")||q.includes("ready from")){const r=await query(`select display_name as "displayName",record_json->>'trade' as trade,record_json->>'location' as location,record_json->'availability'->>'status' as "availabilityStatus",record_json->'availability'->>'availableFrom' as "availableFrom" from nexus_person_agency_roster_workers where agency_id=$1 and status='ACTIVE' and record_json->'availability'->>'status' in ('Available','Ready on date') order by nullif(record_json->'availability'->>'availableFrom','')::date nulls last,display_name limit 100`,[agency.agencyId]);evidence=r.rows;answerType="AVAILABLE_WORKERS";answer=`${evidence.length} roster worker${evidence.length===1?" is":"s are"} currently marked Available or Ready on date.`}
  else if(q.includes("strongest")||q.includes("match")){const r=await query(`select coalesce(r.display_name,p.display_name,'Candidate') as "displayName",req.role,req.location,a.stage,a.readiness_status as "readinessStatus",a.record_json->'match'->>'strength' as "matchStrength",a.record_json->'match'->'reasons' as reasons,a.record_json->'match'->'gaps' as gaps from nexus_person_agency_applications a join nexus_person_agency_requests req on req.request_id=a.request_id and req.agency_id=a.agency_id left join nexus_person_agency_roster_workers r on r.roster_worker_id=a.roster_worker_id and r.agency_id=a.agency_id left join nexus_pm_people p on p.person_id=a.person_id where a.agency_id=$1 order by case a.readiness_status when 'READY' then 1 when 'CHECK' then 2 else 3 end,a.updated_at desc limit 30`,[agency.agencyId]);evidence=r.rows;answerType="EXPLAINABLE_MATCHES";answer=evidence.length?"Here are the strongest current matches, ordered by readiness. Reasons and gaps are included rather than an unexplained AI percentage.":"There are no candidate matches recorded for this agency yet."}
  else if(q.includes("follow-up")||q.includes("follow up")||q.includes("waiting for a response")){const r=await query(`select coalesce(r.display_name,p.display_name,'Candidate') as "displayName",req.role,a.stage,a.readiness_status as "readinessStatus",a.next_action as "nextAction",a.last_contact_at as "lastContactAt" from nexus_person_agency_applications a join nexus_person_agency_requests req on req.request_id=a.request_id and req.agency_id=a.agency_id left join nexus_person_agency_roster_workers r on r.roster_worker_id=a.roster_worker_id and r.agency_id=a.agency_id left join nexus_pm_people p on p.person_id=a.person_id where a.agency_id=$1 and a.stage not in ('PLACED','REJECTED','WITHDRAWN') and a.next_action is not null order by a.updated_at asc limit 100`,[agency.agencyId]);evidence=r.rows;answerType="FOLLOW_UP";answer=`${evidence.length} candidate${evidence.length===1?" needs":"s need"} a recorded follow-up action.`}
  else if(q.includes("open request")&&q.includes("no ready")){const r=await query(`select req.request_id as "requestId",req.role,req.client_name as "clientName",req.location from nexus_person_agency_requests req where req.agency_id=$1 and req.status='OPEN' and not exists(select 1 from nexus_person_agency_applications a where a.agency_id=req.agency_id and a.request_id=req.request_id and a.readiness_status='READY') order by req.updated_at desc limit 100`,[agency.agencyId]);evidence=r.rows;answerType="OPEN_REQUESTS_WITHOUT_READY";answer=`${evidence.length} open request${evidence.length===1?" has":"s have"} no READY candidate recorded.`}
  else if(q.includes("documents")&&q.includes("expir")){answerType="DOCUMENT_EXPIRY_NOT_AVAILABLE";answer="The current Agency projection does not contain trustworthy certificate expiry dates, so I will not infer or invent document-expiry results."}
  else if(q.includes("worked in")){answerType="WORK_HISTORY_NOT_AVAILABLE";answer="The current recruiter-safe Agency dataset does not contain verified work-history locations, so I will not treat preferred location as proof that someone worked there."}
  res.json({schema:"nosmo-agency-ask-nexus-answer/v1",agency:{agencyId:agency.agencyId,name:agency.name},question,answerType,answer,evidence,evidenceCount:evidence.length,tenantScoped:true,privateWorkerFieldsIncluded:false,generatedFromAgencyDataOnly:true});
});

app.get("/api/person-card/agency/v1/invites/_health",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;
  res.json({schema:"nosmo-agency-invite-health/v1",inviteSigningConfigured:Boolean(process.env.NEXUS_ONBOARDING_INVITE_SECRET?.trim()),workAppBaseConfigured:Boolean(process.env.WORK_APP_BASE_URL?.trim()),consentGrantedByInvite:false});
});
app.post("/api/person-card/agency/v1/invites",async(req,res)=>{
  const agency=await requireAgency(req,res);if(!agency)return;
  const secret=process.env.NEXUS_ONBOARDING_INVITE_SECRET?.trim();
  if(!secret||secret.length<32){res.status(503).json({error:"NEXUS_ONBOARDING_INVITE_SECRET_NOT_CONFIGURED"});return}
  const workBase=process.env.WORK_APP_BASE_URL?.trim();
  if(!workBase){res.status(503).json({error:"WORK_APP_BASE_URL_REQUIRED"});return}
  let onboardingUrl;
  try{onboardingUrl=new URL(workBase)}catch{res.status(503).json({error:"WORK_APP_BASE_URL_INVALID"});return}
  const expiresInDays=Math.max(1,Math.min(14,safeInt(req.body?.expiresInDays,7,14)));
  const rosterWorkerId=clean(req.body?.rosterWorkerId,180)||null;
  let trade=clean(req.body?.trade,120)||null,location=clean(req.body?.location,120)||null;
  if(rosterWorkerId){
    const roster=(await query(`select roster_worker_id as "rosterWorkerId",display_name as "displayName",record_json->>'trade' as trade,record_json->>'location' as location from nexus_person_agency_roster_workers where agency_id=$1 and roster_worker_id=$2 and status='ACTIVE' limit 1`,[agency.agencyId,rosterWorkerId])).rows[0];
    if(!roster){res.status(404).json({error:"NEXUS_AGENCY_ROSTER_WORKER_NOT_FOUND"});return}
    trade=trade||roster.trade||null;location=location||roster.location||null;
  }
  const recruiter=(await query(`select display_name as "displayName",job_title as "jobTitle" from nexus_person_agency_recruiter_profiles where auth_user_id=$1 and agency_id=$2 limit 1`,[req.user.id,agency.agencyId])).rows[0]||{};
  const issuedAt=Date.now(),expiresAt=issuedAt+expiresInDays*24*60*60*1000,inviteId=uuid("agency-invite");
  const payload={schema:"nexus-person-onboarding-invite/v1",inviteId,agency:agency.name,agencyId:agency.agencyId,recruiterName:recruiter.displayName||req.user.email||"Recruiter",recruiterTitle:recruiter.jobTitle||undefined,trade:trade||undefined,location:location||undefined,message:clean(req.body?.message,240),issuedAt,expiresAt};
  const body=Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");
  const signature=crypto.createHmac("sha256",secret).update(body).digest("base64url");
  const token=`${body}.${signature}`;
  const digest=crypto.createHash("sha256").update(token,"utf8").digest("hex");
  const client=await pool.connect();
  try{
    await client.query("begin");
    await client.query(`insert into nexus_person_onboarding_invites (invite_id,token_digest,agency,agency_id,created_by_user_id,suggested_trade,suggested_location,message,status,expires_at,created_at,roster_worker_id) values ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9,now(),$10)`,[inviteId,digest,agency.name,agency.agencyId,req.user.id,trade,location,clean(req.body?.message,240)||null,new Date(expiresAt),rosterWorkerId]);
    if(rosterWorkerId){await client.query(`update nexus_person_agency_roster_workers set connection_status='INVITED',invitation_sent_at=now(),invitation_expires_at=$3,updated_by_user_id=$4,updated_at=now() where agency_id=$1 and roster_worker_id=$2`,[agency.agencyId,rosterWorkerId,new Date(expiresAt),req.user.id])}
    await client.query("commit");
  }catch(error){await client.query("rollback");console.error("Agency invite persistence failed",error);res.status(503).json({error:"NEXUS_AGENCY_INVITE_PERSIST_FAILED"});return}finally{client.release()}
  onboardingUrl.searchParams.set("inviteToken",token);onboardingUrl.searchParams.set("inviteId",inviteId);onboardingUrl.searchParams.set("agency",agency.name);
  if(trade)onboardingUrl.searchParams.set("trade",trade);if(location)onboardingUrl.searchParams.set("location",location);
  res.status(201).json({schema:"nexus-person-onboarding-invite-created/v1",inviteId,expiresAt:new Date(expiresAt).toISOString(),onboardingUrl:onboardingUrl.toString(),invitePersisted:true,tenantScoped:true,consentGranted:false,recruiterSafeAccessGranted:false,privateWorkerFieldsIncluded:false});
});

installAgencyCompat(app,{pool,query,clean,record,array,uuid,norm,safeInt,safeNumber,requireAgency,connectedRows,safeCandidate});
const acceptedSitesRoot=path.join(__dirname,"public");
app.use(express.static(acceptedSitesRoot,{index:false,fallthrough:true}));
app.get(["/","/index.html"],(_req,res)=>res.sendFile(path.join(acceptedSitesRoot,"index.html")));
app.use((err,_req,res,_next)=>{console.error("NOSMO Agency error",err);res.status(500).json({error:"NOSMO_AGENCY_INTERNAL_ERROR"})});

if(process.env.VERCEL!=="1"&&process.env.NODE_ENV!=="production"){
  const port=Number(process.env.PORT||4178);app.listen(port,"0.0.0.0",()=>console.log(`NOSMO Agency V1.0025 listening on :${port}`));
}
export default app;
