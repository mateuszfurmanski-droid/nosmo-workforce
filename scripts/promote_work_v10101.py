from __future__ import annotations

from pathlib import Path
import json
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "apps" / "work"
SOURCE = WORK / "recovery-source"

if not SOURCE.exists():
    raise SystemExit("Missing apps/work/recovery-source")

# Copy the preserved donor to the canonical app root without touching the locked donor.
with tempfile.TemporaryDirectory() as td:
    staged = Path(td) / "work"
    shutil.copytree(SOURCE, staged)
    for child in staged.iterdir():
        if child.name in {"README.md", "RECOVERY_SOURCE.md", ".e2e-trigger"}:
            continue
        target = WORK / child.name
        if child.is_dir():
            shutil.copytree(child, target, dirs_exist_ok=True)
        else:
            shutil.copy2(child, target)

# Never promote old Agency surfaces into NOSMO Work.
for rel in [
    "agency-desk.html",
    "agency-invite.html",
    "js/agency-desk.js",
    "js/person-agency-invite.js",
]:
    p = WORK / rel
    if p.exists():
        p.unlink()

# Old person-specific donor data must remain only in recovery-source, never canonical.
for rel in ["assets/KamilKaraszewski.jpeg", "data/person-work-profile-kamil.json"]:
    p = WORK / rel
    if p.exists():
        p.unlink()

DEFAULT_PROFILE = {
    "schema": "nexus-person-work-profile/v1",
    "id": "work-profile-local-worker",
    "personId": "local-worker",
    "version": "V1.0101",
    "demoMode": False,
    "availability": {"status": "available", "label": "Available", "availableFrom": ""},
    "preferences": {
        "primaryTrade": "",
        "targetRoles": [],
        "locations": [],
        "employmentTypes": [],
        "paymentPreferences": [],
        "rate": {"amount": None, "currency": "GBP", "unit": "hour", "display": "Not set"},
    },
    "readiness": {
        "cv": {"state": "pending", "source": "local"},
        "certificates": {"state": "pending", "source": "local"},
        "references": {"state": "pending", "source": "local"},
        "vault": {"state": "local", "source": "local"},
    },
    "sourceConnectors": [],
    "jobMatches": [],
    "agencies": [],
    "jobGateway": {
        "schema": "nexus-job-gateway-client/v1",
        "status": "standalone-api",
        "endpoint": "/api/person-card/jobs/search",
        "provider": "Adzuna",
        "connectorId": "adzuna-jobs",
        "queryDefaults": {"country": "gb", "results": 20},
        "productionTarget": "/api/person-card/jobs/search",
        "note": "Provider credentials remain server-side."
    },
}
(WORK / "data").mkdir(exist_ok=True)
(WORK / "data" / "default-worker-profile.json").write_text(json.dumps(DEFAULT_PROFILE, indent=2) + "\n", encoding="utf-8")

NAV = '''<nav class="appWindowNav" aria-label="NOSMO Work main navigation">
  <a href="./index.html" data-screen="person">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7"/></svg><span>Worker Card</span>
  </a>
  <a href="./screen.html?screen=documents" data-screen="documents">
    <svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h6"/></svg><span>Documents</span>
  </a>
  <a href="./screen.html?screen=work" data-screen="work">
    <svg viewBox="0 0 24 24"><path d="M9 6V4h6v2M4 8h16v11H4zM4 12h16"/></svg><span>Jobs</span>
  </a>
  <a href="./screen.html?screen=apps" data-screen="apps">
    <svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg><span>Apps</span>
  </a>
  <a href="./screen.html?screen=settings" data-screen="settings">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6a7 7 0 0 0-1.7 1L5 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.3-1a7 7 0 0 0 1.7 1l.5 3h5l.5-3a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1z"/></svg><span>Settings</span>
  </a>
</nav>'''

ASK = '''<button class="nexusAskBar" type="button" data-nosmo-ask-nexus>
  <span class="nexusAskMark">N</span>
  <span class="nexusAskCopy"><strong>Ask Nexus</strong><small>Work, documents, jobs and next actions</small></span>
  <span class="nexusAskArrow">›</span>
</button>'''

