import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT='apps/agency/sites/v24-capture';
const PROJECT_ID='appgprj_6a967b267b348191904db8faca122765';
const candidates=[
  'https://nosmo-agency.mateusz-furmanski.chatgpt.site/',
  'https://nosmo-agency-v1-0025.mateusz-furmanski.chatgpt.site/',
  'https://nosmo-agency-v10025.mateusz-furmanski.chatgpt.site/',
  'https://nosmo-agency-v1-0024.mateusz-furmanski.chatgpt.site/'
];
const markers=['NOSMO AGENCY','Agency Desk','Worker-owned data','ASK NEXUS','Workers','Requests','Matches','Messages'];
const sha=(buf)=>crypto.createHash('sha256').update(buf).digest('hex');
const clean=(s)=>s.replace(/[^a-zA-Z0-9._/-]+/g,'_').replace(/\.{2,}/g,'.');
const extFor=(type,url)=>{
  const u=new URL(url); const ext=path.extname(u.pathname);
  if(ext&&ext.length<=8)return ext;
  if(type.includes('javascript'))return '.js'; if(type.includes('css'))return '.css'; if(type.includes('json'))return '.json';
  if(type.includes('html'))return '.html'; if(type.includes('svg'))return '.svg'; if(type.includes('png'))return '.png'; if(type.includes('jpeg'))return '.jpg';
  if(type.includes('webp'))return '.webp'; if(type.includes('woff2'))return '.woff2'; if(type.includes('woff'))return '.woff'; return '.bin';
};
await fs.rm(OUT,{recursive:true,force:true}); await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 NOSMO-Agency-Migration-Capture/1.0'});
let chosen=null; const attempts=[];
for(const url of candidates){
  const page=await context.newPage(); const responses=new Set(); page.on('response',r=>responses.add(r.url()));
  try{
    const nav=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(3500);
    const text=(await page.locator('body').innerText({timeout:10000}).catch(()=>''))||'';
    const score=markers.filter(m=>text.toLowerCase().includes(m.toLowerCase())).length;
    attempts.push({url,finalUrl:page.url(),status:nav?.status()??null,score,matched:markers.filter(m=>text.toLowerCase().includes(m.toLowerCase()))});
    if((nav?.status()??0)<400 && score>=4){chosen={page,url,finalUrl:page.url(),text,responses};break;}
  }catch(error){attempts.push({url,error:String(error?.message||error)});}
  await page.close();
}
await fs.writeFile(`${OUT}/capture-attempts.json`,JSON.stringify({projectId:PROJECT_ID,attempts},null,2));
if(!chosen){await browser.close();console.error('No candidate matched the known NOSMO Agency Sites UI markers');process.exit(2);}
const {page,finalUrl,text,responses}=chosen;
await page.screenshot({path:`${OUT}/reference-mobile.png`,fullPage:true});
const rendered=await page.evaluate(()=>document.documentElement.outerHTML);
await fs.writeFile(`${OUT}/rendered.html`,rendered);
await fs.writeFile(`${OUT}/VISIBLE_TEXT.txt`,text);
const rawResp=await context.request.get(finalUrl,{timeout:45000});
const raw=await rawResp.body(); await fs.writeFile(`${OUT}/raw-response.html`,raw);
const perf=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));
const urls=[...new Set([...responses,...perf])].filter(u=>/^https?:\/\//.test(u));
const resources=[];
for(const url of urls.slice(0,300)){
  try{
    const r=await context.request.get(url,{timeout:30000,failOnStatusCode:false}); if(!r.ok())continue;
    const body=await r.body(); if(body.length>12_000_000)continue;
    const type=r.headers()['content-type']||''; const u=new URL(url); const suffix=crypto.createHash('sha1').update(url).digest('hex').slice(0,10);
    let rel=clean(`${u.hostname}${u.pathname}`); if(!rel||rel.endsWith('/'))rel+='index'; rel=rel.replace(/^\/+/, '');
    const ext=extFor(type,url); if(!path.extname(rel))rel+=ext; rel=rel.replace(/(\.[A-Za-z0-9]+)$/i,`-${suffix}$1`);
    const target=`${OUT}/resources/${rel}`; await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,body);
    resources.push({url,status:r.status(),contentType:type,bytes:body.length,sha256:sha(body),path:target.replace(`${OUT}/`,'')});
  }catch(error){resources.push({url,error:String(error?.message||error)});}
}
const manifest={schema:'nosmo-agency-sites-capture/v1',projectId:PROJECT_ID,sitesVersion:24,sourceCandidate:chosen.url,finalUrl,capturedAt:new Date().toISOString(),markerMatches:markers.filter(m=>text.toLowerCase().includes(m.toLowerCase())),renderedSha256:sha(Buffer.from(rendered)),rawResponseSha256:sha(raw),resources};
await fs.writeFile(`${OUT}/CAPTURE_MANIFEST.json`,JSON.stringify(manifest,null,2));
await browser.close();
console.log(JSON.stringify({finalUrl,markerMatches:manifest.markerMatches,resources:resources.filter(r=>r.path).length,renderedSha256:manifest.renderedSha256},null,2));
