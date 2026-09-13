import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here=path.dirname(new URL(import.meta.url).pathname);
const pub=path.join(here,'public');
const manifest=JSON.parse(fs.readFileSync(path.join(here,'CAPTURE_MANIFEST.json'),'utf8'));
const hash=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const overlays=new Map((manifest.securityOverlays||[]).map(r=>[
  String(r.path||'').replace(/^public\//,''),
  r
]));
const expected=[];
for(const r of manifest.resources||[]){
  if(!r.url||!r.sha256)continue;
  const u=new URL(r.url);
  if(u.hostname!=='nosmo-agency.mateusz-furmanski.chatgpt.site')continue;
  if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/cdn-cgi/'))continue;
  const rel=u.pathname==='/'?'index.html':u.pathname.replace(/^\//,'');
  const overlay=overlays.get(rel);
  expected.push({rel,sha256:overlay?.sha256||r.sha256,source:r.url});
  overlays.delete(rel);
}
for(const r of manifest.dependencyClosure?.downloaded||[]){
  const rel=String(r.path||'').replace(/^public\//,'');
  if(rel)expected.push({rel,sha256:r.sha256,source:r.url});
}
for(const [rel,r] of overlays){
  if(rel&&r.sha256)expected.push({rel,sha256:r.sha256,source:'declared security overlay'});
}
const unique=new Map(expected.map(x=>[x.rel,x]));
const errors=[];
for(const item of unique.values()){
  const file=path.join(pub,item.rel);
  if(!fs.existsSync(file)){errors.push(`MISSING ${item.rel}`);continue}
  const got=hash(file);
  if(got!==item.sha256)errors.push(`HASH ${item.rel} expected=${item.sha256} got=${got}`);
}
const html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
for(const marker of ['NOSMO AGENCY V1.0025','Agency Desk','ASK NEXUS','Smart File Inbox','Worker-owned data.','EMERGENCY']){
  if(!html.toLowerCase().includes(marker.toLowerCase()))errors.push(`MARKER ${marker}`);
}
if(manifest.dependencyClosure?.unresolved?.length)errors.push(`UNRESOLVED ${manifest.dependencyClosure.unresolved.join(',')}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`NOSMO Agency Sites v24 parity PASS: ${unique.size} verified public files; ${(manifest.securityOverlays||[]).length} declared security overlays; 0 unresolved dependencies.`);
