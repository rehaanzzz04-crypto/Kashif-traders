'use strict';
(()=>{
  const loadStyle=href=>{if(document.querySelector('link[href^="'+href+'"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href+'?v=20260913-mobile1';document.head.appendChild(l)};
  const loadScript=src=>{if(document.querySelector('script[src^="'+src+'"]'))return;const s=document.createElement('script');s.src=src+'?v=20260913-mobile1';s.defer=true;document.body.appendChild(s)};
  loadStyle('/mobile-upgrades.css');
  loadScript('/mobile-upgrades.js');
  loadScript('/employee-delete-ui.js');
  if(!('serviceWorker'in navigator))return;
  window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(r=>{r.update().catch(()=>{})}).catch(e=>console.warn('Offline app shell unavailable',e))},{once:true});
})();
