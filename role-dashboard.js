'use strict';
(function(){
  const user=window.KT_USER;if(!user)return;
  const access=new Set(user.access||[]);
  const labels={dashboard:'Dashboard',employees:'Employees & Access',suppliers:'Suppliers','supplier-bills':'Supplier Bills','supplier-payments':'Supplier Payments',clients:'Clients','client-sales':'Client Bills','client-receipts':'Client Payments',products:'Products','goods-receiving':'Goods Receiving','inventory-ledger':'Inventory Ledger',warehouses:'Warehouses','warehouse-stock':'Warehouse Stock','stock-transfer':'Stock Transfer','stock-adjustment':'Stock Adjustment',documents:'Documents',search:'Search',reports:'Reports',settings:'Settings','salary-advances':'Salary & Advances'};
  function renderOverview(ov){
    const allowed=[...access].filter(k=>k!=='dashboard'&&labels[k]);
    ov.innerHTML='<div class="ktOverviewHead"><div><b>Management Overview</b><small>Your assigned access modules</small></div><span class="ktOverviewCount">'+allowed.length+' modules</span></div><div class="ktOverviewGrid">'+(allowed.length?allowed.map(k=>'<button type="button" class="ktOverviewTile" data-go="'+k+'"><span class="ktOverviewDot"></span><span>'+labels[k]+'</span><i>›</i></button>').join(''):'<div class="ktOverviewEmpty">Dashboard only</div>')+'</div>';
    if(!document.getElementById('ktOverviewStyle')){const s=document.createElement('style');s.id='ktOverviewStyle';s.textContent='.ktOverviewHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.ktOverviewHead b{display:block;font-family:Georgia,serif;font-size:25px;line-height:1.1;color:#122d27}.ktOverviewHead small{display:block;margin-top:5px;color:#718078;font-size:13px;font-weight:700}.ktOverviewCount{flex:0 0 auto;background:#edf5ef;color:#176448;border:1px solid #d5e7da;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800}.ktOverviewGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ktOverviewTile{min-width:0;border:1px solid #dde6df;background:#fffdf8;border-radius:14px;padding:12px 10px;display:grid;grid-template-columns:10px minmax(0,1fr) 12px;align-items:center;gap:8px;text-align:left;color:#184c3c;font:800 13px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 3px 10px rgba(24,76,60,.05)}.ktOverviewTile:active{transform:scale(.98);background:#f5f8f4}.ktOverviewDot{width:8px;height:8px;border-radius:50%;background:#b9913e;box-shadow:0 0 0 4px rgba(185,145,62,.12)}.ktOverviewTile i{font-style:normal;font-size:19px;color:#b9913e;text-align:right}.ktOverviewEmpty{grid-column:1/-1;color:#718078;padding:10px 0}@media(max-width:370px){.ktOverviewGrid{grid-template-columns:1fr}.ktOverviewHead b{font-size:22px}}';document.head.appendChild(s);}
    ov.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>{const target=document.querySelector('#nav [data-view="'+btn.dataset.go+'"]');if(target)target.click();}));
  }
  function apply(){
    if(!access.has('dashboard'))return;
    const role=user.designation;
    if(role==='admin'&&window.KT_OPEN_ADMIN_DASHBOARD)return;
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
    const ov=document.getElementById('overview');if(ov)renderOverview(ov);
  }
  window.KT_RENDER_MANAGEMENT_OVERVIEW=renderOverview;
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
