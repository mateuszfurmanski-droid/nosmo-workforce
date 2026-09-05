import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const vercel=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m)=>m[1]));
const jsIds=[...js.matchAll(/\$\("([^"]+)"\)/g)].map((m)=>m[1]);
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

const apiRewrite=vercel.rewrites?.find((r)=>r.source==='/api/:path*');
assert(apiRewrite,'same-origin /api rewrite missing');
assert.equal(apiRewrite.destination,'https://nexus-backend-yata.onrender.com/api/:path*');

console.log(`NOSMO Agency static smoke PASS: ${ids.size} UI ids checked; tenant selector absent; critical API contracts present.`);
