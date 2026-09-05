const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));

function toast(message){
  const el=$("#toast");if(!el)return;
  el.textContent=message;el.classList.add("show");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2800);
}

async function callApi(path,options={}){
  const response=await fetch(path,{credentials:"include",...options,headers:{Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.error||payload.message||`HTTP_${response.status}`);error.status=response.status;throw error}
  return payload;
}

function splitList(value){return String(value||"").split(/[;,|]/).map((v)=>v.trim()).filter(Boolean)}
function key(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"")}

function parseDelimited(text,delimiter){
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++}
      else if(ch==='"')quoted=false;
      else field+=ch;
    }else if(ch==='"')quoted=true;
    else if(ch===delimiter){row.push(field);field=""}
    else if(ch==='\n'){row.push(field);rows.push(row);row=[];field=""}
    else if(ch!=='\r')field+=ch;
  }
  row.push(field);if(row.some((v)=>String(v).trim()))rows.push(row);
  return rows;
}

function mapRows(matrix){
  if(matrix.length<2)return [];
  const headers=matrix[0].map(key);
  const find=(aliases)=>{for(const alias of aliases){const i=headers.indexOf(key(alias));if(i>=0)return i}return -1};
  const indexes={
    displayName:find(["display name","name","worker","candidate","full name"]),
    email:find(["email","email address"]),phone:find(["phone","mobile","telephone"]),
    trade:find(["trade","role","job title","primary trade"]),location:find(["location","base","city"]),
    availabilityStatus:find(["availability","availability status","status"]),availableFrom:find(["available from","ready from","availability date"]),
    skills:find(["skills","skill"]),licences:find(["licences","licenses","tickets","certificates","cards"]),
    expectedRate:find(["expected rate","rate","pay rate"]),privateNote:find(["private note","note","notes"])
  };
  return matrix.slice(1).map((row)=>{
    const get=(name)=>indexes[name]>=0?String(row[indexes[name]]||"").trim():"";
    return {displayName:get("displayName"),email:get("email"),phone:get("phone"),trade:get("trade"),location:get("location"),availabilityStatus:get("availabilityStatus"),availableFrom:get("availableFrom"),skills:splitList(get("skills")),licences:splitList(get("licences")),expectedRate:get("expectedRate"),privateNote:get("privateNote")};
  }).filter((r)=>r.displayName);
}

async function parseRosterFile(file){
  const name=file.name.toLowerCase(),text=await file.text();
  if(name.endsWith(".json")){
    const parsed=JSON.parse(text);const rows=Array.isArray(parsed)?parsed:Array.isArray(parsed.records)?parsed.records:[];
    return rows.map((r)=>({...r,displayName:r.displayName||r.name,skills:Array.isArray(r.skills)?r.skills:splitList(r.skills),licences:Array.isArray(r.licences)?r.licences:Array.isArray(r.licenses)?r.licenses:splitList(r.licences||r.licenses)})).filter((r)=>r.displayName);
  }
  const first=text.split(/\r?\n/,1)[0]||"";const delimiter=name.endsWith(".tsv")?"\t":((first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?";":",");
  return mapRows(parseDelimited(text,delimiter));
}

function injectStyles(){
  const style=document.createElement("style");
  style.textContent=`
    .import-drop{border:1px dashed var(--line-strong);border-radius:14px;padding:18px;text-align:center;background:var(--panel);cursor:pointer}.import-drop strong,.import-drop small{display:block}.import-drop small{margin-top:5px;color:var(--muted);font-size:9px}.import-preview{margin-top:10px;max-height:42vh;overflow:auto;border:1px solid var(--line);border-radius:12px}.import-row{display:grid;grid-template-columns:minmax(120px,1.2fr) 1fr 1fr;gap:8px;padding:8px 9px;border-bottom:1px solid var(--line);font-size:8px}.import-row:last-child{border-bottom:0}.import-row strong{font-size:9px}.import-row span{color:var(--muted)}.import-toolbar{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}.match-generate{border-color:color-mix(in srgb,var(--silent-gold) 45%,var(--line))!important;color:var(--silent-gold)!important}@media(max-width:420px){.import-row{grid-template-columns:1fr}.import-row span{white-space:normal}}
  `;
  document.head.appendChild(style);
}

function buildImportModal(){
  const modal=document.createElement("div");modal.id="importModal";modal.className="modal-backdrop";modal.hidden=true;
  modal.innerHTML=`<section class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="importModalTitle">
    <div class="modal-head"><div><div class="eyebrow">Agency-owned roster</div><h2 id="importModalTitle">Import workers</h2></div><button class="close-button" type="button" data-import-close>×</button></div>
    <p class="view-note">Import CSV, TSV or JSON. Nothing is marked Worker App confirmed. Review the parsed rows before writing them to this agency only.</p>
    <div id="importDrop" class="import-drop"><strong>Choose roster file</strong><small>CSV · TSV · JSON · up to 500 workers per batch</small></div>
    <input id="importFile" type="file" accept=".csv,.tsv,.json,text/csv,text/tab-separated-values,application/json" hidden>
    <div id="importStatus" class="field-help" style="margin-top:8px">No file selected.</div>
    <div id="importPreview" class="import-preview" hidden></div>
    <div class="import-toolbar"><button class="soft-button" type="button" data-import-close>Cancel</button><button id="confirmImport" class="primary-small" type="button" disabled>Import reviewed rows</button></div>
  </section>`;
  document.body.appendChild(modal);return modal;
}

let parsedRecords=[];
function renderImportPreview(records){
  const preview=$("#importPreview"),status=$("#importStatus"),confirm=$("#confirmImport");
  parsedRecords=records.slice(0,500);preview.hidden=false;confirm.disabled=!parsedRecords.length;
  status.textContent=parsedRecords.length?`${parsedRecords.length} valid row${parsedRecords.length===1?"":"s"} ready for review.`:"No valid rows found. A worker name column is required.";
  preview.innerHTML=parsedRecords.length?parsedRecords.slice(0,100).map((r)=>`<div class="import-row"><strong>${escapeText(r.displayName)}</strong><span>${escapeText(r.trade||"Trade not set")}</span><span>${escapeText([r.location,r.availabilityStatus].filter(Boolean).join(" · ")||"No location/status")}</span></div>`).join(""):"";
}
function escapeText(value){return String(value||"").replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]))}

