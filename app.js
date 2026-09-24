'use strict';
const $=id=>document.getElementById(id);
let model={stats:{},companies:[],plans:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const date=v=>v?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v)):'—';
const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
function message(text,bad=false){const el=$('systemMessage');el.textContent=text;el.className='systemmessage '+(bad?'bad':'good');setTimeout(()=>el.classList.add('hidden'),3500)}
async function json(url,options){const r=await fetch(url,{cache:'no-store',...options}),j=await r.json().catch(()=>({}));if(r.status===401){location.replace('/login.html');throw new Error('Login required')}if(!r.ok)throw new Error(j.error||'Request failed');return j}
function planOptions(selected=''){return model.plans.filter(x=>x.active).map(p=>'<option value="'+esc(p.plan_code)+'" '+(p.plan_code===selected?'selected':'')+'>'+esc(p.plan_name)+'</option>').join('')}
function planFeatureList(p){
  const f=p.features||{},labels=[
    ['core_erp','Core ERP'],['basic_reports','Basic reports'],['inventory_ledger','Inventory ledger'],['grn','GRN'],
    ['audit_reports','Audit reports'],['advanced_reports','Advanced reports'],['cashier','Cashier'],['ecommerce','E-commerce'],
    ['ocr','OCR'],['automation','Automation']
  ];
  return labels.filter(([k])=>f[k]===true).map(([,v])=>v);
}
function render(){
  const s=model.stats||{};
  $('stats').innerHTML=[['Companies',s.companies??0,'▦'],['Active Companies',s.active_companies??0,'▥'],['Active Subscriptions',s.active_subscriptions??0,'◉'],['Expiring ≤14 Days',s.expiring_14_days??0,'◷']].map(([k,v,i])=>'<div class="stat" data-icon="'+i+'"><small>'+k+'</small><b>'+esc(v)+'</b></div>').join('');
  const q=($('companySearch').value||'').trim().toLowerCase(),rows=model.companies.filter(x=>!q||[x.company_name,x.company_code,x.plan_name].join(' ').toLowerCase().includes(q));
  $('companyRows').innerHTML=rows.length?rows.map(x=>'<tr><td data-label="Company"><b>'+esc(x.company_name)+'</b></td><td data-label="Code">'+esc(x.company_code)+'</td><td data-label="Plan">'+esc(x.plan_name||'—')+'</td><td data-label="Status"><span class="pill '+esc(x.status)+'">'+esc(x.status)+'</span></td><td data-label="Expiry">'+date(x.expires_on)+'</td><td data-label="Actions"><div class="rowactions"><button class="secondary renew" data-id="'+x.id+'">Renew</button><button class="secondary status" data-id="'+x.id+'" data-status="'+(x.status==='suspended'?'active':'suspended')+'">'+(x.status==='suspended'?'Activate':'Suspend')+'</button></div></td></tr>').join(''):'<tr><td colspan="6">No companies</td></tr>';
  $('plans').innerHTML=model.plans.map(p=>{const features=planFeatureList(p);return '<div class="plan"><b><span>'+esc(p.plan_name)+'</span><span>'+money(p.monthly_price)+'/mo</span></b><small>'+esc(p.user_limit??'Unlimited')+' users · '+esc(p.warehouse_limit??'Unlimited')+' warehouses</small><div class="planFeatures">'+features.map(x=>'<span>✓ '+esc(x)+'</span>').join('')+'</div></div>'}).join('');
  $('planSelect').innerHTML=planOptions('standard');$('renewPlan').innerHTML=planOptions('standard');
  document.querySelectorAll('.renew').forEach(b=>b.onclick=()=>{const c=model.companies.find(x=>String(x.id)===b.dataset.id);$('renewForm').elements.company_id.value=c.id;$('renewCompanyName').textContent=c.company_name;$('renewPlan').innerHTML=planOptions(c.plan_code||'standard');$('renewDialog').showModal()});
  document.querySelectorAll('.status').forEach(b=>b.onclick=()=>setStatus(Number(b.dataset.id),b.dataset.status));
}
async function load(){
  const me=await json('/api/bizora-auth?action=me');$('adminBadge').textContent=me.user.full_name||me.user.email;
  model=await json('/api/bizora-admin?action=overview');render();
}
async function setStatus(id,status){if(!confirm((status==='suspended'?'Suspend':'Activate')+' this company?'))return;try{await json('/api/bizora-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_company_status',company_id:id,status})});message('Company status updated');model=await json('/api/bizora-admin?action=overview');render()}catch(e){message(e.message,true)}}
$('companySearch').oninput=render;$('addCompany').onclick=()=>$('companyDialog').showModal();$('closeCompany').onclick=$('cancelCompany').onclick=()=>$('companyDialog').close();$('closeRenew').onclick=$('cancelRenew').onclick=()=>$('renewDialog').close();
$('companyForm').onsubmit=async e=>{e.preventDefault();const btn=$('createCompany');btn.disabled=true;btn.textContent='Creating…';try{const body=Object.fromEntries(new FormData(e.currentTarget));const created=await json('/api/bizora-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_company',...body})});$('companyDialog').close();e.currentTarget.reset();message('Company created · Code '+(created.company?.company_code||''));model=await json('/api/bizora-admin?action=overview');render()}catch(err){message(err.message,true)}finally{btn.disabled=false;btn.textContent='Create Company'}};
$('renewForm').onsubmit=async e=>{e.preventDefault();const btn=$('renewBtn');btn.disabled=true;btn.textContent='Renewing…';try{const body=Object.fromEntries(new FormData(e.currentTarget));await json('/api/bizora-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'renew_subscription',...body})});$('renewDialog').close();message('Subscription renewed');model=await json('/api/bizora-admin?action=overview');render()}catch(err){message(err.message,true)}finally{btn.disabled=false;btn.textContent='Renew'}};
$('logout').onclick=async()=>{await fetch('/api/bizora-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});location.replace('/login.html')};
load().catch(e=>{message(e.message,true);if(/database|SESSION_SECRET/i.test(e.message))$('companyRows').innerHTML='<tr><td colspan="6">Bizora backend configuration pending.</td></tr>'});

const openAdminMenu=()=>{$('adminNav').classList.add('open');$('adminNavBackdrop').classList.add('open');document.body.classList.add('menu-open');$('adminMenuToggle').setAttribute('aria-expanded','true')};
const closeAdminMenu=()=>{$('adminNav').classList.remove('open');$('adminNavBackdrop').classList.remove('open');document.body.classList.remove('menu-open');$('adminMenuToggle').setAttribute('aria-expanded','false')};
$('adminMenuToggle').onclick=openAdminMenu;$('adminMenuClose').onclick=closeAdminMenu;$('adminNavBackdrop').onclick=closeAdminMenu;
document.querySelectorAll('#adminNav [data-scroll]').forEach(b=>b.onclick=()=>{closeAdminMenu();document.getElementById(b.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'})});
