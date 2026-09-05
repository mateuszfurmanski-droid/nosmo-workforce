import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.resolve(here,'..');
const agency=path.resolve(runtime,'..');
const frontend=fs.readFileSync(path.join(runtime,'public/assets/page-D2n6_To6.js'),'utf8');
const compat=fs.readFileSync(path.join(runtime,'compat.js'),'utf8');

const required=[
  ['GET','/api/agency/health'],
  ['GET','/api/agency/account'],
  ['POST','/api/agency/account'],
  ['GET','/api/agency/profile'],
  ['PATCH','/api/agency/profile'],
  ['GET','/api/agency/candidates'],
  ['GET','/api/agency/activity'],
  ['GET','/api/agency/roster'],
  ['POST','/api/agency/roster/import'],
  ['PATCH','/api/agency/roster/:rosterWorkerId'],
  ['POST','/api/agency/roster/:rosterWorkerId/events'],
  ['GET','/api/agency/pipeline'],
  ['POST','/api/agency/requests'],
  ['PATCH','/api/agency/requests/:requestId'],
  ['POST','/api/agency/requests/:requestId/applications'],
  ['PATCH','/api/agency/applications/:applicationId'],
  ['POST','/api/agency/applications/:applicationId/events'],
  ['POST','/api/agency/applications/:applicationId/placement'],
  ['PATCH','/api/agency/placements/:placementId'],
  ['POST','/api/agency/nexus/query'],
  ['POST','/api/agency/invites'],
];

for(const [method,route] of required){
  const needle=`app.${method.toLowerCase()}(\"${route}\"`;
  assert.ok(compat.includes(needle),`missing compatibility route ${method} ${route}`);
}

const routeCalls=(frontend.match(/\bQ\((?=[`"'])/g)||[]).length;
assert.equal(routeCalls,23,'accepted Sites literal API call-site count changed');
assert.ok(frontend.includes('fetch(`/api/agency${e}`'),'accepted frontend no longer targets /api/agency');
assert.ok(compat.includes('writePerformed:false'),'Ask Nexus must remain read-only');
assert.ok(compat.includes('privateWorkerFieldsIncluded:false'),'private Worker fields guard missing');
assert.ok(compat.includes("scope='RECRUITER_SAFE'"),'recruiter-safe consent scope guard missing');
assert.ok(compat.includes('NEXUS_PLACEMENT_READINESS_BLOCKED'),'placement BLOCKED readiness gate missing');
assert.ok(compat.includes('NEXUS_PLACEMENT_READINESS_REVIEW_REQUIRED'),'placement CHECK confirmation gate missing');
assert.ok(compat.includes('workerAppConfirmed:false'),'import must not fake Worker App confirmation');

function files(root){
  const out=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const p=path.join(root,entry.name);
    if(entry.isDirectory()) out.push(...files(p)); else out.push(p);
  }
  return out;
}
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
const canonical=path.join(agency,'sites/v24/public');
const generated=path.join(runtime,'public');
const canonicalFiles=files(canonical).map(f=>path.relative(canonical,f)).sort();
const generatedFiles=files(generated).map(f=>path.relative(generated,f)).sort();
assert.deepEqual(generatedFiles,canonicalFiles,'runtime public file list differs from accepted Sites bundle');
for(const rel of canonicalFiles) assert.equal(hash(path.join(generated,rel)),hash(path.join(canonical,rel)),`byte mismatch: ${rel}`);

console.log(JSON.stringify({schema:'nosmo-agency-runtime-contract/v1',frontendLiteralApiCallSites:routeCalls,requiredCompatRoutes:required.length,uiByteParity:true,askNexusReadOnly:true,recruiterSafeConsentGate:true,placementReadinessGate:true,workerAppConfirmationNotFaked:true},null,2));
