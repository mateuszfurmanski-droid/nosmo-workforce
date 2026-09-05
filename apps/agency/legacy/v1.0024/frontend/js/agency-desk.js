(function(){
  "use strict";
  const API="/api/person-card/agency";
  const q=id=>document.getElementById(id);
  let agency=null;
  let candidates=[];
  let activity=[];
  let agencyProfile=null;
  let selectedCandidate=null;
  let actionMode="request";
  let preparedDraft="";

  function esc(value){
    return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
  }
  async function api(path,options={}){
    const response=await fetch(API+path,{
      credentials:"include",
      ...options,
      headers:{"content-type":"application/json",...(options.headers||{})}
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(payload.error||("HTTP_"+response.status));
      error.status=response.status;
      error.payload=payload;
      throw error;
    }
    return payload;
  }
  function toggle(id,open){
    const el=q(id);el.classList.toggle("open",open);el.setAttribute("aria-hidden",String(!open));
  }
  function stage(candidate){return candidate.pipeline?.stage||"NEW"}
  function locationText(candidate){return (candidate.locations||[]).join(" · ")||"Location not set"}
  function renderSummary(){
    q("candidateCount").textContent=candidates.length;
    q("shortlistCount").textContent=candidates.filter(c=>stage(c)==="SHORTLISTED").length;
    q("requestCount").textContent=candidates.filter(c=>stage(c)==="REQUESTED").length;
    q("offerCount").textContent=candidates.filter(c=>stage(c)==="OFFERED").length;
  }
  function renderCandidates(){
    renderSummary();
    const host=q("candidateList");
    if(!agency){
      host.innerHTML='<div class="empty">Create or sign in to an Agency Account to load the multi-worker pipeline.</div>';
      return;
    }
    if(!candidates.length){
      host.innerHTML='<div class="empty">No active worker profiles matched this search. Workers appear here only after their Work Profile is finalized as active.</div>';
      return;
    }
    host.innerHTML=candidates.map(candidate=>{
      const currentStage=stage(candidate);
      const shortlist=currentStage==="SHORTLISTED";
      return '<article class="panel candidate">'+
        '<div class="candidateTop"><div><div class="candidateName">'+esc(candidate.displayName)+'</div>'+
        '<div class="candidateTrade">'+esc(candidate.primaryTrade)+'</div>'+
        '<div class="candidateLocation">'+esc(locationText(candidate))+'</div></div>'+
        '<span class="badge '+(currentStage==="NEW"?"available":"pipeline")+'">'+esc(currentStage)+'</span></div>'+
        '<div class="candidateMeta">'+
          '<div class="meta"><span>Availability</span><strong>'+esc(candidate.availability?.label||"Unknown")+'</strong></div>'+
          '<div class="meta"><span>Employment</span><strong>'+esc((candidate.preferences?.employmentTypes||[]).join(" / ")||"Not set")+'</strong></div>'+
          '<div class="meta"><span>CV</span><strong>'+esc(String(candidate.readiness?.cv||"unknown").toUpperCase())+'</strong></div>'+
          '<div class="meta"><span>Certificates</span><strong>'+esc(String(candidate.readiness?.certificates||"unknown").toUpperCase())+'</strong></div>'+
        '</div>'+
        '<div class="actions">'+
          '<button type="button" data-view="'+esc(candidate.personId)+'">View safe profile</button>'+
          '<button type="button" class="secondary" data-shortlist="'+esc(candidate.personId)+'">'+(shortlist?"Remove shortlist":"Shortlist")+'</button>'+
          '<button type="button" data-request="'+esc(candidate.personId)+'">Request Pack</button>'+
          '<button type="button" data-offer="'+esc(candidate.personId)+'">Offer Work</button>'+
        '</div></article>';
    }).join("");

    host.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>openCandidateDetail(button.dataset.view)));
    host.querySelectorAll("[data-shortlist]").forEach(button=>button.addEventListener("click",()=>toggleShortlist(button.dataset.shortlist)));
    host.querySelectorAll("[data-request]").forEach(button=>button.addEventListener("click",()=>openAction(button.dataset.request,"request")));
    host.querySelectorAll("[data-offer]").forEach(button=>button.addEventListener("click",()=>openAction(button.dataset.offer,"offer")));
  }
  function renderActivity(){
    const host=q("agencyActivity");
    if(!agency){host.innerHTML='<div class="empty">Agency account required.</div>';return}
    if(!activity.length){host.innerHTML='<div class="empty">No server-side agency activity yet.</div>';return}
    host.innerHTML=activity.map(item=>{
      const when=new Date(item.createdAt).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
      return '<div class="activityRow"><strong>'+esc(item.actionType.replaceAll("_"," "))+' · '+esc(item.displayName)+'</strong><span>'+esc(when)+'</span></div>';
    }).join("");
  }
  async function loadCandidates(query=""){
    if(!agency)return;
    q("candidateList").innerHTML='<div class="empty">Loading recruiter-safe candidates…</div>';
    const payload=await api("/candidates?limit=200&q="+encodeURIComponent(query));
    candidates=payload.candidates||[];
    renderCandidates();
  }
  async function loadActivity(){
    if(!agency)return;
    const payload=await api("/activity?limit=50");
    activity=payload.activity||[];
    renderActivity();
  }
  function renderAgencyProfile(){
    const card=q("agencyIdentityCard");
    if(!agencyProfile){card.hidden=true;return}
    card.hidden=false;
    const a=agencyProfile.agency||{},r=agencyProfile.recruiter||{};
    q("agencyIdentityName").textContent=a.name||"Agency";
    q("recruiterIdentityLine").textContent=(r.displayName||"Recruiter")+(r.jobTitle?" · "+r.jobTitle:"");
    q("agencyVerificationBadge").textContent=(a.verificationStatus||"UNVERIFIED").toUpperCase();
    q("agencyIdentityLocation").textContent=a.location||"Not set";
    q("agencyIdentityWebsite").textContent=a.website||"Not set";
    q("recruiterIdentityEmail").textContent=r.email||"Not set";
    q("recruiterIdentityPhone").textContent=r.phone||"Not set";
  }
  async function loadAgencyProfile(){
    if(!agency)return;
    agencyProfile=await api("/profile");
    renderAgencyProfile();
  }
  function openAgencyProfile(){
    if(!agencyProfile)return;
    const a=agencyProfile.agency||{},r=agencyProfile.recruiter||{};
    q("profileAgencyName").value=a.name||"";
    q("profileAgencyWebsite").value=a.website||"";
    q("profileAgencyRegistration").value=a.registrationNumber||"";
    q("profileAgencyLocation").value=a.location||"";
    q("profileAgencyDescription").value=a.description||"";
    q("profileRecruiterName").value=r.displayName||"";
    q("profileRecruiterTitle").value=r.jobTitle||"";
    q("profileRecruiterEmail").value=r.email||"";
    q("profileRecruiterPhone").value=r.phone||"";
    q("profileRecruiterPhoto").value=r.photoUrl||"";
    q("profileRecruiterBio").value=r.bio||"";
    q("agencyProfileStatus").textContent="Recruiter identity is tied to the authenticated NOSMO account.";
    toggle("agencyProfileBackdrop",true);
  }
  async function saveAgencyProfile(event){
    event.preventDefault();
    q("agencyProfileStatus").textContent="Saving profiles…";
    try{
      const payload=await api("/profile",{
        method:"PATCH",
        body:JSON.stringify({
          agency:{
            name:q("profileAgencyName").value.trim(),
            website:q("profileAgencyWebsite").value.trim(),
            registrationNumber:q("profileAgencyRegistration").value.trim(),
            location:q("profileAgencyLocation").value.trim(),
            description:q("profileAgencyDescription").value.trim()
          },
          recruiter:{
            displayName:q("profileRecruiterName").value.trim(),
            jobTitle:q("profileRecruiterTitle").value.trim(),
            email:q("profileRecruiterEmail").value.trim(),
            phone:q("profileRecruiterPhone").value.trim(),
            photoUrl:q("profileRecruiterPhoto").value.trim(),
            bio:q("profileRecruiterBio").value.trim()
          }
        })
      });
      agencyProfile={agency:payload.agency,recruiter:payload.recruiter};
      agency=payload.agency;
      renderAgencyProfile();
      q("agencyAccountState").textContent=agency.name+" · "+agency.role+" · authenticated";
      q("agencyProfileStatus").textContent="Agency and recruiter profiles saved.";
    }catch(error){
      q("agencyProfileStatus").textContent="Profile save failed: "+error.message;
    }
  }
  async function loadAccount(){
    try{
      await api("/_health");
      const payload=await api("/account");
      agency=payload.agency;
      q("agencyAccountState").textContent=agency.name+" · "+agency.role+" · authenticated";
      q("accountSetup").hidden=true;
      await Promise.all([loadCandidates(),loadActivity(),loadAgencyProfile()]);
    }catch(error){
      agency=null;candidates=[];activity=[];renderCandidates();renderActivity();renderSummary();
      if(error.payload&&error.payload.databaseReady===false){
        q("accountSetup").hidden=true;
        const missing=Array.isArray(error.payload.missingTables)?error.payload.missingTables:[];
        q("agencyAccountState").textContent="DB activation pending"+(missing.length?" · missing "+missing.length+" Person Card tables":"")+".";
        q("candidateList").innerHTML='<div class="empty">Agency ATS persistence is not activated on this database yet. No demo candidates are substituted.</div>';
        q("agencyActivity").innerHTML='<div class="empty">Agency activity will become available after the Person Card DB migration.</div>';
        return;
      }
      q("accountSetup").hidden=false;
      if(error.status===401){
        q("agencyAccountState").textContent="Sign in required for Agency ATS.";
        q("agencySignIn").hidden=false;
        q("createAgencyAccount").hidden=true;
        q("agencyName").disabled=true;
        q("accountSetupStatus").textContent="Agency pipeline data is server-side and requires an authenticated NOSMO session.";
      }else if(error.status===404){
        q("agencyAccountState").textContent="Authenticated user has no Agency Account yet.";
        q("agencySignIn").hidden=true;
        q("createAgencyAccount").hidden=false;
        q("agencyName").disabled=false;
        q("accountSetupStatus").textContent="Create the first agency account for this login. Candidate pipeline state will then be scoped to this agency.";
      }else{
        q("agencyAccountState").textContent="Agency ATS API unavailable: "+error.message;
        q("accountSetupStatus").textContent="No demo candidate list was substituted.";
      }
    }
  }
  async function createAgency(){
    const name=q("agencyName").value.trim();
    if(!name){q("accountSetupStatus").textContent="Agency / company name is required.";return}
    q("accountSetupStatus").textContent="Creating agency account…";
    try{
      const payload=await api("/account",{method:"POST",body:JSON.stringify({agencyName:name})});
      agency=payload.agency;
      q("agencyAccountState").textContent=agency.name+" · "+agency.role+" · authenticated";
      q("accountSetup").hidden=true;
      await Promise.all([loadCandidates(),loadActivity(),loadAgencyProfile()]);
    }catch(error){q("accountSetupStatus").textContent="Could not create agency account: "+error.message}
  }
  function candidateById(personId){return candidates.find(c=>c.personId===personId)||null}
  function openCandidateDetail(personId){
    const candidate=candidateById(personId);if(!candidate)return;
    q("candidateDetailTitle").textContent=candidate.displayName;
    q("candidateDetailBody").innerHTML=
      '<div class="detailRow"><span>Trade</span><strong>'+esc(candidate.primaryTrade)+'</strong></div>'+
      '<div class="detailRow"><span>Locations</span><strong>'+esc(locationText(candidate))+'</strong></div>'+
      '<div class="detailRow"><span>Availability</span><strong>'+esc(candidate.availability?.label||"Unknown")+'</strong></div>'+
      '<div class="detailRow"><span>Experience</span><strong>'+esc(candidate.experienceYears==null?"Not stated":candidate.experienceYears+" years")+'</strong></div>'+
      '<div class="detailRow"><span>Target roles</span><strong>'+esc((candidate.preferences?.targetRoles||[]).join(", ")||"Not set")+'</strong></div>'+
      '<div class="detailRow"><span>Rate</span><strong>'+esc(candidate.preferences?.rate?.display||"Not set")+'</strong></div>'+
      '<div class="detailRow"><span>CV readiness</span><strong>'+esc(candidate.readiness?.cv||"unknown")+'</strong></div>'+
      '<div class="detailRow"><span>Certificates</span><strong>'+esc(candidate.readiness?.certificates||"unknown")+'</strong></div>'+
      '<div class="detailRow"><span>References</span><strong>'+esc(candidate.readiness?.references||"unknown")+'</strong></div>'+
      '<div class="detailRow"><span>Pipeline</span><strong>'+esc(stage(candidate))+'</strong></div>';
    toggle("candidateDetailBackdrop",true);
    recordAction(personId,"PROFILE_VIEWED",{}).catch(()=>{});
  }
  async function recordAction(personId,actionType,details){
    return api("/candidates/"+encodeURIComponent(personId)+"/actions",{
      method:"POST",body:JSON.stringify({actionType,details})
    });
  }
  async function toggleShortlist(personId){
    const candidate=candidateById(personId);if(!candidate)return;
    const removing=stage(candidate)==="SHORTLISTED";
    const actionType=removing?"REMOVED_FROM_SHORTLIST":"SHORTLISTED";
    try{
      const result=await recordAction(personId,actionType,{purpose:"Agency pipeline"});
      candidate.pipeline.stage=result.nextStage||"NEW";
      renderCandidates();
      await loadActivity();
    }catch(error){q("agencyAccountState").textContent="Pipeline update failed: "+error.message}
  }
  function openAction(personId,mode){
    const candidate=candidateById(personId);if(!candidate)return;
    selectedCandidate=candidate;actionMode=mode;preparedDraft="";
    q("candidateActionTitle").textContent=(mode==="request"?"Request Pack — ":"Offer Work — ")+candidate.displayName;
    q("requestFields").hidden=mode!=="request";
    q("offerFields").hidden=mode!=="offer";
    if(mode==="offer"){
      q("offerRole").value=candidate.primaryTrade||"";
      q("offerLocation").value=(candidate.locations||[])[0]||"";
      q("offerStart").value="";
      q("offerRate").value=candidate.preferences?.rate?.display==="Not set"?"":(candidate.preferences?.rate?.display||"");
      q("offerDuration").value="";
    }
    q("candidateDraftPreview").textContent="No draft prepared.";
    q("candidateActionStatus").textContent="Drafting an action does not send it automatically.";
    toggle("candidateActionBackdrop",true);
  }
  function requestDraft(candidate){
    const items=q("requestItems").value.trim()||"additional work-profile information";
    const purpose=q("requestPurpose").value.trim()||"candidate review";
    return "Hi "+candidate.displayName+",\n\nWe would like to request the following from your NOSMO Person Card: "+items+".\n\nPurpose: "+purpose+".\n\nPlease review the request and share only the items you approve. This request does not grant automatic access to private documents.";
  }
  function offerDraft(candidate){
    const role=q("offerRole").value.trim()||candidate.primaryTrade||"work opportunity";
    const location=q("offerLocation").value.trim()||"to confirm";
    const start=q("offerStart").value.trim()||"to confirm";
    const rate=q("offerRate").value.trim()||"to confirm";
    const duration=q("offerDuration").value.trim()||"to confirm";
    return "Hi "+candidate.displayName+",\n\nWe would like to offer you the following work:\nRole: "+role+"\nLocation: "+location+"\nStart: "+start+"\nRate: "+rate+"\nDuration: "+duration+"\n\nPlease review and confirm whether you are interested. No placement is confirmed until accepted.";
  }
  async function prepareAction(event){
    event.preventDefault();if(!selectedCandidate)return;
    const candidate=selectedCandidate;
    const details=actionMode==="request"
      ?{purpose:q("requestPurpose").value.trim(),summary:q("requestItems").value.trim()}
      :{role:q("offerRole").value.trim(),location:q("offerLocation").value.trim(),start:q("offerStart").value.trim(),rate:q("offerRate").value.trim(),duration:q("offerDuration").value.trim()};
    preparedDraft=actionMode==="request"?requestDraft(candidate):offerDraft(candidate);
    q("candidateDraftPreview").textContent=preparedDraft;
    q("candidateActionStatus").textContent="Saving agency action…";
    try{
      const result=await recordAction(candidate.personId,actionMode==="request"?"REQUEST_PACK_DRAFTED":"OFFER_DRAFTED",details);
      candidate.pipeline.stage=result.nextStage||stage(candidate);
      q("candidateActionStatus").textContent="Draft saved to agency activity. Nothing was sent automatically.";
      renderCandidates();
      await loadActivity();
    }catch(error){q("candidateActionStatus").textContent="Draft prepared locally, but server action log failed: "+error.message}
  }
  async function copyDraft(){
    if(!preparedDraft){q("candidateActionStatus").textContent="Prepare a draft first.";return}
    try{await navigator.clipboard.writeText(preparedDraft);q("candidateActionStatus").textContent="Draft copied. Sending remains your decision."}
    catch(_){q("candidateActionStatus").textContent="Clipboard unavailable."}
  }

  q("createAgencyAccount").addEventListener("click",createAgency);
  q("editAgencyIdentity").addEventListener("click",openAgencyProfile);
  q("agencyProfileForm").addEventListener("submit",saveAgencyProfile);
  q("closeAgencyProfile").addEventListener("click",()=>toggle("agencyProfileBackdrop",false));
  q("agencyProfileBackdrop").addEventListener("click",event=>{if(event.target.id==="agencyProfileBackdrop")toggle("agencyProfileBackdrop",false)});
  q("candidateSearchButton").addEventListener("click",()=>loadCandidates(q("candidateSearch").value.trim()).catch(error=>q("agencyAccountState").textContent="Search failed: "+error.message));
  q("candidateSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();q("candidateSearchButton").click()}});
  q("closeCandidateDetail").addEventListener("click",()=>toggle("candidateDetailBackdrop",false));
  q("closeCandidateAction").addEventListener("click",()=>toggle("candidateActionBackdrop",false));
  q("candidateDetailBackdrop").addEventListener("click",event=>{if(event.target.id==="candidateDetailBackdrop")toggle("candidateDetailBackdrop",false)});
  q("candidateActionBackdrop").addEventListener("click",event=>{if(event.target.id==="candidateActionBackdrop")toggle("candidateActionBackdrop",false)});
  q("candidateActionForm").addEventListener("submit",prepareAction);
  q("copyCandidateDraft").addEventListener("click",copyDraft);

  loadAccount();
})();