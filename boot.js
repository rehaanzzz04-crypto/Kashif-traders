'use strict';
(async()=>{
  try{
    const r=await fetch('/api/auth?action=me',{cache:'no-store'});
    if(!r.ok){location.replace('/login.html');return;}
    const j=await r.json();window.KT_USER=j.user;const access=new Set(j.user.access||[]);
    document.querySelectorAll('#nav [data-view]').forEach(b=>{if(!access.has(b.dataset.view))b.style.display='none';});
    document.querySelectorAll('#nav .section').forEach(s=>{let n=s.nextElementSibling,visible=false;while(n&&!n.classList.contains('section')&&!n.classList.contains('navfoot')){if(n.matches?.('[data-view]')&&n.style.display!=='none')visible=true;n=n.nextElementSibling;}if(!visible)s.style.display='none';});
    const hero=document.querySelector('.hero');if(hero){const names={admin:'Admin Dashboard',manager:'Manager Dashboard',accountant:'Accountant Dashboard',salesman:'Sales Dashboard'};hero.querySelector('h1').textContent=names[j.user.designation]||'Kashif Traders';hero.querySelector('p').textContent='Access is controlled by the Admin permission settings for this designation.';}
    const status=document.getElementById('status');if(status)status.textContent=(j.user.full_name||j.user.employee_code)+' • '+String(j.user.designation||'').toUpperCase();
    const dashboard=document.getElementById('dashboard'),module=document.getElementById('module');dashboard?.classList.add('hidden');module?.classList.add('hidden');
    const load=src=>new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=ok;s.onerror=bad;document.body.appendChild(s);});
    const fetchJson=async url=>{const x=await fetch(url,{cache:'no-store'});if(!x.ok)throw Error('Request failed');return x.json();};
    if(j.user.designation==='admin'&&access.has('dashboard')){
      const urls=['/api/dashboard','/api/approvals?status=pending','/api/salaries'];
      const jobs=urls.map(u=>fetchJson(u).catch(()=>({records:[]})));
      const critical=load('/admin-dashboard-fix.js?v=20260911-admin4');
      const values=await Promise.all(jobs);
      window.KT_ADMIN_PREFETCH=Object.fromEntries(urls.map((u,i)=>[u,values[i]]));
      await critical;
      if(typeof window.KT_OPEN_ADMIN_DASHBOARD==='function')await window.KT_OPEN_ADMIN_DASHBOARD();
      document.body.classList.add('auth-ready');
      Promise.all(['/app.js?v=20260911-noautodash1','/inventory-ui.js?v=20260911-rbac3','/product-status-fix.js?v=20260910-status1','/products-scalable.js?v=20260911-barcode1','/employees-ui.js?v=20260911-rbac3','/salary-ui.js?v=20260911-salary3','/role-dashboard.js?v=20260911-rbac5'].map(load)).catch(console.error);
      return;
    }
    const core=['/app.js?v=20260911-noautodash1','/inventory-ui.js?v=20260911-rbac3','/product-status-fix.js?v=20260910-status1','/products-scalable.js?v=20260911-barcode1','/employees-ui.js?v=20260911-rbac3','/salary-ui.js?v=20260911-salary3','/role-dashboard.js?v=20260911-rbac5'];
    await Promise.all(core.map(load));
    const dash=document.querySelector('#nav [data-view="dashboard"]');const first=[...document.querySelectorAll('#nav [data-view]')].find(b=>b.style.display!=='none');const target=access.has('dashboard')&&dash?dash:first;if(target)target.click();
    document.body.classList.add('auth-ready');
  }catch(e){console.error(e);location.replace('/login.html');}
})();
