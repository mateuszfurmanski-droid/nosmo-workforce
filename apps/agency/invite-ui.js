const $i=(selector,root=document)=>root.querySelector(selector);
const $$i=(selector,root=document)=>Array.from(root.querySelectorAll(selector));

async function inviteApi(path,options={}){
  const response=await fetch(path,{credentials:"include",...options,headers:{Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.error||`HTTP_${response.status}`);error.status=response.status;throw error}
  return payload;
}
function inviteToast(message){const el=$i("#toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(inviteToast.timer);inviteToast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
function inviteEsc(value){return String(value||"").replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]))}

function installInviteStyles(){
  const style=document.createElement("style");
  style.textContent=`.invite-result{margin-top:10px;border:1px solid var(--line-strong);border-radius:13px;padding:10px;background:var(--panel);word-break:break-all}.invite-result strong,.invite-result small{display:block}.invite-result small{margin-top:5px;color:var(--muted)}.invite-handoffs{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.invite-handoffs a,.invite-handoffs button{min-height:36px}.invite-warning{margin-top:10px;padding:9px;border:1px solid color-mix(in srgb,var(--silent-gold) 35%,var(--line));border-radius:12px;color:var(--muted);font-size:9px;line-height:1.45}`;
  document.head.appendChild(style);
}

function buildInviteModal(){
  const modal=document.createElement("div");
  modal.id="inviteWorkerModal";modal.className="modal-backdrop";modal.hidden=true;
  modal.innerHTML=`<section class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="inviteWorkerTitle">
    <div class="modal-head"><div><div class="eyebrow">Worker connection</div><h2 id="inviteWorkerTitle">Invite worker</h2></div><button class="close-button" type="button" data-invite-close>×</button></div>
    <p class="view-note">Create a signed Worker App onboarding link. An invite does not grant recruiter access. Recruiter-safe access begins only after the worker explicitly consents in Worker App.</p>
    <div class="form-grid">
      <label class="field wide"><span>Imported worker (optional)</span><select id="inviteRosterWorker"><option value="">Generic invite</option></select></label>
      <label class="field"><span>Suggested trade</span><input id="inviteTrade" maxlength="120" placeholder="Joiner"></label>
      <label class="field"><span>Suggested location</span><input id="inviteLocation" maxlength="120" placeholder="Leeds"></label>
      <label class="field wide"><span>Message</span><textarea id="inviteMessage" rows="3" maxlength="240" placeholder="Complete your NOSMO Work profile and choose what you want to share with our agency."></textarea></label>
      <label class="field"><span>Expires</span><select id="inviteExpiry"><option value="3">3 days</option><option value="7" selected>7 days</option><option value="14">14 days</option></select></label>
      <div class="form-actions wide"><button class="soft-button" type="button" data-invite-close>Cancel</button><button id="createInviteLink" class="primary-small" type="button">Create signed link</button></div>
    </div>
    <p id="inviteStatus" class="field-help"></p>
    <div id="inviteResult" class="invite-result" hidden><strong>Signed Worker App invite</strong><small id="inviteUrlText"></small><div class="invite-handoffs"><button id="copyInviteLink" class="soft-button" type="button">Copy</button><a id="openInviteLink" class="soft-button" target="_blank" rel="noopener">Open</a><a id="whatsappInviteLink" class="soft-button" target="_blank" rel="noopener">WhatsApp</a><a id="emailInviteLink" class="soft-button">Email</a></div></div>
    <div class="invite-warning">No CV, private documents, Vault data or personal contacts are exposed by creating this link. Imported roster data remains agency-owned and unconfirmed until the worker connects and consents.</div>
  </section>`;
  document.body.appendChild(modal);
  return modal;
}

