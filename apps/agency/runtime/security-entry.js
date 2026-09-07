import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import pg from "pg";
import {
  configuredAgencyOrigin,
  isAgencyApiPath,
  isAgencyHealthPath,
  isProduction,
  productionSslOptions,
  ratePolicy,
  redactedLogValue,
  requiredAgencyRoles,
  requiresBrowserMutationProtection,
  roleAllowed,
  safeApiErrorBody,
  sameOriginRequest,
  securityHeaders,
} from "./security-core.js";

const SESSION_COOKIE="sid";
const REQUIRED_TABLES=[
  "users","sessions","nexus_person_agencies","nexus_person_agency_members",
  "nexus_person_agency_recruiter_profiles","nexus_person_agency_access_grants",
  "nexus_person_agency_roster_workers","nexus_person_agency_roster_events",
  "nexus_person_agency_requests","nexus_person_agency_applications",
  "nexus_person_agency_pipeline_events","nexus_person_agency_placements",
  "nexus_person_work_profiles","nexus_pm_people"
];
const rateBuckets=new Map();

function installSecurePgPool(){
  if(pg.__nosmoSecurePoolInstalled)return;
  const OriginalPool=pg.Pool;
  if(typeof OriginalPool!=="function")throw new Error("NOSMO_PG_POOL_UNAVAILABLE");
  class NosmoSecurePool extends OriginalPool{
    constructor(config={}){
      const next={...config};
      if(isProduction())next.ssl=productionSslOptions();
      super(next);
    }
  }
  Object.defineProperty(pg,"Pool",{value:NosmoSecurePool,writable:false,configurable:false,enumerable:true});
  Object.defineProperty(pg,"__nosmoSecurePoolInstalled",{value:true,writable:false,configurable:false});
}

installSecurePgPool();
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});

function installRedactedErrorLogger(){
  if(!isProduction()||console.__nosmoRedactedErrorLogger)return;
  const original=console.error.bind(console);
  console.error=(...args)=>original(...args.map(redactedLogValue));
  Object.defineProperty(console,"__nosmoRedactedErrorLogger",{value:true});
}
installRedactedErrorLogger();

function clientKey(req,bucket){
  const forwarded=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim();
  const ip=forwarded||req.ip||req.socket?.remoteAddress||"unknown";
  return `${bucket}:${ip}`;
}
function consumeRate(req,res){
  const policy=ratePolicy(req.method,req.path);
  const key=clientKey(req,policy.bucket),now=Date.now();
  let state=rateBuckets.get(key);
  if(!state||state.resetAt<=now)state={count:0,resetAt:now+policy.windowMs};
  state.count+=1;rateBuckets.set(key,state);
  if(rateBuckets.size>10_000){
    for(const [k,v] of rateBuckets){if(v.resetAt<=now)rateBuckets.delete(k)}
    if(rateBuckets.size>10_000)rateBuckets.clear();
  }
  res.setHeader("RateLimit-Limit",String(policy.limit));
  res.setHeader("RateLimit-Remaining",String(Math.max(0,policy.limit-state.count)));
  res.setHeader("RateLimit-Reset",String(Math.ceil(state.resetAt/1000)));
  if(state.count<=policy.limit)return true;
  res.setHeader("Retry-After",String(Math.max(1,Math.ceil((state.resetAt-now)/1000))));
  res.status(429).json({error:"NOSMO_RATE_LIMITED"});
  return false;
}

function queryHasSessionIdentifier(req){
  try{
    const url=new URL(req.originalUrl||req.url||"/","https://nosmo.invalid");
    return ["sid","session","sessionId","session_id"].some(key=>url.searchParams.has(key));
  }catch{return false}
}

async function sessionContext(sid){
  if(!sid)return {authenticated:false,memberships:[]};
  const sessionResult=await pool.query("select sess from sessions where sid=$1 and expire>now() limit 1",[sid]);
  const session=sessionResult.rows[0]?.sess;
  const userId=session?.user?.id;
  if(!userId)return {authenticated:false,memberships:[]};
  const memberships=await pool.query(`select m.agency_id as "agencyId",upper(m.role) as role
    from nexus_person_agency_members m
    join nexus_person_agencies a on a.agency_id=m.agency_id
    where m.auth_user_id=$1 and m.status='ACTIVE' and a.status='ACTIVE'
    order by m.agency_id limit 3`,[String(userId)]);
  return {authenticated:true,userId:String(userId),memberships:memberships.rows};
}

function audit(event,{req,context,result}){
  const membership=context?.memberships?.length===1?context.memberships[0]:null;
  console.info(JSON.stringify({
    schema:"nosmo-security-audit/v1",
    event,
    timestamp:new Date().toISOString(),
    actorId:context?.userId||null,
    agencyId:membership?.agencyId||null,
    role:membership?.role||null,
    result,
    method:req.method,
    path:req.path,
    requestId:req.nosmoRequestId,
  }));
}

