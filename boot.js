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
    const dashboard=document.getElementById('dashboard'),module=document.getElementById('module');
    dashboard?.classList.add('hidden');module?.classList.add('hidden');
    const load=src=>new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=bad;document.body.appendChild(s);});
    await load('/app.js?v=20260911-startup6');
    await load('/inventory-ui.js?v=20260911-rbac3');
    await load('/product-status-fix.js?v=20260910-status1');
    await load('/products-scalable.js?v=20260911-barcode1');
    await load('/employees-ui.js?v=20260911-rbac3');
    await load('/salary-ui.js?v=20260911-salary2');
    await load('/role-dashboard.js?v=20260911-rbac5');
    document.body.classList.add('auth-ready');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const dash=document.querySelector('#nav [data-view="dashboard"]');
    const first=[...document.querySelectorAll('#nav [data-view]')].find(b=>b.style.display!=='none');
    const target=access.has('dashboard')&&dash?dash:first;
    if(target)target.click();
  }catch(e){console.error(e);location.replace('/login.html');}
})();
