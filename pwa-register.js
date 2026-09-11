'use strict';
(()=>{if(!('serviceWorker'in navigator))return;window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(r=>{r.update().catch(()=>{})}).catch(e=>console.warn('Offline app shell unavailable',e))},{once:true})})();
