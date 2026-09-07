import assert from "node:assert/strict";
import crypto from "node:crypto";

const databaseUrl=process.env.SECURITY_QA_DATABASE_URL?.trim();
const mutationOptIn=process.env.SECURITY_QA_ALLOW_MUTATION;
if(!databaseUrl||mutationOptIn!=="isolated-branch"){
  console.log(JSON.stringify({schema:"nosmo-tenant-isolation-e2e/v1",status:"SKIPPED",reason:"Requires SECURITY_QA_DATABASE_URL and SECURITY_QA_ALLOW_MUTATION=isolated-branch"},null,2));
  process.exit(0);
}

process.env.DATABASE_URL=databaseUrl;
process.env.NODE_ENV="test";
process.env.VERCEL="1";

const {default:pg}=await import("pg");
const {Pool}=pg;
const adminPool=new Pool({connectionString:databaseUrl,ssl:{rejectUnauthorized:true}});
const suffix=crypto.randomUUID().replaceAll("-","").slice(0,16);
const ids={
  userA:`security-e2e-user-a-${suffix}`,
  userB:`security-e2e-user-b-${suffix}`,
  recruiter:`security-e2e-recruiter-${suffix}`,
  agencyA:`security-e2e-agency-a-${suffix}`,
  agencyB:`security-e2e-agency-b-${suffix}`,
  sidA:crypto.randomBytes(32).toString("hex"),
  sidB:crypto.randomBytes(32).toString("hex"),
  sidRecruiter:crypto.randomBytes(32).toString("hex"),
  requestA:`security-e2e-request-a-${suffix}`,
  requestB:`security-e2e-request-b-${suffix}`,
  workerA:`security-e2e-worker-a-${suffix}`,
  workerB:`security-e2e-worker-b-${suffix}`,
};
let server;
let runtimePool;

