import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT='apps/agency/sites/v24/public';
const SOURCE='https://nosmo-agency.mateusz-furmanski.chatgpt.site';
const sha=(b)=>crypto.createHash('sha256').update(b).digest('hex');
const assetRe=/(?:["'`(=,:]|\b)(?:\.\/?|\/)?(assets\/[A-Za-z0-9._~()+-]+\.(?:js|css|json|wasm|svg|png|jpg|jpeg|webp|woff2?|ttf))/g;
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
const manifestPath='apps/agency/sites/v24/CAPTURE_MANIFEST.json';
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const known=new Map((manifest.resources||[]).filter(r=>r.url&&r.sha256).map(r=>[new URL(r.url).pathname.replace(/^\//,''),r]));
const downloaded=[];
for(let round=0;round<12;round++){
  const files=await walk(ROOT);const refs=new Set();
  for(const file of files){if(!/\.(?:html|js|css|json)$/.test(file))continue;const text=await fs.readFile(file,'utf8');let m;while((m=assetRe.exec(text)))refs.add(m[1]);}
  const missing=[...refs].filter(rel=>!files.some(f=>f.replaceAll('\\','/').endsWith('/'+rel)));
  if(!missing.length)break;
  let added=0;
  for(const rel of missing){
    const url=`${SOURCE}/${rel}`;const res=await fetch(url,{redirect:'follow'});if(!res.ok)throw new Error(`Missing live asset ${res.status} ${url}`);
    const body=Buffer.from(await res.arrayBuffer());const target=path.join(ROOT,rel);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,body);
    const item={url,status:res.status,contentType:res.headers.get('content-type')||'',bytes:body.length,sha256:sha(body),path:`public/${rel}`,dependencyClosure:true};
    downloaded.push(item);known.set(rel,item);added++;
  }
  if(!added)break;
}
const finalFiles=await walk(ROOT);const unresolved=new Set();
for(const file of finalFiles){if(!/\.(?:html|js|css|json)$/.test(file))continue;const text=await fs.readFile(file,'utf8');let m;while((m=assetRe.exec(text))){const rel=m[1];if(!finalFiles.some(f=>f.replaceAll('\\','/').endsWith('/'+rel)))unresolved.add(rel)}}
if(unresolved.size)throw new Error(`Unresolved asset dependencies: ${[...unresolved].join(', ')}`);
manifest.dependencyClosure={completedAt:new Date().toISOString(),source:SOURCE,downloaded,unresolved:[],publicFiles:finalFiles.map(f=>f.replace(ROOT+'/','')).sort()};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('apps/agency/sites/v24/ASSET_CLOSURE.txt',`Exact Sites dependency closure PASS\nDownloaded: ${downloaded.length}\nUnresolved: 0\n\n${downloaded.map(x=>`${x.sha256}  ${x.path}`).join('\n')}\n`);
console.log(JSON.stringify({downloaded:downloaded.map(x=>x.path),unresolved:[]},null,2));
