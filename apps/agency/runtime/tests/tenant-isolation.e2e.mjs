import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const databaseUrl=process.env.SECURITY_QA_DATABASE_URL?.trim();
const mutationOptIn=process.env.SECURITY_QA_ALLOW_MUTATION;
const remoteBaseUrl=process.env.SECURITY_QA_BASE_URL?.trim();
const deploymentCookieFile=process.env.SECURITY_QA_HTTP_COOKIE_FILE?.trim();
function readCookieJar(file){
  if(!file)return "";
  const pairs=[];
  for(let line of fs.readFileSync(file,"utf8").split(/\r?\n/)){
    if(!line||(line.startsWith("#")&&!line.startsWith("#HttpOnly_")))continue;
    if(line.startsWith("#HttpOnly_"))line=line.slice("#HttpOnly_".length);
    const fields=line.split("\t");
    if(fields.length>=7)pairs.push(`${fields[5]}=${fields[6]}`);
  }
  return pairs.join("; ");
}
const deploymentCookie=process.env.SECURITY_QA_HTTP_COOKIE?.trim()||readCookieJar(deploymentCookieFile);
const protectionBypass=process.env.SECURITY_QA_VERCEL_BYPASS_TOKEN?.trim();
const preseededFixtureFile=process.env.SECURITY_QA_PRESEEDED_FIXTURE_FILE?.trim();
const directDatabaseMode=Boolean(databaseUrl&&mutationOptIn==="isolated-branch");
const preseededRemoteMode=Boolean(remoteBaseUrl&&preseededFixtureFile&&mutationOptIn==="preseeded-isolated-branch");
if(!directDatabaseMode&&!preseededRemoteMode){
  console.log(JSON.stringify({schema:"nosmo-tenant-isolation-e2e/v1",status:"SKIPPED",reason:"Requires an isolated database URL, or an HTTPS preview plus an explicitly preseeded isolated-branch fixture"},null,2));
  process.exit(0);
}

if(directDatabaseMode)process.env.DATABASE_URL=databaseUrl;
process.env.NODE_ENV="test";
process.env.VERCEL="1";