function openImport(){const modal=$("#importModal");modal.hidden=false;document.body.style.overflow="hidden"}
function closeImport(){const modal=$("#importModal");modal.hidden=true;document.body.style.overflow=""}

function installImport(){
  const modal=buildImportModal(),fileInput=$("#importFile"),drop=$("#importDrop");
  const workerHead=$("#view-workers .page-head");
  if(workerHead){
    const actions=document.createElement("div");actions.style.display="flex";actions.style.gap="7px";
    const importButton=document.createElement("button");importButton.className="primary-small";importButton.type="button";importButton.textContent="Import";importButton.addEventListener("click",openImport);
    const refresh=$("#refreshWorkers");if(refresh){refresh.parentNode.insertBefore(actions,refresh);actions.append(importButton,refresh)}else{actions.append(importButton);workerHead.appendChild(actions)}
  }
  const quick=$("#view-dashboard .quick-grid");if(quick){const button=document.createElement("button");button.type="button";button.innerHTML='<span class="quick-icon">⇧</span><strong>Import roster</strong><small>Review CSV/TSV/JSON before agency-only write</small>';button.addEventListener("click",openImport);quick.appendChild(button)}
  drop.addEventListener("click",()=>fileInput.click());drop.addEventListener("dragover",(e)=>e.preventDefault());drop.addEventListener("drop",async(e)=>{e.preventDefault();const file=e.dataTransfer.files?.[0];if(file)await handleFile(file)});
  fileInput.addEventListener("change",async()=>{const file=fileInput.files?.[0];if(file)await handleFile(file)});
  async function handleFile(file){
    $("#importStatus").textContent=`Reading ${file.name}…`;try{renderImportPreview(await parseRosterFile(file))}catch(error){parsedRecords=[];$("#importPreview").hidden=true;$("#confirmImport").disabled=true;$("#importStatus").textContent=`Could not parse file: ${error.message}`}
  }
  $$('[data-import-close]',modal).forEach((button)=>button.addEventListener("click",closeImport));modal.addEventListener("click",(e)=>{if(e.target===modal)closeImport()});
  $("#confirmImport").addEventListener("click",async()=>{
    const button=$("#confirmImport");button.disabled=true;$("#importStatus").textContent="Importing reviewed rows…";
    try{const result=await callApi("/api/person-card/agency/v1/roster/import",{method:"POST",body:JSON.stringify({source:"AGENCY_FILE_IMPORT",records:parsedRecords})});$("#importStatus").textContent=`Created ${result.created||0}, updated ${result.updated||0}, skipped ${result.skipped||0}.`;toast("Agency roster import saved");setTimeout(()=>{closeImport();$("#refreshWorkers")?.click()},500)}catch(error){$("#importStatus").textContent=`Import failed: ${error.message}`;button.disabled=false}
  });
}

function decorateMatchButtons(){
  $$("#requestsList .request-card").forEach((card)=>{
    if(card.dataset.matchEnhanced)return;card.dataset.matchEnhanced="1";
    const review=$("[data-request-matches]",card),actions=$(".request-actions",card);if(!review||!actions)return;
    const requestId=review.dataset.requestMatches;
    const button=document.createElement("button");button.type="button";button.className="match-generate";button.textContent="Generate matches";
    button.addEventListener("click",async()=>{
      button.disabled=true;button.textContent="Matching…";
      try{const result=await callApi(`/api/person-card/agency/v1/requests/${encodeURIComponent(requestId)}/match`,{method:"POST",body:JSON.stringify({})});toast(`${result.candidateCount||0} candidates evaluated`);$("[data-nav='matches']")?.click();const select=$("#matchRequestSelect");if(select){select.value=requestId;select.dispatchEvent(new Event("change"))}}catch(error){toast(`Match failed: ${error.message}`)}finally{button.disabled=false;button.textContent="Generate matches"}
    });
    actions.insertBefore(button,actions.firstChild);
  });
}

function installMatchGeneration(){
  const host=$("#requestsList");if(!host)return;decorateMatchButtons();new MutationObserver(decorateMatchButtons).observe(host,{childList:true,subtree:true});
}

injectStyles();
installImport();
installMatchGeneration();
