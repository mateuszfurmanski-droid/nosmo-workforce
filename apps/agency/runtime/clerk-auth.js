import crypto from "node:crypto";
import {clerkClient,verifyToken} from "@clerk/express";
import {configuredAgencyOrigin} from "./security-core.js";

export const usesClerk=()=>process.env.VERCEL_ENV==="preview";
export function clerkPublicConfig(){
  const key=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY||"";
  if(!/^pk_test_[A-Za-z0-9_-]+$/.test(key))throw new Error("NOSMO_CLERK_PREVIEW_KEY_REQUIRED");
  const domain=Buffer.from(key.slice(8),"base64").toString("utf8").replace(/\$$/,"");
  if(!/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(domain))throw new Error("NOSMO_CLERK_DOMAIN_INVALID");
  return {key,domain,issuer:`https://${domain}`};
}
export function clerkIdentity(issuer,userId){
  return `clerk:${crypto.createHash("sha256").update(JSON.stringify([issuer,userId])).digest("hex")}`;
}
export function activeClerkSession(remote,session,now=Date.now()){
  return remote?.status==="active"&&remote.id===session.clerkSessionId&&remote.userId===session.clerkUserId&&Number(remote.expireAt)>now;
}
export async function verifyClerkLogin(token){
  const origin=configuredAgencyOrigin();
  if(!origin)throw new Error("NOSMO_AGENCY_PUBLIC_ORIGIN_REQUIRED");
  const {issuer}=clerkPublicConfig();
  const claims=await verifyToken(token,{secretKey:process.env.CLERK_SECRET_KEY,authorizedParties:[origin]});
  if(claims.iss!==issuer||claims.azp!==origin||typeof claims.sub!=="string"||typeof claims.sid!=="string")throw new Error("NOSMO_CLERK_IDENTITY_INVALID");
  const session={provider:"clerk-v1",clerkIssuer:issuer,clerkUserId:claims.sub,clerkSessionId:claims.sid};
  const remote=await clerkClient.sessions.getSession(claims.sid);
  if(!activeClerkSession(remote,session))throw new Error("NOSMO_CLERK_SESSION_INACTIVE");
  return {...session,subject:clerkIdentity(issuer,claims.sub),expiresAt:remote.expireAt};
}

// Shared by the outer role gate and the application. Validate once per request,
// never cache revocation status between requests or accept an email as identity.
const validated=Symbol("nosmoValidatedSession");
export async function readValidatedSession(req,pool,getRemoteSession=id=>clerkClient.sessions.getSession(id)){
  if(req[validated]!==undefined)return req[validated];
  const sid=req.cookies?.sid;
  if(!sid)return null;
  const result=await pool.query("select sess from sessions where sid=$1 and expire>now() limit 1",[sid]);
  let session=result.rows[0]?.sess||null;
  if(usesClerk()){
    const {issuer}=clerkPublicConfig();
    if(session?.provider!=="clerk-v1"||session.clerkIssuer!==issuer||session.user?.id!==clerkIdentity(issuer,session.clerkUserId))session=null;
    if(session){
      const remote=await getRemoteSession(session.clerkSessionId);
      if(!activeClerkSession(remote,session))session=null;
    }
  }
  req[validated]=session;
  return session;
}
export async function revokeClerkSession(session){
  if(session?.provider==="clerk-v1")await clerkClient.sessions.revokeSession(session.clerkSessionId);
}

export function clerkLoginPage(res,returnTo){
  const {key,domain}=clerkPublicConfig();
  const nonce=crypto.randomBytes(18).toString("base64");
  const destination=JSON.stringify(returnTo).replace(/</g,"\\u003c");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Content-Security-Policy",`default-src 'self'; script-src 'self' 'nonce-${nonce}' https://${domain} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://${domain} https://clerk-telemetry.com; img-src 'self' data: https:; font-src 'self' data:; frame-src https://${domain} https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
  res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in | NOSMO Agency</title><style>body{margin:0;background:#101219;color:#f4f4f5;font:16px system-ui}main{max-width:440px;margin:8vh auto;padding:24px}a{color:#dfbf70}#auth{margin-top:24px}#status{line-height:1.5}</style></head><body><main><a href="/">NOSMO Agency</a><h1>Sign in to your agency</h1><p id="status" role="status">Loading secure sign-in...</p><div id="auth"></div><p><a id="signup" href="#sign-up">Create an account</a></p></main>
<script nonce="${nonce}" defer crossorigin="anonymous" src="https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js"></script>
<script nonce="${nonce}" defer crossorigin="anonymous" data-clerk-publishable-key="${key}" src="https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js"></script>
<script nonce="${nonce}">window.addEventListener('load',async()=>{const status=document.getElementById('status');try{await Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});let exchanging=false;async function finish(){if(!Clerk.session||exchanging)return;exchanging=true;status.textContent='Opening your agency...';try{const token=await Clerk.session.getToken();const response=await fetch('/api/auth/clerk-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!response.ok)throw new Error('Session setup failed');location.replace(${destination});}catch{status.textContent='Unable to open your agency. Refresh to try again.';exchanging=false;}}function render(){if(Clerk.session){finish();return;}const target=document.getElementById('auth');Clerk.unmountSignIn(target);Clerk.unmountSignUp(target);status.textContent='';const signUpUrl=new URL(location.href);signUpUrl.hash='';signUpUrl.searchParams.set('mode','sign-up');const options={routing:'hash',signUpUrl:signUpUrl.href,signInUrl:'/api/login',forceRedirectUrl:location.href.split('#')[0],signUpForceRedirectUrl:location.href.split('#')[0]};if(new URLSearchParams(location.search).get('mode')==='sign-up'||location.hash.startsWith('#sign-up'))Clerk.mountSignUp(target,options);else Clerk.mountSignIn(target,options);}Clerk.addListener(()=>{if(Clerk.session)finish();});document.getElementById('signup').addEventListener('click',event=>{event.preventDefault();const url=new URL(location.href);url.hash='';url.searchParams.set('mode','sign-up');location.assign(url.href);});render();}catch{status.textContent='Sign-in could not load. Refresh to try again.'}});</script></body></html>`);
}
