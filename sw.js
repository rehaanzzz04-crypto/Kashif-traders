'use strict';
importScripts('/offline-shell-manifest.js');
const CACHE = 'kt-shell-20261009-directproducts1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(self.KT_SHELL_ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('kt-shell-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  // Fast offline Smart Billing navigation and its dedicated assets. Background
  // refresh never holds up the visible counter and doesn't affect other routes.
  const smartFiles=new Set(['/smart-billing-counter.html','/smart-billing-counter.css','/smart-billing-counter.js','/smart-billing-pdf.js','/smart-offline-sync.js']);
  if(smartFiles.has(pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const hit=await cache.match(request)||await cache.match(pathname);
      if(hit){
        event.waitUntil(fetch(request,{cache:'no-store'}).then(async response=>{
          if(response.ok&&!response.redirected)await cache.put(request,response.clone());
        }).catch(()=>{}));
        return hit;
      }
      try{
        const response=await fetch(request);
        if(response.ok&&!response.redirected)await cache.put(request,response.clone());
        return response;
      }catch{return new Response('Smart Billing offline shell unavailable. Connect once to prepare.',{status:503});}
    })());
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        // A login redirect must never replace a module's saved HTML.
        if (response.ok && !response.redirected) await cache.put(pathname, response.clone());
        return response;
      } catch {
        return await cache.match(pathname) || new Response(
          '<!doctype html><meta name="viewport" content="width=device-width"><h1>Offline</h1><p>Yeh page abhi phone par save nahi hai. Internet connect karke dobara kholein.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const networkFirst = request.destination === 'script' || request.destination === 'style';
    if (networkFirst) {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok && !response.redirected) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request) || await cache.match(pathname) || new Response('Offline asset unavailable', { status: 503 });
      }
    }
    const hit = await cache.match(request);
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected && ['image', 'font'].includes(request.destination)) await cache.put(request, response.clone());
      return response;
    } catch {
      return await cache.match(pathname) || new Response('Offline asset unavailable', { status: 503 });
    }
  })());
});
