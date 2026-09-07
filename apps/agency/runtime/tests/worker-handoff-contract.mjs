import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.resolve(here,'..');
const repo=path.resolve(runtime,'../../..');
const onboardingPath=path.join(runtime,'api/person-card/onboarding/[...path].js');
const worker=path.join(repo,'apps/work');
const bootstrapPath=path.join(worker,'js/person-onboarding-v47.js');
const corePath=path.join(worker,'js/person-onboarding-v47-core.js');
const configPath=path.join(worker,'runtime-config.json');
const swPath=path.join(worker,'sw.js');

for(const file of [onboardingPath,bootstrapPath,corePath,configPath,swPath]){
  assert.ok(fs.existsSync(file),`missing handoff file: ${path.relative(repo,file)}`);
}

const onboarding=fs.readFileSync(onboardingPath,'utf8');
const bootstrap=fs.readFileSync(bootstrapPath,'utf8');
const core=fs.readFileSync(corePath,'utf8');
const sw=fs.readFileSync(swPath,'utf8');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));

for(const route of ['invite-info','claim','drafts/load','drafts/save']){
  assert.ok(onboarding.includes(`action===\"${route}\"`),`missing onboarding action ${route}`);
}
assert.ok(onboarding.includes('WORK_APP_BASE_URL'),'Worker origin must be derived from configured Work deployment');
assert.ok(onboarding.includes('NEXUS_ONBOARDING_PUBLIC_ORIGINS'),'explicit onboarding origin allowlist missing');
assert.ok(onboarding.includes('new Set([\"available\",\"busy\",\"from-date\"])'),'Worker V1.0102 availability contract missing Busy');
assert.ok(onboarding.includes("'RECRUITER_SAFE'"),'recruiter-safe access scope missing');
assert.ok(onboarding.includes('privateDocumentsIncluded:false'),'private documents must remain excluded');
assert.ok(onboarding.includes('contactDetailsIncluded:false'),'contact details must remain excluded from recruiter-safe grant');
assert.ok(onboarding.includes('cvTextIncluded:false'),'CV text must remain excluded from recruiter-safe grant');
assert.ok(onboarding.includes('shareWithInvitingAgency'),'explicit Worker consent gate missing');

assert.equal(config.schema,'nosmo-work-runtime-config/v1');
assert.equal(typeof config.onboardingApiBase,'string');
assert.ok(bootstrap.includes('runtime-config.json'),'Worker bootstrap must read same-origin runtime config');
assert.ok(bootstrap.includes('url.protocol!==\"https:\"'),'remote onboarding API must require HTTPS');
assert.ok(bootstrap.includes('person-onboarding-v47-core.js'),'bootstrap must load preserved onboarding core');
assert.ok(core.includes('shareWithInvitingAgency'),'preserved Worker onboarding consent flow missing');
assert.ok(core.includes('post(\"/claim\"'),'preserved Worker claim flow missing');
assert.ok(core.includes('post(\"/drafts/save\"'),'preserved Worker save flow missing');
assert.ok(sw.includes("'./runtime-config.json'"),'runtime config must be available offline');
assert.ok(sw.includes("'./js/person-onboarding-v47-core.js'"),'onboarding core must be precached');

console.log(JSON.stringify({
  schema:'nosmo-worker-agency-handoff-contract/v1',
  onboardingActions:4,
  sameOriginRuntimeConfig:true,
  httpsRemoteApiRequired:true,
  busyAvailabilityPreserved:true,
  explicitConsentRequired:true,
  recruiterSafeProjection:true,
  privateWorkerFieldsExcluded:true
},null,2));
