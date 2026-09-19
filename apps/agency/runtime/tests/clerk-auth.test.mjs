import test from 'node:test';
import assert from 'node:assert/strict';
import {activeClerkSession,clerkIdentity,clerkPublicConfig,readValidatedSession,usesClerk,clerkLoginPage} from '../clerk-auth.js';

test('Preview session authority rejects revoked, expired and mismatched Clerk sessions',()=>{
  const session={clerkSessionId:'sess_a',clerkUserId:'user_a'};
  const remote={id:'sess_a',userId:'user_a',status:'active',expireAt:2000};
  assert.equal(activeClerkSession(remote,session,1000),true);
  for(const change of [{status:'revoked'},{status:'ended'},{userId:'user_b'},{id:'sess_b'},{expireAt:999}]){
    assert.equal(activeClerkSession({...remote,...change},session,1000),false);
  }
});
test('identity separates both issuer and subject',()=>{
  assert.notEqual(clerkIdentity('issuer-a','user'),clerkIdentity('issuer-b','user'));
  assert.notEqual(clerkIdentity('issuer-a','user'),clerkIdentity('issuer-a','other'));
  assert.match(clerkIdentity('issuer-a','user'),/^clerk:[a-f0-9]{64}$/);
});
test('both role gate and handler share validated session and fail closed on upstream errors',async()=>{
  process.env.VERCEL_ENV='preview';
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_'+Buffer.from('test-instance.clerk.accounts.dev$').toString('base64');
  const issuer=clerkPublicConfig().issuer;
  const session={provider:'clerk-v1',clerkIssuer:issuer,clerkUserId:'user_a',clerkSessionId:'sess_a',user:{id:clerkIdentity(issuer,'user_a')}};
  let sqlCalls=0,clerkCalls=0;
  const pool={query:async()=>{sqlCalls++;return {rows:[{sess:session}]}}};
  let getRemoteSession=async()=>{clerkCalls++;return {id:'sess_a',userId:'user_a',status:'active',expireAt:Date.now()+10000}};
  try{
    const req={cookies:{sid:'opaque'}};
    assert.equal(await readValidatedSession(req,pool,getRemoteSession),session);
    assert.equal(await readValidatedSession(req,pool,getRemoteSession),session);
    assert.equal(sqlCalls,1);assert.equal(clerkCalls,1);
    session.user.id='other';
    assert.equal(await readValidatedSession({cookies:{sid:'other'}},pool,getRemoteSession),null);
    assert.equal(clerkCalls,1);
    session.user.id=clerkIdentity(issuer,'user_a');
    getRemoteSession=async()=>{throw new Error('unavailable')};
    await assert.rejects(readValidatedSession({cookies:{sid:'new'}},pool,getRemoteSession),/unavailable/);
    session.provider='legacy';
    assert.equal(await readValidatedSession({cookies:{sid:'legacy'}},pool,getRemoteSession),null);
    const headers={};let html='';
    const res={setHeader:(k,v)=>headers[k]=v,type:()=>res,send:v=>html=v};
    clerkLoginPage(res,'/</script>');
    assert.equal(headers['Cache-Control'],'no-store');
    assert.match(headers['Content-Security-Policy'],/nonce-/);
    assert.ok(!html.includes('location.replace("/</script>'));
    process.env.VERCEL_ENV='production';assert.equal(usesClerk(),false);
  }finally{delete process.env.VERCEL_ENV;delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;}
});