const {default:pg}=await import("pg");
const {Pool}=pg;
const adminPool=directDatabaseMode?new Pool({connectionString:databaseUrl,ssl:{rejectUnauthorized:true}}):null;
const suffix=crypto.randomUUID().replaceAll("-","").slice(0,16);
const generatedIds={
  userA:`security-e2e-user-a-${suffix}`,
  userB:`security-e2e-user-b-${suffix}`,
  recruiter:`security-e2e-recruiter-${suffix}`,
  agencyA:`security-e2e-agency-a-${suffix}`,
  agencyB:`security-e2e-agency-b-${suffix}`,
  sidA:crypto.randomBytes(32).toString("hex"),
  sidB:crypto.randomBytes(32).toString("hex"),
  sidRecruiter:crypto.randomBytes(32).toString("hex"),
  sidExpired:crypto.randomBytes(32).toString("hex"),
  requestA:`security-e2e-request-a-${suffix}`,
  requestB:`security-e2e-request-b-${suffix}`,
  workerA:`security-e2e-worker-a-${suffix}`,
  workerB:`security-e2e-worker-b-${suffix}`,
  personA:`security-e2e-person-a-${suffix}`,
  personB:`security-e2e-person-b-${suffix}`,
  inviteA:`security-e2e-invite-a-${suffix}`,
  inviteB:`security-e2e-invite-b-${suffix}`,
  applicationA:`security-e2e-application-a-${suffix}`,
  applicationB:`security-e2e-application-b-${suffix}`,
  placementA:`security-e2e-placement-a-${suffix}`,
  placementB:`security-e2e-placement-b-${suffix}`,
};
const ids=preseededRemoteMode?JSON.parse(fs.readFileSync(preseededFixtureFile,"utf8")):generatedIds;
const requiredFixtureKeys=Object.keys(generatedIds);
for(const key of requiredFixtureKeys){
  assert.equal(typeof ids[key],"string",`fixture ${key} must be a string`);
  if(key.startsWith("sid"))assert.match(ids[key],/^[a-f0-9]{64}$/,`fixture ${key} must be an opaque test session id`);
  else assert.match(ids[key],/^security-e2e-/,`fixture ${key} must be synthetic`);
}
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
    await client.query("insert into sessions (sid,sess,expire) values ($1,$2::jsonb,$3),($4,$5::jsonb,$3),($6,$7::jsonb,$3),($8,$9::jsonb,$10)",[
      ids.sidA,JSON.stringify({user:{id:ids.userA,email:`${ids.userA}@example.invalid`}}),expire,
      ids.sidB,JSON.stringify({user:{id:ids.userB,email:`${ids.userB}@example.invalid`}}),
      ids.sidRecruiter,JSON.stringify({user:{id:ids.recruiter,email:`${ids.recruiter}@example.invalid`}}),
      ids.sidExpired,JSON.stringify({user:{id:ids.userA,email:`${ids.userA}@example.invalid`}}),new Date(Date.now()-60_000)
    ]);
    await client.query("insert into nexus_person_agency_recruiter_profiles (auth_user_id,agency_id,display_name,job_title,email) values ($1,$2,'SECURITY RECRUITER A','Owner',$3),($4,$5,'SECURITY RECRUITER B','Owner',$6),($7,$2,'SECURITY LIMITED RECRUITER','Recruiter',$8)",[ids.userA,ids.agencyA,`${ids.userA}@example.invalid`,ids.userB,ids.agencyB,`${ids.userB}@example.invalid`,ids.recruiter,`${ids.recruiter}@example.invalid`]);
    await client.query("insert into nexus_person_agency_requests (request_id,agency_id,role,client_name,location,status,headcount,record_json,created_by_user_id,updated_by_user_id) values ($1,$2,'Joiner','Synthetic A','Leeds','OPEN',1,'{}'::jsonb,$3,$3),($4,$5,'Joiner','Synthetic B','Bradford','OPEN',1,'{}'::jsonb,$6,$6)",[ids.requestA,ids.agencyA,ids.userA,ids.requestB,ids.agencyB,ids.userB]);
    await client.query("insert into nexus_person_agency_roster_workers (roster_worker_id,agency_id,display_name,name_location_key,record_json,connection_status,status,created_by_user_id,updated_by_user_id) values ($1,$2,'Synthetic Worker A','synthetic worker a|leeds',$3::jsonb,'IMPORTED','ACTIVE',$4,$4),($5,$6,'Synthetic Worker B','synthetic worker b|bradford',$7::jsonb,'IMPORTED','ACTIVE',$8,$8)",[
      ids.workerA,ids.agencyA,JSON.stringify({trade:"Joiner",location:"Leeds",availability:{status:"Available"}}),ids.userA,
      ids.workerB,ids.agencyB,JSON.stringify({trade:"Joiner",location:"Bradford",availability:{status:"Available"}}),ids.userB
    ]);
    await client.query("insert into nexus_pm_people (person_id,display_name,person_type,status,record_json,persisted_at) values ($1,'Synthetic Candidate A','worker','active',$2::jsonb,now()),($3,'Synthetic Candidate B','worker','active',$4::jsonb,now())",[ids.personA,JSON.stringify({primaryRole:"Joiner",location:"Leeds",privatePhone:"never-return-a"}),ids.personB,JSON.stringify({primaryRole:"Joiner",location:"Bradford",privatePhone:"never-return-b"})]);
    await client.query("insert into nexus_person_onboarding_invites (invite_id,token_digest,agency,agency_id,created_by_user_id,status,expires_at,claimed_person_id,claimed_at) values ($1,$2,'SECURITY E2E A',$3,$4,'CLAIMED',now()+interval '1 hour',$5,now()),($6,$7,'SECURITY E2E B',$8,$9,'CLAIMED',now()+interval '1 hour',$10,now())",[ids.inviteA,`security-e2e-token-a-${suffix}`,ids.agencyA,ids.userA,ids.personA,ids.inviteB,`security-e2e-token-b-${suffix}`,ids.agencyB,ids.userB,ids.personB]);
    await client.query("insert into nexus_person_work_profiles (person_id,schema_version,status,source_invite_id,record_json,persisted_at) values ($1,'nexus-person-work-profile/v1','active',$2,$3::jsonb,now()),($4,'nexus-person-work-profile/v1','active',$5,$6::jsonb,now())",[ids.personA,ids.inviteA,JSON.stringify({preferences:{primaryTrade:"Joiner",locations:["Leeds"]},availability:{status:"available"},privateDocuments:["never-return-a"]}),ids.personB,ids.inviteB,JSON.stringify({preferences:{primaryTrade:"Joiner",locations:["Bradford"]},availability:{status:"available"},privateDocuments:["never-return-b"]})]);
    await client.query("insert into nexus_person_agency_access_grants (agency_id,person_id,source_invite_id,scope,status,consent_source,record_json,granted_at) values ($1,$2,$3,'RECRUITER_SAFE','ACTIVE','SECURITY_E2E','{}'::jsonb,now()),($4,$5,$6,'RECRUITER_SAFE','ACTIVE','SECURITY_E2E','{}'::jsonb,now())",[ids.agencyA,ids.personA,ids.inviteA,ids.agencyB,ids.personB,ids.inviteB]);
    await client.query("insert into nexus_person_agency_candidate_states (agency_id,person_id,stage,note,updated_by_user_id) values ($1,$2,'SHORTLISTED','Synthetic A only',$3),($4,$5,'CONTACTED','Synthetic B only',$6)",[ids.agencyA,ids.personA,ids.userA,ids.agencyB,ids.personB,ids.userB]);
    await client.query("insert into nexus_person_agency_applications (application_id,agency_id,request_id,roster_worker_id,stage,readiness_status,owner_user_id,record_json) values ($1,$2,$3,$4,'SHORTLISTED','READY',$5,'{}'::jsonb),($6,$7,$8,$9,'CONTACTED','READY',$10,'{}'::jsonb)",[ids.applicationA,ids.agencyA,ids.requestA,ids.workerA,ids.userA,ids.applicationB,ids.agencyB,ids.requestB,ids.workerB,ids.userB]);
    await client.query("insert into nexus_person_agency_placements (placement_id,agency_id,request_id,application_id,status,currency,rate_unit,record_json,created_by_user_id,updated_by_user_id) values ($1,$2,$3,$4,'PLACED','GBP','HOURLY','{}'::jsonb,$5,$5),($6,$7,$8,$9,'PLACED','GBP','HOURLY','{}'::jsonb,$10,$10)",[ids.placementA,ids.agencyA,ids.requestA,ids.applicationA,ids.userA,ids.placementB,ids.agencyB,ids.requestB,ids.applicationB,ids.userB]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error}finally{client.release()}
}

