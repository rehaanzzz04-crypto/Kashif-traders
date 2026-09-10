'use strict';
(()=>{
 const user=window.KT_USER;if(!user||user.designation!=='admin')return;
 const dash=document.getElementById('dashboard'),mod=document.getElementById('module'),stats=document.getElementById('stats'),ov=document.getElementById('overview'),nav=document.getElementById('nav');
 const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 async function json(url){const r=await fetch(url,{cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j}
 async function openDashboard(){
  if(typeof closeMenu==='function')closeMenu();
  nav.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='dashboard'));
  dash.classList.add('hidden');mod.classList.add('hidden');
  try{
   const [d,a,s]=await Promise.all([json('/api/dashboard'),json('/api/approvals?status=pending').catch(()=>({records:[]})),json('/api/salaries').catch(()=>({records:[]}))]);
   const general=a.records||[],salary=(s.records||[]).filter(x=>x.status==='pending');
   const pending=[...general.map(x=>({time:x.requested_at,title:(x.action||'Activity')+' · '+(x.module_key||''),who:x.requested_by_name||x.requested_by_code||'Employee'})),...salary.map(x=>({time:x.requested_at,title:(x.request_type==='monthly_salary'?'Monthly Salary':'Salary Advance')+' · '+money(x.amount),who:x.employee_name||x.employee_code||'Employee'}))].sort((x,y)=>new Date(y.time)-new Date(x.time));
   const latest=pending[0];
   stats.innerHTML='<div class="stat"><small>Pending Approvals</small><strong>'+pending.length+'</strong><small>'+(latest?'Latest: '+esc(latest.who)+' · '+esc(latest.title):'No pending requests')+'</small></div><div class="stat"><small>Client Receivables</small><strong>'+money(d.totalClientReceivable)+'</strong><small>'+Number(d.clientCount||0)+' clients</small></div><div class="stat"><small>Supplier Payables</small><strong>'+money(d.totalSupplierPayable)+'</strong><small>'+Number(d.supplierCount||0)+' suppliers</small></div><div class="stat"><small>Supplier Purchases</small><strong>'+money(d.totalSupplierPurchases)+'</strong><small>Recorded bills</small></div><div class="stat"><small>Client Credit Sales</small><strong>'+money(d.totalClientSales)+'</strong><small>Recorded sales</small></div>';
   const labels={employees:'Employees & Access',suppliers:'Suppliers','supplier-bills':'Supplier Bills','supplier-payments':'Supplier Payments',clients:'Clients','client-sales':'Client Bills','client-receipts':'Client Payments',products:'Products','goods-receiving':'Goods Receiving','inventory-ledger':'Inventory Ledger',warehouses:'Warehouses','warehouse-stock':'Warehouse Stock','stock-transfer':'Stock Transfer','stock-adjustment':'Stock Adjustment',documents:'Documents',search:'Search',reports:'Reports',settings:'Settings','salary-advances':'Salary & Advances'};
   const allowed=(user.access||[]).filter(k=>k!=='dashboard'&&labels[k]).map(k=>labels[k]);
   ov.innerHTML=(latest?'<div style="margin-bottom:14px"><b>Latest pending approval:</b> '+esc(latest.who)+' · '+esc(latest.title)+'</div>':'')+'<b>Assigned access:</b> '+allowed.map(x=>'<span class="badge">'+esc(x)+'</span>').join(' ');
   dash.classList.remove('hidden');
  }catch(e){dash.classList.remove('hidden');stats.innerHTML='<div class="stat"><small>Status</small><strong>Unable to load</strong></div>';ov.textContent=e.message;}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('#nav [data-view="dashboard"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openDashboard()},true);
 window.KT_OPEN_ADMIN_DASHBOARD=openDashboard;
})();
