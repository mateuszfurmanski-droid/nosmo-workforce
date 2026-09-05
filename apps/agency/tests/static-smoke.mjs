import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const vercel=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m)=>m[1]));
const jsIds=[...js.matchAll(/(?<!\$)\$\("([^"]+)"\)/g)].map((m)=>m[1]);
const missing=[...new Set(jsIds.filter((id)=>!ids.has(id)))];
assert.deepEqual(missing,[],`app.js references missing HTML ids: ${missing.join(', ')}`);

for(const required of [
  'nexusLogo','authGate','accountSetup','appShell','bottomNav','workerSearch','requestsList',
  'matchRequestSelect','nexusQuestion','nexusSuggestions','nexusAnswer','messagesList','profileForm'
]) assert(ids.has(required),`missing critical UI id ${required}`);

assert.match(js,/nexusLogo"\)\.addEventListener\("click",\(\)=>showView\("nexus"\)\)/,'N logo must open Ask Nexus');
assert.match(js,/\$\$\('\[data-question\]'\)/,'suggested questions must have click handlers');
assert.match(js,/\/api\/auth\/user/,'must use normal authenticated session endpoint');
assert.match(js,/\/api\/person-card\/agency\/v1\/dashboard/,'must use tenant-scoped dashboard endpoint');
assert.match(js,/\/api\/person-card\/agency\/v1\/ask-nexus\/query/,'must use Agency Ask Nexus endpoint');
assert.match(js,/\/api\/person-card\/agency\/v1\/requests/,'must use persisted requests endpoint');
assert.match(js,/\/api\/person-card\/agency\/v1\/applications/,'must use persisted application pipeline endpoint');
assert.doesNotMatch(js,/tenant[_-]?id\s*[:=]/i,'client must not expose a tenant id selector/override');
assert.doesNotMatch(html,/Login to ChatGPT|ChatGPT identity required/i,'normal Agency sign-in must not be presented as a ChatGPT identity gate');
assert.doesNotMatch(css,/purple|#9a64ff/i,'NOSMO Agency UI must not introduce purple styling');
assert.match(css,/--silent-gold:/,'Silent Gold token missing');
assert.match(css,/--nexus-blue:/,'Nexus Blue token missing');
assert.match(css,/--eco-green:/,'Eco Green token missing');

for(const route of [
  '/api/auth/user','/api/login','/api/callback','/api/logout',
  '/api/person-card/agency/account','/api/person-card/agency/profile',
  '/api/person-card/agency/candidates','/api/person-card/agency/activity',
  '/api/person-card/agency/v1/_health','/api/person-card/agency/v1/dashboard',
  '/api/person-card/agency/v1/roster','/api/person-card/agency/v1/roster/import',
  '/api/person-card/agency/v1/requests','/api/person-card/agency/v1/requests/:requestId/match',
  '/api/person-card/agency/v1/requests/:requestId/applications',
  '/api/person-card/agency/v1/applications/:applicationId',
  '/api/person-card/agency/v1/placements','/api/person-card/agency/v1/ask-nexus/query'
]) assert(server.includes(route),`standalone server missing ${route}`);

assert.match(server,/agencyContext\(req\.user\.id\)/,'server must derive Agency context from authenticated membership');
assert.doesNotMatch(server,/req\.body\?\.tenantId|req\.query\.tenantId|x-tenant-id/i,'server must not accept arbitrary tenant override');
assert.match(server,/g\.scope='RECRUITER_SAFE'/,'connected Worker data must be consent scoped');
assert.match(server,/workerAppConfirmed:false/,'Agency import must not claim Worker App confirmation');
assert.match(server,/algorithm:"deterministic-v1"/,'match generation must be explainable deterministic V1');
assert.match(server,/privateWorkerFieldsIncluded:false/,'Ask Nexus must declare private Worker fields excluded');
assert.doesNotMatch(vercel.rewrites?.map((r)=>r.destination).join(' ')||'',/nexus-backend-yata|onrender\.com/i,'canonical deployment must not proxy Agency API to the old backend');
assert.equal(pkg.type,'module');
assert(pkg.dependencies?.express,'standalone Express runtime missing');
assert(pkg.dependencies?.pg,'standalone Postgres runtime missing');
assert(pkg.dependencies?.['openid-client'],'standalone OIDC runtime missing');
assert(vercel.functions?.['server.js'],'Vercel must deploy the canonical Express server');

console.log(`NOSMO Agency static smoke PASS: ${ids.size} UI ids checked; standalone API, consent boundary and tenant scoping contracts present.`);