APPS_SECTION = '''
<section id="appsScreen" hidden>
  <section class="hero canonicalHero">
    <div class="eyebrow">NOSMO WORK | Powered by NEXUS</div>
    <h1>Apps</h1>
    <p>Work tools first. Connected services stay folded until you need them.</p>
  </section>
  <section class="canonicalSection">
    <div class="canonicalSectionTitle">WORK TOOLS</div>
    <div class="workAppsGrid">
      <a class="workToolCard" href="./screen.html?screen=work-mode#drawings"><strong>Drawings</strong><span>Open drawings and project files</span></a>
      <a class="workToolCard" href="./data-fetcher/"><strong>Nexus Upload</strong><span>Add work files to your local inbox</span></a>
      <button class="workToolCard" type="button" id="workCameraButton"><strong>Work Camera</strong><span>Capture evidence from this device</span></button>
      <a class="workToolCard" href="./data-fetcher/"><strong>Private Vault</strong><span>Your local documents and CV files</span></a>
    </div>
    <input id="workCameraInput" type="file" accept="image/*" capture="environment" hidden>
  </section>
  <details class="connectedAppsPanel">
    <summary><span><strong>CONNECTED APPS</strong><small>Secondary services and integrations</small></span><b>4</b></summary>
    <div class="connectedAppsBody">
      <a href="./screen.html?screen=work-mode">Work Mode</a>
      <a href="./data-fetcher/">Import files</a>
      <a href="./data-fetcher/">Manage local documents</a>
      <button type="button" data-nosmo-ask-nexus>Ask Nexus</button>
    </div>
  </details>
  <button class="manageImportsBtn" type="button" onclick="location.href='./data-fetcher/'">Manage apps &amp; imports</button>
  <p class="canonicalPrivacy">Private launcher. You choose what NOSMO imports.</p>
</section>
'''

SETTINGS_SECTION = '''
<section id="settingsScreen" hidden>
  <section class="hero canonicalHero">
    <div class="eyebrow">NOSMO WORK</div>
    <h1>Settings</h1>
    <p>Keep NOSMO Work simple, local and private.</p>
  </section>
  <section class="canonicalSection">
    <div class="canonicalSectionTitle">APPEARANCE</div>
    <div class="appearanceGrid" id="appearanceGrid">
      <button type="button" data-appearance="midnight-black"><i></i><span>Midnight Black</span></button>
      <button type="button" data-appearance="nexus-blue"><i></i><span>Nexus Blue</span></button>
      <button type="button" data-appearance="eco-green"><i></i><span>Eco Green</span></button>
      <button type="button" data-appearance="silent-gold"><i></i><span>Silent Gold</span></button>
      <button type="button" data-appearance="windows-grey"><i></i><span>Windows Grey</span></button>
      <button type="button" data-appearance="architect-white"><i></i><span>Architect White</span></button>
    </div>
  </section>
  <section class="canonicalSection settingsRows">
    <label><span><strong>Reply alerts</strong><small>Show reminders for replies and follow-ups</small></span><input id="replyAlertsSetting" type="checkbox"></label>
    <label><span><strong>Show WhatsApp contacts</strong><small>Display WhatsApp contact actions when available</small></span><input id="whatsappContactsSetting" type="checkbox"></label>
    <button class="settingsAction" id="settingsLanguageButton" type="button"><span><strong>Language</strong><small>Change NOSMO Work language</small></span><b>›</b></button>
    <button class="settingsAction" id="settingsWorkModeButton" type="button"><span><strong>Work Mode</strong><small>Open site tools and local work apps</small></span><b>›</b></button>
  </section>
</section>
'''

