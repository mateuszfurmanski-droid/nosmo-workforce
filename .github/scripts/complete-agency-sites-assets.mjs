import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT='apps/agency/sites/v24/public';
const SOURCE='https://nosmo-agency.mateusz-furmanski.chatgpt.site';
const sha=(b)=>crypto.createHash('sha256').update(b).digest('hex');
const refsRegex=[
  /(?:["'`(=,:]|\b)(?:\.\/?|\/)?(assets\/[A-Za-z0-9._~()+-]+\.(?:js|css|json|wasm|svg|png|jpg|jpeg|webp|woff2?|ttf))/g,
  /["'`](\/app-icons\/[A-Za-z0-9._~()+-]+\.(?:svg|png|jpg|jpeg|webp))["'`]/g,
  /["'`](\/(?:nosmo-logo|nexus-logo-ui-mark-n)\.png)["'`]/g,
];
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
const manifestPath='apps/agency/sites/v24/CAPTURE_MANIFEST.json';
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const prior=[...(manifest.dependencyClosure?.downloaded||[])];
const downloaded=[];
const collectRefs=(text)=>{const refs=new Set();for(const re of refsRegex){re.lastIndex=0;let m;while((m=re.exec(text)))refs.add(m[1].replace(/^\//,''))}return refs};
for(let round=0;round<12;round++){
  const files=await walk(ROOT);const refs=new Set();
  for(const file of files){if(!/\.(?:html|js|css|json)$/.test(file))continue;const text=await fs.readFile(file,'utf8');for(const rel of collectRefs(text))refs.add(rel)}
  const existing=new Set(files.map(f=>f.replaceAll('\\','/').replace(ROOT.replaceAll('\\','/')+'/','')));
  const missing=[...refs].filter(rel=>!existing.has(rel));
  if(!missing.length)break;
  let added=0;
  for(const rel of missing){
    const url=`${SOURCE}/${rel}`;const res=await fetch(url,{redirect:'follow'});if(!res.ok)throw new Error(`Missing live asset ${res.status} ${url}`);
    const body=Buffer.from(await res.arrayBuffer());const target=path.join(ROOT,rel);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,body);
    downloaded.push({url,status:res.status,contentType:res.headers.get('content-type')||'',bytes:body.length,sha256:sha(body),path:`public/${rel}`,dependencyClosure:true});added++;
  }
  if(!added)break;
}
const finalFiles=await walk(ROOT);const existing=new Set(finalFiles.map(f=>f.replaceAll('\\','/').replace(ROOT.replaceAll('\\','/')+'/','')));const unresolved=new Set();
for(const file of finalFiles){if(!/\.(?:html|js|css|json)$/.test(file))continue;const text=await fs.readFile(file,'utf8');for(const rel of collectRefs(text))if(!existing.has(rel))unresolved.add(rel)}
if(unresolved.size)throw new Error(`Unresolved asset dependencies: ${[...unresolved].join(', ')}`);
const allDownloaded=[...new Map([...prior,...downloaded].map(x=>[x.path,x])).values()];
manifest.dependencyClosure={completedAt:new Date().toISOString(),source:SOURCE,downloaded:allDownloaded,unresolved:[],publicFiles:[...existing].sort()};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('apps/agency/sites/v24/ASSET_CLOSURE.txt',`Exact Sites dependency closure PASS\nDownloaded: ${allDownloaded.length}\nUnresolved: 0\n\n${allDownloaded.map(x=>`${x.sha256}  ${x.path}`).join('\n')}\n`);
console.log(JSON.stringify({newlyDownloaded:downloaded.map(x=>x.path),totalDownloaded:allDownloaded.length,unresolved:[]},null,2));