async function seed(){
  const client=await adminPool.connect();
  try{
    await client.query("begin");
    await client.query("insert into users (id,email,first_name,last_name) values ($1,$2,'Security','A'),($3,$4,'Security','B'),($5,$6,'Security','Recruiter')",[ids.userA,`${ids.userA}@example.invalid`,ids.userB,`${ids.userB}@example.invalid`,ids.recruiter,`${ids.recruiter}@example.invalid`]);
    await client.query("insert into nexus_person_agencies (agency_id,name,status,created_by_user_id) values ($1,'SECURITY E2E A','ACTIVE',$2),($3,'SECURITY E2E B','ACTIVE',$4)",[ids.agencyA,ids.userA,ids.agencyB,ids.userB]);
    await client.query("insert into nexus_person_agency_members (auth_user_id,agency_id,role,status) values ($1,$2,'OWNER','ACTIVE'),($3,$4,'OWNER','ACTIVE'),($5,$2,'RECRUITER','ACTIVE')",[ids.userA,ids.agencyA,ids.userB,ids.agencyB,ids.recruiter]);
    const expire=new Date(Date.now()+60*60*1000);
    await client.query("insert into sessions (sid,sess,expire) values ($1,$2::jsonb,$3),($4,$5::jsonb,$3),($6,$7::jsonb,$3)",[
      ids.sidA,JSON.stringify({user:{id:ids.userA,email:`${ids.userA}@example.invalid`}}),expire,
      ids.sidB,JSON.stringify({user:{id:ids.userB,email:`${ids.userB}@example.invalid`}}),
      ids.sidRecruiter,JSON.stringify({user:{id:ids.recruiter,email:`${ids.recruiter}@example.invalid`}})
    ]);
    await client.query("insert into nexus_person_agency_requests (request_id,agency_id,role,client_name,location,status,headcount,record_json,created_by_user_id,updated_by_user_id) values ($1,$2,'Joiner','Synthetic A','Leeds','OPEN',1,'{}'::jsonb,$3,$3),($4,$5,'Joiner','Synthetic B','Bradford','OPEN',1,'{}'::jsonb,$6,$6)",[ids.requestA,ids.agencyA,ids.userA,ids.requestB,ids.agencyB,ids.userB]);
    await client.query("insert into nexus_person_agency_roster_workers (roster_worker_id,agency_id,display_name,name_location_key,record_json,connection_status,status,created_by_user_id,updated_by_user_id) values ($1,$2,'Synthetic Worker A','synthetic worker a|leeds',$3::jsonb,'IMPORTED','ACTIVE',$4,$4),($5,$6,'Synthetic Worker B','synthetic worker b|bradford',$7::jsonb,'IMPORTED','ACTIVE',$8,$8)",[
      ids.workerA,ids.agencyA,JSON.stringify({trade:"Joiner",location:"Leeds",availability:{status:"Available"}}),ids.userA,
      ids.workerB,ids.agencyB,JSON.stringify({trade:"Joiner",location:"Bradford",availability:{status:"Available"}}),ids.userB
    ]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error}finally{client.release()}
}

async function cleanup(){
  const client=await adminPool.connect();
  try{
    await client.query("begin");
    await client.query("delete from nexus_person_agency_roster_events where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_roster_workers where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_pipeline_events where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_placements where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_applications where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_requests where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_actions where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_candidate_states where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_access_grants where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_recruiter_profiles where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from sessions where sid in ($1,$2,$3)",[ids.sidA,ids.sidB,ids.sidRecruiter]);
    await client.query("delete from nexus_person_agency_members where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agencies where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from users where id in ($1,$2,$3)",[ids.userA,ids.userB,ids.recruiter]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error}finally{client.release()}
}

async function request(base,pathname,{sid,method="GET",body,rawBody,origin=true,headers={}}={}){
  const target=new URL(pathname,base);
  const requestHeaders={...headers};
  if(sid)requestHeaders.cookie=`sid=${sid}`;
  if(origin)requestHeaders.origin=base.origin;
  let payload;
  if(rawBody!==undefined){payload=rawBody;requestHeaders["content-type"]||="application/json"}
  else if(body!==undefined){payload=JSON.stringify(body);requestHeaders["content-type"]="application/json"}
  const response=await fetch(target,{method,headers:requestHeaders,body:payload,redirect:"manual"});
  const text=await response.text();
  let json=null;try{json=JSON.parse(text)}catch{}
  return {response,text,json};
}

try{
  await seed();
  const runtime=await import(`../security-entry.js?e2e=${suffix}`);
  runtimePool=runtime.pool;
  server=await new Promise((resolve,reject)=>{
    const listener=runtime.default.listen(0,"127.0.0.1",()=>resolve(listener));
    listener.once("error",reject);
  });
  const address=server.address();
  const base=new URL(`http://127.0.0.1:${address.port}`);

  // Unauthenticated and invalid sessions fail closed.
  let result=await request(base,"/api/agency/pipeline",{origin:false});
  assert.equal(result.response.status,401);
  result=await request(base,"/api/agency/pipeline",{sid:"not-a-real-session",origin:false});
  assert.equal(result.response.status,401);

  // Agency A cannot read Agency B requests or roster rows.
  result=await request(base,"/api/agency/pipeline",{sid:ids.sidA,origin:false});
  assert.equal(result.response.status,200);
  assert.equal(JSON.stringify(result.json).includes(ids.requestA),true);
  assert.equal(JSON.stringify(result.json).includes(ids.requestB),false);
  result=await request(base,"/api/agency/roster",{sid:ids.sidA,origin:false});
  assert.equal(result.response.status,200);
  assert.equal(JSON.stringify(result.json).includes(ids.workerA),true);
  assert.equal(JSON.stringify(result.json).includes(ids.workerB),false);

  // Cross-tenant write and SQL-looking identifiers are safely denied.
  result=await request(base,`/api/agency/requests/${encodeURIComponent(ids.requestB)}`,{sid:ids.sidA,method:"PATCH",body:{status:"PAUSED",confirmed:true}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/requests/${encodeURIComponent("' OR 1=1 --")}`,{sid:ids.sidA,method:"PATCH",body:{status:"PAUSED",confirmed:true}});
  assert.equal(result.response.status,404);

  // Recruiter is an Agency user but cannot perform OWNER/ADMIN account mutation.
  result=await request(base,"/api/agency/account",{sid:ids.sidRecruiter,method:"POST",body:{agencyName:"SHOULD NOT RENAME"}});
  assert.equal(result.response.status,403);

  // Browser state changes require same-origin evidence.
  result=await request(base,`/api/agency/requests/${ids.requestA}`,{sid:ids.sidA,method:"PATCH",body:{status:"PAUSED",confirmed:true},origin:false});
  assert.equal(result.response.status,403);
  result=await request(base,`/api/agency/requests/${ids.requestA}`,{sid:ids.sidA,method:"PATCH",body:{status:"PAUSED",confirmed:true},origin:false,headers:{origin:"https://evil.example"}});
  assert.equal(result.response.status,403);

  // Parser failures are bounded and safe.
  result=await request(base,"/api/agency/requests",{sid:ids.sidA,method:"POST",rawBody:"{",origin:true});
  assert.equal(result.response.status,400);
  assert.equal(result.json?.error,"NOSMO_MALFORMED_JSON");
  const huge=JSON.stringify({request:{description:"x".repeat(300_000)}});
  result=await request(base,"/api/agency/requests",{sid:ids.sidA,method:"POST",rawBody:huge,origin:true});
  assert.equal(result.response.status,413);
  assert.equal(result.json?.error,"NOSMO_PAYLOAD_TOO_LARGE");

  // Security headers are present even on denied API responses.
  result=await request(base,"/api/agency/pipeline",{origin:false});
  assert.equal(result.response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(result.response.headers.get("x-frame-options"),"DENY");
  assert.ok(result.response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"));
  assert.equal(result.response.headers.get("cache-control"),"no-store");

  // Verify denied cross-tenant write did not mutate Agency B.
  const verification=await adminPool.query("select client_name,status from nexus_person_agency_requests where agency_id=$1 and request_id=$2",[ids.agencyB,ids.requestB]);
  assert.equal(verification.rows.length,1);
  assert.equal(verification.rows[0].client_name,"Synthetic B");
  assert.equal(verification.rows[0].status,"OPEN");

  console.log(JSON.stringify({
    schema:"nosmo-tenant-isolation-e2e/v1",
    status:"PASS",
    unauthenticatedDenied:true,
    invalidSessionDenied:true,
    crossTenantReadDenied:true,
    crossTenantWriteDenied:true,
    sqlLookingIdentifierSafe:true,
    recruiterAdminMutationDenied:true,
    csrfOriginDenied:true,
    malformedJsonRejected:true,
    oversizedPayloadRejected:true,
    securityHeadersPresent:true
  },null,2));
}finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(runtimePool)await runtimePool.end().catch(()=>{});
  await cleanup().catch(error=>console.error("SECURITY_E2E_CLEANUP_FAILED",error?.message||error));
  await adminPool.end().catch(()=>{});
}
