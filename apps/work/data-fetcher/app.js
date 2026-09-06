(function(){
  "use strict";
  const KEY="nosmo-work:file-registry/v1";
  const DB_NAME="nosmo-work-files-v1";
  const DB_VERSION=1;
  const STORE_NAME="files";
  const $=id=>document.getElementById(id);
  let selected=[];

  function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
  function fmtBytes(n){if(n<1024)return n+" B";if(n<1024*1024)return (n/1024).toFixed(1)+" KB";return (n/1024/1024).toFixed(1)+" MB";}
  function registry(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch(_){return []}}
  function save(rows){localStorage.setItem(KEY,JSON.stringify(rows));}
  function message(text,kind){const el=$("message");if(!el)return;el.textContent=text;el.dataset.kind=kind||"info";}
  function fileRole(file){return /\b(cv|resume|curriculum)\b/i.test(String(file.name||"").replace(/[_-]+/g," "))?"cv":"document";}
  function newId(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2);}

  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error("INDEXED_DB_UNAVAILABLE"));return;}
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:"id"});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("INDEXED_DB_OPEN_FAILED"));
    });
  }
  async function putStoredFile(record,file){
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,"readwrite");
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error("FILE_STORE_FAILED"));
        tx.objectStore(STORE_NAME).put({
          id:record.id,
          name:file.name,
          size:file.size,
          type:file.type||"",
          lastModified:file.lastModified,
          addedAt:record.addedAt,
          fileRole:record.fileRole,
          blob:file
        });
      });
    }finally{
      db.close();
    }
  }
  function renderQueue(){
    const q=$("queue"); if(!q)return;
    $("queueTitle").textContent=selected.length?selected.length+" file(s) selected":"No files selected";
    $("uploadBtn").disabled=!selected.length;
    q.innerHTML=selected.length?selected.map((f,i)=>'<div class="file-row"><strong>'+esc(f.name)+'</strong><small>'+fmtBytes(f.size)+' · '+esc(f.type||"unknown")+' · '+esc(fileRole(f))+'</small><button data-remove="'+i+'" type="button">×</button></div>').join(""):'';
    q.querySelectorAll("[data-remove]").forEach(btn=>btn.addEventListener("click",()=>{selected.splice(Number(btn.dataset.remove),1);renderQueue();}));
  }
  function renderRegistry(){
    const rows=registry();
    const el=$("registry"); if(!el)return;
    $("summary").textContent=rows.length?rows.length+" file record(s) attached to this local profile draft":"No profile files added yet.";
    el.innerHTML=rows.length?rows.map(r=>'<div class="registry-row"><strong>'+esc(r.name)+'</strong><small>'+fmtBytes(r.size)+' · '+esc(r.type||"unknown")+' · '+esc(r.fileRole||"document")+' · '+(r.storage==="indexeddb-local"?"stored locally":"metadata only")+' · '+new Date(r.addedAt).toLocaleString()+'</small></div>').join(""):'<div class="empty">No profile files yet.</div>';
  }
  async function addSelected(){
    if(!selected.length){message("Choose one or more files first.","warn");return;}
    if(window.NOSMO_WORK_STORAGE_READY)await window.NOSMO_WORK_STORAGE_READY;
    $("uploadBtn").disabled=true;
    const rows=registry();
    const now=new Date().toISOString();
    let storedCount=0,metadataOnlyCount=0;
    for(const f of selected){
      const record={id:newId(),name:f.name,size:f.size,type:f.type||"",lastModified:f.lastModified,addedAt:now,fileRole:fileRole(f),storage:"metadata-only-local"};
      try{
        await putStoredFile(record,f);
        record.storage="indexeddb-local";
        storedCount++;
      }catch(err){
        console.warn("NOSMO local file storage unavailable for",f.name,err);
        metadataOnlyCount++;
      }
      rows.push(record);
    }
    save(rows);
    selected=[];
    $("fileInput").value="";
    renderQueue();renderRegistry();
    if(storedCount&&metadataOnlyCount){
      message(storedCount+" file(s) stored locally. "+metadataOnlyCount+" kept as metadata only because browser storage was unavailable.","warn");
    }else if(storedCount){
      message(storedCount+" file(s) stored locally on this device. They are not uploaded to NOSMO and can now be handed to Share CV.","ok");
    }else{
      message("File metadata added, but browser file storage is unavailable. Share CV will require re-selecting/downloading the file.","warn");
    }
  }
  function downloadManifest(){
    const payload={schema:"nosmo-work-data-fetcher-manifest/v1",createdAt:new Date().toISOString(),storageMode:"local-indexeddb-with-metadata-registry",files:registry()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="nosmo-work-file-manifest.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function init(){
    $("serviceStatus").textContent="standalone · local";
    $("projectKey").value="person-work-profile";
    $("projectKey").disabled=true;
    $("fileInput").addEventListener("change",e=>{selected=[...e.target.files];renderQueue();});
    $("dropzone").addEventListener("click",()=> $("fileInput").click());
    $("dropzone").addEventListener("dragover",e=>e.preventDefault());
    $("dropzone").addEventListener("drop",e=>{e.preventDefault();selected=[...e.dataTransfer.files];renderQueue();});
    $("clearBtn").addEventListener("click",()=>{selected=[];$("fileInput").value="";renderQueue();});
    $("uploadBtn").addEventListener("click",addSelected);
    $("refreshBtn").addEventListener("click",renderRegistry);
    $("confirmBtn").addEventListener("click",()=>message("Current local profile files are confirmed on this device.","ok"));
    $("manifestBtn").addEventListener("click",downloadManifest);
    renderQueue();renderRegistry();
    message("Standalone mode: selected file bytes can be stored in this browser for local Share CV. Nothing is uploaded to NOSMO.","info");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();