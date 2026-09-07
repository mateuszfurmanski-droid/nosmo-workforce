(function(){
  "use strict";

  const PERSON_KEY="nosmo-work:v1:person-id";
  const TOKEN_PREFIX="nexus-person-work-draft-token:";
  const PENDING_KEY="nosmo-work:v1:agency-status-pending";
  const LAST_SYNC_KEY="nosmo-work:v1:agency-status-sync";
  let apiBase="";
  let syncing=false;

  function trustedBase(value){
    if(typeof value!=="string"||!value.trim())return "";
    try{
      const url=new URL(value.trim());
      const local=url.protocol==="http:"&&(url.hostname==="localhost"||url.hostname==="127.0.0.1");
      if(url.protocol!=="https:"&&!local)return "";
      return url.toString().replace(/\/$/,"");
    }catch{return ""}
  }
  function safeJson(value,fallback){try{return JSON.parse(value)||fallback}catch{return fallback}}
  function currentPersonId(){
    let personId="";
    try{personId=localStorage.getItem(PERSON_KEY)||""}catch{}
    if(personId){
      try{if(localStorage.getItem(TOKEN_PREFIX+personId))return personId}catch{}
    }
    const candidates=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||"";
        if(key.startsWith(TOKEN_PREFIX)&&localStorage.getItem(key))candidates.push(key.slice(TOKEN_PREFIX.length));
      }
    }catch{}
    if(candidates.length===1){
      personId=candidates[0];
      try{localStorage.setItem(PERSON_KEY,personId)}catch{}
      return personId;
    }
    return "";
  }
  function draftToken(personId){
    try{return personId?localStorage.getItem(TOKEN_PREFIX+personId)||"":""}catch{return ""}
  }
  function normalize(detail){
    const state=String(detail?.state||detail?.status||"");
    if(!["available","busy","from-date"].includes(state))return null;
    const date=state==="from-date"?String(detail?.date||detail?.availableFrom||"").slice(0,40):"";
    if(state==="from-date"&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    return {state,date};
  }
  function rememberPending(value){
    try{localStorage.setItem(PENDING_KEY,JSON.stringify({...value,queuedAt:new Date().toISOString()}))}catch{}
  }
  function clearPending(){try{localStorage.removeItem(PENDING_KEY)}catch{}}
  function emit(detail){window.dispatchEvent(new CustomEvent("nosmo:agency-status-sync",{detail}))}

  async function sync(value){
    if(syncing||!apiBase)return false;
    const personId=currentPersonId();
    const token=draftToken(personId);
    if(!personId||!token)return false;
    syncing=true;
    try{
      const response=await fetch(apiBase+"/availability",{
        method:"POST",
        headers:{"content-type":"application/json"},
        credentials:"omit",
        cache:"no-store",
        body:JSON.stringify({draftToken:token,state:value.state,date:value.date})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||("HTTP_"+response.status));
      const marker={personId,state:value.state,date:value.date,persistedAt:payload.persistedAt||null,lastSyncedAt:new Date().toISOString()};
      try{localStorage.setItem(LAST_SYNC_KEY,JSON.stringify(marker))}catch{}
      clearPending();
      emit({ok:true,...marker});
      return true;
    }catch(error){
      rememberPending(value);
      emit({ok:false,personId,state:value.state,date:value.date,error:error?.message||"NEXUS_WORK_AVAILABILITY_SYNC_FAILED"});
      return false;
    }finally{syncing=false}
  }
  async function queue(detail){
    const value=normalize(detail);
    if(!value)return;
    rememberPending(value);
    await sync(value);
  }
  async function retryPending(){
    const pending=safeJson(localStorage.getItem(PENDING_KEY),null);
    const value=normalize(pending);
    if(value)await sync(value);
  }
  async function loadConfig(){
    try{
      const response=await fetch("./runtime-config.json",{cache:"no-store"});
      if(response.ok){const config=await response.json();apiBase=trustedBase(config?.onboardingApiBase)}
    }catch{}
    await retryPending();
  }

  window.addEventListener("nosmo:availability-change",event=>{void queue(event.detail)});
  window.addEventListener("online",()=>{void retryPending()});
  void loadConfig();
})();
