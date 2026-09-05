(function(){
  "use strict";

  function q(sel,root){return (root||document).querySelector(sel)}
  function qa(sel,root){return Array.from((root||document).querySelectorAll(sel))}
  function escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,function(ch){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
  }
  function openWork(panel){
    if(typeof window.NEXUS_OPEN_WORK_PANEL==="function"){
      window.NEXUS_OPEN_WORK_PANEL(panel);
      return;
    }
    var overlay=q("#workOverlay");
    qa(".workPanel").forEach(function(el){
      el.classList.toggle("active",el.dataset.panel===panel);
    });
    var title=q("#workTitle");
    var titles={
      availability:"Availability",
      find:"AI Work Agent",
      matches:"Job Matches",
      agencies:"Agency Outreach",
      "incoming-request":"Agency Request",
      application:"Application Draft",
      request:"Request Pack",
      offer:"Offer Work",
      ai:"AI Profile Check"
    };
    if(title)title.textContent=titles[panel]||"AI Work Agent";
    overlay?.classList.add("open");
    overlay?.setAttribute("aria-hidden","false");
  }

  function toast(msg){
    var el=q("#workToast");
    if(!el)return;
    el.textContent=msg;
    el.classList.add("show");
    window.setTimeout(function(){el.classList.remove("show")},2400);
  }

  function currentDraftId(){
    return new URLSearchParams(window.location.search).get("draft");
  }
  function contextualWorkUrl(view){
    var url=new URL(window.location.origin+window.location.pathname);
    var draftId=currentDraftId();
    if(draftId)url.searchParams.set("draft",draftId);
    if(view)url.searchParams.set("view",view);
    return url.toString();
  }
  function initials(first,last){
    return [String(first||"").trim()[0],String(last||"").trim()[0]].filter(Boolean).join("").toUpperCase()||"PC";
  }
  function applyPersonDraftToCard(person,profile){
    if(!person)return;
    var first=q(".first"),last=q(".last"),role=q(".role"),trade=q(".trade"),photo=q(".photo");
    if(first)first.textContent=person.firstName||"PERSON";
    if(last)last.textContent=person.lastName||"CARD";
    if(role)role.textContent="WORK PROFILE";
    if(trade)trade.textContent=profile&&profile.preferences&&profile.preferences.primaryTrade||person.primaryRole||"TRADE NOT SET";

    var meta=qa(".metaLine");
    if(meta[0]){
      var span=q("span",meta[0]);
      if(span)span.textContent=person.location||profile?.preferences?.locations?.[0]||"Location not set";
    }
    if(meta[1]){
      var span2=q("span",meta[1]);
      if(span2)span2.textContent=person.experienceYears ? person.experienceYears+" yrs experience" : "Experience added in profile";
    }

    if(photo){
      photo.style.backgroundImage="none";
      photo.style.display="grid";
      photo.style.placeItems="center";
      photo.style.color="#72adff";
      photo.style.fontWeight="950";
      photo.style.fontSize="34px";
      photo.textContent=initials(person.firstName,person.lastName);
      if(person.photoDataUrl){
        photo.style.backgroundImage='url("'+String(person.photoDataUrl).replace(/"/g,"")+'")';
        photo.style.backgroundSize="cover";
        photo.style.backgroundPosition="center";
        photo.style.color="transparent";
      }
    }

    var links=qa(".comms a");
    links.forEach(function(link){
      var label=(link.getAttribute("aria-label")||"").toLowerCase();
      if(label==="whatsapp"){
        var number=String(person.contact&&person.contact.phone||"").replace(/[^0-9+]/g,"");
        link.href=number?"https://wa.me/"+encodeURIComponent(number.replace(/^\+/,"")):"https://wa.me/?text="+encodeURIComponent("NOSMO Person Card: "+contextualWorkUrl("recruiter"));
      }
      if(label==="email"){
        var email=person.contact&&person.contact.email;
        link.href=email?"mailto:"+encodeURIComponent(email):"mailto:?subject="+encodeURIComponent("NOSMO Person Card")+"&body="+encodeURIComponent(contextualWorkUrl("recruiter"));
      }
      if(label==="phone"){
        var phone=person.contact&&person.contact.phone;
        link.href=phone?"tel:"+encodeURIComponent(phone):"tel:";
      }
      if(label==="sms"){
        var sms=person.contact&&person.contact.phone;
        link.href=sms?"sms:"+encodeURIComponent(sms):"sms:?body="+encodeURIComponent(contextualWorkUrl("recruiter"));
      }
      if(label==="share")link.href=contextualWorkUrl("recruiter");
    });

    document.title="NOSMO Nexus — "+(person.displayName||[person.firstName,person.lastName].filter(Boolean).join(" "))+" Work Profile";
    var status=q("#workDataMode");
    if(status)status.textContent="DRAFT PROFILE";
  }
  async function loadDraftProfile(){
    var draftId=currentDraftId();
    if(!draftId)return null;

    var person=null,profile=null;
    try{
      person=JSON.parse(localStorage.getItem("nexus-person-draft:"+draftId)||"null");
      profile=JSON.parse(localStorage.getItem("nexus-work-profile-draft:"+draftId)||"null");
    }catch(_){}

    if(person&&profile){
      if(profile.personId!==draftId||person.id!==draftId){
        return {error:"NEXUS_WORK_PROFILE_DRAFT_ID_MISMATCH",draftId:draftId};
      }
      return {person:person,profile:profile,draftId:draftId,source:"local"};
    }

    var apiBase=(document.querySelector('meta[name="nexus-onboarding-api-base"]')?.content||"").trim().replace(/\/$/,"");
    var draftToken="";
    try{draftToken=localStorage.getItem("nexus-person-work-draft-token:"+draftId)||""}catch(_){}
    if(!apiBase||!draftToken){
      return {error:"NEXUS_WORK_PROFILE_DRAFT_NOT_FOUND",draftId:draftId};
    }

    try{
      var res=await fetch(apiBase+"/drafts/load",{
        method:"POST",
        headers:{"content-type":"application/json"},
        credentials:"omit",
        cache:"no-store",
        body:JSON.stringify({draftToken:draftToken})
      });
      var payload=await res.json().catch(function(){return {}});
      if(!res.ok){
        return {error:payload&&payload.error||("HTTP_"+res.status),draftId:draftId};
      }
      if(!payload.person||!payload.workProfile||payload.personId!==draftId){
        return {error:"NEXUS_WORK_PROFILE_SERVER_DRAFT_INVALID",draftId:draftId};
      }
      person=payload.person;
      profile=payload.workProfile;
      try{
        localStorage.setItem("nexus-person-draft:"+draftId,JSON.stringify(person));
        localStorage.setItem("nexus-work-profile-draft:"+draftId,JSON.stringify(profile));
      }catch(_){}
      return {person:person,profile:profile,draftId:draftId,source:"server",persistedAt:payload.persistedAt};
    }catch(_){
      return {error:"NEXUS_WORK_PROFILE_SERVER_UNREACHABLE",draftId:draftId};
    }
  }

  function sourceLabel(profile,id){
    var row=(profile.sourceConnectors||[]).find(function(x){return x.id===id});
    return row?row.label:"Source";
  }
  function renderCriteria(profile){
    var grid=q("#workCriteria");
    if(!grid)return;
    var a=profile.availability||{},p=profile.preferences||{};
    var chips=[
      ["Trade",p.primaryTrade||"—"],
      ["Base",(p.locations||[])[0]||"—"],
      ["Status",a.label||a.status||"—"],
      ["Radius",a.preferredRadiusKm?String(a.preferredRadiusKm)+" km":"—"],
      ["Shift",(a.shifts||[]).join(" / ")||"—"],
      ["Transport",a.ownTransport?"Own transport":"Not stated"]
    ];
    grid.innerHTML=chips.map(function(row){
      return '<div class="workChip"><span>'+escapeHtml(row[0])+'</span><strong>'+escapeHtml(row[1])+'</strong></div>';
    }).join("");
  }
  function tokenize(value){
    return String(value||"").toLowerCase().replace(/[^a-z0-9+]+/g," ").split(/\s+/).filter(function(x){return x.length>2});
  }
  function scoreJob(profile,job){
    var prefs=profile.preferences||{};
    var tradeTokens=tokenize([prefs.primaryTrade].concat(prefs.targetRoles||[]).join(" "));
    var jobTokens=tokenize([job.title,job.category,job.descriptionSnippet].join(" "));
    var overlap=tradeTokens.filter(function(token){return jobTokens.indexOf(token)>=0});
    var score=45;
    var reasons=[];
    if(overlap.length){
      score+=Math.min(30,overlap.length*8);
      reasons.push("Trade/role terms: "+overlap.slice(0,4).join(", "));
    }
    var preferred=(prefs.locations||[]).map(function(x){return String(x).toLowerCase()});
    var loc=String(job.location&&job.location.display||"").toLowerCase();
    if(preferred.some(function(x){return x&&loc.indexOf(x)>=0})){
      score+=15;reasons.push("Preferred location");
    }
    if(job.contract&&job.contract.fullTime){score+=4;reasons.push("Full-time")}
    score=Math.max(0,Math.min(99,score));
    return {score:score,reasons:reasons.length?reasons:["General work-profile relevance"]};
  }
  function normalizeLiveForCard(profile,job){
    var scored=scoreJob(profile,job);
    return {
      id:job.id,
      sourceId:job.source&&job.source.connectorId||"job-gateway",
      sourceUrl:job.source&&job.source.sourceUrl,
      title:job.title,
      employer:job.company||"Employer not stated",
      location:job.location&&job.location.display||"Location not stated",
      distanceKm:null,
      shift:job.contract&&job.contract.fullTime?"Full-time":"Not stated",
      rate:job.salary&&job.salary.display||"Not stated",
      matchScore:scored.score,
      reasons:scored.reasons,
      gaps:[],
      observedAt:job.source&&job.source.observedAt,
      sourceMode:"live-api",
      provider:job.source&&job.source.provider||"Job Gateway"
    };
  }
  function renderJobs(profile){
    var list=q("#jobList");
    if(!list)return;
    list.innerHTML=(profile.jobMatches||[]).map(function(job){
      var reasons=(job.reasons||[]).map(function(x){return '<i>'+escapeHtml(x)+'</i>'}).join("");
      var gaps=(job.gaps||[]).length
        ? '<p class="reason">Check: '+escapeHtml((job.gaps||[]).join(" · "))+'</p>'
        : '<p class="reason">No missing requirement identified in the demo record.</p>';
      return '<article class="jobCard">'+
        '<div class="jobTop"><div><strong>'+escapeHtml(job.title)+'</strong><span>'+escapeHtml(sourceLabel(profile,job.sourceId))+' · '+escapeHtml(job.location)+'</span></div><div class="match">'+escapeHtml(job.matchScore)+'%</div></div>'+
        '<div class="jobMeta">'+(job.distanceKm!==null&&job.distanceKm!==undefined?'<i>'+escapeHtml(job.distanceKm)+' km</i>':'')+'<i>'+escapeHtml(job.shift||"Shift n/a")+'</i><i>'+escapeHtml(job.rate||"Rate n/a")+'</i></div>'+
        '<p class="reason">'+reasons+'</p>'+gaps+
        '<div class="jobActions"><button type="button" data-application-job="'+escapeHtml(job.id)+'">Prepare application</button>'+(job.sourceUrl?'<a href="'+escapeHtml(job.sourceUrl)+'" target="_blank" rel="noopener">Open source</a>':'<button type="button" data-job-id="'+escapeHtml(job.id)+'">Details</button>')+'</div>'+
      '</article>';
    }).join("");
  }
  function renderAgencies(profile){
    var list=q("#agencyQueue");
    if(!list)return;
    list.innerHTML=(profile.agencies||[]).map(function(a){
      return '<div class="agencyRow"><strong>'+escapeHtml(a.name)+'</strong><p>'+escapeHtml(a.desk||"Agency")+' · '+escapeHtml(a.status||"")+'</p>'+
        '<div class="agencyActions"><a href="'+escapeHtml(a.whatsapp||"#")+'" target="_blank" rel="noopener">WhatsApp</a><a href="'+escapeHtml(a.email||"#")+'">Email</a></div></div>';
    }).join("");
  }
  function availabilityLabel(a){
    if(!a)return "Available";
    if(a.status==="busy")return "Busy";
    if(a.status==="from-date")return a.availableFrom ? "Ready on "+a.availableFrom : "Ready on date";
    return "Available";
  }
  function readLocalAvailability(profile){
    try{
      var raw=localStorage.getItem("nexus-work-availability:"+profile.personId);
      if(!raw)return profile.availability||{};
      return Object.assign({},profile.availability||{},JSON.parse(raw));
    }catch(_){return profile.availability||{}}
  }
  function applyAvailabilityToUi(profile){
    var a=readLocalAvailability(profile);
    profile.availability=a;
    var label=q("#workAvailabilityLabel");
    if(label)label.textContent=availabilityLabel(a);
    var state=q("#availabilityState"),date=q("#availabilityDate"),radius=q("#availabilityRadius");
    var day=q("#shiftDay"),night=q("#shiftNight"),transport=q("#ownTransport"),away=q("#workAway");
    if(state)state.value=a.status||"available";
    if(date)date.value=a.availableFrom||"";
    if(radius)radius.value=String(a.preferredRadiusKm||0);
    if(day)day.checked=(a.shifts||[]).indexOf("day")>=0;
    if(night)night.checked=(a.shifts||[]).indexOf("night")>=0;
    if(transport)transport.checked=!!a.ownTransport;
    if(away)away.checked=!!a.workAway;
    renderCriteria(profile);
  }
  function bindAvailability(profile){
    var save=q("#saveAvailability");
    if(!save)return;
    save.addEventListener("click",function(){
      var state=q("#availabilityState"),date=q("#availabilityDate"),radius=q("#availabilityRadius");
      var day=q("#shiftDay"),night=q("#shiftNight"),transport=q("#ownTransport"),away=q("#workAway");
      var shifts=[];
      if(day&&day.checked)shifts.push("day");
      if(night&&night.checked)shifts.push("night");
      var next={
        status:state?state.value:"available",
        label:state&&state.value==="busy"?"Busy":state&&state.value==="from-date"?"Ready on date":"Available",
        availableFrom:date?date.value:"",
        preferredRadiusKm:radius?Number(radius.value||0):0,
        shifts:shifts,
        ownTransport:!!(transport&&transport.checked),
        workAway:!!(away&&away.checked)
      };
      try{localStorage.setItem("nexus-work-availability:"+profile.personId,JSON.stringify(next))}catch(_){}
      profile.availability=Object.assign({},profile.availability||{},next);
      applyAvailabilityToUi(profile);
      toast("Availability saved on this device");
    });
  }
  function renderReadiness(profile){
    var p=profile.readiness||{};
    var map=[
      ["#aiCvState",p.cv&&p.cv.state],
      ["#aiCertState",p.certificates&&p.certificates.state],
      ["#aiRefState",p.references&&p.references.state]
    ];
    map.forEach(function(row){var el=q(row[0]);if(el&&row[1])el.textContent=String(row[1]).toUpperCase()});
  }
  function bindJobDetails(profile){
    document.addEventListener("click",function(e){
      var btn=e.target.closest&&e.target.closest("[data-job-id]");
      if(!btn)return;
      var job=(profile.jobMatches||[]).find(function(j){return j.id===btn.dataset.jobId});
      if(!job)return;
      toast(job.title+" · "+job.matchScore+"% · "+(job.gaps||[]).length+" gap(s)");
    });
  }
  


  const incomingRequestLabels={
    cv:"Current CV",
    certs:"Certificates / tickets",
    refs:"References",
    rtw:"Right to Work check information",
    availability:"Current availability"
  };
  function incomingRequestFromUrl(){
    var params=new URLSearchParams(window.location.search);
    if(params.get("view")==="recruiter")return null;
    var request=(params.get("request")||"").split(",").map(function(x){return x.trim()}).filter(function(x){return incomingRequestLabels[x]});
    if(!request.length)return null;
    return {
      requestId:(params.get("requestId")||"req-link").slice(0,80),
      agency:(params.get("agency")||"Recruitment team").slice(0,120),
      items:request.slice(0,8)
    };
  }
  function renderIncomingRequest(profile,request){
    var agency=q("#incomingAgency"),list=q("#incomingRequestItems"),status=q("#incomingRequestStatus");
    if(agency)agency.textContent=request.agency+" requests:";
    if(list){
      list.innerHTML=request.items.map(function(code){
        return '<label class="agencyRow" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span><strong>'+escapeHtml(incomingRequestLabels[code])+'</strong><p>Worker approval required</p></span><input type="checkbox" data-incoming-item="'+escapeHtml(code)+'" checked></label>';
      }).join("");
    }
    var storageKey="nexus-work-request-response:"+profile.personId+":"+request.requestId;
    var prior=null;
    try{prior=JSON.parse(localStorage.getItem(storageKey)||"null")}catch(_){}
    if(prior&&status)status.textContent="Saved on this device: "+String(prior.status||"response");
    q("#approveRequest")?.addEventListener("click",function(){
      var approved=qa("[data-incoming-item]:checked").map(function(el){return el.dataset.incomingItem});
      var response={schema:"nexus-person-work-request-response/v1",requestId:request.requestId,personId:profile.personId,agency:request.agency,status:"approved-local",approvedItems:approved,respondedAt:new Date().toISOString(),serverDisclosurePerformed:false};
      try{localStorage.setItem(storageKey,JSON.stringify(response))}catch(_){}
      if(status)status.textContent="Approved on this device: "+(approved.map(function(x){return incomingRequestLabels[x]}).join(", ")||"nothing");
      toast("Request response saved locally — nothing sent yet");
    });
    q("#rejectRequest")?.addEventListener("click",function(){
      var response={schema:"nexus-person-work-request-response/v1",requestId:request.requestId,personId:profile.personId,agency:request.agency,status:"rejected-local",approvedItems:[],respondedAt:new Date().toISOString(),serverDisclosurePerformed:false};
      try{localStorage.setItem(storageKey,JSON.stringify(response))}catch(_){}
      if(status)status.textContent="Request rejected on this device.";
      toast("Request rejected locally — nothing sent");
    });
    openWork("incoming-request");
  }

  var selectedApplicationJob=null;
  function profileDisplayName(){
    var h=document.querySelector(".name");
    return h ? h.textContent.replace(/\s+/g," ").trim() : "Worker";
  }
  function buildApplicationMessage(profile,job){
    var prefs=profile.preferences||{},a=profile.availability||{};
    var role=prefs.primaryTrade||"construction professional";
    var loc=job.location||"";
    var company=job.employer||"your team";
    var availability=availabilityLabel(a);
    return "Hi "+company+",\n\nI would like to apply for the "+job.title+" role"+(loc?" in "+loc:"")+". "+
      "My NOSMO Person Card lists me as "+role+", with "+availability.toLowerCase()+". "+
      "I have 15+ years of relevant experience and can share my current CV, verified certificates and references where available.\n\n"+
      "Person Card: "+contextualWorkUrl("recruiter")+"\n\n"+
      "Please let me know if you need any additional information.\n\n"+
      profileDisplayName();
  }
  function applicationReadiness(profile,job){
    var r=profile.readiness||{},missing=[];
    if(!r.cv||r.cv.state!=="current")missing.push("CV is not marked current");
    if(!r.certificates||r.certificates.state!=="verified")missing.push("certificates need confirmation");
    if(job&&job.gaps&&job.gaps.length)missing=missing.concat(job.gaps);
    return missing.length ? "Before sending: "+missing.join(" · ") : "Profile appears ready for this draft.";
  }
  function updateApplicationDraft(profile,job){
    if(!job)return;
    selectedApplicationJob=job;
    var title=q("#applicationJobTitle"),meta=q("#applicationJobMeta"),preview=q("#applicationPreview"),ready=q("#applicationReadiness");
    if(title)title.textContent=job.title;
    if(meta)meta.textContent=[job.employer,job.location,job.rate].filter(Boolean).join(" · ");
    var msg=buildApplicationMessage(profile,job);
    if(preview)preview.value=msg;
    if(ready)ready.textContent=applicationReadiness(profile,job);
    var wa=q("#applicationWhatsApp");if(wa)wa.href="https://wa.me/?text="+encodeURIComponent(msg);
    var email=q("#applicationEmail");if(email)email.href="mailto:?subject="+encodeURIComponent("Application — "+job.title)+"&body="+encodeURIComponent(msg);
  }
  function bindApplicationDraft(profile){
    document.addEventListener("click",function(e){
      var btn=e.target.closest&&e.target.closest("[data-application-job]");
      if(!btn)return;
      e.preventDefault();
      var job=(profile.jobMatches||[]).find(function(x){return x.id===btn.dataset.applicationJob});
      if(!job)return;
      updateApplicationDraft(profile,job);
      openWork("application");
    });
    q("#copyApplication")?.addEventListener("click",function(){
      var value=q("#applicationPreview")?.value||"";
      navigator.clipboard?.writeText(value);toast("Application draft copied");
    });
    q("#refreshApplication")?.addEventListener("click",function(){
      if(selectedApplicationJob)updateApplicationDraft(profile,selectedApplicationJob);
      toast("Application draft refreshed from Person Card");
    });
    q("#applicationPreview")?.addEventListener("input",function(){
      var value=q("#applicationPreview")?.value||"";
      var wa=q("#applicationWhatsApp");if(wa)wa.href="https://wa.me/?text="+encodeURIComponent(value);
      var email=q("#applicationEmail");if(email&&selectedApplicationJob)email.href="mailto:?subject="+encodeURIComponent("Application — "+selectedApplicationJob.title)+"&body="+encodeURIComponent(value);
    });
  }

  function selectedRequestItems(){
    var items=[];
    if(q("#reqCv")&&q("#reqCv").checked)items.push("current CV");
    if(q("#reqCerts")&&q("#reqCerts").checked)items.push("certificates / tickets");
    if(q("#reqRefs")&&q("#reqRefs").checked)items.push("references");
    if(q("#reqRtw")&&q("#reqRtw").checked)items.push("Right to Work check information");
    if(q("#reqAvail")&&q("#reqAvail").checked)items.push("current availability");
    return items;
  }
  function requestCodes(){
    var codes=[];
    if(q("#reqCv")&&q("#reqCv").checked)codes.push("cv");
    if(q("#reqCerts")&&q("#reqCerts").checked)codes.push("certs");
    if(q("#reqRefs")&&q("#reqRefs").checked)codes.push("refs");
    if(q("#reqRtw")&&q("#reqRtw").checked)codes.push("rtw");
    if(q("#reqAvail")&&q("#reqAvail").checked)codes.push("availability");
    return codes;
  }
  function buildWorkerRequestUrl(){
    var agency=(q("#reqAgency")&&q("#reqAgency").value.trim())||"Recruitment team";
    var url=new URL(contextualWorkUrl());
    url.searchParams.set("agency",agency);
    url.searchParams.set("request",requestCodes().join(","));
    url.searchParams.set("requestId","req-"+Date.now().toString(36));
    return url.toString();
  }
  function buildRequestMessage(profile){
    var agency=(q("#reqAgency")&&q("#reqAgency").value.trim())||"the recruitment team";
    var items=selectedRequestItems();
    var card=buildWorkerRequestUrl();
    return "Hi Kamil,\n\n"+agency+" would like to request the following from your NOSMO Person Card: "+
      (items.length?items.join(", "):"additional work-profile information")+
      ".\n\nPlease review and share only the items you approve.\n\nOpen request: "+card+
      "\n\nThis request does not grant automatic access to private documents.";
  }
  function updateRequestChannels(profile){
    var msg=buildRequestMessage(profile);
    var preview=q("#requestPreview");if(preview)preview.value=msg;
    var wa=q("#requestWhatsApp");if(wa)wa.href="https://wa.me/?text="+encodeURIComponent(msg);
    var email=q("#requestEmail");if(email)email.href="mailto:?subject="+encodeURIComponent("NOSMO Person Card information request")+"&body="+encodeURIComponent(msg);
    return msg;
  }
  function buildOfferMessage(profile){
    var role=(q("#offerRole")&&q("#offerRole").value.trim())||"work opportunity";
    var location=(q("#offerLocation")&&q("#offerLocation").value.trim())||"location to confirm";
    var start=(q("#offerStart")&&q("#offerStart").value)||"to confirm";
    var rate=(q("#offerRate")&&q("#offerRate").value.trim())||"to confirm";
    var duration=(q("#offerDuration")&&q("#offerDuration").value.trim())||"to confirm";
    var agency=(q("#offerAgency")&&q("#offerAgency").value.trim())||"Recruiter / employer";
    return "Hi Kamil,\n\n"+agency+" would like to offer you the following work:\n"+
      "Role: "+role+"\nLocation: "+location+"\nStart: "+start+"\nRate: "+rate+"\nDuration: "+duration+
      "\n\nPlease review and confirm whether you are interested.\n\nThis is a draft offer from the NOSMO Recruiter View; no placement is confirmed until accepted.";
  }
  function updateOfferChannels(profile){
    var msg=buildOfferMessage(profile);
    var preview=q("#offerPreview");if(preview)preview.value=msg;
    var wa=q("#offerWhatsApp");if(wa)wa.href="https://wa.me/?text="+encodeURIComponent(msg);
    var email=q("#offerEmail");if(email)email.href="mailto:?subject="+encodeURIComponent("Work offer")+"&body="+encodeURIComponent(msg);
    return msg;
  }
  function bindRecruiterDrafts(profile){
    q("#buildRequest")?.addEventListener("click",function(){updateRequestChannels(profile);toast("Request Pack draft prepared")});
    q("#copyRequest")?.addEventListener("click",function(){
      var msg=updateRequestChannels(profile);
      navigator.clipboard?.writeText(msg);toast("Request Pack copied");
    });
    ["#reqCv","#reqCerts","#reqRefs","#reqRtw","#reqAvail","#reqAgency"].forEach(function(sel){
      q(sel)?.addEventListener("change",function(){updateRequestChannels(profile)});
      q(sel)?.addEventListener("input",function(){updateRequestChannels(profile)});
    });
    q("#buildOffer")?.addEventListener("click",function(){updateOfferChannels(profile);toast("Offer draft prepared")});
    q("#copyOffer")?.addEventListener("click",function(){
      var msg=updateOfferChannels(profile);
      navigator.clipboard?.writeText(msg);toast("Offer copied");
    });
    ["#offerRole","#offerLocation","#offerStart","#offerRate","#offerDuration","#offerAgency"].forEach(function(sel){
      q(sel)?.addEventListener("change",function(){updateOfferChannels(profile)});
      q(sel)?.addEventListener("input",function(){updateOfferChannels(profile)});
    });
    updateRequestChannels(profile);
    updateOfferChannels(profile);
  }

  function isRecruiterView(){
    return new URLSearchParams(window.location.search).get("view")==="recruiter";
  }
  function enableRecruiterView(profile){
    if(!isRecruiterView())return;
    document.body.setAttribute("data-recruiter-view","true");
    var mode=q("#workDataMode");
    if(mode)mode.textContent="RECRUITER VIEW";

    var status=q("#workAvailabilityStatus");
    if(status){
      status.removeAttribute("data-work-action");
      status.removeAttribute("role");
      status.removeAttribute("tabindex");
      status.setAttribute("aria-label","Worker availability");
    }

    var menu=q("#menu");
    if(menu&&!q('[data-agency-desk-link]',menu)){
      var deskLink=document.createElement("a");
      deskLink.className="mi";
      deskLink.href="./agency-desk.html";
      deskLink.setAttribute("data-agency-desk-link","true");
      deskLink.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V5h8v2M4 11h16"/></svg><span><strong>Agency Desk</strong><span>Recruiter pipeline, invites, requests and offers</span></span>';
      menu.prepend(deskLink);
    }
    if(menu&&!q('[data-agency-invite-link]',menu)){
      var inviteLink=document.createElement("a");
      inviteLink.className="mi";
      inviteLink.href="./agency-invite.html";
      inviteLink.setAttribute("data-agency-invite-link","true");
      inviteLink.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg><span><strong>Invite New Worker</strong><span>Create a new Person Card onboarding link</span></span>';
      menu.prepend(inviteLink);
    }

    qa(".bridge").forEach(function(el){el.hidden=true});
    qa('a[href*="nexus-file-loader"],a[href*="section=vault"],a[href="/apps/nexus/"],a[href*="/apps/nexus/person-cards/"],a[href*="nexus-logo-ui"]').forEach(function(el){el.hidden=true});

    var workButtons=qa(".actions").find(function(row){return q("[data-work-action]",row)});
    if(workButtons){
      workButtons.innerHTML=
        '<button class="act" type="button" data-recruiter-action="offer"><svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V5h8v2M4 11h16"/></svg><span>Offer Work</span></button>'+
        '<button class="act" type="button" data-recruiter-action="docs"><svg viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6zM14 2v5h5M9 13h6M9 17h6"/></svg><span>Request Docs</span></button>'+
        '<button class="act" type="button" data-recruiter-action="contact"><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5zM8 9h8M8 13h5"/></svg><span>Contact</span></button>'+
        '<button class="act" type="button" data-recruiter-action="shortlist"><svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg><span>Shortlist</span></button>'+
        '<button class="act" type="button" data-recruiter-action="share"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 11l8-5M8 13l8 5"/></svg><span>Share</span></button>';
    }

    document.addEventListener("click",function(e){
      var action=e.target.closest&&e.target.closest("[data-recruiter-action]");
      if(!action)return;
      e.preventDefault();
      var type=action.dataset.recruiterAction;
      if(type==="offer"){openWork("offer");return}
      if(type==="docs"){openWork("request");return}
      if(type==="contact"){var first=q(".comms a");if(first)first.click();return}
      if(type==="shortlist"){try{localStorage.setItem("nexus-recruiter-shortlist:"+profile.personId,"true")}catch(_){}
        toast("Worker shortlisted on this device");return}
      if(type==="share"){
        var url=contextualWorkUrl("recruiter");
        if(navigator.share){navigator.share({title:"NOSMO Recruiter View",url:url}).catch(function(){})}
        else{navigator.clipboard&&navigator.clipboard.writeText(url);toast("Recruiter View link copied")}
      }
    });
  }
  async function searchLiveJobs(profile){
    var status=q("#jobSourceStatus");
    var gateway=profile.jobGateway||{};
    if(!gateway.endpoint){
      if(status)status.textContent="LIVE connector ready but not connected: server endpoint/provider credentials are not configured.";
      toast("Live Job Gateway is not connected yet");
      return false;
    }
    var prefs=profile.preferences||{},availability=profile.availability||{};
    var what=prefs.primaryTrade||(prefs.targetRoles||[])[0];
    var where=(prefs.locations||[])[0];
    if(!what){toast("Add a trade before searching");return false}
    var url=new URL(gateway.endpoint,window.location.href);
    url.searchParams.set("what",what);
    if(where)url.searchParams.set("where",where);
    url.searchParams.set("country",gateway.queryDefaults&&gateway.queryDefaults.country||"gb");
    url.searchParams.set("results",String(gateway.queryDefaults&&gateway.queryDefaults.results||10));
    if(status)status.textContent="Searching live "+(gateway.provider||"job")+" source…";
    try{
      var res=await fetch(url.toString(),{method:"GET",credentials:"omit",cache:"no-store"});
      var payload=await res.json().catch(function(){return {}});
      if(!res.ok){
        var code=payload&&payload.error||("HTTP_"+res.status);
        if(status)status.textContent="LIVE connector unavailable: "+code;
        toast("Live connector unavailable: "+code);
        return false;
      }
      var live=(payload.results||[]).map(function(job){return normalizeLiveForCard(profile,job)});
      profile.jobMatches=live.sort(function(a,b){return b.matchScore-a.matchScore});
      renderJobs(profile);
      if(status)status.textContent="LIVE · "+escapeHtml(payload.provider||gateway.provider||"Job Gateway")+" · "+live.length+" jobs · "+new Date().toLocaleTimeString();
      var mode=q("#workDataMode");if(mode)mode.textContent="LIVE JOBS";
      openWork("matches");
      return true;
    }catch(err){
      console.error("Nexus live job search failed",err);
      if(status)status.textContent="LIVE connector unreachable. Demo data was not substituted automatically.";
      toast("Live Job Gateway unreachable");
      return false;
    }
  }
  async function init(){
    var host=q("[data-work-profile-src]");
    if(!host)return;
    var src=host.getAttribute("data-work-profile-src");
    try{
      var draft=await loadDraftProfile();
      var profile;
      if(draft){
        if(draft.error){
          var mode=q("#workDataMode");if(mode)mode.textContent="DRAFT MISSING";
          var source=q("#jobSourceStatus");if(source)source.textContent="Person Card draft is unavailable from local storage and authorised server restore.";
          toast("Person Card draft not found on this device");
          return;
        }
        profile=draft.profile;
        applyPersonDraftToCard(draft.person,profile);
        if(draft.source==="server"){var restored=q("#jobSourceStatus");if(restored)restored.textContent="Person Card restored from durable server persistence.";}
      }else{
        var res=await fetch(src,{cache:"no-store"});
        if(!res.ok)throw new Error("HTTP "+res.status);
        profile=await res.json();
      }
      window.NEXUS_WORK_PROFILE=profile;
      applyAvailabilityToUi(profile);
      renderJobs(profile);
      renderAgencies(profile);
      renderReadiness(profile);
      bindAvailability(profile);
      bindJobDetails(profile);
      bindRecruiterDrafts(profile);
      bindApplicationDraft(profile);
      enableRecruiterView(profile);
      var incoming=incomingRequestFromUrl();
      if(incoming)renderIncomingRequest(profile,incoming);
      var mode=q("#workDataMode");
      if(mode)mode.textContent=profile.demoMode?"DEMO DATA":"CONNECTED";
      var sourceStatus=q("#jobSourceStatus");
      if(sourceStatus){
        sourceStatus.textContent=profile.jobGateway&&profile.jobGateway.endpoint
          ?"LIVE Job Gateway configured · "+(profile.jobGateway.provider||"provider")
          :"LIVE Job Gateway ready, not connected. Demo matches remain separate.";
      }
    }catch(err){
      console.error("Nexus Work Profile data load failed",err);
      toast("Work Profile data unavailable. Static fallback remains visible.");
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
