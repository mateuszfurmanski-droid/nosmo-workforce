const state={
  user:null,
  agency:null,
  profile:null,
  dashboard:null,
  roster:[],
  connected:[],
  requests:[],
  applications:new Map(),
  activity:[],
  workerSource:"all",
  requestFilter:"ALL",
  currentView:"dashboard",
  workerQuery:"",
};

const $=(id)=>document.getElementById(id);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));

function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
}

function compact(value,max=180){
  const text=String(value??"").replace(/\s+/g," ").trim();
  return text.length>max?text.slice(0,max-1)+"…":text;
}

function asArray(value){
  return Array.isArray(value)?value:[];
}

function jsonValue(value){
  if(Array.isArray(value)) return value;
  if(value&&typeof value==="object") return value;
  if(typeof value==="string"){
    try{return JSON.parse(value)}catch{return value}
  }
  return value;
}

function showToast(message){
  const toast=$("toast");
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toast.classList.remove("show"),2600);
}

function showConnection(title,text){
  $("connectionTitle").textContent=title;
  $("connectionText").textContent=text;
  $("connectionBanner").hidden=false;
}

function clearConnection(){
  $("connectionBanner").hidden=true;
}

async function api(path,options={}){
  const headers={Accept:"application/json",...(options.headers||{})};
  if(options.body && !(options.body instanceof FormData) && !headers["Content-Type"]){
    headers["Content-Type"]="application/json";
  }
  const response=await fetch(path,{credentials:"include",...options,headers});
  const type=response.headers.get("content-type")||"";
  const payload=type.includes("application/json")?await response.json().catch(()=>({})):await response.text().catch(()=>"");
  if(!response.ok){
    const message=typeof payload==="object"&&payload?(payload.error||payload.message):payload;
    const error=new Error(message||`HTTP_${response.status}`);
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

function setTheme(theme){
  const safe=theme==="light"?"light":"dark";
  document.documentElement.dataset.theme=safe;
  localStorage.setItem("nosmo-agency-theme",safe);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content",safe==="light"?"#f5f5f2":"#080a0d");
}

function toggleTheme(){
  setTheme(document.documentElement.dataset.theme==="light"?"dark":"light");
}

function showView(name){
  const exists=$(`view-${name}`);
  if(!exists) return;
  state.currentView=name;
  $$(".view").forEach((view)=>view.classList.toggle("active",view.dataset.view===name));
  $$("[data-nav]",$("bottomNav")).forEach((button)=>button.classList.toggle("active",button.dataset.nav===name));
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="matches") hydrateMatchSelect();
  if(name==="messages") renderMessages();
}

function openModal(id){
  const modal=$(id);
  if(!modal) return;
  modal.hidden=false;
  document.body.style.overflow="hidden";
}

function closeModal(id){
  const modal=$(id);
  if(!modal) return;
  modal.hidden=true;
  if(!$$(`.modal-backdrop:not([hidden])`).length) document.body.style.overflow="";
}

function isDemoAgency(){
  const a=state.agency||{};
  return String(a.verificationStatus||"").toUpperCase()==="DEMO" || /\bdemo\b/i.test(String(a.name||""));
}

function renderAgencyIdentity(){
  const a=state.agency||{};
  $("tenantLabel").textContent=a.name||"Recruiter workspace";
  $("dashboardAgencyName").textContent=a.name||"Agency";
  $("demoBanner").hidden=!isDemoAgency();
  const user=state.user||{};
  $("sessionLabel").textContent=[user.firstName,user.lastName].filter(Boolean).join(" ")||user.email||"Authenticated";
}

function showAuthenticatedShell(){
  $("authGate").hidden=true;
  $("accountSetup").hidden=true;
  $("appShell").hidden=false;
  $("bottomNav").hidden=false;
  renderAgencyIdentity();
}

function showLoginGate(){
  state.agency=null;
  $("appShell").hidden=true;
  $("bottomNav").hidden=true;
  $("accountSetup").hidden=true;
  $("authGate").hidden=false;
}

function showAccountSetup(){
  $("appShell").hidden=true;
  $("bottomNav").hidden=true;
  $("authGate").hidden=true;
  $("accountSetup").hidden=false;
}

async function bootstrap(){
  clearConnection();
  try{
    const auth=await api("/api/auth/user");
    state.user=auth.user||null;
    if(!state.user){showLoginGate();return}

    try{
      const account=await api("/api/person-card/agency/account");
      state.agency=account.agency;
    }catch(error){
      if(error.status===404){showAccountSetup();return}
      throw error;
    }

    showAuthenticatedShell();
    const results=await Promise.allSettled([
      loadDashboard(),
      loadWorkers(),
      loadRequests(),
      loadActivity(),
      loadProfile(),
    ]);
    const rejected=results.filter((r)=>r.status==="rejected");
    if(rejected.length){
      showConnection("Some Agency data did not load",`${rejected.length} service request${rejected.length===1?"":"s"} failed. Retry without changing tenant context.`);
    }
  }catch(error){
    console.error(error);
    showConnection("Agency service unavailable",friendlyError(error));
    showLoginGate();
  }
}

function friendlyError(error){
  if(error?.status===401) return "Your session is not authenticated. Sign in again.";
  if(error?.status===403) return "This account is not authorized for the requested Agency workspace.";
  if(error?.status===503) return "The Agency data service or database is not ready.";
  return compact(error?.message||"Unable to reach the Agency service.",220);
}

async function createAgency(){
  const name=$("newAgencyName").value.trim();
  if(!name){$("accountSetupStatus").textContent="Agency / company name is required.";return}
  $("createAgencyButton").disabled=true;
  $("accountSetupStatus").textContent="Creating Agency Account…";
  try{
    const result=await api("/api/person-card/agency/account",{method:"POST",body:JSON.stringify({agencyName:name})});
    state.agency=result.agency;
    showAuthenticatedShell();
    await Promise.allSettled([loadDashboard(),loadWorkers(),loadRequests(),loadActivity(),loadProfile()]);
  }catch(error){
    $("accountSetupStatus").textContent=friendlyError(error);
  }finally{
    $("createAgencyButton").disabled=false;
  }
}

async function loadDashboard(){
  const data=await api("/api/person-card/agency/v1/dashboard");
  state.dashboard=data;
  if(data.agency){state.agency={...(state.agency||{}),...data.agency}}
  renderAgencyIdentity();
  const s=data.summary||{};
  $("kpiRoster").textContent=s.rosterWorkers??0;
  $("kpiOpenRequests").textContent=s.openRequests??0;
  $("kpiPipeline").textContent=s.candidatesInPipeline??0;
  $("kpiPlacements").textContent=s.livePlacements??0;
  const pipeline=asArray(data.pipeline);
  $("pipelineSummary").classList.remove("empty-card");
  $("pipelineSummary").innerHTML=pipeline.length?pipeline.map((row)=>`<div class="pipeline-chip"><strong>${escapeHtml(row.count??0)}</strong><span>${escapeHtml(row.stage||"UNKNOWN")}</span></div>`).join(""):'<div class="empty-card">No pipeline records yet.</div>';
}

async function loadWorkers(query=state.workerQuery){
  state.workerQuery=query||"";
  const suffix=state.workerQuery?`?limit=200&q=${encodeURIComponent(state.workerQuery)}`:"?limit=200";
  const [rosterResult,connectedResult]=await Promise.allSettled([
    api(`/api/person-card/agency/v1/roster${suffix}`),
    api(`/api/person-card/agency/candidates${suffix}`),
  ]);
  if(rosterResult.status==="fulfilled") state.roster=asArray(rosterResult.value.workers);
  if(connectedResult.status==="fulfilled") state.connected=asArray(connectedResult.value.candidates);
  if(rosterResult.status==="rejected"&&connectedResult.status==="rejected") throw rosterResult.reason;
  renderWorkers();
}

function normalizedWorkerKey(name,location){
  return `${String(name||"").toLowerCase().replace(/\s+/g," ").trim()}|${String(location||"").toLowerCase().replace(/\s+/g," ").trim()}`;
}

function normalizedWorkers(){
  const connectedKeys=new Set(state.connected.map((c)=>normalizedWorkerKey(c.displayName,asArray(c.locations)[0]||"")));
  const roster=state.roster
    .filter((r)=>!connectedKeys.has(normalizedWorkerKey(r.displayName,r.location)))
    .map((r)=>({
      id:r.rosterWorkerId,
      source:"roster",
      displayName:r.displayName||"Worker",
      trade:r.trade||"Trade not set",
      location:r.location||"Location not set",
      availability:r.availabilityStatus||"Unknown",
      availableFrom:r.availableFrom||null,
      licences:asArray(jsonValue(r.licences)),
      skills:asArray(jsonValue(r.skills)),
      expectedRate:r.expectedRate||null,
      connectionStatus:r.connectionStatus||"IMPORTED",
      workerAppConfirmed:r.workerAppConfirmed===true,
      raw:r,
    }));
  const connected=state.connected.map((c)=>({
    id:c.personId,
    source:"connected",
    displayName:c.displayName||"Worker",
    trade:c.primaryTrade||"Trade not set",
    location:asArray(c.locations).join(" · ")||"Location not set",
    availability:c.availability?.label||c.availability?.status||"Unknown",
    availableFrom:c.availability?.availableFrom||null,
    licences:[],
    skills:asArray(c.preferences?.targetRoles),
    expectedRate:c.preferences?.rate?.display||null,
    pipeline:c.pipeline||{},
    readiness:c.readiness||{},
    raw:c,
  }));
  return {roster,connected,all:[...connected,...roster]};
}

function availabilityClass(value){
  const text=String(value||"").toLowerCase();
  if(text.includes("ready")) return "ready-date";
  if(text.includes("available")) return "available";
  if(text.includes("busy")||text.includes("unavailable")) return "busy";
  return "";
}

function renderWorkers(){
  const groups=normalizedWorkers();
  let items=groups[state.workerSource]||groups.all;
  const q=state.workerQuery.toLowerCase().trim();
  if(q){
    items=items.filter((w)=>[w.displayName,w.trade,w.location,w.availability,...w.licences,...w.skills].join(" ").toLowerCase().includes(q));
  }
  $("workersCount").textContent=`${items.length} shown · ${groups.connected.length} connected · ${groups.roster.length} imported`;
  $("workersList").innerHTML=items.length?items.map((worker)=>`
    <article class="worker-card">
      <div class="worker-main">
        <div class="worker-line-1"><span class="worker-name">${escapeHtml(worker.displayName)}</span><span class="worker-source ${worker.source==="connected"?"connected":"imported"}">${worker.source==="connected"?"CONNECTED":"IMPORTED"}</span></div>
        <div class="worker-line-2">${escapeHtml(worker.trade)} · ${escapeHtml(worker.location)}</div>
      </div>
      <div class="worker-meta"><span class="status-pill ${availabilityClass(worker.availability)}">${escapeHtml(worker.availability)}</span></div>
      <button type="button" aria-label="Open ${escapeHtml(worker.displayName)}" data-worker-id="${escapeHtml(worker.id)}" data-worker-type="${worker.source}">›</button>
    </article>`).join(""):'<div class="empty-card">No workers match this filter.</div>';
  $$('[data-worker-id]',$("workersList")).forEach((button)=>button.addEventListener("click",()=>openWorker(button.dataset.workerType,button.dataset.workerId)));
}

function findWorker(type,id){
  const groups=normalizedWorkers();
  return (groups[type]||[]).find((w)=>w.id===id)||null;
}

function detailTile(label,value){
  return `<div class="detail-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value||"Not set")}</strong></div>`;
}

function openWorker(type,id){
  const worker=findWorker(type,id);
  if(!worker) return;
  $("workerModalTitle").textContent=worker.displayName;
  const connected=worker.source==="connected";
  const sourceNote=connected
    ?"Connected Worker App profile. Only the recruiter-safe consent projection is displayed."
    :"Imported agency-owned roster record. This is not Worker App confirmed data.";
  const readiness=connected?worker.readiness||{}:{};
  $("workerModalBody").innerHTML=`
    <div class="detail-banner ${connected?"connected":"imported"}">${escapeHtml(sourceNote)}</div>
    <div class="worker-detail-grid">
      ${detailTile("Trade",worker.trade)}
      ${detailTile("Location",worker.location)}
      ${detailTile("Availability",worker.availability+(worker.availableFrom?` · ${worker.availableFrom}`:""))}
      ${detailTile("Rate",worker.expectedRate||worker.raw?.preferences?.rate?.display)}
      ${detailTile("CV",connected?String(readiness.cv||"unknown").toUpperCase():"Not worker-confirmed")}
      ${detailTile("Certificates",connected?String(readiness.certificates||"unknown").toUpperCase():(worker.licences.join(", ")||"Imported list only"))}
      ${detailTile("Pipeline",connected?worker.pipeline?.stage||"NEW":"Not connected")}
      ${detailTile("Source",connected?"Worker recruiter-safe share":"Agency roster")}
    </div>
    ${connected?`<div class="form-actions" style="margin-top:12px"><button class="soft-button" type="button" data-worker-action="SHORTLISTED" data-person-id="${escapeHtml(worker.id)}">Shortlist</button><button class="soft-button" type="button" data-worker-action="REQUEST_PACK_DRAFTED" data-person-id="${escapeHtml(worker.id)}">Request Pack</button></div>`:""}
  `;
  $$('[data-worker-action]',$("workerModalBody")).forEach((button)=>button.addEventListener("click",()=>candidateAction(button.dataset.personId,button.dataset.workerAction)));
  openModal("workerModal");
}

async function candidateAction(personId,actionType){
  try{
    await api(`/api/person-card/agency/candidates/${encodeURIComponent(personId)}/actions`,{
      method:"POST",
      body:JSON.stringify({actionType,details:{purpose:"Agency recruitment workflow"}}),
    });
    showToast(actionType==="SHORTLISTED"?"Worker shortlisted":"Request Pack draft recorded");
    await Promise.allSettled([loadWorkers(),loadActivity(),loadDashboard()]);
    closeModal("workerModal");
  }catch(error){showToast(friendlyError(error))}
}

async function loadRequests(){
  const data=await api("/api/person-card/agency/v1/requests");
  state.requests=asArray(data.requests);
  renderRequests();
  hydrateMatchSelect();
}

function requestDetails(req){
  return jsonValue(req.details)||{};
}

function renderRequests(){
  const list=state.requestFilter==="ALL"?state.requests:state.requests.filter((r)=>String(r.status).toUpperCase()===state.requestFilter);
  $("requestsList").innerHTML=list.length?list.map((req)=>{
    const details=requestDetails(req);
    const skills=asArray(details.requiredSkills).slice(0,3).join(", ");
    return `<article class="request-card">
      <div><h3>${escapeHtml(req.role)}</h3><p>${escapeHtml(req.clientName||"Client")} · ${escapeHtml(req.location)} · ${escapeHtml(req.headcount||1)} required</p>${skills?`<p>Skills: ${escapeHtml(skills)}</p>`:""}</div>
      <span class="request-status ${escapeHtml(req.status)}">${escapeHtml(req.status)}</span>
      <div class="request-actions"><button type="button" data-request-matches="${escapeHtml(req.requestId)}">Review matches</button><button type="button" data-request-nexus="${escapeHtml(req.requestId)}">Ask Nexus</button></div>
    </article>`;
  }).join(""):'<div class="empty-card">No job requests in this filter.</div>';
  $$('[data-request-matches]',$("requestsList")).forEach((button)=>button.addEventListener("click",()=>openRequestMatches(button.dataset.requestMatches)));
  $$('[data-request-nexus]',$("requestsList")).forEach((button)=>button.addEventListener("click",()=>{
    const req=state.requests.find((r)=>r.requestId===button.dataset.requestNexus);
    showView("nexus");
    const question=`Show the strongest current matches for ${req?.role||"this request"} in ${req?.location||"the requested location"} and explain reasons and gaps.`;
    $("nexusQuestion").value=question;
    askNexus(question);
  }));
}

function csvList(value){
  return String(value||"").split(",").map((s)=>s.trim()).filter(Boolean).slice(0,24);
}

async function saveRequest(event){
  event.preventDefault();
  $("saveRequestButton").disabled=true;
  $("requestFormStatus").textContent="Saving request…";
  const pay=$("requestPayRate").value.trim();
  const bill=$("requestBillRate").value.trim();
  const body={
    role:$("requestRole").value.trim(),
    clientName:$("requestClient").value.trim(),
    location:$("requestLocation").value.trim(),
    startDate:$("requestStart").value||undefined,
    headcount:Number($("requestHeadcount").value||1),
    status:$("requestStatus").value,
    requiredSkills:csvList($("requestSkills").value),
    requiredLicences:csvList($("requestLicences").value),
    rates:{currency:"GBP",unit:"HOURLY",pay:pay||null,bill:bill||null},
    preferences:{},
  };
  try{
    const result=await api("/api/person-card/agency/v1/requests",{method:"POST",body:JSON.stringify(body)});
    $("requestFormStatus").textContent="Request saved.";
    showToast(`${result.request?.role||"Request"} saved`);
    $("requestForm").reset();
    $("requestHeadcount").value="1";
    $("requestStatus").value="OPEN";
    await Promise.allSettled([loadRequests(),loadDashboard()]);
    closeModal("requestModal");
  }catch(error){
    $("requestFormStatus").textContent=friendlyError(error);
  }finally{$("saveRequestButton").disabled=false}
}

function openNewRequest(){
  $("requestFormStatus").textContent="";
  openModal("requestModal");
}

function hydrateMatchSelect(){
  const select=$("matchRequestSelect");
  if(!select) return;
  const current=select.value;
  select.innerHTML='<option value="">Select request</option>'+state.requests.map((r)=>`<option value="${escapeHtml(r.requestId)}">${escapeHtml(r.role)} — ${escapeHtml(r.location)} [${escapeHtml(r.status)}]</option>`).join("");
  if(state.requests.some((r)=>r.requestId===current)) select.value=current;
}

async function openRequestMatches(requestId){
  showView("matches");
  hydrateMatchSelect();
  $("matchRequestSelect").value=requestId;
  await loadApplications(requestId);
}

async function loadApplications(requestId){
  if(!requestId){$("matchesList").innerHTML='<div class="empty-card">Select a job request to inspect its candidates.</div>';return}
  $("matchesList").innerHTML='<div class="empty-card">Loading explainable matches…</div>';
  try{
    const data=await api(`/api/person-card/agency/v1/requests/${encodeURIComponent(requestId)}/applications`);
    state.applications.set(requestId,asArray(data.applications));
    renderApplications(requestId);
  }catch(error){$("matchesList").innerHTML=`<div class="empty-card">${escapeHtml(friendlyError(error))}</div>`}
}

function normalizeJsonArray(value){
  const parsed=jsonValue(value);
  return Array.isArray(parsed)?parsed.map((x)=>String(x)):[];
}

function renderApplications(requestId){
  const apps=state.applications.get(requestId)||[];
  $("matchesList").innerHTML=apps.length?apps.map((app)=>{
    const reasons=normalizeJsonArray(app.matchReasons);
    const gaps=normalizeJsonArray(app.matchGaps);
    const readiness=String(app.readinessStatus||"CHECK").toUpperCase();
    const stages=["NEW","SHORTLISTED","CONTACTED","INTERESTED","SUBMITTED","INTERVIEW","OFFERED","PLACED","REJECTED","WITHDRAWN"];
    return `<article class="match-card">
      <div class="match-top"><div><h3>${escapeHtml(app.displayName)}</h3><div class="match-sub">${escapeHtml(app.matchStrength||"Current match")} · ${escapeHtml(app.stage||"NEW")}</div></div><span class="status-pill ${readiness.toLowerCase()}">${escapeHtml(readiness)}</span></div>
      <div class="match-columns">
        <div class="reason-box"><strong>Why it matches</strong>${reasons.length?`<ul>${reasons.map((r)=>`<li>${escapeHtml(r)}</li>`).join("")}</ul>`:'<ul><li>No recorded reason yet.</li></ul>'}</div>
        <div class="reason-box"><strong>Gaps / checks</strong>${gaps.length?`<ul>${gaps.map((g)=>`<li>${escapeHtml(g)}</li>`).join("")}</ul>`:'<ul><li>No recorded gap.</li></ul>'}</div>
      </div>
      <div class="match-actions"><select data-stage-select="${escapeHtml(app.applicationId)}">${stages.map((stage)=>`<option value="${stage}" ${stage===app.stage?"selected":""}>${stage}</option>`).join("")}</select><button type="button" data-save-stage="${escapeHtml(app.applicationId)}" data-request-id="${escapeHtml(requestId)}">Save stage</button></div>
    </article>`;
  }).join(""):'<div class="empty-card">No candidate applications are recorded for this request yet. The UI does not invent matches.</div>';
  $$('[data-save-stage]',$("matchesList")).forEach((button)=>button.addEventListener("click",()=>saveApplicationStage(button.dataset.requestId,button.dataset.saveStage)));
}

async function saveApplicationStage(requestId,applicationId){
  const select=$(`[data-stage-select="${CSS.escape(applicationId)}"]`,$("matchesList"));
  if(!select) return;
  try{
    await api(`/api/person-card/agency/v1/applications/${encodeURIComponent(applicationId)}`,{method:"PATCH",body:JSON.stringify({stage:select.value})});
    showToast(`Pipeline stage → ${select.value}`);
    await Promise.allSettled([loadApplications(requestId),loadDashboard()]);
  }catch(error){showToast(friendlyError(error))}
}

async function loadActivity(){
  const data=await api("/api/person-card/agency/activity?limit=100");
  state.activity=asArray(data.activity);
  renderActivity();
  renderMessages();
}

function formatDate(value){
  if(!value) return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return compact(value,40);
  return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

function actionLabel(value){return String(value||"Activity").replaceAll("_"," ")}

function renderActivity(){
  const items=state.activity.slice(0,6);
  $("recentActivity").innerHTML=items.length?items.map((item)=>`<article class="activity-card"><div><strong>${escapeHtml(actionLabel(item.actionType))}</strong><small>${escapeHtml(item.displayName||"Worker")}</small></div><span>${escapeHtml(formatDate(item.createdAt))}</span></article>`).join(""):'<div class="empty-card">No recorded agency activity yet.</div>';
}

function renderMessages(){
  const relevant=new Set(["CONTACTED","REQUEST_PACK_DRAFTED","OFFER_DRAFTED","SHARED"]);
  const items=state.activity.filter((item)=>relevant.has(String(item.actionType||"").toUpperCase()));
  $("messagesList").innerHTML=items.length?items.map((item)=>`<article class="message-card"><div class="match-top"><strong>${escapeHtml(item.displayName||"Worker")}</strong><span>${escapeHtml(formatDate(item.createdAt))}</span></div><div class="match-sub">${escapeHtml(actionLabel(item.actionType))}</div></article>`).join(""):'<div class="empty-card">No recorded communication actions yet. No external message sync is being claimed.</div>';
}

async function askNexus(questionOverride){
  const question=String(questionOverride||$("nexusQuestion").value||"").trim();
  if(!question){showToast("Enter a question for Nexus");return}
  $("nexusQuestion").value=question;
  $("askNexusButton").disabled=true;
  $("nexusAnswer").classList.add("empty-card");
  $("nexusAnswer").textContent="Nexus is reading the current agency-scoped data…";
  try{
    const result=await api("/api/person-card/agency/v1/ask-nexus/query",{method:"POST",body:JSON.stringify({question})});
    const evidence=asArray(result.evidence);
    $("nexusAnswer").classList.remove("empty-card");
    $("nexusAnswer").innerHTML=`
      <div class="nexus-result-head"><strong>${escapeHtml(result.answerType||"Agency answer")}</strong><span>${result.tenantScoped?"TENANT SCOPED":"SCOPE UNKNOWN"}</span></div>
      <div class="nexus-answer-text">${escapeHtml(result.answer||"No answer returned.")}</div>
      ${evidence.length?`<div class="evidence-list">${evidence.slice(0,30).map(renderEvidence).join("")}</div>`:""}
    `;
  }catch(error){
    $("nexusAnswer").classList.add("empty-card");
    $("nexusAnswer").textContent=friendlyError(error);
  }finally{$("askNexusButton").disabled=false}
}

function renderEvidence(item){
  const record=item&&typeof item==="object"?item:{};
  const title=record.displayName||record.role||record.clientName||record.requestId||"Evidence";
  const skip=new Set(["displayName","requestId"]);
  const lines=Object.entries(record).filter(([key,value])=>!skip.has(key)&&value!==null&&value!==undefined&&value!=="").slice(0,5).map(([key,value])=>{
    const shown=typeof value==="object"?JSON.stringify(value):String(value);
    return `${key.replace(/([A-Z])/g," $1")}: ${compact(shown,120)}`;
  });
  return `<div class="evidence-row"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(lines.join(" · ")||"Agency evidence")}</small></div>`;
}

async function loadProfile(){
  const data=await api("/api/person-card/agency/profile");
  state.profile=data;
  if(data.agency){state.agency={...(state.agency||{}),...data.agency};renderAgencyIdentity()}
}

function openProfile(){
  const a=state.profile?.agency||state.agency||{};
  const r=state.profile?.recruiter||{};
  $("profileAgencyName").value=a.name||"";
  $("profileAgencyWebsite").value=a.website||"";
  $("profileAgencyRegistration").value=a.registrationNumber||"";
  $("profileAgencyLocation").value=a.location||"";
  $("profileAgencyDescription").value=a.description||"";
  $("profileRecruiterName").value=r.displayName||"";
  $("profileRecruiterTitle").value=r.jobTitle||"";
  $("profileRecruiterEmail").value=r.email||"";
  $("profileRecruiterPhone").value=r.phone||"";
  $("profileRecruiterBio").value=r.bio||"";
  $("profileFormStatus").textContent="";
  openModal("profileModal");
}

async function saveProfile(event){
  event.preventDefault();
  $("saveProfileButton").disabled=true;
  $("profileFormStatus").textContent="Saving…";
  const body={
    agency:{
      name:$("profileAgencyName").value.trim(),
      website:$("profileAgencyWebsite").value.trim(),
      registrationNumber:$("profileAgencyRegistration").value.trim(),
      location:$("profileAgencyLocation").value.trim(),
      description:$("profileAgencyDescription").value.trim(),
    },
    recruiter:{
      displayName:$("profileRecruiterName").value.trim(),
      jobTitle:$("profileRecruiterTitle").value.trim(),
      email:$("profileRecruiterEmail").value.trim(),
      phone:$("profileRecruiterPhone").value.trim(),
      bio:$("profileRecruiterBio").value.trim(),
    },
  };
  try{
    const data=await api("/api/person-card/agency/profile",{method:"PATCH",body:JSON.stringify(body)});
    state.profile={agency:data.agency,recruiter:data.recruiter};
    state.agency={...(state.agency||{}),...data.agency};
    renderAgencyIdentity();
    $("profileFormStatus").textContent="Profile saved.";
    showToast("Agency profile saved");
    setTimeout(()=>closeModal("profileModal"),350);
  }catch(error){$("profileFormStatus").textContent=friendlyError(error)}
  finally{$("saveProfileButton").disabled=false}
}

async function logout(){
  $("logoutButton").disabled=true;
  try{
    const result=await api("/api/logout",{method:"POST",body:JSON.stringify({})});
    if(result.redirectUrl){window.location.assign(result.redirectUrl);return}
    window.location.reload();
  }catch(error){showToast(friendlyError(error));$("logoutButton").disabled=false}
}

function bindEvents(){
  $("nexusLogo").addEventListener("click",()=>showView("nexus"));
  $("topMenuButton").addEventListener("click",()=>showView("settings"));
  $("retryButton").addEventListener("click",bootstrap);
  $("createAgencyButton").addEventListener("click",createAgency);
  $("themeToggle").addEventListener("click",toggleTheme);
  $("logoutButton").addEventListener("click",logout);
  $("workerSearchButton").addEventListener("click",()=>loadWorkers($("workerSearch").value.trim()).catch((e)=>showToast(friendlyError(e))));
  $("workerSearch").addEventListener("keydown",(event)=>{if(event.key==="Enter"){event.preventDefault();$("workerSearchButton").click()}});
  $("refreshWorkers").addEventListener("click",()=>loadWorkers().catch((e)=>showToast(friendlyError(e))));
  $("refreshMatches").addEventListener("click",()=>loadApplications($("matchRequestSelect").value));
  $("matchRequestSelect").addEventListener("change",()=>loadApplications($("matchRequestSelect").value));
  $("requestForm").addEventListener("submit",saveRequest);
  $("profileForm").addEventListener("submit",saveProfile);
  $("askNexusButton").addEventListener("click",()=>askNexus());
  $("nexusQuestion").addEventListener("keydown",(event)=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();askNexus()}});

  $$('[data-nav]').forEach((button)=>button.addEventListener("click",()=>showView(button.dataset.nav)));
  $$('[data-new-request]').forEach((button)=>button.addEventListener("click",openNewRequest));
  $$('[data-open-profile]').forEach((button)=>button.addEventListener("click",openProfile));
  $$('[data-question]').forEach((button)=>button.addEventListener("click",()=>{
    const question=button.dataset.question;
    showView("nexus");
    $("nexusQuestion").value=question;
    askNexus(question);
  }));
  $$('[data-worker-source]').forEach((button)=>button.addEventListener("click",()=>{
    state.workerSource=button.dataset.workerSource;
    $$('[data-worker-source]').forEach((b)=>b.classList.toggle("active",b===button));
    renderWorkers();
  }));
  $$('[data-request-filter]').forEach((button)=>button.addEventListener("click",()=>{
    state.requestFilter=button.dataset.requestFilter;
    $$('[data-request-filter]').forEach((b)=>b.classList.toggle("active",b===button));
    renderRequests();
  }));
  $$('[data-close-modal]').forEach((button)=>button.addEventListener("click",()=>closeModal(button.dataset.closeModal)));
  $$(".modal-backdrop").forEach((backdrop)=>backdrop.addEventListener("click",(event)=>{if(event.target===backdrop) closeModal(backdrop.id)}));
  document.addEventListener("keydown",(event)=>{if(event.key==="Escape") $$(".modal-backdrop:not([hidden])").forEach((modal)=>closeModal(modal.id))});
}

setTheme(localStorage.getItem("nosmo-agency-theme")||"dark");
bindEvents();
bootstrap();
