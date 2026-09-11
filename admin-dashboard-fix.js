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
   const latest=pending[0], receivable=Number(d.totalClientReceivable||0), payable=Number(d.totalSupplierPayable||0), purchases=Number(d.totalSupplierPurchases||0), sales=Number(d.totalClientSales||0);
   stats.innerHTML='<div class="stat"><small>Pending Approvals</small><strong>'+pending.length+'</strong><small>'+(latest?'Latest: '+esc(latest.who)+' · '+esc(latest.title):'No pending requests')+'</small></div><div class="stat"><small>Client Receivables</small><strong>'+money(receivable)+'</strong><small>'+Number(d.clientCount||0)+' clients</small></div><div class="stat"><small>Supplier Payables</small><strong>'+money(payable)+'</strong><small>'+Number(d.supplierCount||0)+' suppliers</small></div><div class="stat"><small>Supplier Purchases</small><strong>'+money(purchases)+'</strong><small>Recorded bills</small></div><div class="stat"><small>Client Credit Sales</small><strong>'+money(sales)+'</strong><small>Recorded sales</small></div>';
   const net=sales-purchases;
   ov.innerHTML='<div class="mgmt-grid">'
    +'<div class="mgmt-card"><small>Action Required</small><strong>'+pending.length+'</strong><span>'+(pending.length?'Pending approval'+(pending.length===1?'':'s'):'Nothing pending')+'</span></div>'
    +'<div class="mgmt-card"><small>Money to Collect</small><strong>'+money(receivable)+'</strong><span>Outstanding from '+Number(d.clientCount||0)+' clients</span></div>'
    +'<div class="mgmt-card"><small>Money to Pay</small><strong>'+money(payable)+'</strong><span>Outstanding to '+Number(d.supplierCount||0)+' suppliers</span></div>'
    +'<div class="mgmt-card"><small>Sales vs Purchases</small><strong>'+money(net)+'</strong><span>'+(net>=0?'Sales ahead of purchases':'Purchases ahead of sales')+'</span></div>'
    +'</div>'+(latest?'<div class="overview-alert"><b>Latest pending approval</b><span>'+esc(latest.who)+' · '+esc(latest.title)+'</span></div>':'<div class="overview-alert overview-ok"><b>Approvals clear</b><span>No pending management requests.</span></div>');
   dash.classList.remove('hidden');
  }catch(e){dash.classList.remove('hidden');stats.innerHTML='<div class="stat"><small>Status</small><strong>Unable to load</strong></div>';ov.textContent=e.message;}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('#nav [data-view="dashboard"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openDashboard()},true);
 window.KT_OPEN_ADMIN_DASHBOARD=openDashboard;
})();
