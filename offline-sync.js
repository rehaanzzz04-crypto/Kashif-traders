'use strict';
(() => {
  if (window.KT_OFFLINE) return;
  const nativeFetch = window.fetch.bind(window), AUTH = 'kt_offline_user_v1';
  const DB = 'kt_offline_v3', VERSION = 1;
  const mutations = new Set(['POST','PATCH','DELETE']);
  const dataResources = new Set(['suppliers','supplier_invoices','supplier_payments','clients','client_invoices','client_receipts','documents','cash_sales','cash_sale_customers','sale_products']);
  let dbPromise, running = false, identityCheck;
  const uid = () => crypto.randomUUID();
  function session() { try { return JSON.parse(localStorage.getItem(AUTH) || 'null'); } catch { return null; } }
  function owner() { return session()?.user?.id == null ? null : String(session().user.id); }
  async function ensureIdentity() {
    if(!navigator.onLine){const saved=session();return Boolean(saved?.user&&Date.now()-Date.parse(saved.saved_at)<12*60*60*1000);}
    if(!identityCheck)identityCheck=(async()=>{
      try {const r=await nativeFetch('/api/auth?action=me',{cache:'no-store'});
        if([401,403].includes(r.status)){localStorage.removeItem(AUTH);return false;}
        if(!r.ok)throw Error('Authentication unavailable');
        const data=await r.json();if(!data.user)return false;
        localStorage.setItem(AUTH,JSON.stringify({user:data.user,saved_at:new Date().toISOString()}));return true;
      } catch {identityCheck=null;const saved=session();return Boolean(saved?.user&&Date.now()-Date.parse(saved.saved_at)<12*60*60*1000);}
    })();
    return identityCheck;
  }
  function urlOf(input) { return new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.origin); }
  function canonical(input) { const u=urlOf(input); u.searchParams.sort(); return u.pathname+u.search; }
  function supported(u) { return u.pathname === '/api/data' && dataResources.has(u.searchParams.get('resource')) || u.pathname === '/api/inventory' || u.pathname === '/api/salaries'; }
  function db() {
    if (!dbPromise) dbPromise = new Promise((resolve,reject) => {
      const r=indexedDB.open(DB,VERSION);
      r.onupgradeneeded=()=>{for(const name of ['operations','snapshots','mappings']) if(!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name,{keyPath:'key'});};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    return dbPromise;
  }
  async function transaction(store, mode, action) {
    const d=await db();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction(store,mode);let result;
      const req=action(tx.objectStore(store));req.onsuccess=()=>{result=req.result;};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Phone storage failed'));
    });
  }
  const put=(store,value)=>transaction(store,'readwrite',s=>s.put(value));
  const get=(store,key)=>transaction(store,'readonly',s=>s.get(key));
  const all=store=>transaction(store,'readonly',s=>s.getAll());
  async function legacyCount() {
    if(!indexedDB.databases)return 0;
    if(!(await indexedDB.databases()).some(d=>d.name==='kt_offline_v2'))return 0;
    return new Promise(resolve=>{const r=indexedDB.open('kt_offline_v2');r.onerror=()=>resolve(0);r.onsuccess=()=>{const d=r.result;if(!d.objectStoreNames.contains('queue')){d.close();resolve(0);return;}const tx=d.transaction('queue','readonly'),q=tx.objectStore('queue').count();q.onsuccess=()=>resolve(q.result);q.onerror=()=>resolve(0);tx.oncomplete=()=>d.close();};});
  }
  async function items() { const id=owner();return (await all('operations')).filter(x=>x.owner===id&&x.state!=='done').sort((a,b)=>a.created.localeCompare(b.created)||a.key.localeCompare(b.key)); }
  function response(data,status=200) { return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}); }
  function pending(item) { return response({offline_queued:true,pending_sync:true,record:{...item.body,id:item.tempId||Number(new URL(item.url,location.origin).searchParams.get('id')),invoice_number:'OFFLINE-'+item.key.slice(0,8),_offline_pending:true},queue_id:item.key,temp_id:item.tempId,message:'Phone par save hai; server sync baqi hai.'},202); }
  async function saveSnapshot(url,res,id) {
    if(!id||id!==owner()||!res.ok)return;
    const blob=await res.clone().blob();if(blob.size>10*1024*1024)return;
    await put('snapshots',{key:id+':'+url,owner:id,url,blob,type:res.headers.get('content-type')||'',at:new Date().toISOString()});
  }
  async function cached(url) {
    const id=owner();if(!id)return null;
    let snap=await get('snapshots',id+':'+url),u=new URL(url,location.origin),derived=false;
    if(!snap && u.pathname==='/api/data' && ['sale_products','cash_sale_customers'].includes(u.searchParams.get('resource'))) {
      const allowed=new Set(['resource','search','status','barcode']);
      if([...u.searchParams.keys()].every(k=>allowed.has(k))) { snap=await get('snapshots',id+':/api/data?resource='+u.searchParams.get('resource'));derived=Boolean(snap); }
    }
    if(!snap)return null;
    const headers={'Content-Type':snap.type,'X-KT-Offline-Cache':'1','X-KT-Snapshot-Time':snap.at};
    if(!snap.type.includes('json'))return new Response(snap.blob,{headers});
    let data=JSON.parse(await snap.blob.text());
    if(Array.isArray(data.records)) {
      let rows=data.records;
      for(const item of await items()) {
        const target=new URL(item.url,location.origin);
        if(target.pathname!==u.pathname||target.searchParams.get('resource')!==u.searchParams.get('resource'))continue;
        // Only simple list queries can include local provisional entries.
        if([...u.searchParams.keys()].some(k=>!['resource','search','status','barcode','id'].includes(k)))continue;
        if(item.method==='POST' && !item.body.action) rows=[{...item.body,id:item.tempId,_offline_pending:true,invoice_number:'OFFLINE-'+item.key.slice(0,8)},...rows];
        // Do not change paid balances or stock based on an unverified offline action.
      }
      if(derived) {
        const search=(u.searchParams.get('search')||'').toLowerCase(),status=u.searchParams.get('status'),barcode=u.searchParams.get('barcode');
        rows=rows.filter(r=>(!status||r.status===status)&&(!barcode||String(r.barcode)===barcode)&&(!search||[r.name,r.barcode,r.product_number,r.sku].some(v=>String(v||'').toLowerCase().includes(search))));
      }
      const requestedId=u.searchParams.get('id');if(requestedId)rows=rows.filter(r=>String(r.id)===requestedId);
      data={...data,records:rows};
    }
    return new Response(JSON.stringify({...data,_offline_snapshot_at:snap.at}),{headers});
  }
  async function resolveValue(value,id,field="") {
    if(typeof value==='number'&&value<0&&(field==='id'||field.endsWith('_id'))) {const m=await get('mappings',id+':'+value);if(!m)throw Error('Pehli linked entry ka sync baqi hai.');return m.id;}
    if(Array.isArray(value))return Promise.all(value.map(v=>resolveValue(v,id,field)));
    if(value&&typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))out[k]=await resolveValue(v,id,k);return out;}
    return value;
  }
  async function transmit(item) {
    let body,url;
    try {
      // Persist the exact resolved payload before sending; retries must match.
      if(item.wire)({body,url}=item.wire);
      else {
        body=await resolveValue(item.body,item.owner);const u=new URL(item.url,location.origin),id=Number(u.searchParams.get('id'));
        if(id<0)u.searchParams.set('id',await resolveValue(id,item.owner,"id"));url=u.pathname+u.search;
        item={...item,wire:{body,url}};await put('operations',item);
      }
    } catch(e) {await put('operations',{...item,error:e.message});return null;}
    let res;
    try {res=await nativeFetch(url,{method:item.method,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','X-KT-Offline-ID':item.key,'X-KT-Offline-Owner':item.owner},body:item.method==='DELETE'?undefined:JSON.stringify(body)});}
    catch {await put('operations',{...item,error:'Connection nahi mila; entry phone par mehfooz hai.'});return null;}
    const data=await res.clone().json().catch(()=>({}));
    if(!res.ok) {
      await put('operations',{...item,state:[401,403].includes(res.status)?'pending':'review',error:data.error||'Server review required',httpStatus:res.status});return res;
    }
    // Write mapping before completing operation so dependent records survive restart.
    if(item.tempId&&data.record?.id)await put('mappings',{key:item.owner+':'+item.tempId,id:data.record.id});
    await put('operations',{...item,state:'done',result:data,completed:new Date().toISOString()});
    window.dispatchEvent(new CustomEvent('kt-offline-synced',{detail:{key:item.key,result:data}}));
    return res;
  }
  async function syncUnlocked() {
    if(running||!navigator.onLine||!owner())return;running=true;
    try {
      const r=await nativeFetch('/api/auth?action=me',{cache:'no-store'});if(!r.ok)return;
      const auth=await r.json();if(String(auth.user?.id)!==owner())return;
      for(const item of await items()) {
        if(item.state==='review')break;
        const result=await transmit(item);if(!result||!result.ok)break;
      }
    } catch(e) {console.warn('Offline sync paused',e);} finally {running=false;await badge();}
  }
  async function sync() {return navigator.locks ? navigator.locks.request('kt-offline-sync',syncUnlocked) : syncUnlocked();}
  window.fetch=async (input,init={})=>{
    const u=urlOf(input);if(u.origin!==location.origin||!u.pathname.startsWith('/api/'))return nativeFetch(input,init);
    const url=canonical(u),method=String(init.method||input?.method||'GET').toUpperCase();
    if(u.pathname==='/api/auth') {
      try {
        const res=await nativeFetch(input,init);
        if(method==='GET'&&u.searchParams.get('action')==='me') {
          if(res.ok){const j=await res.clone().json();if(j.user)localStorage.setItem(AUTH,JSON.stringify({user:j.user,saved_at:new Date().toISOString()}));}
          else if([401,403].includes(res.status))localStorage.removeItem(AUTH);
        }
        if(method==='POST'&&u.searchParams.get('action')==='logout'&&res.ok){localStorage.removeItem(AUTH);identityCheck=null;}
        return res;
      } catch(e) {
        const saved=session();
        if(method==='GET'&&u.searchParams.get('action')==='me'&&saved?.user&&Date.now()-Date.parse(saved.saved_at)<12*60*60*1000)return response({user:saved.user,offline_session:true});
        throw e;
      }
    }
    if(!await ensureIdentity())return response({error:'Login required'},401);
    if(method==='GET') {
      if(navigator.onLine) {
        try {const id=owner(),res=await nativeFetch(input,init);if(res.ok)await saveSnapshot(url,res,id).catch(()=>{});return res;} catch {}
      }
      return await cached(url)||response({error:'Yeh data phone par save nahi hai. Online khol kar Offline Data Tayyar karein.'},503);
    }
    if(mutations.has(method)&&supported(u)&&owner()) {
      let raw=init.body;
      if(raw===undefined&&input instanceof Request)raw=await input.clone().text();
      let body={};try{if(raw)body=JSON.parse(raw);}catch{return response({error:'Is attachment ko save karne ke liye internet chahiye.'},503);}
      const prior=(await items()).find(x=>x.url===url&&x.method===method&&JSON.stringify(x.body)===JSON.stringify(body));
      if(prior){await sync();const latest=await get('operations',prior.key);if(latest.state==='done')return response(latest.result);if(latest.state==='review')return response({error:latest.error,pending_sync:true,queue_id:latest.key},409);return pending(latest);}
      const key=uid(),item={key,owner:owner(),url,method,body,tempId:method==='POST'?-(Date.now()*1000+Math.floor(Math.random()*1000)):null,created:new Date().toISOString(),state:'pending'};
      // Never tell the form it saved until the IndexedDB transaction commits.
      try{await put('operations',item);}catch{return response({error:'Phone storage mein entry save nahi hui. Form clear na karein.'},507);}
      await badge();
      if(navigator.onLine) {
        // Serialize all requests across tabs and flush dependencies in creation order.
        await sync();const latest=await get('operations',key);
        if(latest.state==='done')return response(latest.result,200);
        if(latest.state==='review')return response({error:latest.error,pending_sync:true,queue_id:key},latest.httpStatus||409);
      }
      await badge();return pending(item);
    }
    if(!navigator.onLine)return response({error:'Is action ke liye internet zaroori hai. Koi tabdeeli server par nahi hui.'},503);
    return nativeFetch(input,init);
  };
  async function prepare() {
    const urls=['/api/dashboard','/api/data?resource=sale_products','/api/data?resource=cash_sale_customers','/api/data?resource=cash_sales&status=all',...['suppliers','supplier_invoices','supplier_payments','clients','client_invoices','client_receipts','documents'].map(r=>'/api/data?resource='+r),...['products','warehouses','stock','movements'].map(r=>'/api/inventory?resource='+r),'/api/salaries'];
    let done=0,failed=0;
    for(const url of urls){try{const r=await window.fetch(url,{cache:'no-store'});if(r.ok&&await get('snapshots',owner()+':'+canonical(url)))done++;else if(r.status!==403)failed++;}catch{failed++;}}
    alert(done+' data lists phone par save hui hain.'+(failed?' '+failed+' lists load nahi ho sakin.':'')+' Reports aakhri saved data ke mutabiq hongi.');
  }
  async function panel() {
    const old=document.getElementById('ktOfflinePanel');if(old){old.remove();return;}
    const el=document.createElement('dialog');el.id='ktOfflinePanel';el.style.cssText='max-width:90vw;width:520px;max-height:80vh;overflow:auto;border:1px solid #cbbf9b;border-radius:14px;padding:18px;color:#173f35';
    const legacy=await legacyCount();if(legacy){const warning=document.createElement('p');warning.textContent=legacy+' purani Pending Sync entries bhi mehfooz hain. Original employee ki tasdeeq ke baghair unhein dobara post nahi kiya gaya. Admin review zaroori hai.';el.append(warning);}
    const h=document.createElement('h2');h.textContent='Offline Entries';el.append(h);
    const note=document.createElement('p');note.textContent='Pending entries sirf is phone par hain. Cashier aur server balances sync ke baad update honge. Review wali entry dobara create na karein.';el.append(note);
    for(const item of await items()){const p=document.createElement('p');p.textContent=item.method+' '+(new URL(item.url,location.origin).searchParams.get('resource')||item.url)+' • '+item.created+' • '+(item.error||'Pending Sync');el.append(p);}
    for(const [label,action]of [['Sync karein',sync],['Offline Data Tayyar',prepare],['Band karein',()=>el.remove()]]){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:10px;margin:4px;background:#173f35;color:white;border:0;border-radius:7px';b.onclick=async()=>{b.disabled=true;try{await action();}finally{b.disabled=false;}};el.append(b);}
    document.body.append(el);el.showModal();
  }
  async function badge() {
    if(!document.body||!owner())return;
    let el=document.getElementById('ktOfflineBadge');if(!el){el=document.createElement('button');el.id='ktOfflineBadge';el.type='button';el.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9998;padding:10px;border:1px solid #c4ad72;border-radius:12px;background:#f0e4c5;color:#173f35;font:700 12px system-ui';el.onclick=()=>panel().catch(console.error);document.body.append(el);}
    const q=await items(),legacy=await legacyCount();el.textContent=legacy?'Purani entries • Review':q.length?q.length+' Pending Sync'+(q.some(x=>x.state==='review')?' • Review':''):navigator.onLine?'Offline Data':'Offline • Saved Data';
  }
  window.KT_OFFLINE={sync,items,count:async()=>(await items()).length,prepare};
  window.addEventListener('online',()=>{identityCheck=null;sync();});window.addEventListener('offline',()=>badge());
  window.addEventListener('load',()=>{badge().catch(console.error);sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
})();
