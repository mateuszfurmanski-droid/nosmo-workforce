(function(){
  "use strict";
  const FALLBACK="./data/default-worker-profile.json";
  const LEGACY="nosmo-person-card-freeware:work-card/v2";
  const MIGRATION="nosmo-person-card-freeware:canonical-work-profile-migrated/v1";
  let profile=null;
  const copy=value=>JSON.parse(JSON.stringify(value));
  function localKey(id){return "nexus-person-work-profile-local:"+(id||"local-worker")}
  function read(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch(_){return null}}
  function availability(p){const a=p.availability||{};if(a.status==="available-from")return "Available from date";if(a.status==="available")return "Available now";return "Not available"}
  function toCard(p){const portfolio=p.portfolio||{};return {
    profile:{currentRole:p.preferences?.primaryTrade||p.preferences?.targetRoles?.[0]||"",availability:availability(p),availableFrom:p.availability?.availableFrom||"",preferredLocation:(p.preferences?.locations||[]).join(", "),employmentType:(p.preferences?.employmentTypes||[]).join(" / ")},
    recentProjects:portfolio.recentProjects||[],workHistory:portfolio.workHistory||[],references:portfolio.references||[],skills:portfolio.skills||[],licences:portfolio.licences||[],notes:portfolio.notes||[]
  }}
  function fromCard(card){
    profile.preferences=profile.preferences||{};profile.availability=profile.availability||{};profile.portfolio=profile.portfolio||{};
    profile.preferences.primaryTrade=card.profile?.currentRole||"";
    profile.preferences.locations=String(card.profile?.preferredLocation||"").split(/[,;]/).map(x=>x.trim()).filter(Boolean);
    profile.preferences.employmentTypes=String(card.profile?.employmentType||"").split(/[/,;]/).map(x=>x.trim()).filter(Boolean);
    const label=card.profile?.availability;profile.availability.status=label==="Available now"?"available":label==="Available from date"?"available-from":"not-available";profile.availability.availableFrom=card.profile?.availableFrom||"";
    ["recentProjects","workHistory","references","skills","licences","notes"].forEach(k=>profile.portfolio[k]=copy(card[k]||[]));
    saveProfile();return profile;
  }
  function saveProfile(){if(profile)localStorage.setItem(localKey(profile.personId),JSON.stringify(profile))}
  function merge(base,local){return {...base,...local,availability:{...(base.availability||{}),...(local?.availability||{})},preferences:{...(base.preferences||{}),...(local?.preferences||{})},readiness:{...(base.readiness||{}),...(local?.readiness||{})},portfolio:{...(base.portfolio||{}),...(local?.portfolio||{})}}}
  async function init(){
    const params=new URLSearchParams(location.search);const draft=params.get("draft");let base=draft?read("nexus-work-profile-draft:"+draft):null;
    if(!base){try{base=await fetch(FALLBACK).then(r=>{if(!r.ok)throw new Error("PROFILE_LOAD_FAILED");return r.json()})}catch(_){base={schema:"nexus-person-work-profile/v1",personId:"local-worker",availability:{status:"not-available"},preferences:{},portfolio:{},jobMatches:[],agencies:[]}}}
    profile=merge(base,read(localKey(base.personId)));
    if(!localStorage.getItem(MIGRATION)){const legacy=read(LEGACY);if(legacy&&typeof legacy==="object"){const card=toCard(profile);["profile","recentProjects","workHistory","references","skills","licences","notes"].forEach(k=>{if(legacy[k])card[k]=legacy[k]});fromCard(card)}localStorage.setItem(MIGRATION,new Date().toISOString())}
    window.NEXUS_WORK_PROFILE=profile;window.dispatchEvent(new CustomEvent("nexus:work-profile-ready",{detail:{profile}}));
  }
  window.NOSMO_WORK_PROFILE_BRIDGE={getProfile:()=>profile,getCard:()=>profile?toCard(profile):null,saveCard:fromCard,saveProfile};
  init();
})();
