const CACHE='nosmo-work-v10102-canonical-20260906-1';
const CORE=[
  './','./index.html','./screen.html','./onboarding.html','./section.html',
  './manifest.webmanifest','./assets/pwa/icon-192.png','./assets/pwa/icon-512.png','./assets/pwa/icon-512-maskable.png','./data/default-worker-profile.json','./css/asia-hub-theme.css','./css/work-v1-final.css',
  './css/work-v10101-canonical.css','./js/work-v10101-shell.js','./js/work-storage-migration.js','./js/work-v1-runtime.js','./js/person-onboarding-v47.js','./js/person-work-overlay-controller.js',
  './js/person-work-profile.js','./js/canonical-work-profile-bridge.js','./js/contact-action-engine.js','./js/work-hub.js'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})))).catch(()=>null));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nosmo-work-v1')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.includes('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));return res;
    }).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
    if(res.ok&&['style','script','image','font'].includes(req.destination)){
      const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));
    }
    return res;
  })));
});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();});
