'use strict';
// Bump with every app release. A new worker waits for explicit user activation.
const RELEASE = '1.0.4';
const BASE = self.registration.scope;
const PREFIX = 'finflow-shell:' + new URL(BASE).pathname + ':';
const CACHE = PREFIX + RELEASE;
const SHELL = ['index.html','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
const urls = SHELL.map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  try{
   const responses=await Promise.all(urls.map(async url=>{
    const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin',redirect:'error',signal:controller.signal}));
    if(!response.ok||response.type==='opaque')throw Error('Incomplete offline download');
    // Consume each download immediately instead of leaving HTTP bodies open while
    // the remaining requests wait for a connection slot.
    const body=await response.arrayBuffer();
    if(!body.byteLength)throw Error('Empty offline file');
    const headers=new Headers(response.headers);
    // Fetch has already decoded transport compression; the cached body is plain.
    ['content-encoding','content-length','transfer-encoding'].forEach(name=>headers.delete(name));
    return new Response(body,{status:response.status,headers});
   }));
   const html=await responses[0].clone().text();
   if(!html.includes(`<meta name="application-version" content="${RELEASE}">`))throw Error('Release files are still deploying');
   const cache=await caches.open(CACHE);
   await Promise.all(urls.map((url,i)=>cache.put(url,responses[i])));
  }catch(error){await caches.delete(CACHE);throw error;}
  finally{clearTimeout(timeout);controller.abort();}
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  // Only FinFlow's app-shell caches in this scope; never touch stored financial data.
  await Promise.all((await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),base=new URL(BASE);
 if(request.method!=='GET'||url.origin!==base.origin)return;
 const isApp=request.mode==='navigate'&&(url.pathname===base.pathname||url.pathname===base.pathname+'index.html');
 const canonical=isApp?urls[0]:url.origin+url.pathname;
 if(!isApp&&!urls.includes(canonical))return;
 // Cache only bundled application files, never Gist/API calls or user files.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),cached=await cache.match(canonical);
  if(cached)return cached;
  return fetch(request);
 })());
});
