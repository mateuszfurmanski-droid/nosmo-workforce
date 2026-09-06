(function(){
  "use strict";

  const REGISTRY_KEY="nosmo-person-card-freeware:file-registry/v1";
  const APP_LOG_KEY="nosmo-person-card-freeware:application-log/v1";
  const CONTACT_DRAFT_PREFIX="nosmo-person-card-freeware:contact-draft/v1:";
  const DB_NAME="nosmo-person-card-freeware-files-v1";
  const DB_VERSION=1;
  const STORE_NAME="files";
  const MAX_LOG_ROWS=250;
  const state={profile:null,currentJob:null,ready:false};

  function q(sel,root){return (root||document).querySelector(sel)}
  function escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,function(ch){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
  }
  function toast(message){
    const el=q("#workToast");
    if(!el)return;
    el.textContent=message;
    el.classList.add("show");
    window.setTimeout(function(){el.classList.remove("show")},2600);
  }
  function storageJson(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch(_){return fallback}
  }
  function writeStorageJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}
  }
  function applicationLog(){
    const rows=storageJson(APP_LOG_KEY,[]);
    return Array.isArray(rows)?rows:[];
  }
  function addLog(channel,status,extra){
    const job=state.currentJob||{};
    const row=Object.assign({
      schema:"nexus-contact-action-event/v1",
      id:(crypto.randomUUID?crypto.randomUUID():"evt-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)),
      personId:state.profile&&state.profile.personId||null,
      jobId:job.id||null,
      title:job.title||null,
      employer:job.employer||null,
      channel:channel||"contact",
      status:status,
      at:new Date().toISOString(),
      localOnly:true
    },extra||{});
    const rows=applicationLog();
    rows.unshift(row);
    writeStorageJson(APP_LOG_KEY,rows.slice(0,MAX_LOG_ROWS));
    renderStatus();
    return row;
  }

  function openDb(){
    return new Promise(function(resolve,reject){
      if(!window.indexedDB){reject(new Error("INDEXED_DB_UNAVAILABLE"));return}
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=function(){
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)){
          db.createObjectStore(STORE_NAME,{keyPath:"id"});
        }
      };
      req.onsuccess=function(){resolve(req.result)};
      req.onerror=function(){reject(req.error||new Error("INDEXED_DB_OPEN_FAILED"))};
    });
  }
  async function getStoredFile(id){
    if(!id)return null;
    const db=await openDb();
    try{
      return await new Promise(function(resolve,reject){
        const tx=db.transaction(STORE_NAME,"readonly");
        const req=tx.objectStore(STORE_NAME).get(id);
        req.onsuccess=function(){resolve(req.result||null)};
        req.onerror=function(){reject(req.error||new Error("FILE_READ_FAILED"))};
      });
    }finally{
      db.close();
    }
  }

  function registry(){
    const rows=storageJson(REGISTRY_KEY,[]);
    return Array.isArray(rows)?rows:[];
  }
  function cvRegistry(){
    const rows=registry();
    const cvs=rows.filter(function(row){
      return row.fileRole==="cv" || /\b(cv|resume|curriculum)\b/i.test(String(row.name||"").replace(/[_-]+/g," "));
    });
    return cvs.length?cvs:rows.filter(function(row){
      return /pdf|word|officedocument|msword/i.test(String(row.type||"")) || /\.(pdf|docx?|odt)$/i.test(String(row.name||""));
    });
  }

  function inferCountryPrefix(){
    const lang=(navigator.language||"").toLowerCase();
    return lang==="en-gb" || lang.endsWith("-gb") ? "+44" : "";
  }
  function normalizePhone(raw,prefix){
    let value=String(raw||"").trim();
    if(!value)return "";
    value=value.replace(/[()\s.-]/g,"");
    if(value.startsWith("00"))value="+"+value.slice(2);
    if(value.startsWith("+")){
      value=value.slice(1).replace(/\D/g,"");
    }else{
      value=value.replace(/\D/g,"");
      if(value.startsWith("0")){
        const cc=String(prefix||"").replace(/\D/g,"");
        if(cc)value=cc+value.replace(/^0+/,"");
      }
    }
    if(!/^\d{7,15}$/.test(value))return "";
    return value;
  }
  function safeEmail(raw){
    const value=String(raw||"").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value:"";
  }
  function currentMessage(){
    return q("#applicationPreview")?.value||"";
  }
  function jobContact(job){
    const c=job&&job.contact||{};
    return {
      phone:c.phone||job?.phone||"",
      whatsapp:c.whatsapp||job?.whatsapp||c.phone||job?.phone||"",
      email:c.email||job?.email||""
    };
  }
  function contactDraftKey(){
    return CONTACT_DRAFT_PREFIX+(state.profile?.personId||"anonymous")+":"+(state.currentJob?.id||"no-job");
  }
  function readContactDraft(){
    return storageJson(contactDraftKey(),{});
  }
  function saveContactDraft(){
    if(!state.currentJob)return;
    writeStorageJson(contactDraftKey(),{
      countryPrefix:q("#caeCountryCode")?.value||"",
      phone:q("#caePhone")?.value||"",
      email:q("#caeEmail")?.value||"",
      cvId:q("#caeCv")?.value||"",
      updatedAt:new Date().toISOString()
    });
  }
  function channelTargets(){
    const prefix=q("#caeCountryCode")?.value||"";
    const phone=q("#caePhone")?.value||"";
    const normalized=normalizePhone(phone,prefix);
    const email=safeEmail(q("#caeEmail")?.value||"");
    return {phone:phone,normalized:normalized,email:email};
  }

  function injectStyles(){
    if(q("#nexusContactActionStyles"))return;
    const style=document.createElement("style");
    style.id="nexusContactActionStyles";
    style.textContent=['      .cae{margin-top:10px;border:1px solid rgba(78,141,223,.28);border-radius:14px;background:linear-gradient(180deg,rgba(6,17,30,.92),rgba(3,10,20,.95));padding:11px}','      .caeHead{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px}','      .caeHead small{display:block;color:#76adf7;font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}','      .caeHead strong{display:block;margin-top:3px;color:#fff;font-size:13px}','      .caeBadge{border:1px solid rgba(37,215,127,.28);border-radius:999px;color:#84efb8;background:rgba(37,215,127,.08);padding:4px 7px;font-size:7px;font-weight:900;white-space:nowrap}','      .caeGrid{display:grid;grid-template-columns:86px minmax(0,1fr);gap:7px}','      .caeField{display:grid;gap:4px}','      .caeField.wide{grid-column:1/-1}','      .caeField span{color:#9fb0c6;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}','      .caeField input,.caeField select{width:100%;min-width:0;background:#03101f;color:#e9f2ff;border:1px solid rgba(78,141,223,.25);border-radius:9px;padding:8px;font:inherit;font-size:10px;outline:none}','      .caeField input:focus,.caeField select:focus{border-color:rgba(58,139,255,.78)}','      .caeSteps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}','      .caeAction{min-height:39px;border:1px solid rgba(78,141,223,.28);border-radius:10px;background:rgba(12,38,66,.72);color:#edf6ff;text-decoration:none;display:grid;place-items:center;text-align:center;font:inherit;font-size:9px;font-weight:900;cursor:pointer;padding:6px}','      .caeAction.whatsapp{background:rgba(37,215,127,.12);border-color:rgba(37,215,127,.35);color:#a7f6ca}','      .caeAction.confirm{background:rgba(58,139,255,.16);border-color:rgba(58,139,255,.42)}','      .caeSecondary{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}','      .caeStatus{margin:8px 0 0;color:#9fb0c6;font-size:8.5px;line-height:1.4}','      .caeStatus b{color:#dbeaff}','      .caeHelp{margin:6px 0 0;color:#7389a6;font-size:7.5px;line-height:1.35}','      .caeAddCv{color:#86bdff;text-decoration:none;font-weight:850}','      @media(max-width:360px){.caeSteps{grid-template-columns:1fr}.caeGrid{grid-template-columns:74px minmax(0,1fr)}}'].join("");
    document.head.appendChild(style);
  }

  function injectUi(){
    if(q("#contactActionEngine"))return;
    const panel=q('.workPanel[data-panel="application"]');
    if(!panel)return;
    const oldWa=q("#applicationWhatsApp");
    if(oldWa&&oldWa.parentElement)oldWa.parentElement.hidden=true;

    const box=document.createElement("div");
    box.className="cae";
    box.id="contactActionEngine";
    box.innerHTML=['      <div class="caeHead">','        <div><small>Contact Action Engine</small><strong>Apply from your own phone</strong></div>','        <span class="caeBadge">FREEWARE · LOCAL</span>','      </div>','      <div class="caeGrid">','        <label class="caeField"><span>Country</span><input id="caeCountryCode" inputmode="tel" autocomplete="tel-country-code" placeholder="+44"></label>','        <label class="caeField"><span>Employer phone / WhatsApp</span><input id="caePhone" inputmode="tel" autocomplete="tel" placeholder="+44 7…"></label>','        <label class="caeField wide"><span>Employer email</span><input id="caeEmail" inputmode="email" autocomplete="email" placeholder="recruitment@company.co.uk"></label>','        <label class="caeField wide"><span>CV to use</span><select id="caeCv"><option value="">No local CV selected</option></select></label>','      </div>','      <div class="caeSteps">','        <a class="caeAction whatsapp" id="caeWhatsApp" href="#" target="_blank" rel="noopener">1 · WHATSAPP</a>','        <button class="caeAction" id="caeShareCv" type="button">2 · SHARE CV</button>','        <button class="caeAction confirm" id="caeConfirmSent" type="button">3 · I SENT IT</button>','      </div>','      <div class="caeSecondary">','        <a class="caeAction" id="caeEmailAction" href="#">EMAIL</a>','        <a class="caeAction" id="caeCallAction" href="#">CALL</a>','      </div>','      <p class="caeStatus" id="caeStatus"><b>Prepared locally.</b> Opening a channel never counts as sent.</p>','      <p class="caeHelp">WhatsApp opens the employer chat with your reviewed message. Share CV uses the phone share sheet. Only <b>I SENT IT</b> records a confirmed application. <a class="caeAddCv" href="./data-fetcher/">Add / replace CV</a>.</p>'].join("");
    const note=panel.querySelector(".sourceNote:last-of-type");
    if(note)note.before(box);else panel.appendChild(box);
  }

  function populateCvSelect(preferredId){
    const select=q("#caeCv");
    if(!select)return;
    const rows=cvRegistry();
    const current=preferredId||select.value;
    select.innerHTML='<option value="">No local CV selected</option>'+rows.map(function(row){
      const marker=row.storage==="indexeddb-local"?"stored":"metadata only";
      return '<option value="'+escapeHtml(row.id)+'">'+escapeHtml(row.name)+' · '+marker+'</option>';
    }).join("");
    if(current&&rows.some(function(row){return row.id===current}))select.value=current;
  }

  function updateTargets(){
    const wa=q("#caeWhatsApp"),email=q("#caeEmailAction"),call=q("#caeCallAction");
    const targets=channelTargets();
    const msg=currentMessage();
    if(wa){
      wa.href=targets.normalized
        ?"https://wa.me/"+targets.normalized+"?text="+encodeURIComponent(msg)
        :"#";
      wa.setAttribute("aria-disabled",targets.normalized?"false":"true");
    }
    if(email){
      email.href=targets.email && state.currentJob
        ?"mailto:"+encodeURIComponent(targets.email)+"?subject="+encodeURIComponent("Application — "+state.currentJob.title)+"&body="+encodeURIComponent(msg)
        :"#";
      email.setAttribute("aria-disabled",targets.email?"false":"true");
    }
    if(call){
      call.href=targets.normalized?"tel:+"+targets.normalized:"#";
      call.setAttribute("aria-disabled",targets.normalized?"false":"true");
    }
  }

  function latestJobEvent(){
    if(!state.currentJob)return null;
    return applicationLog().find(function(row){
      return row.personId===(state.profile&&state.profile.personId||null) && row.jobId===state.currentJob.id;
    })||null;
  }
  function renderStatus(){
    const el=q("#caeStatus");
    if(!el)return;
    const latest=latestJobEvent();
    if(!latest){
      el.innerHTML="<b>Prepared locally.</b> Opening a channel never counts as sent.";
      return;
    }
    const map={
      "prepared":"Draft prepared",
      "opened":"Channel opened",
      "cv-share-completed":"CV handed to share sheet",
      "cv-downloaded":"CV downloaded for manual attachment",
      "sent-confirmed":"Application confirmed sent"
    };
    el.innerHTML="<b>"+escapeHtml(map[latest.status]||latest.status)+".</b> "+escapeHtml(new Date(latest.at).toLocaleString())+" · local application log";
  }

  function setJob(job){
    if(!job)return;
    state.currentJob=job;
    const contact=jobContact(job);
    const draft=readContactDraft();
    const cc=q("#caeCountryCode"),phone=q("#caePhone"),email=q("#caeEmail");
    if(cc)cc.value=draft.countryPrefix||inferCountryPrefix();
    if(phone)phone.value=draft.phone||contact.whatsapp||contact.phone||"";
    if(email)email.value=draft.email||contact.email||"";
    populateCvSelect(draft.cvId||"");
    updateTargets();
    addLog("contact","prepared",{cvRecordId:q("#caeCv")?.value||null});
  }

  function confirmSent(job,extra){
    if(job&&(!state.currentJob||state.currentJob.id!==job.id))setJob(job);
    if(!state.currentJob)return null;
    return addLog(extra?.channel||"manual","sent-confirmed",Object.assign({
      userConfirmed:true,
      serverTransmissionPerformed:false
    },extra||{}));
  }

  function recordOpened(job,channel,extra){
    if(job&&(!state.currentJob||state.currentJob.id!==job.id))setJob(job);
    if(!state.currentJob)return null;
    return addLog(channel||"contact","opened",Object.assign({
      serverTransmissionPerformed:false,
      applicationSent:false
    },extra||{}));
  }

  async function shareCv(){
    const id=q("#caeCv")?.value||"";
    if(!id){
      toast("Choose a CV first. Add it in Data / File Loader if needed.");
      return;
    }
    let stored=null;
    try{stored=await getStoredFile(id)}catch(_){}
    if(!stored||!stored.blob){
      toast("This CV is metadata-only. Re-add it in Data / File Loader to enable Share CV.");
      return;
    }
    const file=new File([stored.blob],stored.name||"CV.pdf",{type:stored.type||"application/octet-stream",lastModified:stored.lastModified||Date.now()});
    const shareData={files:[file],title:"CV — "+(state.currentJob?.title||"job application"),text:"CV for "+(state.currentJob?.title||"job application")};
    try{
      if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
        await navigator.share(shareData);
        addLog("share-cv","cv-share-completed",{cvRecordId:id,fileName:file.name});
        toast("CV handed to the phone share sheet. This is not marked sent.");
        return;
      }
    }catch(err){
      if(err&&err.name==="AbortError"){toast("CV share cancelled");return}
    }
    const url=URL.createObjectURL(stored.blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=stored.name||"CV";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function(){URL.revokeObjectURL(url)},1500);
    addLog("share-cv","cv-downloaded",{cvRecordId:id,fileName:stored.name||null});
    toast("CV downloaded. Attach it manually in WhatsApp or email.");
  }

  function bindUi(){
    ["#caeCountryCode","#caePhone","#caeEmail"].forEach(function(sel){
      q(sel)?.addEventListener("input",function(){saveContactDraft();updateTargets()});
    });
    q("#caeCv")?.addEventListener("change",function(){saveContactDraft();renderStatus()});
    q("#applicationPreview")?.addEventListener("input",updateTargets);

    q("#caeWhatsApp")?.addEventListener("click",function(event){
      const targets=channelTargets();
      if(!targets.normalized){
        event.preventDefault();
        toast("Enter the employer WhatsApp number in international format.");
        return;
      }
      saveContactDraft();
      addLog("whatsapp","opened",{targetLast4:targets.normalized.slice(-4),cvRecordId:q("#caeCv")?.value||null});
      toast("WhatsApp opened — not marked sent.");
    });
    q("#caeEmailAction")?.addEventListener("click",function(event){
      const targets=channelTargets();
      if(!targets.email){
        event.preventDefault();
        toast("Enter a valid employer email address.");
        return;
      }
      saveContactDraft();
      addLog("email","opened",{targetDomain:targets.email.split("@")[1]||null,cvRecordId:q("#caeCv")?.value||null});
      toast("Email composer opened — not marked sent.");
    });
    q("#caeCallAction")?.addEventListener("click",function(event){
      const targets=channelTargets();
      if(!targets.normalized){
        event.preventDefault();
        toast("Enter a valid employer phone number.");
        return;
      }
      saveContactDraft();
      addLog("call","opened",{targetLast4:targets.normalized.slice(-4)});
      toast("Phone dialler opened.");
    });
    q("#caeShareCv")?.addEventListener("click",shareCv);
    q("#caeConfirmSent")?.addEventListener("click",function(){
      if(!state.currentJob){toast("Choose a job first");return}
      const targets=channelTargets();
      const latest=latestJobEvent();
      const channel=latest&&latest.channel||"manual";
      addLog(channel,"sent-confirmed",{
        targetLast4:targets.normalized?targets.normalized.slice(-4):null,
        targetDomain:targets.email?targets.email.split("@")[1]:null,
        cvRecordId:q("#caeCv")?.value||null,
        userConfirmed:true
      });
      toast("Application marked sent by you.");
    });

    document.addEventListener("click",function(event){
      const btn=event.target.closest?.("[data-application-job]");
      if(btn){
        window.setTimeout(function(){
          const profile=window.NEXUS_WORK_PROFILE||state.profile;
          const job=(profile?.jobMatches||[]).find(function(row){return row.id===btn.dataset.applicationJob});
          if(job)setJob(job);
        },0);
        return;
      }
      const agencyLink=event.target.closest?.(".agencyActions a");
      if(agencyLink){
        const row=agencyLink.closest(".agencyRow");
        const name=row?.querySelector("strong")?.textContent?.trim()||"Agency";
        const label=(agencyLink.textContent||"contact").trim().toLowerCase();
        const priorJob=state.currentJob;
        state.currentJob={id:"agency:"+name,title:"Agency outreach",employer:name};
        addLog(label,"opened",{agencyOutreach:true});
        state.currentJob=priorJob;
      }
    });

    window.addEventListener("storage",function(event){
      if(event.key===REGISTRY_KEY)populateCvSelect(readContactDraft().cvId||"");
    });
    window.addEventListener("focus",function(){populateCvSelect(readContactDraft().cvId||"")});
  }

  function attach(profile){
    if(state.ready)return;
    state.profile=profile||window.NEXUS_WORK_PROFILE||null;
    injectStyles();
    injectUi();
    populateCvSelect("");
    bindUi();
    state.ready=true;
    renderStatus();
    window.NEXUS_CONTACT_ACTION_ENGINE={
      schema:"nexus-contact-action-engine/v1",
      version:"freeware1",
      mode:"local-user-handoff",
      setJob:setJob,
      confirmSent:confirmSent,
      recordOpened:recordOpened,
      log:applicationLog,
      normalizePhone:normalizePhone
    };
  }

  window.addEventListener("nexus:work-profile-ready",function(event){
    attach(event.detail&&event.detail.profile||window.NEXUS_WORK_PROFILE);
  });

  let attempts=0;
  const timer=window.setInterval(function(){
    attempts++;
    if(window.NEXUS_WORK_PROFILE){
      window.clearInterval(timer);
      attach(window.NEXUS_WORK_PROFILE);
    }else if(attempts>80){
      window.clearInterval(timer);
      injectStyles();
      injectUi();
      populateCvSelect("");
      bindUi();
      state.ready=true;
    }
  },100);
})();
