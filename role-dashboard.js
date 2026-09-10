'use strict';
(function(){
  const user=window.KT_USER;if(!user)return;
  const access=new Set(user.access||[]);
  const labels={dashboard:'Dashboard',employees:'Employees & Access',suppliers:'Suppliers','supplier-bills':'Supplier Bills','supplier-payments':'Supplier Payments',clients:'Clients','client-sales':'Client Bills','client-receipts':'Client Payments',products:'Products','goods-receiving':'Goods Receiving','inventory-ledger':'Inventory Ledger',warehouses:'Warehouses','warehouse-stock':'Warehouse Stock','stock-transfer':'Stock Transfer','stock-adjustment':'Stock Adjustment',documents:'Documents',search:'Search',reports:'Reports',settings:'Settings'};
  function apply(){
    if(!access.has('dashboard'))return;
    const role=user.designation;
    const hero=document.querySelector('.hero');
    if(hero){const h={admin:'Admin Dashboard',manager:'Manager Dashboard',accountant:'Accountant Dashboard',salesman:'Sales Dashboard'};hero.querySelector('h1').textContent=h[role]||'Dashboard';hero.querySelector('p').textContent='Your dashboard reflects the access assigned by Admin.';}
    const stats=document.getElementById('stats');
    if(stats){
      const cards=[...stats.children];
      const showClient=access.has('clients')||access.has('client-sales')||access.has('client-receipts')||access.has('reports');
      const showSupplier=access.has('suppliers')||access.has('supplier-bills')||access.has('supplier-payments')||access.has('reports');
      if(cards[0])cards[0].style.display=showClient?'':'none';
      if(cards[1])cards[1].style.display=showSupplier?'':'none';
      if(cards[2])cards[2].style.display=(access.has('supplier-bills')||access.has('reports'))?'':'none';
      if(cards[3])cards[3].style.display=(access.has('client-sales')||access.has('reports'))?'':'none';
      const visible=cards.filter(c=>c.style.display!=='none').length;
      stats.style.gridTemplateColumns=visible>0?'repeat('+Math.min(visible,4)+',1fr)':'';
    }
    const ov=document.getElementById('overview');
    if(ov){const allowed=[...access].filter(k=>k!=='dashboard'&&labels[k]).map(k=>labels[k]);ov.innerHTML='<b>Assigned access:</b> '+(allowed.length?allowed.map(x=>'<span class="badge">'+x+'</span>').join(' '):'Dashboard only');}
  }
  setTimeout(apply,350);
  const dashboardBtn=document.querySelector('#nav [data-view="dashboard"]');if(dashboardBtn)dashboardBtn.addEventListener('click',()=>setTimeout(apply,350),true);
  const topLogout=document.getElementById('logoutBtn');if(topLogout)topLogout.remove();
  if(nav&&!document.getElementById('logoutBtn')){
    const foot=nav.querySelector('.navfoot');
    const b=document.createElement('button');b.id='logoutBtn';b.className='logoutMenuBtn';b.innerHTML='<span class="ico">↪</span><span class="label">Logout</span><span class="arr">›</span>';
    b.onclick=async()=>{b.disabled=true;await fetch('/api/auth?action=logout',{method:'POST'}).catch(()=>{});location.replace('/login.html');};
    if(foot)nav.insertBefore(b,foot);else nav.appendChild(b);
  }
})();
