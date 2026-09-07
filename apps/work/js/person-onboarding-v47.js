(function(){
  "use strict";
  const current=document.currentScript;
  const meta=document.querySelector('meta[name="nexus-onboarding-api-base"]');
  function trustedBase(value){
    if(typeof value!=="string"||!value.trim())return "";
    try{
      const url=new URL(value.trim());
      const local=(url.protocol==="http:"&&(url.hostname==="localhost"||url.hostname==="127.0.0.1"));
      if(url.protocol!=="https:"&&!local)return "";
      return url.toString().replace(/\/$/,"");
    }catch{return ""}
  }
  function loadCore(){
    const script=document.createElement("script");
    script.src="./js/person-onboarding-v47-core.js?v=10102";
    script.async=false;
    if(current&&current.parentNode)current.parentNode.insertBefore(script,current.nextSibling);
    else document.head.appendChild(script);
  }
  fetch("./runtime-config.json",{cache:"no-store"})
    .then(response=>response.ok?response.json():null)
    .then(config=>{
      const base=trustedBase(config&&config.onboardingApiBase);
      if(base&&meta)meta.content=base;
    })
    .catch(()=>{})
    .finally(loadCore);
})();
