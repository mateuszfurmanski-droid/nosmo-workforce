import "./security-bootstrap.js";
import crypto from "node:crypto";
import {safeApiErrorBody,securityHeaders} from "./security-core.js";

const buckets=new Map();

function clientKey(req,bucket){
  const forwarded=String(req.headers?.["x-forwarded-for"]||"").split(",")[0].trim();
  return `${bucket}:${forwarded||req.socket?.remoteAddress||"unknown"}`;
}
function takeRate(req,res,{bucket,limit,windowMs}){
  const key=clientKey(req,bucket),now=Date.now();
  let state=buckets.get(key);
  if(!state||state.resetAt<=now)state={count:0,resetAt:now+windowMs};
  state.count+=1;buckets.set(key,state);
  if(buckets.size>5000){for(const [k,v] of buckets){if(v.resetAt<=now)buckets.delete(k)}}
  if(state.count<=limit)return true;
  res.setHeader("Retry-After",String(Math.max(1,Math.ceil((state.resetAt-now)/1000))));
  res.status(429).json({error:"NOSMO_RATE_LIMITED"});
  return false;
}
function credentialInUrl(req){
  try{
    const url=new URL(req.url||"/","https://nosmo.invalid");
    return ["draftToken","inviteToken","token","sid","sessionId"].some(key=>url.searchParams.has(key));
  }catch{return false}
}

export function createSecureOnboardingHandler(loader,{bucket="onboarding",limit=120,windowMs=60_000,maxBodyBytes=128*1024}={}){
  let loaded;
  return async function securedOnboarding(req,res){
    for(const [name,value] of Object.entries(securityHeaders()))res.setHeader(name,value);
    res.setHeader("Cache-Control","no-store");
    res.setHeader("X-Request-Id",crypto.randomUUID());
    const originalJson=res.json.bind(res);
    res.json=(body)=>originalJson(safeApiErrorBody(body,res.statusCode));
    if(credentialInUrl(req)){res.status(400).json({error:"NOSMO_CREDENTIAL_URL_FORBIDDEN"});return}
    const contentLength=Number(req.headers?.["content-length"]||0);
    if(Number.isFinite(contentLength)&&contentLength>maxBodyBytes){res.status(413).json({error:"NOSMO_PAYLOAD_TOO_LARGE"});return}
    if(!takeRate(req,res,{bucket,limit,windowMs}))return;
    try{
      loaded=loaded||loader();
      const module=await loaded;
      return await module.default(req,res);
    }catch(error){
      console.error("NOSMO secured onboarding error",error);
      if(!res.headersSent)res.status(500).json({error:"NOSMO_ONBOARDING_INTERNAL_ERROR"});
    }
  };
}