let currentInviteUrl="";
async function loadInviteRoster(){
  const select=$i("#inviteRosterWorker");if(!select)return;
  try{
    const data=await inviteApi("/api/person-card/agency/v1/roster?limit=200");
    select.innerHTML='<option value="">Generic invite</option>'+((data.workers||[]).map((w)=>`<option value="${inviteEsc(w.rosterWorkerId)}" data-trade="${inviteEsc(w.trade)}" data-location="${inviteEsc(w.location)}">${inviteEsc(w.displayName)} — ${inviteEsc(w.trade||"trade not set")}</option>`).join(""));
  }catch{select.innerHTML='<option value="">Generic invite</option>'}
}
function openInvite(){const modal=$i("#inviteWorkerModal");modal.hidden=false;document.body.style.overflow="hidden";$i("#inviteStatus").textContent="";$i("#inviteResult").hidden=true;currentInviteUrl="";loadInviteRoster()}
function closeInvite(){const modal=$i("#inviteWorkerModal");modal.hidden=true;document.body.style.overflow=""}

function addInviteButtons(){
  const workerHead=$i("#view-workers .page-head");
  if(workerHead&&!$i("#inviteWorkerButton")){
    const btn=document.createElement("button");btn.id="inviteWorkerButton";btn.className="soft-button";btn.type="button";btn.textContent="Invite";btn.addEventListener("click",openInvite);
    const actions=workerHead.lastElementChild?.tagName==="DIV"?workerHead.lastElementChild:null;(actions||workerHead).appendChild(btn);
  }
  const quick=$i("#view-dashboard .quick-grid");
  if(quick&&!$i("#quickInviteWorker")){
    const btn=document.createElement("button");btn.id="quickInviteWorker";btn.type="button";btn.innerHTML='<span class="quick-icon">↗</span><strong>Invite worker</strong><small>Signed Worker App link · consent required</small>';btn.addEventListener("click",openInvite);quick.appendChild(btn);
  }
}

function initInviteUi(){
  installInviteStyles();const modal=buildInviteModal();addInviteButtons();
  $i("#inviteRosterWorker").addEventListener("change",(event)=>{const option=event.target.selectedOptions[0];if(!option)return;if(option.dataset.trade)$i("#inviteTrade").value=option.dataset.trade;if(option.dataset.location)$i("#inviteLocation").value=option.dataset.location});
  $$i("[data-invite-close]",modal).forEach((btn)=>btn.addEventListener("click",closeInvite));modal.addEventListener("click",(event)=>{if(event.target===modal)closeInvite()});
  $i("#createInviteLink").addEventListener("click",async()=>{
    const button=$i("#createInviteLink");button.disabled=true;$i("#inviteStatus").textContent="Creating signed invite…";
    try{
      const result=await inviteApi("/api/person-card/agency/v1/invites",{method:"POST",body:JSON.stringify({rosterWorkerId:$i("#inviteRosterWorker").value||undefined,trade:$i("#inviteTrade").value.trim(),location:$i("#inviteLocation").value.trim(),message:$i("#inviteMessage").value.trim(),expiresInDays:Number($i("#inviteExpiry").value)})});
      currentInviteUrl=result.onboardingUrl||"";$i("#inviteUrlText").textContent=currentInviteUrl;$i("#inviteResult").hidden=!currentInviteUrl;$i("#inviteStatus").textContent="Invite saved. Worker consent has not been granted yet.";
      $i("#openInviteLink").href=currentInviteUrl;
      const share=`NOSMO Work invite: ${currentInviteUrl}`;$i("#whatsappInviteLink").href=`https://wa.me/?text=${encodeURIComponent(share)}`;$i("#emailInviteLink").href=`mailto:?subject=${encodeURIComponent("NOSMO Work invite")}&body=${encodeURIComponent(share)}`;
      inviteToast("Signed invite created");
    }catch(error){$i("#inviteStatus").textContent=error.message==="WORK_APP_BASE_URL_REQUIRED"?"Worker App invite URL is not configured yet. No fake link was created.":`Invite failed: ${error.message}`}
    finally{button.disabled=false}
  });
  $i("#copyInviteLink").addEventListener("click",async()=>{if(!currentInviteUrl)return;try{await navigator.clipboard.writeText(currentInviteUrl);inviteToast("Invite link copied")}catch{inviteToast("Clipboard unavailable")}});
}

initInviteUi();
