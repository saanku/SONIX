const CACHE='sonix-shell-v6';
const base=new URL('./',self.location.href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([base.href,new URL('icon.svg',base).href])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sonix-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;const url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||req.headers.has('range')||url.pathname.includes('/audio/'))return;
 event.respondWith(fetch(req).then(res=>{if(res.ok){const clone=res.clone();caches.open(CACHE).then(cache=>cache.put(req,clone));}return res;}).catch(async()=>{const cached=await caches.match(req);if(cached)return cached;if(req.mode==='navigate'){const shell=await caches.match(base.href);if(shell)return shell;}return new Response('Offline',{status:503});}));
});
