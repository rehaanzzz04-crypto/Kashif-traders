'use strict';
(function(){
  const user=window.KT_USER;if(!user)return;
  function apply(){
    const role=user.designation;
    const hero=document.querySelector('.hero');
    if(hero){const h={admin:'Admin Dashboard',manager:'Manager Dashboard',accountant:'Accountant Dashboard',salesman:'Sales Dashboard'};const p={admin:'Full business control, employee access, accounts, inventory and warehouse operations.',manager:'Operational control across accounts, inventory, warehouse and reporting.',accountant:'Accounts workspace for suppliers, clients, bills, payments and financial reports.',salesman:'Sales workspace for clients, client bills, payments and product visibility.'};hero.querySelector('h1').textContent=h[role]||'Kashif Traders';hero.querySelector('p').textContent=p[role]||'';}
    const stats=document.getElementById('stats');
    if(stats&&role==='salesman'){const cards=[...stats.children];cards.forEach((c,i)=>{if(i===1||i===2)c.style.display='none';});stats.style.gridTemplateColumns='repeat(2,1fr)';}
    const ov=document.getElementById('overview');if(ov&&role==='salesman')ov.innerHTML='Sales access enabled for <b>'+String(user.full_name||user.employee_code)+'</b>. Use Clients, Client Bills, Client Payments, Products and Search from the menu.';
    if(ov&&role==='accountant')ov.insertAdjacentHTML('afterbegin','<b>Accountant workspace:</b> financial records and reports &nbsp;•&nbsp; ');
    if(ov&&role==='manager')ov.insertAdjacentHTML('afterbegin','<b>Manager workspace:</b> operational oversight &nbsp;•&nbsp; ');
    if(ov&&role==='admin')ov.insertAdjacentHTML('afterbegin','<b>Admin workspace:</b> full system control &nbsp;•&nbsp; ');
  }
  setTimeout(apply,250);
  nav.addEventListener('click',e=>{if(e.target.closest('[data-view="dashboard"]'))setTimeout(apply,250);},true);
  const topLogout=document.getElementById('logoutBtn');if(topLogout)topLogout.remove();
  if(nav&&!document.getElementById('logoutBtn')){
    const foot=nav.querySelector('.navfoot');
    const b=document.createElement('button');b.id='logoutBtn';b.className='logoutMenuBtn';b.innerHTML='<span class="ico">↪</span><span class="label">Logout</span><span class="arr">›</span>';
    b.onclick=async()=>{b.disabled=true;await fetch('/api/auth?action=logout',{method:'POST'}).catch(()=>{});location.replace('/login.html');};
    if(foot)nav.insertBefore(b,foot);else nav.appendChild(b);
  }
})();
