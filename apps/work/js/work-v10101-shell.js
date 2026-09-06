(function(){
  "use strict";
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const APPEARANCE_KEY="nosmo-work:v1:appearance";
  const REPLY_KEY="nosmo-work:v1:reply-alerts";
  const WA_KEY="nosmo-work:v1:show-whatsapp";
  const AVAILABILITY_KEY="nosmo-work:v1:availability";
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
  function availabilityOptionLabel(state){
    const option=q('#availabilityState option[value="'+state+'"],#availability option[value="'+state+'"]');
    if(option)return option.textContent.trim();
    return state==="busy"?"Busy":state==="from-date"?"Ready on date":"Available";
  }
  function currentAvailability(){
    try{
      const value=JSON.parse(localStorage.getItem(AVAILABILITY_KEY)||"null");
      if(value&&["available","busy","from-date"].includes(value.state))return value;
    }catch(_){}
    return {state:"available",date:""};
  }
  function fallbackAvailabilitySheet(button){
    let sheet=q("#workAvailabilitySheet");
    if(sheet){sheet.classList.add("open");return}
    const current=currentAvailability();
    sheet=document.createElement("div");
    sheet.id="workAvailabilitySheet";
    sheet.className="workAvailabilitySheet open";
    sheet.innerHTML='<div class="workAvailabilityPanel" role="dialog" aria-modal="true"><h3>Availability</h3><div class="workAvailabilityChoices"><button type="button" class="workAvailabilityChoice" data-state="available"><span class="workStatusLed"></span><span>'+availabilityOptionLabel("available")+'</span></button><button type="button" class="workAvailabilityChoice" data-state="busy"><span class="workStatusLed"></span><span>'+availabilityOptionLabel("busy")+'</span></button><button type="button" class="workAvailabilityChoice" data-state="from-date"><span class="workStatusLed"></span><span>'+availabilityOptionLabel("from-date")+'</span></button></div><div class="workReadyDate"><label>Ready date</label><input type="date" id="workReadyDateInput"></div><button class="workAvailabilityDone" type="button">Done</button></div>';
    document.body.appendChild(sheet);
    sheet.dataset.pendingState=current.state;
    const dateInput=q("#workReadyDateInput",sheet);
    dateInput.value=current.date||"";
    q(".workReadyDate",sheet)?.classList.toggle("visible",current.state==="from-date");
    sheet.addEventListener("click",event=>{if(event.target===sheet)sheet.classList.remove("open")});
    qa(".workAvailabilityChoice",sheet).forEach(choice=>choice.addEventListener("click",()=>{
      sheet.dataset.pendingState=choice.dataset.state;
      q(".workReadyDate",sheet)?.classList.toggle("visible",choice.dataset.state==="from-date");
    }));
    q(".workAvailabilityDone",sheet)?.addEventListener("click",()=>{
      const state=sheet.dataset.pendingState||"available";
      const date=dateInput.value||"";
      if(state==="from-date"&&!date){dateInput.focus();return}
      const value={state,date:state==="from-date"?date:""};
      localStorage.setItem(AVAILABILITY_KEY,JSON.stringify(value));
      qa("#availabilityState,#availability").forEach(select=>{select.value=state});
      qa("#availabilityDate,#availableFrom").forEach(input=>{input.value=value.date});
      button.dataset.state=state;
      const label=state==="from-date"?availabilityOptionLabel(state)+(value.date?" · "+value.date:""):availabilityOptionLabel(state);
      const textSpan=button.querySelector("span:last-child");
      if(textSpan)textSpan.textContent=label;
      window.dispatchEvent(new CustomEvent("nosmo:availability-change",{detail:value}));
      sheet.classList.remove("open");
    });
  }
  function bindAvailabilityFallback(){
    document.addEventListener("click",event=>{
      const button=event.target.closest?.("#workAvailabilityCompact");
      if(!button)return;
      window.setTimeout(()=>{
        const sheet=q("#workAvailabilitySheet");
        if(sheet?.classList.contains("open"))return;
        fallbackAvailabilitySheet(button);
      },0);
    });
  }
  function init(){
    if(location.pathname.endsWith("/index.html")||location.pathname.endsWith("/"))document.title="NOSMO Work";
    setAppearance(localStorage.getItem(APPEARANCE_KEY)||"midnight-black");
    bindAvailabilityFallback();
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
