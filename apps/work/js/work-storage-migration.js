(function(){
  "use strict";
  const MARKER="nosmo-work:migration:person-card-freeware/v1";
  const DB_MARKER="nosmo-work:migration:indexeddb-files/v1";
  const PAIRS=[
    ["nosmo-person-card-freeware:documents/v1","nosmo-work:documents/v1"],
    ["nosmo-person-card-freeware:work-card/v2","nosmo-work:work-card/v2"],
    ["nosmo-person-card-freeware:work-card/v1","nosmo-work:work-card/v1"],
    ["nosmo-person-card-freeware:jobs/v1","nosmo-work:jobs/v1"],
    ["nosmo-person-card-freeware:applications/v1","nosmo-work:applications/v1"],
    ["nosmo-person-card-freeware:employers/v1","nosmo-work:employers/v1"],
    ["nosmo-person-card-freeware:application-log/v1","nosmo-work:application-log/v1"],
    ["nosmo-person-card-freeware:file-registry/v1","nosmo-work:file-registry/v1"]
  ];
  const OLD_DRAFT_PREFIX="nosmo-person-card-freeware:contact-draft/v1:";
  const NEW_DRAFT_PREFIX="nosmo-work:contact-draft/v1:";
  const OLD_DB="nosmo-person-card-freeware-files-v1";
  const NEW_DB="nosmo-work-files-v1";
  const STORE="files";

  function copyLocalStorage(){
    if(!window.localStorage)return;
    PAIRS.forEach(([oldKey,newKey])=>{
      if(localStorage.getItem(newKey)!==null)return;
      const value=localStorage.getItem(oldKey);
      if(value!==null)localStorage.setItem(newKey,value);
    });
    const keys=[];
    for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
    keys.filter(Boolean).filter(key=>key.startsWith(OLD_DRAFT_PREFIX)).forEach(oldKey=>{
      const newKey=NEW_DRAFT_PREFIX+oldKey.slice(OLD_DRAFT_PREFIX.length);
      if(localStorage.getItem(newKey)===null)localStorage.setItem(newKey,localStorage.getItem(oldKey));
    });
    localStorage.setItem(MARKER,new Date().toISOString());
  }

  function openNewDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(NEW_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"id"});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("NOSMO_WORK_DB_OPEN_FAILED"));
    });
  }
  function openLegacyDb(){
    return new Promise(resolve=>{
      if(!window.indexedDB){resolve(null);return;}
      const req=indexedDB.open(OLD_DB);
      let created=false;
      req.onupgradeneeded=()=>{created=true;try{req.transaction.abort()}catch(_){}};
      req.onerror=()=>resolve(null);
      req.onsuccess=()=>{if(created){try{req.result.close();indexedDB.deleteDatabase(OLD_DB)}catch(_){}resolve(null);return}resolve(req.result);};
    });
  }
  async function migrateDb(){
    if(!window.indexedDB)return false;
    if(localStorage.getItem(DB_MARKER))return true;
    const oldDb=await openLegacyDb();
    const newDb=await openNewDb();
    try{
      if(oldDb&&oldDb.objectStoreNames.contains(STORE)){
        const rows=await new Promise((resolve,reject)=>{
          const req=oldDb.transaction(STORE,"readonly").objectStore(STORE).getAll();
          req.onsuccess=()=>resolve(req.result||[]);
          req.onerror=()=>reject(req.error||new Error("NOSMO_WORK_LEGACY_DB_READ_FAILED"));
        });
        if(rows.length){
          await new Promise((resolve,reject)=>{
            const tx=newDb.transaction(STORE,"readwrite");
            const store=tx.objectStore(STORE);
            rows.forEach(row=>store.put(row));
            tx.oncomplete=()=>resolve();
            tx.onerror=()=>reject(tx.error||new Error("NOSMO_WORK_DB_COPY_FAILED"));
          });
        }
      }
      localStorage.setItem(DB_MARKER,new Date().toISOString());
      return true;
    }finally{
      try{oldDb&&oldDb.close()}catch(_){}
      try{newDb.close()}catch(_){}
    }
  }

  try{copyLocalStorage()}catch(err){console.warn("NOSMO Work local storage migration skipped",err)}
  window.NOSMO_WORK_STORAGE_READY=migrateDb().catch(err=>{console.warn("NOSMO Work IndexedDB migration skipped",err);return false});
})();