CANONICAL_CSS = r'''
/* NOSMO Work V1.0101 canonical shell reconstructed from the locked 2026-09-04 baseline. */
:root{--work-accent:var(--nosmo-nexus-blue,#2f86ff)}
.appWindowNav{grid-template-columns:repeat(5,minmax(0,1fr))!important;height:82px!important}
.appWindowNav a{font-size:9px!important;font-weight:690!important;min-height:58px!important;padding:5px 2px!important}
.appWindowNav a svg{width:22px!important;height:22px!important}
.nexusAskBar{width:100%;min-height:54px;margin:0 0 12px;border:1px solid rgba(47,134,255,.26);border-radius:16px;background:linear-gradient(180deg,rgba(10,27,48,.94),rgba(5,16,29,.96));color:#f6f8fc;display:grid;grid-template-columns:36px minmax(0,1fr) 22px;gap:10px;align-items:center;padding:8px 11px;text-align:left;box-shadow:0 8px 24px rgba(0,0,0,.16);cursor:pointer}
.nexusAskMark{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(47,134,255,.13);border:1px solid rgba(47,134,255,.35);color:#74b3ff;font-weight:850;font-size:18px}
.nexusAskCopy strong{display:block;font-size:13px;font-weight:720}.nexusAskCopy small{display:block;margin-top:2px;color:#93a6bc;font-size:9px;line-height:1.25}.nexusAskArrow{font-size:24px;color:#73adf7}
.canonicalHero{margin-bottom:10px}.canonicalSection{margin-top:10px;border:1px solid rgba(108,160,228,.2);border-radius:18px;background:rgba(4,15,28,.78);padding:12px;box-shadow:0 10px 28px rgba(0,0,0,.16)}
.canonicalSectionTitle{color:#8fc0ff;font-size:10px;font-weight:760;letter-spacing:.1em;margin-bottom:9px}
.workAppsGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.workToolCard{min-height:94px;border:1px solid rgba(108,160,228,.2);border-radius:15px;background:rgba(7,20,36,.78);color:#fff;text-decoration:none;padding:12px;text-align:left;display:flex;flex-direction:column;justify-content:center;cursor:pointer}.workToolCard strong{font-size:13px;font-weight:690}.workToolCard span{margin-top:5px;color:#92a4ba;font-size:9px;line-height:1.35}.connectedAppsPanel{margin-top:10px;border:1px solid rgba(108,160,228,.18);border-radius:16px;background:rgba(4,15,28,.64);overflow:hidden}.connectedAppsPanel summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px}.connectedAppsPanel summary::-webkit-details-marker{display:none}.connectedAppsPanel summary strong{display:block;font-size:10px;color:#b8c7d9;letter-spacing:.08em}.connectedAppsPanel summary small{display:block;margin-top:3px;color:#7f92aa;font-size:8px}.connectedAppsPanel summary b{min-width:28px;height:28px;border-radius:10px;background:rgba(47,134,255,.12);display:grid;place-items:center;color:#8fc0ff}.connectedAppsBody{display:grid;gap:7px;padding:0 12px 12px}.connectedAppsBody a,.connectedAppsBody button,.manageImportsBtn{min-height:44px;border:1px solid rgba(108,160,228,.2);border-radius:11px;background:#08182d;color:#eaf1fb;text-decoration:none;display:flex;align-items:center;padding:9px 11px;font-size:10px;font-weight:650;cursor:pointer}.manageImportsBtn{width:100%;margin-top:10px;justify-content:center}.canonicalPrivacy{color:#8598ae;font-size:9px;line-height:1.4;margin:8px 2px 0}
.appearanceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.appearanceGrid button{min-height:48px;border:1px solid rgba(108,160,228,.18);border-radius:12px;background:rgba(7,20,36,.72);color:#eef4fb;display:flex;gap:9px;align-items:center;padding:8px 10px;text-align:left;cursor:pointer}.appearanceGrid button[aria-pressed="true"]{border-color:var(--work-accent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--work-accent) 35%,transparent)}.appearanceGrid i{width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,.2);flex:0 0 18px}.appearanceGrid [data-appearance="midnight-black"] i{background:#020713}.appearanceGrid [data-appearance="nexus-blue"] i{background:#2f86ff}.appearanceGrid [data-appearance="eco-green"] i{background:#22dc7d}.appearanceGrid [data-appearance="silent-gold"] i{background:#d6b35f}.appearanceGrid [data-appearance="windows-grey"] i{background:#8e99a8}.appearanceGrid [data-appearance="architect-white"] i{background:#f5f7fb}.appearanceGrid span{font-size:10px;font-weight:650}
.settingsRows{display:grid;gap:8px}.settingsRows label,.settingsAction{min-height:54px;border:1px solid rgba(108,160,228,.18);border-radius:12px;background:rgba(7,20,36,.68);color:#eef4fb;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px}.settingsRows label span,.settingsAction span{text-align:left}.settingsRows strong,.settingsAction strong{display:block;font-size:11px;font-weight:690}.settingsRows small,.settingsAction small{display:block;margin-top:3px;color:#8498af;font-size:8.5px;line-height:1.3}.settingsRows input{width:20px;height:20px}.settingsAction{width:100%;cursor:pointer}.settingsAction b{font-size:20px;color:#78b0ff}
.canonicalProfileActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.canonicalProfileActions button{min-height:42px;border:1px solid rgba(108,160,228,.22);border-radius:12px;background:#08182d;color:#eef4fb;font-size:10px;font-weight:690;cursor:pointer}
.comms{display:none!important}.photo{background-image:none!important;background:radial-gradient(circle at 50% 38%,rgba(47,134,255,.2),rgba(2,7,19,.94))!important;position:relative}.photo:after{content:'WORK';position:absolute;inset:0;display:grid;place-items:center;color:#7eb6ff;font-size:15px;font-weight:800;letter-spacing:.12em}
html[data-work-appearance="nexus-blue"]{--work-accent:#2f86ff}html[data-work-appearance="eco-green"]{--work-accent:#22dc7d}html[data-work-appearance="silent-gold"]{--work-accent:#d6b35f}html[data-work-appearance="windows-grey"]{--work-accent:#8e99a8}html[data-work-appearance="architect-white"]{--work-accent:#6b7787}
html[data-work-appearance="eco-green"] .appWindowNav a.active,html[data-work-appearance="eco-green"] .nexusAskMark{border-color:rgba(34,220,125,.55)!important;color:#64eaa2!important}html[data-work-appearance="silent-gold"] .appWindowNav a.active,html[data-work-appearance="silent-gold"] .nexusAskMark{border-color:rgba(214,179,95,.58)!important;color:#e1c77d!important}
@media(max-width:380px){.appWindowNav a{font-size:7.8px!important}.appWindowNav{gap:3px!important;padding-left:4px!important;padding-right:4px!important}.workAppsGrid,.appearanceGrid{grid-template-columns:1fr 1fr}.nexusAskCopy small{font-size:8px}}
'''