async function cleanup(){
  const client=await adminPool.connect();
  try{
    await client.query("begin");
    await client.query("delete from nexus_person_agency_pipeline_events where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_placements where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_applications where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_requests where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_roster_events where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_roster_workers where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_actions where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_candidate_states where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agency_access_grants where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_work_events where person_id in ($1,$2)",[ids.personA,ids.personB]);
    await client.query("delete from nexus_person_work_profiles where person_id in ($1,$2)",[ids.personA,ids.personB]);
    await client.query("delete from nexus_person_onboarding_invites where invite_id in ($1,$2)",[ids.inviteA,ids.inviteB]);
    await client.query("delete from nexus_pm_people where person_id in ($1,$2)",[ids.personA,ids.personB]);
    await client.query("delete from nexus_person_agency_recruiter_profiles where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from sessions where sid in ($1,$2,$3,$4)",[ids.sidA,ids.sidB,ids.sidRecruiter,ids.sidExpired]);
    await client.query("delete from nexus_person_agency_members where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from nexus_person_agencies where agency_id in ($1,$2)",[ids.agencyA,ids.agencyB]);
    await client.query("delete from users where id in ($1,$2,$3)",[ids.userA,ids.userB,ids.recruiter]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error}finally{client.release()}
}

async function request(base,pathname,{sid,method="GET",body,rawBody,origin=true,headers={}}={}){
  const target=new URL(pathname,base);
  const requestHeaders={...headers};
  const cookies=[deploymentCookie,sid?`sid=${sid}`:null].filter(Boolean);
  if(cookies.length)requestHeaders.cookie=cookies.join("; ");
  if(protectionBypass)requestHeaders["x-vercel-protection-bypass"]=protectionBypass;
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
  if(directDatabaseMode)await seed();
  let base;
  if(remoteBaseUrl){
    base=new URL(remoteBaseUrl);
    assert.equal(base.protocol,"https:","remote security QA must use HTTPS");
  }else{
    const runtime=await import(`../security-entry.js?e2e=${suffix}`);
    runtimePool=runtime.pool;
    server=await new Promise((resolve,reject)=>{
      const listener=runtime.default.listen(0,"127.0.0.1",()=>resolve(listener));
      listener.once("error",reject);
    });
    const address=server.address();
    base=new URL(`http://127.0.0.1:${address.port}`);
  }

  // Unauthenticated and invalid sessions fail closed.
  let result=await request(base,"/api/agency/pipeline",{origin:false});
  assert.equal(result.response.status,401);
  result=await request(base,"/api/agency/pipeline",{sid:"not-a-real-session",origin:false});
  assert.equal(result.response.status,401);
  result=await request(base,"/api/agency/pipeline",{sid:ids.sidExpired,origin:false});
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
  result=await request(base,"/api/agency/profile",{sid:ids.sidA,origin:false});
  assert.equal(result.response.status,200);
  assert.equal(JSON.stringify(result.json).includes("SECURITY RECRUITER A"),true);
  assert.equal(JSON.stringify(result.json).includes("SECURITY RECRUITER B"),false);
  result=await request(base,"/api/agency/candidates",{sid:ids.sidA,origin:false});
  assert.equal(result.response.status,200);
  assert.equal(JSON.stringify(result.json).includes(ids.personA),true);
  assert.equal(JSON.stringify(result.json).includes(ids.personB),false);
  assert.equal(JSON.stringify(result.json).includes("never-return"),false);
  result=await request(base,"/api/person-card/agency/candidates",{sid:ids.sidA,origin:false});
  assert.equal(result.response.status,200);
  assert.equal(JSON.stringify(result.json).includes(ids.personA),true);
  assert.equal(JSON.stringify(result.json).includes(ids.personB),false);
  result=await request(base,"/api/agency/pipeline",{sid:ids.sidA,origin:false});
  assert.equal(JSON.stringify(result.json).includes(ids.applicationA),true);
  assert.equal(JSON.stringify(result.json).includes(ids.applicationB),false);
  assert.equal(JSON.stringify(result.json).includes(ids.placementA),true);
  assert.equal(JSON.stringify(result.json).includes(ids.placementB),false);

  // Cross-tenant writes, updates and delivery access are safely denied.
  result=await request(base,`/api/agency/requests/${encodeURIComponent(ids.requestB)}`,{sid:ids.sidA,method:"PATCH",body:{status:"PAUSED",confirmed:true}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/roster/${encodeURIComponent(ids.workerB)}`,{sid:ids.sidA,method:"PATCH",body:{worker:{trade:"MUTATED"}}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/applications/${encodeURIComponent(ids.applicationB)}`,{sid:ids.sidA,method:"PATCH",body:{stage:"REJECTED"}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/placements/${encodeURIComponent(ids.placementB)}`,{sid:ids.sidA,method:"PATCH",body:{status:"CANCELLED",confirmed:true}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/requests/${encodeURIComponent(ids.requestB)}/applications`,{sid:ids.sidA,method:"POST",body:{rosterWorkerId:ids.workerA,stage:"NEW"}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/applications/${encodeURIComponent(ids.applicationB)}/events`,{sid:ids.sidA,method:"POST",body:{eventType:"CONTACT_CONFIRMED"}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/applications/${encodeURIComponent(ids.applicationB)}/placement`,{sid:ids.sidA,method:"POST",body:{readinessConfirmed:true}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/agency/invites/${encodeURIComponent(ids.inviteB)}/delivery`,{sid:ids.sidA,method:"POST",body:{}});
  assert.equal(result.response.status,404);
  result=await request(base,`/api/person-card/agency/candidates/${encodeURIComponent(ids.personB)}/actions`,{sid:ids.sidA,method:"POST",body:{actionType:"PROFILE_VIEWED"}});
  assert.equal(result.response.status,404);

  // Unsupported delete operations fail closed and cannot mutate another tenant.
  for(const pathname of [
    `/api/agency/requests/${ids.requestB}`,
    `/api/agency/roster/${ids.workerB}`,
    `/api/agency/applications/${ids.applicationB}`,
    `/api/agency/placements/${ids.placementB}`,
  ]){
    result=await request(base,pathname,{sid:ids.sidA,method:"DELETE",body:{confirmed:true}});
    assert.equal(result.response.status,404);
  }

  // SQL-looking identifiers are treated only as identifiers.
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
  if(adminPool){
    const verification=await adminPool.query(`select
      (select status from nexus_person_agency_requests where agency_id=$1 and request_id=$2) as request_status,
      (select record_json->>'trade' from nexus_person_agency_roster_workers where agency_id=$1 and roster_worker_id=$3) as worker_trade,
      (select stage from nexus_person_agency_applications where agency_id=$1 and application_id=$4) as application_stage,
      (select status from nexus_person_agency_placements where agency_id=$1 and placement_id=$5) as placement_status,
      (select display_name from nexus_person_agency_recruiter_profiles where agency_id=$1 and auth_user_id=$6) as recruiter_name`,[ids.agencyB,ids.requestB,ids.workerB,ids.applicationB,ids.placementB,ids.userB]);
    assert.equal(verification.rows[0].request_status,"OPEN");
    assert.equal(verification.rows[0].worker_trade,"Joiner");
    assert.equal(verification.rows[0].application_stage,"CONTACTED");
    assert.equal(verification.rows[0].placement_status,"PLACED");
    assert.equal(verification.rows[0].recruiter_name,"SECURITY RECRUITER B");
  }

  console.log(JSON.stringify({
    schema:"nosmo-tenant-isolation-e2e/v1",
    status:"PASS",
    unauthenticatedDenied:true,
    invalidSessionDenied:true,
    expiredSessionDenied:true,
    crossTenantReadDenied:true,
    crossTenantWriteDenied:true,
    crossTenantDeleteDenied:true,
    recruiterProfileIsolated:true,
    candidatesIsolated:true,
    workerRecordsIsolated:true,
    requestsJobsIsolated:true,
    applicationsPlacementsIsolated:true,
    inviteDeliveryIsolated:true,
    privateWorkerFieldsExcluded:true,
    sqlLookingIdentifierSafe:true,
    recruiterAdminMutationDenied:true,
    csrfOriginDenied:true,
    malformedJsonRejected:true,
    oversizedPayloadRejected:true,
    securityHeadersPresent:true,
    databaseMutationVerified:Boolean(adminPool),
    externalFixtureCleanupRequired:preseededRemoteMode
  },null,2));
}finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(runtimePool)await runtimePool.end().catch(()=>{});
  if(adminPool){
    await cleanup().catch(error=>console.error("SECURITY_E2E_CLEANUP_FAILED",error?.message||error));
    await adminPool.end().catch(()=>{});
  }
}
