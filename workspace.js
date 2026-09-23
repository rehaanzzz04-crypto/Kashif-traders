'use strict';
const $=id=>document.getElementById(id);
let model=null,currentView='dashboard';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
async function json(url,options){const r=await fetch(url,{cache:'no-store',...options}),j=await r.json().catch(()=>({}));if(r.status===401){location.replace('/company-login.html');throw new Error('Login required')}if(!r.ok)throw new Error(j.error||'Request failed');return j}
const defs={
  suppliers:{title:'Suppliers',action:'suppliers',create:'create_supplier',cols:[['supplier_code','Code'],['business_name','Business'],['contact_person','Contact'],['mobile_number','Mobile'],['opening_balance','Opening Balance']],fields:[['supplier_code','Supplier Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['opening_balance','Opening Balance','number']]},
  clients:{title:'Clients',action:'clients',create:'create_client',cols:[['client_code','Code'],['business_name','Business'],['contact_person','Contact'],['mobile_number','Mobile'],['credit_limit','Credit Limit'],['opening_balance','Opening Balance']],fields:[['client_code','Client Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['credit_limit','Credit Limit','number'],['opening_balance','Opening Balance','number']]},
  products:{title:'Products',action:'products',create:'create_product',cols:[['sku','SKU'],['barcode','Barcode'],['product_name','Product'],['unit','Unit'],['purchase_price','Purchase Price'],['sale_price','Sale Price']],fields:[['sku','SKU','text'],['barcode','Barcode','text'],['product_name','Product Name','text'],['unit','Unit','text'],['purchase_price','Purchase Price','number'],['sale_price','Sale Price','number']]},
  warehouses:{title:'Warehouses',action:'warehouses',create:'create_warehouse',cols:[['warehouse_code','Code'],['warehouse_name','Warehouse'],['address','Address']],fields:[['warehouse_code','Warehouse Code','text'],['warehouse_name','Warehouse Name','text'],['address','Address','text']]}
};
function setHeader(){
  $('companyName').textContent=model.company.name;$('companyMeta').textContent=model.company.code+' · '+model.user.full_name;
  $('accessBadge').textContent=(model.subscription.plan_name||'No Plan')+' · '+(model.subscription.access_mode==='write'?'ACTIVE':'READ ONLY');
  if(model.subscription.access_mode!=='write'){$('readOnlyNote').classList.remove('hidden');$('readOnlyNote').textContent='Subscription expired. Data dekh sakte hain, lekin renewal tak new entries blocked hain.'}
}
function dashboard(){
  $('workspaceTitle').textContent='Company Dashboard';$('workspaceSubtitle').textContent='Only '+model.company.name+' data is visible in this session';$('addRecord').classList.add('hidden');
  const s=model.stats||{};$('workspaceBody').innerHTML='<div class="stats">'+[['Suppliers',s.suppliers],['Clients',s.clients],['Products',s.products],['Warehouses',s.warehouses]].map(([k,v])=>'<div class="stat"><small>'+k+'</small><b>'+esc(v??0)+'</b></div>').join('')+'</div><div class="card subscription"><h2>Subscription</h2><div class="subgrid"><div><small>Plan</small><b>'+esc(model.subscription.plan_name||'—')+'</b></div><div><small>Expires</small><b>'+esc(String(model.subscription.expires_on||'—').slice(0,10))+'</b></div><div><small>Access</small><b>'+esc(model.subscription.access_mode)+'</b></div><div><small>Role</small><b>'+esc(model.user.role)+'</b></div></div></div>';
}
async function show(view){
  currentView=view;document.querySelectorAll('#workspaceNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='dashboard')return dashboard();
  const d=defs[view];$('workspaceTitle').textContent=d.title;$('workspaceSubtitle').textContent=model.company.name+' · '+d.title;$('addRecord').classList.toggle('hidden',model.subscription.access_mode!=='write');
  $('workspaceBody').innerHTML='<div class="card">Loading…</div>';
  const j=await json('/api/bizora-company?action='+d.action),rows=j.records||[];
  $('workspaceBody').innerHTML='<div class="card"><div class="tablewrap"><table><thead><tr>'+d.cols.map(c=>'<th>'+c[1]+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+d.cols.map(c=>'<td>'+((c[0].includes('price')||c[0].includes('balance')||c[0]==='credit_limit')?money(r[c[0]]):esc(r[c[0]]??'—'))+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+d.cols.length+'">No records yet</td></tr>')+'</tbody></table></div></div>';
}
function openForm(){
  const d=defs[currentView];if(!d)return;$('recordTitle').textContent='Add '+d.title.replace(/s$/,'');$('recordHint').textContent=model.company.name+' only';
  $('recordFields').innerHTML=d.fields.map(([name,label,type])=>'<label>'+label+'<input name="'+name+'" type="'+type+'" '+(['supplier_code','business_name','client_code','sku','product_name','warehouse_code','warehouse_name'].includes(name)?'required':'')+'></label>').join('');$('recordDialog').showModal();
}
$('workspaceNav').onclick=e=>{const b=e.target.closest('[data-view]');if(b)show(b.dataset.view).catch(err=>$('workspaceBody').innerHTML='<div class="card error">'+esc(err.message)+'</div>')};
$('addRecord').onclick=openForm;$('closeRecord').onclick=$('cancelRecord').onclick=()=>$('recordDialog').close();
$('recordForm').onsubmit=async e=>{e.preventDefault();const d=defs[currentView],btn=$('saveRecord');btn.disabled=true;btn.textContent='Saving…';try{const data=Object.fromEntries(new FormData(e.currentTarget));await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:d.create,...data})});$('recordDialog').close();e.currentTarget.reset();model=await json('/api/bizora-company?action=overview');setHeader();await show(currentView)}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Save'}};
$('companyLogout').onclick=async()=>{await fetch('/api/bizora-company-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});location.replace('/company-login.html')};
(async()=>{model=await json('/api/bizora-company?action=overview');setHeader();dashboard()})().catch(e=>{$('workspaceBody').innerHTML='<div class="card error">'+esc(e.message)+'</div>'});