function auditEventFor(req){
  if(req.path==="/api/login")return "LOGIN_STARTED";
  if(req.path==="/api/callback")return "LOGIN_CALLBACK";
  if(req.path==="/api/logout")return "LOGOUT";
  if(req.method==="POST"&&(req.path==="/api/agency/account"||req.path==="/api/person-card/agency/account"))return "AGENCY_ACCOUNT_MUTATION";
  if(req.path.includes("/invites")&&req.method!=="GET")return "RECRUITER_INVITATION";
  if(req.method==="PATCH"&&req.path.includes("/profile"))return "PROFILE_MUTATION";
  if(!["GET","HEAD","OPTIONS"].includes(req.method)&&isAgencyApiPath(req.path))return "AGENCY_DATA_MUTATION";
  return null;
}

const app=express();
app.disable("x-powered-by");
app.set("trust proxy",1);
app.use(cookieParser());
app.use((req,res,next)=>{
  req.nosmoRequestId=crypto.randomUUID();
  res.setHeader("X-Request-Id",req.nosmoRequestId);
  for(const [name,value] of Object.entries(securityHeaders()))res.setHeader(name,value);
  res.setHeader("Cache-Control",req.path.startsWith("/api/")?"no-store":"public, max-age=0, must-revalidate");
  const originalJson=res.json.bind(res);
  res.json=(body)=>originalJson(safeApiErrorBody(body,res.statusCode));
  next();
});
app.use((req,res,next)=>consumeRate(req,res)?next():undefined);

app.get(["/api/agency/health","/api/person-card/agency/v1/_health"],async(_req,res)=>{
  try{
    const result=await pool.query("select unnest($1::text[]) as name, to_regclass('public.'||unnest($1::text[]))::text as reg",[REQUIRED_TABLES]);
    const missingCount=result.rows.filter(row=>!row.reg).length;
    res.status(missingCount?503:200).json({
      schema:"nosmo-security-health/v1",
      status:missingCount?"database-migration-required":"ok",
      databaseReady:missingCount===0,
      missingTableCount:missingCount,
      securityGate:"ENFORCED"
    });
  }catch(error){
    console.error("NOSMO health check failed",error);
    res.status(503).json({schema:"nosmo-security-health/v1",status:"database-unavailable",databaseReady:false,securityGate:"ENFORCED"});
  }
});

app.use(async(req,res,next)=>{
  if(!isAgencyApiPath(req.path)){next();return}
  if(queryHasSessionIdentifier(req)){
    audit("SESSION_IDENTIFIER_IN_URL_DENIED",{req,context:null,result:"DENIED"});
    res.status(400).json({error:"NOSMO_SESSION_URL_FORBIDDEN"});return;
  }
  if(isProduction()&&req.headers.authorization){
    audit("LEGACY_BEARER_SESSION_DENIED",{req,context:null,result:"DENIED"});
    res.status(401).json({error:"NOSMO_COOKIE_SESSION_REQUIRED"});return;
  }
  if(isProduction()&&(req.path==="/api/login"||req.path==="/api/callback")&&!configuredAgencyOrigin()){
    res.status(503).json({error:"NOSMO_AGENCY_PUBLIC_ORIGIN_REQUIRED"});return;
  }
  if(requiresBrowserMutationProtection(req.method,req.path)&&req.cookies?.[SESSION_COOKIE]&&!sameOriginRequest(req)){
    audit("CSRF_ORIGIN_DENIED",{req,context:null,result:"DENIED"});
    res.status(403).json({error:"NOSMO_CSRF_ORIGIN_DENIED"});return;
  }
  let context={authenticated:false,memberships:[]};
  if(req.cookies?.[SESSION_COOKIE]){
    try{context=await sessionContext(req.cookies[SESSION_COOKIE])}
    catch(error){console.error("NOSMO security context failed",error);res.status(503).json({error:"NOSMO_SECURITY_CONTEXT_UNAVAILABLE"});return}
  }
  if(context.memberships.length>1){
    audit("AMBIGUOUS_TENANT_CONTEXT_DENIED",{req,context,result:"DENIED"});
    res.status(409).json({error:"NOSMO_AGENCY_CONTEXT_AMBIGUOUS"});return;
  }
  const hasMembership=context.memberships.length===1;
  const allowed=requiredAgencyRoles(req.method,req.path,hasMembership);
  if(allowed&&hasMembership&&!roleAllowed(context.memberships[0].role,allowed)){
    audit("ROLE_ACCESS_DENIED",{req,context,result:"DENIED"});
    res.status(403).json({error:"NOSMO_ROLE_FORBIDDEN"});return;
  }
  if(allowed&&context.authenticated&&!hasMembership){
    audit("TENANT_MEMBERSHIP_REQUIRED",{req,context,result:"DENIED"});
    res.status(404).json({error:"NEXUS_AGENCY_ACCOUNT_REQUIRED",canCreate:true});return;
  }
  const event=auditEventFor(req);
  if(event)res.once("finish",()=>audit(event,{req,context,result:res.statusCode<400?"SUCCESS":"FAILED"}));
  next();
});

const {default:legacyApp}=await import("./server.js");
app.use(legacyApp);
app.use((err,req,res,_next)=>{
  console.error("NOSMO secured runtime error",err);
  if(res.headersSent)return;
  audit("UNHANDLED_ERROR",{req,context:null,result:"FAILED"});
  res.status(500).json({error:"NOSMO_AGENCY_INTERNAL_ERROR"});
});

export {app,pool};
export default app;
