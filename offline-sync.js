'use strict';
(()=>{
 const KEY='kt_offline_queue_v1',allowed=new Set(['suppliers','supplier_invoices','supplier_payments','clients','client_invoices','client_receipts','documents']);
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
 const write=q=>{try{localStorage.setItem(KEY,JSON.stringify(q));return true}catch{return false}};
 const id=()=>globalThis.crypto?.randomUUID?.()||('kt-'+Date.now()+'-'+Math.random().toString(36).slice(2));
 function notify(msg,bad=false){try{if(typeof toast==='function')toast(msg,bad)}catch{}}
 function refreshBadge(){const n=read().length;let el=document.getElementById('ktOfflineBadge');if(!el){el=document.createElement('div');el.id='ktOfflineBadge';el.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9998;padding:7px 10px;border-radius:999px;background:#f0e4c5;color:#513f1c;font:700 11px system-ui;box-shadow:0 3px 12px #0002;display:none';document.body.appendChild(el)}el.textContent=n+' Pending Sync';el.style.display=n?'block':'none'}
 function queue(resource,options){if(!allowed.has(resource))return null;const method=options?.method||'GET';if(method!=='POST')return null;let body={};try{body=typeof options.body==='string'?JSON.parse(options.body):options.body||{}}catch{return null}const q=read();const item={qid:id(),resource,method:'POST',body,created_at:new Date().toISOString()};q.push(item);if(!write(q))return null;refreshBadge();notify('Internet offline — entry Pending Sync mein save ho gai.');return {offline_queued:true,pending_sync:true,queue_id:item.qid}}
 async function sync(){if(!navigator.onLine||window.KT_OFFLINE_SYNCING)return;let q=read();if(!q.length){refreshBadge();return}window.KT_OFFLINE_SYNCING=true;let done=0,blocked=false;try{for(const item of [...q]){try{const r=await fetch('/api/data?resource='+encodeURIComponent(item.resource),{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-KT-Offline-ID':item.qid},body:JSON.stringify(item.body)});if(r.status===401||r.status===403){blocked=true;break}if(!r.ok)continue;q=q.filter(x=>x.qid!==item.qid);write(q);done++}catch{break}}}finally{window.KT_OFFLINE_SYNCING=false;refreshBadge()}if(done){notify(done+' offline entr'+(done===1?'y':'ies')+' sync ho '+(done===1?'gai':'gain')+'.');try{if(typeof loadModule==='function'&&typeof currentView==='string'&&currentView!=='dashboard')loadModule(currentView)}catch{}}if(blocked)notify('Pending Sync ke liye dobara login zaroori hai.',true)}
 window.KT_OFFLINE={queue,sync,count:()=>read().length};
 window.addEventListener('online',()=>setTimeout(sync,500));document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
 refreshBadge();if(navigator.onLine)setTimeout(sync,1800);
})();
