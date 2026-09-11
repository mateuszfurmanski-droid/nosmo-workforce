const SAFE_METHODS=new Set(["GET","HEAD","OPTIONS"]);
export const AGENCY_ROLES=new Set(["OWNER","ADMIN","RECRUITER"]);
export const AGENCY_ADMIN_ROLES=new Set(["OWNER","ADMIN"]);

export function isProduction(env=process.env){return env.NODE_ENV==="production"}

export function normalizeOrigin(value){
  if(!value||typeof value!=="string")return null;
  try{
    const url=new URL(value.trim());
    if(!["https:","http:"].includes(url.protocol))return null;
    return url.origin;
  }catch{return null}
}

export function configuredAgencyOrigin(env=process.env){
  const vercelEnv=String(env.VERCEL_ENV||"").trim().toLowerCase();
  if(vercelEnv==="preview"){
    const previewHost=String(env.VERCEL_URL||"").trim();
    if(previewHost)return normalizeOrigin(`https://${previewHost}`);
  }
  const explicit=normalizeOrigin(env.NOSMO_AGENCY_PUBLIC_ORIGIN);
  if(explicit)return explicit;
  const vercelHost=String(env.VERCEL_PROJECT_PRODUCTION_URL||"").trim();
  return vercelHost?normalizeOrigin(`https://${vercelHost}`):null;
}

export function requestSourceOrigin(req){
  const source=req?.headers?.origin||req?.headers?.referer;
  if(!source)return null;
  try{return new URL(String(source)).origin}catch{return null}
}

export function derivedRequestOrigin(req){
  const proto=String(req?.headers?.["x-forwarded-proto"]||req?.protocol||"https").split(",")[0].trim();
  const host=String(req?.headers?.["x-forwarded-host"]||req?.headers?.host||"").split(",")[0].trim();
  return host?normalizeOrigin(`${proto}://${host}`):null;
}

export function sameOriginRequest(req,env=process.env){
  const source=requestSourceOrigin(req);
  if(!source)return false;
  const expected=configuredAgencyOrigin(env)||derivedRequestOrigin(req);
  return Boolean(expected&&source===expected);
}

export function isAgencyApiPath(pathname=""){
  return pathname==="/api/login"||pathname==="/api/callback"||pathname==="/api/auth/user"||pathname==="/api/logout"||pathname.startsWith("/api/agency/")||pathname.startsWith("/api/person-card/agency/");
}

export function isAgencyHealthPath(pathname=""){
  return pathname==="/api/agency/health"||pathname==="/api/person-card/agency/v1/_health";
}

export function requiresBrowserMutationProtection(method="GET",pathname=""){
  return !SAFE_METHODS.has(String(method).toUpperCase())&&isAgencyApiPath(pathname);
}

export function requiredAgencyRoles(method="GET",pathname="",hasMembership=false){
  const upper=String(method).toUpperCase();
  if(isAgencyHealthPath(pathname))return null;
  if((pathname==="/api/agency/account"||pathname==="/api/person-card/agency/account")&&upper==="POST"){
    return hasMembership?AGENCY_ADMIN_ROLES:null;
  }
  if(pathname==="/api/login"||pathname==="/api/callback"||pathname==="/api/auth/user"||pathname==="/api/logout")return null;
  if(pathname.startsWith("/api/agency/")||pathname.startsWith("/api/person-card/agency/"))return AGENCY_ROLES;
  return null;
}

export function roleAllowed(role,allowed){
  return !allowed||allowed.has(String(role||"").toUpperCase());
}

export function productionSslOptions(env=process.env){
  if(!isProduction(env))return undefined;
  return {rejectUnauthorized:true};
}

export function secureExternalUrl(value,{production=isProduction()}={}){
  if(typeof value!=="string"||!value.trim())return null;
  try{
    const url=new URL(value.trim());
    const localhost=(url.hostname==="localhost"||url.hostname==="127.0.0.1"||url.hostname==="[::1]");
    if(url.protocol==="https:")return url;
    if(!production&&localhost&&url.protocol==="http:")return url;
    return null;
  }catch{return null}
}

export function securityHeaders({production=isProduction()}={}){
  const headers={
    "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"DENY",
    "Referrer-Policy":"strict-origin-when-cross-origin",
    "Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy":"same-origin",
  };
  if(production)headers["Strict-Transport-Security"]="max-age=63072000; includeSubDomains; preload";
  return headers;
}

export function safeApiErrorBody(body,statusCode=500){
  if(!body||typeof body!=="object"||Array.isArray(body))return body;
  if(statusCode<400||!body.error)return body;
  const out={...body};
  delete out.detail;
  delete out.stack;
  delete out.sql;
  delete out.query;
  delete out.internal;
  if(statusCode>=500&&!/^[A-Z0-9_:-]{3,120}$/.test(String(out.error||"")))out.error="NOSMO_INTERNAL_ERROR";
  return out;
}

export function ratePolicy(method="GET",pathname=""){
  const upper=String(method).toUpperCase();
  if(pathname==="/api/login"||pathname==="/api/callback")return {windowMs:10*60_000,limit:30,bucket:"auth"};
  if(pathname.includes("/invites"))return {windowMs:60*60_000,limit:60,bucket:"invite"};
  if(pathname.includes("ask-nexus")||pathname.includes("/nexus/query"))return {windowMs:60_000,limit:60,bucket:"assistant"};
  if(!SAFE_METHODS.has(upper))return {windowMs:60_000,limit:180,bucket:"write"};
  if(pathname.includes("candidates")||pathname.includes("roster")||pathname.includes("pipeline"))return {windowMs:60_000,limit:300,bucket:"read"};
  return {windowMs:60_000,limit:600,bucket:"general"};
}

export function redactedLogValue(value){
  if(value instanceof Error)return {name:value.name,code:value.code||undefined,message:String(value.message||"error").slice(0,240)};
  if(typeof value!=="string")return value;
  return value
    .replace(/(authorization:\s*bearer\s+)[^\s]+/ig,"$1[REDACTED]")
    .replace(/(sid=)[^;\s]+/ig,"$1[REDACTED]")
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@\s]+@/ig,"$1[REDACTED]@");
}
