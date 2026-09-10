'use strict';
(async()=>{
  try{
    const r=await fetch('/api/auth?action=me',{cache:'no-store'});
    if(!r.ok){location.replace('/login.html');return;}
    const j=await r.json();window.KT_USER=j.user;const access=new Set(j.user.access||[]);
    document.querySelectorAll('#nav [data-view]').forEach(b=>{if(!access.has(b.dataset.view))b.style.display='none';});
    document.querySelectorAll('#nav .section').forEach(s=>{let n=s.nextElementSibling,visible=false;while(n&&!n.classList.contains('section')&&!n.classList.contains('navfoot')){if(n.matches?.('[data-view]')&&n.style.display!=='none')visible=true;n=n.nextElementSibling;}if(!visible&&s.textContent.trim()!=='Workspace')s.style.display='none';});
    const hero=document.querySelector('.hero');if(hero){const names={admin:'Admin Dashboard',manager:'Manager Dashboard',accountant:'Accountant Dashboard',salesman:'Sales Dashboard'};const desc={admin:'Full business control, employee access, accounts, inventory and warehouse operations.',manager:'Operational control across accounts, inventory, warehouse and reporting.',accountant:'Accounts workspace for suppliers, clients, bills, payments and financial reports.',salesman:'Sales workspace for clients, client bills, payments and product visibility.'};hero.querySelector('h1').textContent=names[j.user.designation]||'Kashif Traders';hero.querySelector('p').textContent=desc[j.user.designation]||'';}
    const status=document.getElementById('status');if(status)status.textContent=(j.user.full_name||j.user.employee_code)+' • '+String(j.user.designation||'').toUpperCase();
    const load=src=>new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=bad;document.body.appendChild(s);});
    await load('/app.js?v=20260910-rbac1');
    await load('/inventory-ui.js?v=20260910-rbac1');
    await load('/product-status-fix.js?v=20260910-status1');
    await load('/products-scalable.js?v=20260910-rbac1');
    await load('/employees-ui.js?v=20260910-rbac1');
    await load('/role-dashboard.js?v=20260910-rbac1');
  }catch(e){console.error(e);location.replace('/login.html');}
})();
