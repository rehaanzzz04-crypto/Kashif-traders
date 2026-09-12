'use strict';
(()=>{
 const user=window.KT_USER;if(!user||user.designation!=='admin')return;
 const dash=document.getElementById('dashboard'),mod=document.getElementById('module'),stats=document.getElementById('stats'),ov=document.getElementById('overview'),nav=document.getElementById('nav'),hero=document.querySelector('.hero');
 const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const prefetched=window.KT_ADMIN_PREFETCH||{};
 async function json(url){if(prefetched[url]){const p=prefetched[url];delete prefetched[url];return p;}const r=await fetch(url,{cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j;}
 function ensureStyle(){if(document.getElementById('adminApprovedDesign'))return;const s=document.createElement('style');s.id='adminApprovedDesign';s.textContent=`
 body.adminApproved .hero{padding:30px 28px;text-align:center;border-radius:30px;background:linear-gradient(125deg,#154738,#1d5b49)}
 body.adminApproved .hero:after{right:34px;top:-24px;font-size:150px}
 body.adminApproved .hero h1{font-size:44px;line-height:1.05;margin:0 0 10px;font-weight:800}
 body.adminApproved .hero p{margin:0 auto;color:#e2b952;font-size:22px;font-weight:800;max-width:none}
 body.adminApproved .hero .admin-location{display:block;margin-top:8px;color:#f0f4ef;font-size:18px;font-weight:500}
 body.adminApproved #stats{grid-template-columns:1fr;margin:14px 0 0;gap:12px}
 body.adminApproved #stats .stat{position:relative;display:grid;grid-template-columns:84px 1fr;grid-template-rows:auto auto auto;column-gap:18px;align-items:center;min-height:120px;padding:18px 24px;border-radius:24px;border:1px solid #ddd5c6;border-top:4px solid #bc8f2d;background:#fffdf8;box-shadow:0 10px 24px rgba(29,55,45,.08)}
 body.adminApproved #stats .stat:before{grid-column:1;grid-row:1/4;display:grid;place-items:center;font-size:48px;font-weight:900;line-height:1}
 body.adminApproved #stats .stat small{grid-column:2;color:#6f7a73;font-size:17px;font-weight:800;line-height:1.2}
 body.adminApproved #stats .stat strong{grid-column:2;margin:2px 0;font-size:29px;line-height:1.05;color:#101715}
 body.adminApproved #stats .stat:nth-child(1):before{content:'◴';color:#ef2f34;font-size:58px}
 body.adminApproved #stats .stat:nth-child(2):before{content:'♟';color:#0fb05b;font-size:56px;transform:scaleX(1.3)}
 body.adminApproved #stats .stat:nth-child(3):before{content:'♟';color:#ef2f34;font-size:56px;transform:scaleX(1.3)}
 body.adminApproved #stats .stat:nth-child(4):before{content:'◆';color:#c48f22;font-size:56px}
 body.adminApproved #stats .stat:nth-child(5):before{content:'▥';color:#1478e8;font-size:54px}
 body.adminApproved #dashboard>.panel{margin-top:14px;padding:18px 20px;border-radius:24px;background:#fffdf8}
 body.adminApproved #dashboard>.panel h2{font-size:34px;color:#163f35;margin:0 0 12px}
 body.adminApproved .mgmt-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 body.adminApproved .mgmt-card{position:relative;min-height:116px;padding:17px 16px 15px 25px;border:1px solid #d8dfda;border-top:0;border-radius:17px;background:#fbfdfc;box-shadow:0 3px 8px rgba(20,50,40,.05);overflow:hidden}
 body.adminApproved .mgmt-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:8px;border-radius:17px 0 0 17px;background:#c4932f}
 body.adminApproved .mgmt-card.collect:before{background:#08a65a}
 body.adminApproved .mgmt-card.pay:before{background:#ef3338}
 body.adminApproved .mgmt-card.sales:before{background:#1478e8}
 body.adminApproved .mgmt-card.action:before{background:#c4932f}
 body.adminApproved .mgmt-card small{font-size:15px;color:#53645c}
 body.adminApproved .mgmt-card strong{font-size:25px;margin:6px 0 5px;color:#0d4d3c}
 body.adminApproved .mgmt-card span{font-size:15px;color:#69756f}
 body.adminApproved .overview-alert{display:none!important}
 @media(max-width:620px){body.adminApproved .hero{padding:27px 18px;border-radius:30px}body.adminApproved .hero h1{font-size:40px}body.adminApproved .hero p{font-size:20px}body.adminApproved .hero .admin-location{font-size:17px}body.adminApproved #stats{gap:11px}body.adminApproved #stats .stat{grid-template-columns:78px 1fr;min-height:113px;padding:16px 18px;border-radius:22px}body.adminApproved #stats .stat:before{font-size:48px}body.adminApproved #stats .stat small{font-size:16px}body.adminApproved #stats .stat strong{font-size:27px}body.adminApproved #dashboard>.panel{padding:16px 14px;border-radius:24px}body.adminApproved #dashboard>.panel h2{font-size:32px}body.adminApproved .mgmt-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}body.adminApproved .mgmt-card{min-height:106px;padding:14px 10px 12px 20px}body.adminApproved .mgmt-card small{font-size:13px}body.adminApproved .mgmt-card strong{font-size:20px}body.adminApproved .mgmt-card span{font-size:12px}}
 @media(max-width:390px){body.adminApproved .hero h1{font-size:37px}body.adminApproved .hero p{font-size:18px}body.adminApproved #stats .stat{grid-template-columns:68px 1fr;padding:14px 14px}body.adminApproved #stats .stat small{font-size:14px}body.adminApproved #stats .stat strong{font-size:24px}body.adminApproved .mgmt-card small{font-size:11px}body.adminApproved .mgmt-card strong{font-size:17px}body.adminApproved .mgmt-card span{font-size:10px}}
 `;document.head.appendChild(s);}
 function setAdminHero(){document.body.classList.add('adminApproved');ensureStyle();if(!hero)return;const name=user.full_name||user.employee_code||'Administrator';hero.querySelector('h1').textContent=name;hero.querySelector('p').innerHTML='System Administrator<span class="admin-location">Head Office · Sialkot</span>';}
 async function openDashboard(){
  setAdminHero();if(typeof closeMenu==='function')closeMenu();nav.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='dashboard'));dash.classList.add('hidden');mod.classList.add('hidden');
  try{
   const [d,a,s]=await Promise.all([json('/api/dashboard'),json('/api/approvals?status=pending').catch(()=>({records:[]})),json('/api/salaries').catch(()=>({records:[]}))]);
   const general=a.records||[],salary=(s.records||[]).filter(x=>x.status==='pending');
   const pending=[...general.map(x=>({time:x.requested_at,title:(x.action||'Activity')+' · '+(x.module_key||''),who:x.requested_by_name||x.requested_by_code||'Employee'})),...salary.map(x=>({time:x.requested_at,title:(x.request_type==='monthly_salary'?'Monthly Salary':'Salary Advance')+' · '+money(x.amount),who:x.employee_name||x.employee_code||'Employee'}))].sort((x,y)=>new Date(y.time)-new Date(x.time));
   const latest=pending[0],receivable=Number(d.totalClientReceivable||0),payable=Number(d.totalSupplierPayable||0),purchases=Number(d.totalSupplierPurchases||0),sales=Number(d.totalClientSales||0);
   stats.innerHTML='<div class="stat"><small>Pending Approvals</small><strong>'+pending.length+'</strong><small>'+(latest?'Latest: '+esc(latest.who)+' · '+esc(latest.title):'No pending requests')+'</small></div><div class="stat"><small>Client Receivables</small><strong>'+money(receivable)+'</strong><small>'+Number(d.clientCount||0)+' clients</small></div><div class="stat"><small>Supplier Payables</small><strong>'+money(payable)+'</strong><small>'+Number(d.supplierCount||0)+' suppliers</small></div><div class="stat"><small>Supplier Purchases</small><strong>'+money(purchases)+'</strong><small>Recorded bills</small></div><div class="stat"><small>Client Credit Sales</small><strong>'+money(sales)+'</strong><small>Recorded sales</small></div>';
   const net=sales-purchases;
   ov.innerHTML='<div class="mgmt-grid">'
    +'<div class="mgmt-card collect"><small>Money to Collect</small><strong>'+money(receivable)+'</strong><span>Outstanding from '+Number(d.clientCount||0)+' clients</span></div>'
    +'<div class="mgmt-card pay"><small>Money to Pay</small><strong>'+money(payable)+'</strong><span>Outstanding to '+Number(d.supplierCount||0)+' suppliers</span></div>'
    +'<div class="mgmt-card sales"><small>Sales vs Purchases</small><strong>'+money(net)+'</strong><span>'+(net>=0?'Sales ahead of purchases':'Purchases ahead of sales')+'</span></div>'
    +'<div class="mgmt-card action"><small>Action Required</small><strong>'+pending.length+'</strong><span>'+(pending.length?'Pending approval'+(pending.length===1?'':'s'):'Nothing pending')+'</span></div>'
    +'</div>';
   dash.classList.remove('hidden');
  }catch(e){dash.classList.remove('hidden');stats.innerHTML='<div class="stat"><small>Status</small><strong>Unable to load</strong></div>';ov.textContent=e.message;}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('#nav [data-view="dashboard"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openDashboard()},true);
 window.KT_OPEN_ADMIN_DASHBOARD=openDashboard;setAdminHero();
})();
