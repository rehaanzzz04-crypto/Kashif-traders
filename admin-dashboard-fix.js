'use strict';
(()=>{
 const user=window.KT_USER;if(!user||user.designation!=='admin')return;
 const dash=document.getElementById('dashboard'),mod=document.getElementById('module'),stats=document.getElementById('stats'),ov=document.getElementById('overview'),nav=document.getElementById('nav'),hero=document.querySelector('.hero');
 const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const titleCase=v=>String(v||'').trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
 const prefetched=window.KT_ADMIN_PREFETCH||{};
 const cacheKey='kt-admin-dashboard-v3-'+String(user.id||user.employee_code||user.full_name||'admin');
 async function json(url){if(prefetched[url]){const p=prefetched[url];delete prefetched[url];return await Promise.resolve(p);}const r=await fetch(url,{cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j;}
 function ensureStyle(){if(document.getElementById('adminApprovedDesign'))return;const s=document.createElement('style');s.id='adminApprovedDesign';s.textContent=`
 body.adminApproved .hero{position:relative;overflow:hidden;padding:18px 20px;text-align:left;border-radius:22px;background:linear-gradient(125deg,#0d4437,#17604d);box-shadow:0 14px 34px rgba(12,61,49,.15);border:1px solid rgba(201,168,93,.32)}
 body.adminApproved .hero:before{content:'BUSINESS CONTROL CENTER';display:block;margin-bottom:7px;color:#e4c66d;font-size:9px;font-weight:900;letter-spacing:1.5px}
 body.adminApproved .hero:after{right:20px;top:-34px;font-size:118px;opacity:.055}
 body.adminApproved .hero h1{font-size:34px;line-height:1;margin:0 0 6px;font-weight:800;letter-spacing:-.5px}
 body.adminApproved .hero p{margin:0;color:#e2bd58;font-size:16px;font-weight:800;max-width:none}
 body.adminApproved .hero .admin-location{display:inline-block;margin-left:9px;color:#dfeae5;font-size:12px;font-weight:600}
 body.adminApproved #stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:12px 0 0;gap:8px}
 body.adminApproved #stats .stat{position:relative;display:block;min-width:0;min-height:104px;padding:13px 14px;border-radius:15px;border:1px solid #e1d8c7;border-top:3px solid #bc8f2d;background:linear-gradient(145deg,#fffef9,#faf6ed);box-shadow:0 5px 15px rgba(29,55,45,.055);text-align:left;overflow:hidden}
 body.adminApproved #stats .stat:after{content:'';position:absolute;right:-20px;bottom:-28px;width:72px;height:72px;border-radius:50%;background:rgba(185,150,66,.055)}
 body.adminApproved #stats .stat .metricIcon{display:none!important}
 body.adminApproved #stats .stat small{display:block;color:#69766f;font-size:10px;font-weight:900;line-height:1.25;text-align:left;text-transform:uppercase;letter-spacing:.35px}
 body.adminApproved #stats .stat small:last-child{text-transform:none;letter-spacing:0;font-weight:700;font-size:9px;color:#89918d}
 body.adminApproved #stats .stat strong{display:block;margin:7px 0 5px;font-size:19px;line-height:1.06;color:#123f34;text-align:left;overflow-wrap:anywhere}
 body.adminApproved #stats .stat.loading strong{color:#89928d}
 body.adminApproved #dashboard>.panel{margin-top:10px;padding:14px;border-radius:18px;background:linear-gradient(145deg,#fffef9,#faf7ef);border:1px solid #e0d7c6;box-shadow:0 7px 18px rgba(29,55,45,.05)}
 body.adminApproved #dashboard>.panel h2{font-size:23px;line-height:1.05;color:#163f35;margin:0 0 10px}
 body.adminApproved .mgmt-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
 body.adminApproved .mgmt-card{position:relative;min-width:0;min-height:88px;padding:11px 9px 10px 17px;border:1px solid #dce2de;border-radius:13px;background:#fbfdfc;box-shadow:0 3px 8px rgba(20,50,40,.04);overflow:hidden}
 body.adminApproved .mgmt-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:#c4932f}
 body.adminApproved .mgmt-card.collect:before{background:#08a65a}body.adminApproved .mgmt-card.pay:before{background:#ef4b4f}body.adminApproved .mgmt-card.sales:before{background:#2584dc}body.adminApproved .mgmt-card.action:before{background:#c4932f}
 body.adminApproved .mgmt-card small{display:block;font-size:10px;color:#53645c;font-weight:900;line-height:1.15;text-transform:uppercase;letter-spacing:.25px}
 body.adminApproved .mgmt-card strong{display:block;font-size:16px;margin:6px 0 4px;color:#0d4d3c;line-height:1.08;overflow-wrap:anywhere}
 body.adminApproved .mgmt-card span{display:block;font-size:9px;color:#69756f;line-height:1.25}
 body.adminApproved .overview-alert{display:none!important}
 @media(max-width:1000px){body.adminApproved #stats{grid-template-columns:repeat(3,minmax(0,1fr))}body.adminApproved .mgmt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:620px){
  body.adminApproved .hero{padding:15px 16px;border-radius:19px}
  body.adminApproved .hero:before{font-size:8px;margin-bottom:6px}
  body.adminApproved .hero h1{font-size:27px}
  body.adminApproved .hero p{font-size:13px}
  body.adminApproved .hero .admin-location{display:block;margin:4px 0 0;font-size:10px}
  body.adminApproved #stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px}
  body.adminApproved #stats .stat{min-height:92px;padding:11px 12px;border-radius:14px}
  body.adminApproved #stats .stat:nth-child(5){grid-column:1/-1;min-height:82px}
  body.adminApproved #stats .stat small{font-size:9px}
  body.adminApproved #stats .stat small:last-child{font-size:8px}
  body.adminApproved #stats .stat strong{font-size:17px;margin:6px 0 4px}
  body.adminApproved #dashboard>.panel{padding:12px 10px;border-radius:16px}
  body.adminApproved #dashboard>.panel h2{font-size:20px;margin-bottom:9px}
  body.adminApproved .mgmt-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
  body.adminApproved .mgmt-card{min-height:82px;padding:10px 7px 9px 15px}
  body.adminApproved .mgmt-card small{font-size:8px}
  body.adminApproved .mgmt-card strong{font-size:14px}
  body.adminApproved .mgmt-card span{font-size:8px}
 }
 @media(max-width:360px){body.adminApproved #stats .stat strong{font-size:15px}body.adminApproved .mgmt-card strong{font-size:13px}}
 `;document.head.appendChild(s);}
 function setAdminHero(){document.body.classList.add('adminApproved');ensureStyle();if(!hero)return;const name=titleCase(user.full_name||user.employee_code||'Administrator');hero.querySelector('h1').textContent=name;hero.querySelector('p').innerHTML='System Administrator<span class="admin-location">Head Office · Sialkot</span>';}
 function card(title,value,note,loading=false){return '<div class="stat'+(loading?' loading':'')+'"><small>'+title+'</small><strong>'+value+'</strong><small>'+note+'</small></div>'}
 function render(d={},pending=[],loading=false){const latest=pending[0],receivable=Number(d.totalClientReceivable||0),payable=Number(d.totalSupplierPayable||0),purchases=Number(d.totalSupplierPurchases||0),sales=Number(d.totalClientSales||0),clientCount=Number(d.clientCount||0),supplierCount=Number(d.supplierCount||0);const val=v=>loading?'…':v;stats.innerHTML=card('Pending Approvals',val(pending.length),loading?'Updating…':(latest?'Latest: '+esc(latest.who)+' · '+esc(latest.title):'No pending requests'),loading)+card('Client Receivables',val(money(receivable)),loading?'Updating…':clientCount+' clients',loading)+card('Supplier Payables',val(money(payable)),loading?'Updating…':supplierCount+' suppliers',loading)+card('Supplier Purchases',val(money(purchases)),loading?'Updating…':'Recorded bills',loading)+card('Client Credit Sales',val(money(sales)),loading?'Updating…':'Recorded sales',loading);const net=sales-purchases;ov.innerHTML='<div class="mgmt-grid"><div class="mgmt-card collect"><small>Money to Collect</small><strong>'+val(money(receivable))+'</strong><span>'+(loading?'Updating…':'Outstanding from '+clientCount+' clients')+'</span></div><div class="mgmt-card pay"><small>Money to Pay</small><strong>'+val(money(payable))+'</strong><span>'+(loading?'Updating…':'Outstanding to '+supplierCount+' suppliers')+'</span></div><div class="mgmt-card sales"><small>Sales vs Purchases</small><strong>'+val(money(net))+'</strong><span>'+(loading?'Updating…':(net>=0?'Sales ahead of purchases':'Purchases ahead of sales'))+'</span></div><div class="mgmt-card action"><small>Action Required</small><strong>'+val(pending.length)+'</strong><span>'+(loading?'Updating…':(pending.length?'Pending approval'+(pending.length===1?'':'s'):'Nothing pending'))+'</span></div></div>'}
 function renderInstant(){try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached&&cached.d&&Array.isArray(cached.pending)){render(cached.d,cached.pending,false);return;}}catch(_){}render({},[],true);}
 async function refreshDashboard(){try{const[d,a,s]=await Promise.all([json('/api/dashboard'),json('/api/approvals?status=pending').catch(()=>({records:[]})),json('/api/salaries').catch(()=>({records:[]}))]);const general=a.records||[],salary=(s.records||[]).filter(x=>x.status==='pending');const pending=[...general.map(x=>({time:x.requested_at,title:(x.action||'Activity')+' · '+(x.module_key||''),who:x.requested_by_name||x.requested_by_code||'Employee'})),...salary.map(x=>({time:x.requested_at,title:(x.request_type==='monthly_salary'?'Monthly Salary':'Salary Advance')+' · '+money(x.amount),who:x.employee_name||x.employee_code||'Employee'}))].sort((x,y)=>new Date(y.time)-new Date(x.time));render(d,pending,false);try{localStorage.setItem(cacheKey,JSON.stringify({d,pending,ts:Date.now()}));}catch(_){}}catch(e){if(!stats.children.length){stats.innerHTML='<div class="stat"><small>Status</small><strong>Unable to load</strong></div>';ov.textContent=e.message;}}}
 function openDashboard(){setAdminHero();if(typeof closeMenu==='function')closeMenu();nav.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='dashboard'));mod.classList.add('hidden');dash.classList.remove('hidden');renderInstant();refreshDashboard();}
 document.addEventListener('click',e=>{const b=e.target.closest('#nav [data-view="dashboard"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openDashboard()},true);window.KT_OPEN_ADMIN_DASHBOARD=openDashboard;setAdminHero();
})();