SHELL_JS = r'''
(function(){
  "use strict";
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const APPEARANCE_KEY="nosmo-work:v1:appearance";
  const REPLY_KEY="nosmo-work:v1:reply-alerts";
  const WA_KEY="nosmo-work:v1:show-whatsapp";
  function getBool(key, fallback){const v=localStorage.getItem(key);return v===null?fallback:v==="true"}
  function setAppearance(value){
    const appearance=value||"midnight-black";
    document.documentElement.dataset.workAppearance=appearance;
    localStorage.setItem(APPEARANCE_KEY,appearance);
    const light=appearance==="architect-white"||appearance==="windows-grey";
    document.documentElement.dataset.workTheme=light?"light":"dark";
    localStorage.setItem("nosmo-work:v1:theme",light?"light":"dark");
    qa("[data-appearance]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.appearance===appearance)));
  }
  function askNexus(){
    if(typeof window.NEXUS_OPEN_WORK_PANEL==="function"){window.NEXUS_OPEN_WORK_PANEL("ai");return}
    if(!location.pathname.endsWith("index.html")&&!location.pathname.endsWith("/")){location.href="./index.html#ask-nexus";return}
    location.hash="ask-nexus";
  }
  function hydrateWorker(profile){
    const first=q(".first"), last=q(".last"), role=q(".role"), trade=q(".trade"), photo=q(".photo");
    if(!first||!last)return;
    const display=String(profile?.displayName||profile?.name||"").trim();
    const bits=display.split(/\s+/).filter(Boolean);
    first.textContent=bits[0]||"Worker";
    last.textContent=bits.slice(1).join(" ")||"Card";
    const primary=profile?.preferences?.primaryTrade||"Add your trade";
    const target=profile?.preferences?.targetRoles?.[0]||"Worker profile";
    if(role)role.textContent=target;
    if(trade)trade.textContent=primary;
    const meta=qa(".metaLine span");
    if(meta[0])meta[0].textContent=(profile?.preferences?.locations||[]).join(", ")||"United Kingdom";
    if(meta[1])meta[1].textContent="Worker-owned profile";
    if(photo)photo.setAttribute("aria-label",display||"NOSMO Work profile");
    qa("a.iconLink").forEach(a=>{a.removeAttribute("href");a.setAttribute("aria-disabled","true")});
  }
  function init(){
    document.title="NOSMO Work";
    setAppearance(localStorage.getItem(APPEARANCE_KEY)||"midnight-black");
    qa("[data-nosmo-ask-nexus]").forEach(el=>el.addEventListener("click",askNexus));
    qa("[data-appearance]").forEach(el=>el.addEventListener("click",()=>setAppearance(el.dataset.appearance)));
    const reply=q("#replyAlertsSetting"), wa=q("#whatsappContactsSetting");
    if(reply){reply.checked=getBool(REPLY_KEY,true);reply.addEventListener("change",()=>localStorage.setItem(REPLY_KEY,String(reply.checked)))}
    if(wa){wa.checked=getBool(WA_KEY,true);wa.addEventListener("change",()=>localStorage.setItem(WA_KEY,String(wa.checked)))}
    q("#settingsLanguageButton")?.addEventListener("click",()=>q(".workLangButton")?.click());
    q("#settingsWorkModeButton")?.addEventListener("click",()=>{location.href="./screen.html?screen=work-mode"});
    q("#workCameraButton")?.addEventListener("click",()=>q("#workCameraInput")?.click());
    q("#workCameraInput")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f){localStorage.setItem("nosmo-work:v1:last-camera-name",f.name);alert("Photo selected locally. It has not been uploaded or shared.")}});
    if(q(".profile")&&!q(".canonicalProfileActions")){
      const row=document.createElement("div");row.className="canonicalProfileActions";
      row.innerHTML='<button type="button" id="canonicalEditProfile">EDIT PROFILE</button><button type="button" id="canonicalShareProfile">SHARE</button>';
      q(".profile").appendChild(row);
      q("#canonicalEditProfile")?.addEventListener("click",()=>{if(typeof window.NEXUS_OPEN_ONBOARDING==="function")window.NEXUS_OPEN_ONBOARDING();else location.href="./onboarding.html"});
      q("#canonicalShareProfile")?.addEventListener("click",async()=>{const data={title:"NOSMO Work",text:"NOSMO Work profile",url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);alert("Profile link copied")}}catch(_){}});
    }
    hydrateWorker(window.NEXUS_WORK_PROFILE||{});
    window.addEventListener("nexus:work-profile-ready",e=>hydrateWorker(e.detail?.profile||window.NEXUS_WORK_PROFILE||{}));
    if(location.hash==="#ask-nexus")setTimeout(askNexus,120);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
'''

