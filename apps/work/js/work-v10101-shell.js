(function(){
  "use strict";
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const APPEARANCE_KEY="nosmo-work:v1:appearance";
  const REPLY_KEY="nosmo-work:v1:reply-alerts";
  const WA_KEY="nosmo-work:v1:show-whatsapp";
  function getBool(key, fallback){const v=localStorage.getItem(key);return v===null?fallback:v==="true"}
  function setAppearance(value){
    const appearance=value||"midnight-black";
    document.documentElement.dataset.workAppearance=appearance;
    localStorage.setItem(APPEARANCE_KEY,appearance);
    const light=appearance==="architect-white"||appearance==="windows-grey";
    document.documentElement.dataset.workTheme=light?"light":"dark";
    localStorage.setItem("nosmo-work:v1:theme",light?"light":"dark");
    qa("[data-appearance]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.appearance===appearance)));
  }
  function askNexus(){
    if(typeof window.NEXUS_OPEN_WORK_PANEL==="function"){window.NEXUS_OPEN_WORK_PANEL("ai");return}
    if(!location.pathname.endsWith("index.html")&&!location.pathname.endsWith("/")){location.href="./index.html#ask-nexus";return}
    location.hash="ask-nexus";
  }
  function hydrateWorker(profile){
    const first=q(".first"), last=q(".last"), role=q(".role"), trade=q(".trade"), photo=q(".photo");
    if(!first||!last)return;
    const display=String(profile?.displayName||profile?.name||"").trim();
    const bits=display.split(/\s+/).filter(Boolean);
    first.textContent=bits[0]||"Worker";
    last.textContent=bits.slice(1).join(" ")||"Card";
    const primary=profile?.preferences?.primaryTrade||"Add your trade";
    const target=profile?.preferences?.targetRoles?.[0]||"Worker profile";
    if(role)role.textContent=target;
    if(trade)trade.textContent=primary;
    const meta=qa(".metaLine span");
    if(meta[0])meta[0].textContent=(profile?.preferences?.locations||[]).join(", ")||"United Kingdom";
    if(meta[1])meta[1].textContent="Worker-owned profile";
    if(photo)photo.setAttribute("aria-label",display||"NOSMO Work profile");
    qa("a.iconLink").forEach(a=>{a.removeAttribute("href");a.setAttribute("aria-disabled","true")});
  }
  function init(){
    document.title="NOSMO Work";
    setAppearance(localStorage.getItem(APPEARANCE_KEY)||"midnight-black");
    qa("[data-nosmo-ask-nexus]").forEach(el=>el.addEventListener("click",askNexus));
    qa("[data-appearance]").forEach(el=>el.addEventListener("click",()=>setAppearance(el.dataset.appearance)));
    const reply=q("#replyAlertsSetting"), wa=q("#whatsappContactsSetting");
    if(reply){reply.checked=getBool(REPLY_KEY,true);reply.addEventListener("change",()=>localStorage.setItem(REPLY_KEY,String(reply.checked)))}
    if(wa){wa.checked=getBool(WA_KEY,true);wa.addEventListener("change",()=>localStorage.setItem(WA_KEY,String(wa.checked)))}
    q("#settingsLanguageButton")?.addEventListener("click",()=>q(".workLangButton")?.click());
    q("#settingsWorkModeButton")?.addEventListener("click",()=>{location.href="./screen.html?screen=work-mode"});
    q("#workCameraButton")?.addEventListener("click",()=>q("#workCameraInput")?.click());
    q("#workCameraInput")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f){localStorage.setItem("nosmo-work:v1:last-camera-name",f.name);alert("Photo selected locally. It has not been uploaded or shared.")}});
    if(q(".profile")&&!q(".canonicalProfileActions")){
      const row=document.createElement("div");row.className="canonicalProfileActions";
      row.innerHTML='<button type="button" id="canonicalEditProfile">EDIT PROFILE</button><button type="button" id="canonicalShareProfile">SHARE</button>';
      q(".profile").appendChild(row);
      q("#canonicalEditProfile")?.addEventListener("click",()=>{if(typeof window.NEXUS_OPEN_ONBOARDING==="function")window.NEXUS_OPEN_ONBOARDING();else location.href="./onboarding.html"});
      q("#canonicalShareProfile")?.addEventListener("click",async()=>{const data={title:"NOSMO Work",text:"NOSMO Work profile",url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);alert("Profile link copied")}}catch(_){}});
    }
    hydrateWorker(window.NEXUS_WORK_PROFILE||{});
    window.addEventListener("nexus:work-profile-ready",e=>hydrateWorker(e.detail?.profile||window.NEXUS_WORK_PROFILE||{}));
    if(location.hash==="#ask-nexus")setTimeout(askNexus,120);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
