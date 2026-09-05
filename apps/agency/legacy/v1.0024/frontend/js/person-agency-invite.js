(function(){
  "use strict";
  const q=s=>document.querySelector(s);
  const apiBase=(document.querySelector('meta[name="nexus-onboarding-api-base"]')?.content||"").trim().replace(/\/$/,"");
  const agencyAccountEndpoint="/api/person-card/agency/account";
  let currentUrl="";

  function value(id,max){return String(q("#"+id)?.value||"").replace(/\s+/g," ").trim().slice(0,max)}
  function updateActions(url,mode){
    currentUrl=url||"";
    q("#inviteUrl").textContent=currentUrl||"—";
    q("#resultMode").textContent=mode||"NO INVITE CREATED";
    q("#openInvite").href=currentUrl||"#";
    const msg="Please create or update your NOSMO Person Card: "+currentUrl;
    q("#waInvite").href=currentUrl?"https://wa.me/?text="+encodeURIComponent(msg):"#";
    q("#emailInvite").href=currentUrl?"mailto:?subject="+encodeURIComponent("NOSMO Person Card invite")+"&body="+encodeURIComponent(msg):"#";
  }
  function demoLink(){
    const agency=value("agency",120);
    if(!agency){q("#inviteState").textContent="Agency/company is required.";return}
    const url=new URL("person-card-onboarding.html",window.location.href);
    url.searchParams.set("inviteId","demo-"+Date.now().toString(36));
    url.searchParams.set("agency",agency);
    const trade=value("trade",120),location=value("location",120),message=value("message",240);
    if(trade)url.searchParams.set("trade",trade);
    if(location)url.searchParams.set("location",location);
    if(message)url.searchParams.set("message",message);
    url.searchParams.set("mode","demo-unsigned");
    updateActions(url.toString(),"DEMO · UNSIGNED");
    q("#inviteState").textContent="Demo link created locally. It is not a signed invite and cannot authorize AI Prefill or protected data access.";
  }
  async function secureInvite(){
    const agency=value("agency",120);
    if(!agency){q("#inviteState").textContent="Authenticated Agency Account is required.";return}
    if(!apiBase){
      q("#inviteState").textContent="Secure Nexus invite endpoint is not configured on this preview. No fake secure token was generated.";
      return;
    }
    q("#inviteState").textContent="Creating signed invite…";
    try{
      const res=await fetch(apiBase+"/invites",{
        method:"POST",
        headers:{"content-type":"application/json"},
        credentials:"include",
        body:JSON.stringify({agency,trade:value("trade",120),location:value("location",120),message:value("message",240),expiresInDays:7})
      });
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(payload.error||("HTTP "+res.status));
      if(!payload.onboardingUrl)throw new Error("NEXUS_ONBOARDING_INVITE_INVALID_RESPONSE");
      updateActions(payload.onboardingUrl,"SECURE · SIGNED");
      q("#inviteState").textContent="Signed invite created. Expires "+(payload.expiresAt||"per server policy")+".";
    }catch(error){
      q("#inviteState").textContent="Secure invite failed: "+(error&&error.message?error.message:"request failed");
    }
  }
  async function loadAgencyAccount(){
    try{
      const res=await fetch(agencyAccountEndpoint,{credentials:"include",cache:"no-store"});
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw Object.assign(new Error(payload.error||("HTTP "+res.status)),{status:res.status});
      const agency=payload.agency?.name||"";
      if(agency){
        q("#agency").value=agency;
        q("#agency").readOnly=true;
        let identity="Secure invites will be issued as "+agency+".";
        try{
          const profileRes=await fetch("/api/person-card/agency/profile",{credentials:"include",cache:"no-store"});
          const profilePayload=await profileRes.json().catch(()=>({}));
          if(profileRes.ok&&profilePayload.recruiter){
            const recruiter=profilePayload.recruiter;
            identity="Secure invites will be issued by "+(recruiter.displayName||"Recruiter")+
              (recruiter.jobTitle?" · "+recruiter.jobTitle:"")+" for "+agency+".";
          }
        }catch(_){}
        q("#inviteState").textContent=identity;
      }
    }catch(error){
      if(error.status===401){
        q("#inviteState").textContent="Sign in to NOSMO before creating a secure Agency Invite.";
      }else if(error.status===404||error.status===403){
        q("#inviteState").textContent="Create an Agency Account in Agency Desk before creating a secure invite.";
      }else{
        q("#inviteState").textContent="Agency Account could not be verified. Demo unsigned links remain local-only.";
      }
    }
  }

  q("#secureInvite")?.addEventListener("click",secureInvite);
  q("#demoInvite")?.addEventListener("click",demoLink);
  q("#copyInvite")?.addEventListener("click",async()=>{
    if(!currentUrl){q("#inviteState").textContent="Create an invite first.";return}
    try{await navigator.clipboard.writeText(currentUrl);q("#inviteState").textContent="Invite link copied."}catch(_){q("#inviteState").textContent="Copy unavailable on this browser."}
  });
  ["waInvite","emailInvite","openInvite"].forEach(id=>q("#"+id)?.addEventListener("click",e=>{if(!currentUrl)e.preventDefault()}));
  loadAgencyAccount();
})();
