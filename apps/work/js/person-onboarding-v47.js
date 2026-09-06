(function(){
  "use strict";

  const params=new URLSearchParams(window.location.search);
  const inviteId=(params.get("inviteId")||params.get("invite")||"demo-v47").slice(0,80);
  const agency=(params.get("agency")||"NOSMO Work Profile").slice(0,120);
  const suggestedTrade=(params.get("trade")||"").slice(0,120);
  const suggestedLocation=(params.get("location")||"").slice(0,120);
  const inviteToken=(params.get("inviteToken")||"").slice(0,8000);
  const apiBase=(document.querySelector('meta[name="nexus-onboarding-api-base"]')?.content||"").trim().replace(/\/$/,"");
  const secureInvite=Boolean(inviteToken);
  const pageMode=(document.body?.dataset?.personMode||"full").toLowerCase();
  const onboardingMode=pageMode==="onboarding"||secureInvite||params.get("mode")==="onboarding";
  window.NEXUS_V47_PAGE_MODE=pageMode;
  window.NEXUS_V47_ONBOARDING_MODE=onboardingMode;
  const LOCAL_KEY="nexus-v47-onboarding:"+inviteId;
  const TOKEN_KEY="nexus-v47-draft-token:"+inviteId;
  let draftToken="";
  let personId="";
  let autosaveTimer=null;
  let verifiedInviteIdentity=false;

  const q=(sel,root)=>(root||document).querySelector(sel);
  const qa=(sel,root)=>Array.from((root||document).querySelectorAll(sel));
  const clean=value=>String(value||"").replace(/\s+/g," ").trim();

  function toast(message){
    const el=q("#onboardToast"); if(!el)return;
    el.textContent=message;
    el.classList.add("show");
    window.setTimeout(()=>el.classList.remove("show"),2200);
  }

  function openEditor(){
    q("#onboardOverlay")?.classList.add("open");
    q("#onboardOverlay")?.setAttribute("aria-hidden","false");
  }
  function closeEditor(){
    q("#onboardOverlay")?.classList.remove("open");
    q("#onboardOverlay")?.setAttribute("aria-hidden","true");
  }

  function field(id){
    const el=q("#"+id);
    if(!el)return "";
    return el.type==="checkbox" ? !!el.checked : el.value;
  }
  function setField(id,value){
    const el=q("#"+id);
    if(!el)return;
    if(el.type==="checkbox")el.checked=Boolean(value);
    else if(value!==undefined&&value!==null)el.value=String(value);
  }

  function collect(){
    return {
      schema:"nexus-person-onboarding-draft/v1",
      inviteId,
      personId,
      agency,
      firstName:clean(field("firstName")).slice(0,80),
      lastName:clean(field("lastName")).slice(0,80),
      trade:clean(field("trade")).slice(0,140),
      location:clean(field("location")).slice(0,140),
      experienceYears:Number(field("experienceYears")||0)||0,
      phone:clean(field("phone")).slice(0,80),
      email:clean(field("email")).slice(0,160),
      radius:Number(field("radius")||40)||40,
      availability:String(field("availability")||"available"),
      availableFrom:String(field("availableFrom")||""),
      cvText:String(field("cvText")||"").slice(0,20000),
      ownTransport:Boolean(field("ownTransport")),
      dayShift:Boolean(field("dayShift")),
      nightShift:Boolean(field("nightShift")),
      workAway:Boolean(field("workAway")),
      shareWithInvitingAgency:Boolean(field("shareWithInvitingAgency")),
      updatedAt:new Date().toISOString()
    };
  }

  function saveLocal(){
    const draft=collect();
    try{localStorage.setItem(LOCAL_KEY,JSON.stringify(draft))}catch(_){}
    return draft;
  }

  function loadLocal(){
    let draft=null;
    try{draft=JSON.parse(localStorage.getItem(LOCAL_KEY)||"null")}catch(_){}
    if(!draft){
      draft={
        firstName:"",
        lastName:"",
        trade:suggestedTrade,
        location:suggestedLocation,
        experienceYears:0,
        phone:"",
        email:"",
        radius:40,
        availability:"available",
        availableFrom:"",
        cvText:"",
        ownTransport:false,
        dayShift:true,
        nightShift:false,
        workAway:false
      };
    }
    if(draft.personId)personId=draft.personId;
    Object.keys(draft).forEach(key=>setField(key,draft[key]));
    return draft;
  }

  function seedEditorFromVisibleCard(){
    const first=clean(q(".first")?.textContent);
    const last=clean(q(".last")?.textContent);
    const trade=clean(q(".trade")?.textContent);
    const meta=qa(".metaLine");
    const location=clean(meta[0]&&q("span",meta[0])?.textContent);
    const experienceText=clean(meta[1]&&q("span",meta[1])?.textContent);
    const experienceMatch=experienceText.match(/(\d{1,2})/);

    setField("firstName",first&&first!=="YOUR"?first:"");
    setField("lastName",last&&last!=="PERSON CARD"?last:"");
    setField("trade",trade&&trade!=="ADD YOUR TRADE"?trade:"");
    setField("location",location&&location!=="Add location"?location:"");
    setField("experienceYears",experienceMatch?Number(experienceMatch[1]):0);
    setField("radius",40);
    setField("availability","available");
    setField("dayShift",true);
    setField("nightShift",false);
    setField("ownTransport",false);
    setField("workAway",false);
  }

  function availabilityLabel(d){
    if(d.availability==="busy")return "Busy";
    if(d.availability==="from-date")return d.availableFrom ? "From "+d.availableFrom : "From Date";
    return "Available";
  }

  function resetDonorDataToSafeDraft(){
    q(".first").textContent="YOUR";
    q(".last").textContent="PERSON CARD";
    q(".role").textContent="WORK PROFILE";
    q(".trade").textContent="ADD YOUR TRADE";

    const meta=qa(".metaLine");
    if(meta[0])q("span",meta[0]).textContent="Add location";
    if(meta[1])q("span",meta[1]).textContent="Add experience";

    const status=qa(".status div");
    if(status[0])status[0].innerHTML='<i class="greenDot"></i>Available';
    if(status[1])status[1].innerHTML='<i class="blueShield">✓</i>Draft';
    if(status[2])status[2].innerHTML='<i class="purpleDoc"></i>Invite';

    const photo=q(".photo");
    if(photo){
      photo.removeAttribute("aria-label");
      photo.style.backgroundImage="none";
      photo.style.display="grid";
      photo.style.placeItems="center";
      photo.style.color="#72adff";
      photo.style.fontWeight="900";
      photo.style.fontSize="28px";
      photo.textContent="PC";
    }

    const jobs=qa(".history .job");
    const placeholders=[
      ["Add recent role","Employer / project","—"],
      ["Add previous role","Employer / project","—"],
      ["Add earlier role","Employer / project","—"]
    ];
    jobs.forEach((job,index)=>{
      const p=placeholders[index]||placeholders[2];
      const strong=q("strong",job), span=q("span",job), date=q(".date",job);
      if(strong)strong.textContent=p[0];
      if(span)span.textContent=p[1];
      if(date)date.textContent=p[2];
    });

    const skills=qa(".bottom .section").find(section=>q(".sectionHead span",section)?.textContent==="Core Skills");
    if(skills){
      qa(".skill",skills).forEach((row,index)=>{
        const label=q(".skillText span",row);
        const bar=q(".bar i",row);
        const labels=["Primary trade","Secondary skill","Project experience","Quality / compliance"];
        if(label)label.textContent=labels[index]||"Skill";
        if(bar)bar.style.width="8%";
      });
    }

    const training=qa(".bottom .section").find(section=>q(".sectionHead span",section)?.textContent==="Training");
    if(training){
      const p=q("p",training);
      if(p)p.textContent="No training records added yet.";
    }

    // Keep every existing button/module in place, but prevent Worker-specific identity routes
    // from being mistaken for the new worker until a real canonical person exists.
    qa('a[href*="person=worker-profile"],a[href*="focus=worker-profile"],a[href*="worker-card-section"],a[href*="card=/worker-card"]').forEach(link=>{
      link.dataset.originalHref=link.getAttribute("href")||"";
      link.setAttribute("href","#");
      link.setAttribute("aria-disabled","true");
      link.addEventListener("click",event=>{
        if(link.getAttribute("aria-disabled")==="true"){
          event.preventDefault();
          toast("This module will bind to the new Person ID after Finish.");
        }
      });
    });
  }

  function updateVisibleCard(){
    const d=collect();
    q(".first").textContent=d.firstName||"YOUR";
    q(".last").textContent=d.lastName||"PERSON CARD";
    q(".role").textContent="WORK PROFILE";
    q(".trade").textContent=(d.trade||"ADD YOUR TRADE").toUpperCase();

    const meta=qa(".metaLine");
    if(meta[0])q("span",meta[0]).textContent=d.location||"Add location";
    if(meta[1])q("span",meta[1]).textContent=d.experienceYears ? d.experienceYears+" yrs experience" : "Add experience";

    const status=qa(".status div");
    if(status[0])status[0].innerHTML='<i class="greenDot"></i>'+availabilityLabel(d);
    if(status[1])status[1].innerHTML='<i class="blueShield">✓</i>'+(personId?"Draft":"Draft");
    if(status[2])status[2].innerHTML='<i class="purpleDoc"></i>'+(secureInvite?"Secure Invite":"Invite");

    const initials=((d.firstName[0]||"")+(d.lastName[0]||"")).toUpperCase()||"PC";
    const photo=q(".photo");
    if(photo)photo.textContent=initials;

    if(d.phone){
      const digits=d.phone.replace(/[^0-9]/g,"");
      const phone=q('[aria-label="Phone"]'); if(phone)phone.href="tel:"+d.phone;
      const sms=q('[aria-label="SMS"]'); if(sms)sms.href="sms:"+d.phone;
      const wa=q('[aria-label="WhatsApp"]'); if(wa)wa.href=digits?"https://wa.me/"+digits:"#";
    }
    if(d.email){
      const email=q('[aria-label="Email"]'); if(email)email.href="mailto:"+encodeURIComponent(d.email);
    }
    const share=q('[aria-label="Share"]'); if(share)share.href=location.href;
  }

  function fillWorkHistoryFromCv(){
    const d=collect();
    if(!d.cvText)return;
    const jobs=qa(".history .job");
    if(!jobs.length)return;
    const lines=d.cvText.split(/\n+/).map(clean).filter(Boolean).slice(0,3);
    lines.forEach((line,index)=>{
      const job=jobs[index]; if(!job)return;
      const strong=q("strong",job), span=q("span",job), date=q(".date",job);
      if(strong)strong.textContent=line.slice(0,54);
      if(span)span.textContent="Imported from worker CV / work history";
      if(date)date.textContent="Draft";
    });
  }

  function smartPrefill(){
    const cv=clean(field("cvText"));
    if(!cv){toast("Paste CV or work history first");return}
    const lower=cv.toLowerCase();
    if(!clean(field("trade"))){
      const trades=[
        ["Carpenter / Joiner",["joiner","carpenter","carpentry","second fix"]],
        ["Welder / Fabricator",["welder","welding","fabricator","fabrication"]],
        ["Electrician",["electrician","electrical installer"]],
        ["Plumber",["plumber","plumbing","pipefitter"]],
        ["Dryliner",["dryliner","dry lining","drylining"]],
        ["Site Manager",["site manager","construction manager","site supervisor"]]
      ];
      const hit=trades.find(row=>row[1].some(term=>lower.includes(term)));
      if(hit)setField("trade",hit[0]);
    }
    if(!Number(field("experienceYears"))){
      const explicit=cv.match(/(\d{1,2})\+?\s*(?:years|yrs)\s+(?:of\s+)?experience/i);
      if(explicit)setField("experienceYears",explicit[1]);
      else{
        const years=[...cv.matchAll(/(?:19|20)\d{2}/g)].map(m=>Number(m[0])).filter(y=>y>=1980&&y<=new Date().getFullYear());
        if(years.length)setField("experienceYears",Math.max(1,Math.min(60,new Date().getFullYear()-Math.min(...years))));
      }
    }
    updateVisibleCard();
    fillWorkHistoryFromCv();
    saveLocal();
    scheduleAutosave();
    q("#aiStatus").textContent="Smart Prefill used local rules only. Review before saving.";
    toast("Smart Prefill complete");
  }

  async function post(path,body){
    if(!apiBase)throw new Error("NEXUS_ONBOARDING_API_NOT_CONFIGURED");
    const response=await fetch(apiBase+path,{
      method:"POST",
      headers:{"content-type":"application/json"},
      credentials:"omit",
      cache:"no-store",
      body:JSON.stringify(body)
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||("HTTP_"+response.status));
    return payload;
  }

  async function loadSecureInviteInfo(){
    if(!secureInvite||!apiBase)return false;
    try{
      const payload=await post("/invite-info",{inviteToken});
      const verified=payload&&payload.verifiedSignedInvite===true;
      if(!verified)throw new Error("NEXUS_ONBOARDING_INVITE_NOT_VERIFIED");
      verifiedInviteIdentity=true;
      const agencyName=payload.agency&&payload.agency.name?String(payload.agency.name):agency;
      const recruiterName=payload.recruiter&&payload.recruiter.displayName?String(payload.recruiter.displayName):"Recruiter";
      const recruiterTitle=payload.recruiter&&payload.recruiter.jobTitle?String(payload.recruiter.jobTitle):"";
      const consent=q("#shareWithInvitingAgency");
      if(consent)consent.disabled=false;
      const consentAgency=q("#consentAgencyName");
      if(consentAgency)consentAgency.textContent=agencyName||"this agency";
      const inviter=q("#consentInviterIdentity");
      if(inviter)inviter.textContent="Verified inviter: "+recruiterName+(recruiterTitle?" · "+recruiterTitle:"")+" · "+agencyName;
      const notice=q("#inviteNotice");
      if(notice)notice.textContent=recruiterName+(recruiterTitle?" · "+recruiterTitle:"")+" from "+agencyName+" sent this verified secure Person Card invite.";
      return true;
    }catch(error){
      verifiedInviteIdentity=false;
      setField("shareWithInvitingAgency",false);
      const consent=q("#shareWithInvitingAgency");
      if(consent)consent.disabled=true;
      const inviter=q("#consentInviterIdentity");
      if(inviter)inviter.textContent="Inviter identity could not be verified. Agency sharing stays disabled.";
      const notice=q("#inviteNotice");
      if(notice)notice.textContent="Secure invite verification is unavailable. You can edit the Person Card, but agency sharing stays disabled.";
      return false;
    }
  }

  function serverPayload(finalize){
    const d=collect();
    return {
      draftToken,
      finalize:Boolean(finalize),
      firstName:d.firstName,
      lastName:d.lastName,
      trade:d.trade,
      location:d.location,
      experienceYears:d.experienceYears,
      phone:d.phone,
      email:d.email,
      radius:d.radius,
      availability:d.availability,
      availableFrom:d.availableFrom,
      cvText:d.cvText,
      ownTransport:d.ownTransport,
      dayShift:d.dayShift,
      nightShift:d.nightShift,
      workAway:d.workAway,
      shareWithInvitingAgency:Boolean(
        verifiedInviteIdentity && d.shareWithInvitingAgency
      )
    };
  }

  async function ensureClaim(){
    if(!secureInvite||!apiBase)return false;
    try{draftToken=localStorage.getItem(TOKEN_KEY)||""}catch(_){}
    if(draftToken)return true;

    const claim=await post("/claim",{inviteToken});
    if(!claim.draftToken||!claim.personId)throw new Error("NEXUS_ONBOARDING_CLAIM_INVALID_RESPONSE");
    draftToken=claim.draftToken;
    personId=claim.personId;
    try{
      localStorage.setItem(TOKEN_KEY,draftToken);
      localStorage.setItem("nexus-person-work-draft-token:"+personId,draftToken);
    }catch(_){}
    saveLocal();
    return true;
  }

  async function saveServer(finalize){
    if(!secureInvite||!apiBase)return false;
    await ensureClaim();
    const result=await post("/drafts/save",serverPayload(finalize));
    return Boolean(result&&result.serverPersonMutationPerformed);
  }

  function scheduleAutosave(){
    if(!secureInvite||!apiBase)return;
    if(autosaveTimer)clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(async()=>{
      try{await saveServer(false)}
      catch(error){
        q("#aiStatus").textContent="Server autosave unavailable. Local draft is still safe.";
      }
    },900);
  }

  async function aiAssist(){
    if(!secureInvite){toast("Secure signed invite required for AI Assist");return}
    if(!apiBase){toast("Trusted onboarding API is not configured");return}
    const d=collect();
    if(!d.cvText){toast("Paste CV or work history first");return}
    try{
      await ensureClaim();
      q("#aiStatus").textContent="AI Assist is analysing the supplied work history…";
      const payload=await post("/ai-prefill",{
        inviteId,
        inviteToken,
        draftToken,
        personId,
        cvText:d.cvText,
        current:{
          firstName:d.firstName,
          lastName:d.lastName,
          trade:d.trade,
          location:d.location,
          experienceYears:d.experienceYears
        }
      });
      const p=payload.prefill||{};
      ["firstName","lastName","trade","location","experienceYears"].forEach(id=>{
        if(p[id]!==undefined&&p[id]!==null&&String(p[id]).trim())setField(id,p[id]);
      });
      updateVisibleCard();
      fillWorkHistoryFromCv();
      saveLocal();
      await saveServer(false);
      q("#aiStatus").textContent="AI draft ready. Review before Finish.";
      toast("AI draft ready");
    }catch(error){
      q("#aiStatus").textContent="AI Assist unavailable: "+(error&&error.message?error.message:"request failed");
      toast("AI Assist unavailable");
    }
  }

  async function explicitSave(){
    saveLocal();
    updateVisibleCard();
    fillWorkHistoryFromCv();
    if(secureInvite&&apiBase){
      try{
        await saveServer(false);
        toast("Draft saved to server");
        return;
      }catch(error){
        q("#aiStatus").textContent="Server save failed. Local draft remains safe.";
      }
    }
    toast("Draft saved on this device");
  }

  async function finish(){
    const d=saveLocal();
    const missing=[];
    if(!d.firstName)missing.push("first name");
    if(!d.lastName)missing.push("last name");
    if(!d.trade)missing.push("trade");
    if(!d.location)missing.push("location");
    if(missing.length){
      toast("Complete: "+missing.join(", "));
      return;
    }

    if(secureInvite&&apiBase){
      try{
        await saveServer(true);
      }catch(error){
        q("#aiStatus").textContent="Finish blocked: durable server save failed.";
        toast("Server save failed — Finish blocked");
        return;
      }
    }

    updateVisibleCard();
    fillWorkHistoryFromCv();
    closeEditor();
    q("#onboardingLaunch strong").textContent="Person Card draft updated";
    q("#openOnboarding").textContent="EDIT AGAIN";
    toast("Person Card updated");
  }

  function bind(){
    q("#openOnboarding")?.addEventListener("click",openEditor);
    q("#onboardClose")?.addEventListener("click",closeEditor);
    q("#onboardOverlay")?.addEventListener("click",event=>{if(event.target===q("#onboardOverlay"))closeEditor()});
    q("#smartPrefill")?.addEventListener("click",smartPrefill);
    q("#aiPrefill")?.addEventListener("click",aiAssist);
    q("#saveDraft")?.addEventListener("click",explicitSave);
    q("#finishProfile")?.addEventListener("click",finish);
    qa("#onboardOverlay input,#onboardOverlay select,#onboardOverlay textarea").forEach(el=>{
      el.addEventListener("input",()=>{saveLocal();updateVisibleCard();scheduleAutosave()});
      el.addEventListener("change",()=>{saveLocal();updateVisibleCard();scheduleAutosave()});
    });
    document.addEventListener("keydown",event=>{if(event.key==="Escape")closeEditor()});
  }

  function init(){
    bind();

    if(onboardingMode){
      resetDonorDataToSafeDraft();
      loadLocal();
      updateVisibleCard();
      fillWorkHistoryFromCv();

      q("#inviteNotice").textContent=secureInvite
        ? agency+" sent a secure Person Card invite. Existing v47 modules remain in place."
        : agency+" · demo/local onboarding. Existing v47 modules remain in place.";

      const consentBox=q("#agencyConsentBox");
      if(consentBox)consentBox.classList.toggle("visible",secureInvite);
      const consentAgency=q("#consentAgencyName");
      if(consentAgency)consentAgency.textContent=agency||"this agency";
      const consent=q("#shareWithInvitingAgency");
      if(consent)consent.disabled=true;
      if(!secureInvite){
        setField("shareWithInvitingAgency",false);
        const inviter=q("#consentInviterIdentity");
        if(inviter)inviter.textContent="Agency sharing is available only from a verified secure invite.";
      }else{
        loadSecureInviteInfo();
      }

      if(!localStorage.getItem(LOCAL_KEY)&&params.get("preview")!=="closed")openEditor();
      return;
    }

    // Full-package demo mode: preserve the accepted v47 donor data and all donor links.
    // The editor is prefilled from the visible copied card and only modifies this copy.
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(LOCAL_KEY)||"null")}catch(_){}
    if(saved){
      if(saved.personId)personId=saved.personId;
      Object.keys(saved).forEach(key=>setField(key,saved[key]));
      updateVisibleCard();
      fillWorkHistoryFromCv();
    }else{
      seedEditorFromVisibleCard();
    }

    const notice=q("#inviteNotice");
    if(notice)notice.textContent="Editing the v47 FULL copy only. The accepted original v47 remains frozen and all existing modules stay connected.";
    const launch=q("#onboardingLaunch strong");
    if(launch)launch.textContent="Edit this v47 copy · original remains locked";
  }

  init();
})();
