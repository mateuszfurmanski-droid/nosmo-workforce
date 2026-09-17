// Local HTTP runtime + isolated PostgreSQL. Clerk BAPI is simulated here;
// this suite does not claim live identity-provider or browser E2E coverage.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {mock} from 'node:test';
import pg from 'pg';

assert.equal(process.env.SECURITY_QA_ALLOW_MUTATION,'isolated-branch');
assert.ok(process.env.SECURITY_QA_DATABASE_URL);
process.env.DATABASE_URL=process.env.SECURITY_QA_DATABASE_URL;
process.env.NODE_ENV='test';
process.env.VERCEL='1';
process.env.VERCEL_ENV='preview';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_'+Buffer.from('qa-instance.clerk.accounts.dev$').toString('base64');
const issuer='https://qa-instance.clerk.accounts.dev';
const suffix=crypto.randomUUID();
const prefix=`security-clerk-${suffix}`;
const upstream=new Map();
mock.module('@clerk/express',{namedExports:{
  clerkClient:{sessions:{getSession:async id=>{const s=upstream.get(id);if(!s)throw Error('Unknown synthetic session');return s},revokeSession:async id=>{upstream.get(id).status='revoked'}}},
  verifyToken:async()=>{throw Error('This suite never simulates successful JWT verification')},
}});
const {clerkIdentity}=await import('../clerk-auth.js');
const actors=['a','b','recruiter'].map(label=>{
  const subject=`${prefix}-${label}`;const id=clerkIdentity(issuer,subject);const sessionId=`sess-${subject}`;
  upstream.set(sessionId,{id:sessionId,userId:subject,status:'active',expireAt:Date.now()+3600000});
  return {id,subject,sessionId,sid:crypto.randomBytes(32).toString('hex'),agency:`${prefix}-${label==='recruiter'?'a':label}`};
});
const [a,b,recruiter]=actors;
const person=`${prefix}-person`,invite=`${prefix}-invite`;
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000});
let runtime,server,checks=0,seeded=false;
async function check(path,{actor=a,method='GET',body,origin=true,status=200}={}){
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={};if(actor)headers.cookie=`sid=${actor.sid}`;if(origin)headers.origin=base;
  if(body)headers['content-type']='application/json';
  const response=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const text=await response.text();assert.equal(response.status,status,`${method} ${path}`);
  checks++;console.log(JSON.stringify({check:checks,path,method,status}));return text;
}
try{
  const client=await db.connect();
  try{
    await client.query('begin');
    for(const actor of actors){
      await client.query('insert into users(id,first_name) values($1,$2)',[actor.id,'Synthetic QA']);
      await client.query('insert into sessions(sid,sess,expire) values($1,$2::jsonb,now()+interval \'1 hour\')',[actor.sid,JSON.stringify({provider:'clerk-v1',clerkIssuer:issuer,clerkUserId:actor.subject,clerkSessionId:actor.sessionId,user:{id:actor.id}})]);
    }
    for(const actor of [a,b])await client.query("insert into nexus_person_agencies(agency_id,name,status,created_by_user_id) values($1,$2,'ACTIVE',$3)",[actor.agency,`${prefix} agency`,actor.id]);
    for(const actor of actors)await client.query("insert into nexus_person_agency_members(auth_user_id,agency_id,role,status) values($1,$2,$3,'ACTIVE')",[actor.id,actor.agency,actor===recruiter?'RECRUITER':'OWNER']);
    for(const actor of [a,b])await client.query("insert into nexus_person_agency_requests(request_id,agency_id,role,client_name,location,status,headcount,record_json,created_by_user_id,updated_by_user_id) values($1,$2,'Joiner','Synthetic','Leeds','OPEN',1,'{}'::jsonb,$3,$3)",[`${actor.agency}-request`,actor.agency,actor.id]);
    await client.query("insert into nexus_pm_people(person_id,display_name,person_type,status,record_json,persisted_at) values($1,'Synthetic worker','worker','active',$2::jsonb,now())",[person,JSON.stringify({privatePhone:'NEVER_RETURN_PRIVATE'})]);
    await client.query("insert into nexus_person_onboarding_invites(invite_id,token_digest,agency,agency_id,created_by_user_id,status,expires_at,claimed_person_id,claimed_at) values($1,$2,'Synthetic',$3,$4,'CLAIMED',now()+interval '1 hour',$5,now())",[invite,`${prefix}-token`,a.agency,a.id,person]);
    await client.query("insert into nexus_person_work_profiles(person_id,schema_version,status,source_invite_id,record_json,persisted_at) values($1,'nexus-person-work-profile/v1','active',$2,$3::jsonb,now())",[person,invite,JSON.stringify({preferences:{primaryTrade:'Joiner',locations:['Leeds']},availability:{status:'available'},privateDocuments:['NEVER_RETURN_PRIVATE']})]);
    await client.query("insert into nexus_person_agency_access_grants(agency_id,person_id,source_invite_id,scope,status,consent_source,record_json,granted_at,updated_at) values($1,$2,$3,'RECRUITER_SAFE','ACTIVE','WORKER_INVITE_ACCEPTED','{}'::jsonb,now(),now())",[a.agency,person,invite]);
    await client.query('commit');seeded=true;
  }catch(error){await client.query('rollback');throw error}finally{client.release()}
  runtime=await import('../security-entry.js');
  server=runtime.default.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  await check('/api/agency/requests',{actor:null,status:401});
  let body=await check('/api/agency/requests');assert.ok(body.includes(`${a.agency}-request`));assert.ok(!body.includes(`${b.agency}-request`));
  await check(`/api/agency/requests/${b.agency}-request`,{method:'PATCH',body:{role:'Painter'},status:404});
  await check('/api/agency/account',{actor:recruiter,method:'POST',body:{agencyName:'Denied'},status:403});
  body=await check('/api/agency/candidates');assert.ok(body.includes(person));assert.ok(!body.includes('NEVER_RETURN_PRIVATE'));
  body=await check('/api/agency/candidates',{actor:b});assert.ok(!body.includes(person));
  await db.query("update nexus_person_agency_access_grants set status='REVOKED',revoked_at=now() where agency_id=$1 and person_id=$2",[a.agency,person]);
  body=await check('/api/agency/candidates');assert.ok(!body.includes(person));
  await check('/api/agency/account',{method:'POST',body:{agencyName:'Denied'},origin:false,status:403});
  upstream.get(a.sessionId).status='revoked';await check('/api/agency/requests',{status:401});
  upstream.get(a.sessionId).status='active';upstream.get(a.sessionId).expireAt=Date.now()-1000;await check('/api/agency/requests',{status:401});
  upstream.get(a.sessionId).expireAt=Date.now()+3600000;upstream.get(a.sessionId).userId=b.subject;await check('/api/agency/requests',{status:401});
  const unchanged=await db.query('select role from nexus_person_agency_requests where request_id=$1',[`${b.agency}-request`]);assert.equal(unchanged.rows[0].role,'Joiner');
  console.log(JSON.stringify({status:'PASS',checks,mode:'local-http-isolated-db-simulated-clerk-bapi'}));
}finally{
  if(server)await new Promise(r=>server.close(r));
  if(seeded){
  const client=await db.connect();
  try{
    await client.query('begin');
    await client.query('delete from nexus_person_agency_access_grants where agency_id=any($1)',[[a.agency,b.agency]]);
    await client.query('delete from nexus_person_work_profiles where person_id=$1',[person]);
    await client.query('delete from nexus_person_onboarding_invites where invite_id=$1',[invite]);
    await client.query('delete from nexus_pm_people where person_id=$1',[person]);
    await client.query('delete from nexus_person_agency_requests where agency_id=any($1)',[[a.agency,b.agency]]);
    await client.query('delete from sessions where sid=any($1)',[actors.map(x=>x.sid)]);
    await client.query('delete from nexus_person_agency_members where auth_user_id=any($1)',[actors.map(x=>x.id)]);
    await client.query('delete from nexus_person_agencies where agency_id=any($1)',[[a.agency,b.agency]]);
    await client.query('delete from users where id=any($1)',[actors.map(x=>x.id)]);
    await client.query('commit');
    const remaining=await client.query('select count(*)::int as n from users where id=any($1)',[actors.map(x=>x.id)]);assert.equal(remaining.rows[0].n,0);
    console.log('Synthetic fixture cleanup verified');
  }catch(error){await client.query('rollback');throw error}finally{client.release();await db.end();await runtime?.pool.end()}
  }else{await db.end()}
  mock.restoreAll();
}
