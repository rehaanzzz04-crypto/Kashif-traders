'use strict';
(async()=>{
  try{
    const r=await fetch('/api/auth?action=me',{cache:'no-store'});
    if(!r.ok){location.replace('/login.html');return;}
    const j=await r.json();window.KT_USER=j.user;const access=new Set(j.user.access||[]);
    document.querySelectorAll('#nav [data-view]').forEach(b=>{if(!access.has(b.dataset.view))b.style.display='none';});
    document.querySelectorAll('#nav .section').forEach(s=>{let n=s.nextElementSibling,visible=false;while(n&&!n.classList.contains('section')&&!n.classList.contains('navfoot')){if(n.matches?.('[data-view]')&&n.style.display!=='none')visible=true;n=n.nextElementSibling;}if(!visible)s.style.display='none';});
    const hero=document.querySelector('.hero');if(hero){const names={admin:'Admin Dashboard',manager:'Manager Dashboard',accountant:'Accountant Dashboard',salesman:'Sales Dashboard'};hero.querySelector('h1').textContent=names[j.user.designation]||'Kashif Traders';hero.querySelector('p').textContent='Your dashboard reflects the access assigned by Admin.';}
    const status=document.getElementById('status');if(status)status.textContent=(j.user.full_name||j.user.employee_code)+' • '+String(j.user.designation||'').toUpperCase();
    const dashboard=document.getElementById('dashboard'),module=document.getElementById('module');dashboard?.classList.add('hidden');module?.classList.add('hidden');
    const load=src=>new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=ok;s.onerror=bad;document.body.appendChild(s);});
    await load('/offline-sync.js?v=20260911-offline3').catch(e=>console.error('Offline feature unavailable',e));
    const extras=()=>load('/document-scan.js?v=20260911-scan3').catch(e=>console.error('Document scan feature unavailable',e));
    if(j.user.designation==='admin'&&access.has('dashboard')){document.body.classList.add('auth-ready');await load('/admin-dashboard-fix.js?v=20260911-admin6');if(typeof window.KT_OPEN_ADMIN_DASHBOARD==='function')window.KT_OPEN_ADMIN_DASHBOARD();Promise.all(['/app.js?v=20260911-noautodash1','/inventory-ui.js?v=20260911-rbac3','/product-status-fix.js?v=20260910-status1','/products-scalable.js?v=20260911-barcode1','/employees-ui.js?v=20260911-rbac3','/salary-ui.js?v=20260912-statement1','/role-dashboard.js?v=20260911-rbac6'].map(load)).then(extras).catch(console.error);return;}
    const core=['/app.js?v=20260911-noautodash1','/inventory-ui.js?v=20260911-rbac3','/product-status-fix.js?v=20260910-status1','/products-scalable.js?v=20260911-barcode1','/employees-ui.js?v=20260911-rbac3','/salary-ui.js?v=20260912-statement1','/role-dashboard.js?v=20260911-rbac6'];await Promise.all(core.map(load));extras();const dash=document.querySelector('#nav [data-view="dashboard"]');const first=[...document.querySelectorAll('#nav [data-view]')].find(b=>b.style.display!=='none');const target=access.has('dashboard')&&dash?dash:first;if(target)target.click();document.body.classList.add('auth-ready');
  }catch(e){console.error(e);location.replace('/login.html');}
})();
