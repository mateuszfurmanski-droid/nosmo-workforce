import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.resolve(here,'..');
const repo=path.resolve(runtime,'../../..');
const onboardingPath=path.join(runtime,'api/person-card/onboarding/[...path].js');
const availabilityPath=path.join(runtime,'api/person-card/onboarding/availability.js');
const worker=path.join(repo,'apps/work');
const bootstrapPath=path.join(worker,'js/person-onboarding-v47.js');
const corePath=path.join(worker,'js/person-onboarding-v47-core.js');
const statusSyncPath=path.join(worker,'js/work-agency-status-sync.js');
const shellPath=path.join(worker,'js/work-v10101-shell.js');
const configPath=path.join(worker,'runtime-config.json');
const swPath=path.join(worker,'sw.js');

for(const file of [onboardingPath,availabilityPath,bootstrapPath,corePath,statusSyncPath,shellPath,configPath,swPath]){
  assert.ok(fs.existsSync(file),`missing handoff file: ${path.relative(repo,file)}`);
}

const onboarding=fs.readFileSync(onboardingPath,'utf8');
const availability=fs.readFileSync(availabilityPath,'utf8');
const bootstrap=fs.readFileSync(bootstrapPath,'utf8');
const core=fs.readFileSync(corePath,'utf8');
const statusSync=fs.readFileSync(statusSyncPath,'utf8');
const shell=fs.readFileSync(shellPath,'utf8');
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

assert.ok(availability.includes('nexus-person-work-availability-sync/v1'),'availability sync response contract missing');
assert.ok(availability.includes('new Set([\"available\",\"busy\",\"from-date\"])'),'availability endpoint must accept all canonical Worker states');
assert.ok(availability.includes("w.status='active'"),'availability sync must require an active Worker profile');
assert.ok(availability.includes("i.status='CLAIMED'"),'availability sync must remain bound to the signed invite authority');
assert.ok(availability.includes('PERSON_WORK_AVAILABILITY_UPDATED'),'availability audit event missing');
assert.ok(availability.includes('privateWorkerFieldsIncluded:false'),'availability sync must not expose private Worker fields');
assert.ok(availability.includes('WORK_APP_BASE_URL'),'availability endpoint must enforce the Worker origin');

assert.equal(config.schema,'nosmo-work-runtime-config/v1');
assert.equal(typeof config.onboardingApiBase,'string');
assert.ok(bootstrap.includes('runtime-config.json'),'Worker bootstrap must read same-origin runtime config');
assert.ok(bootstrap.includes('url.protocol!==\"https:\"'),'remote onboarding API must require HTTPS');
assert.ok(bootstrap.includes('person-onboarding-v47-core.js'),'bootstrap must load preserved onboarding core');
assert.ok(core.includes('shareWithInvitingAgency'),'preserved Worker onboarding consent flow missing');
assert.ok(core.includes('post(\"/claim\"'),'preserved Worker claim flow missing');
assert.ok(core.includes('post(\"/drafts/save\"'),'preserved Worker save flow missing');

assert.ok(statusSync.includes('nosmo:availability-change'),'Worker status sync must subscribe to canonical availability events');
assert.ok(statusSync.includes('nexus-person-work-draft-token:'),'Worker status sync must use existing scoped draft authority');
assert.ok(statusSync.includes('nosmo-work:v1:agency-status-pending'),'offline status changes must remain queued');
assert.ok(statusSync.includes('window.addEventListener(\"online\"'),'queued status changes must retry after connectivity returns');
assert.ok(statusSync.includes('apiBase+\"/availability\"'),'Worker must send status only to the trusted onboarding runtime');
assert.ok(!statusSync.includes('cvText:'),'status sync payload must not contain CV text');
assert.ok(!statusSync.includes('phone:'),'status sync payload must not contain contact phone');
assert.ok(!statusSync.includes('email:'),'status sync payload must not contain contact email');
assert.ok(shell.includes('work-agency-status-sync.js'),'canonical Worker shell must load status synchronization');
assert.ok(sw.includes("'./runtime-config.json'"),'runtime config must be available offline');
assert.ok(sw.includes("'./js/person-onboarding-v47-core.js'"),'onboarding core must be precached');
assert.ok(sw.includes("'./js/work-agency-status-sync.js'"),'status synchronization runtime must be precached');

console.log(JSON.stringify({
  schema:'nosmo-worker-agency-handoff-contract/v1',
  onboardingActions:4,
  sameOriginRuntimeConfig:true,
  httpsRemoteApiRequired:true,
  busyAvailabilityPreserved:true,
  explicitConsentRequired:true,
  recruiterSafeProjection:true,
  privateWorkerFieldsExcluded:true,
  postOnboardingStatusSync:true,
  offlineStatusRetry:true
},null,2));