# Canonical compatibility layer: generic fallback instead of the donor's person-specific fixture.
for rel in ["js/canonical-work-profile-bridge.js", "js/person-work-profile.js"]:
    p = WORK / rel
    if p.exists():
        text = p.read_text(encoding="utf-8")
        text = text.replace("./data/person-work-profile-kamil.json", "./data/default-worker-profile.json")
        p.write_text(text, encoding="utf-8")

# Genericise residual person-specific donor copy in canonical text files only.
for p in WORK.rglob("*"):
    if not p.is_file() or "recovery-source" in p.parts:
        continue
    if p.suffix.lower() not in {".html", ".js", ".mjs", ".json", ".css", ".md"} and p.name != "manifest.webmanifest":
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    replacements = [
        ("Kamil%20Karaszewski", "Worker%20Profile"),
        ("Kamil Karaszewski", "Worker Profile"),
        ("person-card-kamil.html", "index.html"),
        ("person-work-profile-kamil.json", "default-worker-profile.json"),
        ("Eindhoven, Netherlands", "United Kingdom"),
        ("Eindhoven", "Leeds"),
        ("Welding &amp; Fabrication", "Construction"),
        ("Welding & Fabrication", "Construction"),
        ("Karaszewski", "Card"),
        ("Kamil", "Worker"),
    ]
    for a,b in replacements:
        text=text.replace(a,b)
    p.write_text(text, encoding="utf-8")

# Add canonical stylesheet and shell runtime.
(WORK / "css" / "work-v10101-canonical.css").write_text(CANONICAL_CSS.strip()+"\n", encoding="utf-8")
(WORK / "js" / "work-v10101-shell.js").write_text(SHELL_JS.strip()+"\n", encoding="utf-8")

for rel in ["index.html", "screen.html", "onboarding.html", "section.html", "about.html", "directory.html"]:
    p=WORK/rel
    if not p.exists():
        continue
    html=p.read_text(encoding="utf-8")
    if "work-v10101-canonical.css" not in html:
        html=html.replace("</head>", '<link rel="stylesheet" href="./css/work-v10101-canonical.css?v=10101">\n</head>')
    if "work-v10101-shell.js" not in html:
        html=html.replace("</body>", '<script src="./js/work-v10101-shell.js?v=10101"></script>\n</body>')
    html=html.replace('data-work-profile-src="./data/default-worker-profile.json?v=freeware1"','data-work-profile-src="./data/default-worker-profile.json?v=10101"')
    # Any bottom nav in the donor becomes the locked five-item V1.0101 shell.
    html=re.sub(r'<nav class="appWindowNav"[^>]*>.*?</nav>', NAV, html, flags=re.S)
    # Ask Nexus is persistent immediately below the top header.
    if "data-nosmo-ask-nexus" not in html and '<header class="top"' in html:
        html=re.sub(r'(<header class="top".*?</header>)', r'\1\n'+ASK, html, count=1, flags=re.S)
    p.write_text(html, encoding="utf-8")

