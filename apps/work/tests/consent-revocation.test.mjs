import test, {mock} from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL='1';
process.env.DATABASE_URL='postgresql://synthetic.invalid/unused';
process.env.NEXUS_IDENTITY_PEPPER='synthetic-test-pepper';
let calls=[],person='worker-own',updated=true,fail=false;
mock.module('@neondatabase/serverless',{exports:{neon:()=>async(strings,...values)=>{
  calls.push({sql:strings.join('?'),values});
  if(fail)throw Error('Synthetic database failure');
  if(strings.join('').includes('nexus_identity_bindings'))return person?[{personId:person}]:[];
  return updated?[{event_id:'synthetic-event'}]:[];
}}});
const {handleWorkerRequest}=await import('../app/worker-server.ts');
const identity={provider:'clerk-v1',subject:'["issuer","user-own"]',displayName:'Synthetic'};
function request(body={agencyId:'agency-a'},origin='https://worker.example.test'){
  return new Request('https://worker.example.test/api/worker/connection',{method:'DELETE',headers:origin?{origin,'content-type':'application/json'}:{'content-type':'application/json'},body:JSON.stringify(body)});
}
test('revocation requires origin and authenticated identity before database access',async()=>{
  calls=[];
  assert.equal((await handleWorkerRequest(request({},null),['connection'],identity)).status,403);
  assert.equal((await handleWorkerRequest(request(),['connection'],null)).status,401);
  assert.equal(calls.length,0);
});
test('revocation binds the target to the verified Worker and emits no private data',async()=>{
  calls=[];person='worker-own';updated=true;
  const response=await handleWorkerRequest(request({agencyId:'agency-a',personId:'worker-victim'}),['connection'],identity);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{schema:'nosmo-worker-connection-revoked/v1',revoked:true,agencyId:'agency-a'});
  assert.equal(calls.length,2);
  assert.ok(calls[1].values.includes('worker-own'));
  assert.ok(!calls[1].values.includes('worker-victim'));
  assert.match(response.headers.get('cache-control'),/no-store/);
});
test('unknown Worker or missing active grant cannot report successful revocation',async()=>{
  calls=[];person=null;
  assert.equal((await handleWorkerRequest(request(),['connection'],identity)).status,404);
  assert.equal(calls.length,1);
  person='worker-own';updated=false;
  assert.equal((await handleWorkerRequest(request(),['connection'],identity)).status,404);
  fail=true;
  assert.equal((await handleWorkerRequest(request(),['connection'],identity)).status,503);
  fail=false;
});
