(function(){
  "use strict";

  const overlay=document.getElementById("workOverlay");
  const close=document.getElementById("workClose");
  const title=document.getElementById("workTitle");
  const toastEl=document.getElementById("workToast");
  const titles={
    hub:"Work Hub",
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

  function showToast(message){
    if(!toastEl)return;
    toastEl.textContent=message;
    toastEl.classList.add("show");
    setTimeout(()=>toastEl.classList.remove("show"),2400);
  }

  function openWork(panel){
    document.querySelectorAll(".workPanel").forEach(el=>{
      el.classList.toggle("active",el.dataset.panel===panel);
    });
    if(title)title.textContent=titles[panel]||"AI Work Agent";
    overlay?.classList.add("open");
    overlay?.setAttribute("aria-hidden","false");
  }

  function closeWork(){
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden","true");
  }

  document.addEventListener("click",event=>{
    const trigger=event.target.closest?.("[data-work-action]");
    if(trigger){
      event.preventDefault();
      openWork(trigger.dataset.workAction);
      return;
    }
    const draft=event.target.closest?.("[data-demo-draft]");
    if(draft){
      event.preventDefault();
      showToast("Draft prepared for "+draft.dataset.demoDraft+". No external message was sent.");
    }
  });

  close?.addEventListener("click",closeWork);
  overlay?.addEventListener("click",event=>{
    if(event.target===overlay)closeWork();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape")closeWork();
  });

  async function shareWorkProfile(){
    const url=location.href;
    const data={
      title:"NOSMO Person Card — Work Profile",
      text:"NOSMO Person Card Work Profile",
      url
    };
    try{
      if(navigator.share){
        await navigator.share(data);
        return;
      }
      await navigator.clipboard?.writeText(url);
      showToast("Work Profile link copied");
    }catch(_){
      showToast("Share cancelled");
    }
  }

  document.getElementById("workShare")?.addEventListener("click",shareWorkProfile);
  document.addEventListener("click",event=>{
    if(event.target.closest?.("[data-work-share]")){
      event.preventDefault();
      shareWorkProfile();
    }
  });

  window.NEXUS_OPEN_WORK_PANEL=openWork;

  const previewPanel=new URLSearchParams(window.location.search).get("previewWork");
  if(previewPanel && Object.prototype.hasOwnProperty.call(titles,previewPanel)){
    window.setTimeout(()=>openWork(previewPanel),120);
  }

  if(!document.querySelector('script[data-nexus-contact-action-engine]')){
    const script=document.createElement("script");
    script.src="./js/contact-action-engine.js?v=freeware1";
    script.async=false;
    script.dataset.nexusContactActionEngine="true";
    document.head.appendChild(script);
  }
})();