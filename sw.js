'use strict';
importScripts('/offline-shell-manifest.js');
const CACHE = 'kt-shell-20260922-offline-sync2';
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
    const cache = await caches.open(CACHE), hit = await cache.match(request);
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected && ['script', 'style', 'image', 'font'].includes(request.destination)) await cache.put(request, response.clone());
      return response;
    } catch {
      return await cache.match(pathname) || new Response('Offline asset unavailable', { status: 503 });
    }
  })());
});