# screen.html gains real Apps + Settings routes while Work Mode remains available from Apps.
screen=WORK/"screen.html"
html=screen.read_text(encoding="utf-8")
if 'id="appsScreen"' not in html:
    html=html.replace('<section id="reservedScreen"', APPS_SECTION+SETTINGS_SECTION+'\n<section id="reservedScreen"')
html=re.sub(
    r'const screens=\{\s*documents:\{title:"DOCUMENTS"\},\s*work:\{title:"WORK CARD"\},\s*"work-mode":\{title:"WORK MODE"\}\s*\};',
    'const screens={documents:{title:"DOCUMENTS"},work:{title:"JOBS"},apps:{title:"APPS"},settings:{title:"SETTINGS"},"work-mode":{title:"WORK MODE"}};',
    html,
)
html=html.replace('document.getElementById("workModeScreen").hidden=true;\n  document.getElementById("reservedScreen").hidden=true;', 'document.getElementById("workModeScreen").hidden=true;\n  document.getElementById("appsScreen").hidden=true;\n  document.getElementById("settingsScreen").hidden=true;\n  document.getElementById("reservedScreen").hidden=true;')
html=html.replace('else if(next==="work-mode"){document.getElementById("workModeScreen").hidden=false}', 'else if(next==="apps"){document.getElementById("appsScreen").hidden=false}\n  else if(next==="settings"){document.getElementById("settingsScreen").hidden=false}\n  else if(next==="work-mode"){document.getElementById("workModeScreen").hidden=false}')
html=re.sub(r'document\.querySelectorAll\([^\n]+\)\.forEach\(link=>\{', 'document.querySelectorAll(\'.appWindowNav a[data-screen]\').forEach(link=>{', html, count=1)
screen.write_text(html, encoding="utf-8")

# index.html is Worker Card, not old Person Card naming.
index=WORK/"index.html"
html=index.read_text(encoding="utf-8")
html=html.replace('aria-label="Person Card Freeware main windows"','aria-label="NOSMO Work main navigation"')
index.write_text(html, encoding="utf-8")

# Update PWA shortcuts to the actual five-surface product shell.
manifest_path=WORK/"manifest.webmanifest"
manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["name"]="NOSMO Work"
manifest["short_name"]="NOSMO Work"
manifest["description"]="Worker Card, documents, jobs, work tools and private worker-owned actions."
manifest["shortcuts"]=[
    {"name":"Worker Card","short_name":"Worker Card","url":"./index.html"},
    {"name":"Documents","short_name":"Documents","url":"./screen.html?screen=documents"},
    {"name":"Jobs","short_name":"Jobs","url":"./screen.html?screen=work"},
    {"name":"Apps","short_name":"Apps","url":"./screen.html?screen=apps"},
    {"name":"Settings","short_name":"Settings","url":"./screen.html?screen=settings"},
]
manifest_path.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")

# Bump service-worker cache and include canonical shell assets.
sw=WORK/"sw.js"
text=sw.read_text(encoding="utf-8")
text=text.replace("nosmo-work-v1-20260905-1","nosmo-work-v10101-canonical-20260905-1")
if "work-v10101-canonical.css" not in text:
    text=text.replace("'./js/work-v1-runtime.js'", "'./css/work-v10101-canonical.css','./js/work-v10101-shell.js','./js/work-v1-runtime.js'")
sw.write_text(text,encoding="utf-8")

# Static acceptance checks for the reconstructed baseline.
index_text=(WORK/"index.html").read_text(encoding="utf-8")
screen_text=(WORK/"screen.html").read_text(encoding="utf-8")
for label in ["Worker Card","Documents","Jobs","Apps","Settings"]:
    assert label in index_text and label in screen_text, label
assert 'id="appsScreen"' in screen_text
assert 'id="settingsScreen"' in screen_text
assert "work-v10101-shell.js" in index_text and "work-v10101-shell.js" in screen_text
assert "work-v10101-canonical.css" in index_text and "work-v10101-canonical.css" in screen_text
assert "Kamil" not in index_text and "Karaszewski" not in index_text
assert not (WORK/"agency-desk.html").exists()
assert not (WORK/"agency-invite.html").exists()
assert not (WORK/"js"/"agency-desk.js").exists()
assert not (WORK/"js"/"person-agency-invite.js").exists()
assert (WORK/"data"/"default-worker-profile.json").exists()
assert not (WORK/"data"/"person-work-profile-kamil.json").exists()
print("NOSMO_WORK_V1_0101_CANONICAL_PROMOTION_PASS")
