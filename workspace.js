'use strict';
const $=id=>document.getElementById(id);
let model=null,currentView='dashboard',optionCache={};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
const date=v=>v?String(v).slice(0,10):'—';
async function json(url,options){const r=await fetch(url,{cache:'no-store',...options}),j=await r.json().catch(()=>({}));if(r.status===401){location.replace('/company-login.html');throw new Error('Login required')}if(!r.ok)throw new Error(j.error||'Request failed');return j}
const defs={
  users:{title:'Users',action:'users',create:'create_user',cols:[['user_code','User ID'],['full_name','Name'],['email','Email'],['role','Role'],['active','Status']],fields:[['user_code','User ID','text'],['full_name','Full Name','text'],['email','Email','email'],['role','Role','select:company_admin,manager,accountant,salesman,cashier'],['password','Temporary Password','password']]},
  suppliers:{title:'Suppliers',action:'suppliers',create:'create_supplier',cols:[['supplier_code','Code'],['business_name','Business'],['contact_person','Contact'],['mobile_number','Mobile'],['opening_balance','Opening Balance']],fields:[['supplier_code','Supplier Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['opening_balance','Opening Balance','number']]},
  'supplier-bills':{title:'Supplier Invoices',action:'supplier_invoices',create:'create_supplier_invoice',cols:[['invoice_number','Invoice'],['business_name','Supplier'],['invoice_date','Date'],['due_date','Due'],['amount','Amount'],['status','Status']],fields:[['supplier_id','Supplier','supplier'],['invoice_number','Invoice Number','text'],['invoice_date','Invoice Date','date'],['due_date','Due Date','date'],['amount','Amount','number'],['notes','Notes','textarea']]},
  'supplier-payments':{title:'Supplier Payments',action:'supplier_payments',create:'create_supplier_payment',cols:[['payment_date','Date'],['business_name','Supplier'],['amount','Amount'],['payment_method','Method'],['reference_number','Reference']],fields:[['supplier_id','Supplier','supplier'],['payment_date','Payment Date','date'],['amount','Amount','number'],['payment_method','Method','select:CASH,BANK,ONLINE,CHEQUE,EASYPAISA,JAZZCASH'],['reference_number','Reference','text'],['notes','Notes','textarea']]},
  clients:{title:'Customers',action:'clients',create:'create_client',cols:[['client_code','Code'],['business_name','Business'],['contact_person','Contact'],['mobile_number','Mobile'],['credit_limit','Credit Limit'],['opening_balance','Opening Balance']],fields:[['client_code','Customer Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['credit_limit','Credit Limit','number'],['opening_balance','Opening Balance','number']]},
  'client-bills':{title:'Customer Invoices',action:'client_invoices',create:'create_client_invoice',cols:[['invoice_number','Invoice'],['business_name','Customer'],['invoice_date','Date'],['due_date','Due'],['amount','Amount'],['status','Status']],fields:[['client_id','Customer','client'],['invoice_number','Invoice Number','text'],['invoice_date','Invoice Date','date'],['due_date','Due Date','date'],['amount','Amount','number'],['notes','Notes','textarea']]},
  'client-payments':{title:'Customer Payments',action:'client_receipts',create:'create_client_receipt',cols:[['receipt_date','Date'],['business_name','Customer'],['amount','Amount'],['payment_method','Method'],['reference_number','Reference']],fields:[['client_id','Customer','client'],['receipt_date','Receipt Date','date'],['amount','Amount','number'],['payment_method','Method','select:CASH,BANK,ONLINE,CHEQUE,EASYPAISA,JAZZCASH'],['reference_number','Reference','text'],['notes','Notes','textarea']]},
  products:{title:'Products',action:'products',create:'create_product',cols:[['sku','SKU'],['barcode','Barcode'],['product_name','Product'],['unit','Unit'],['purchase_price','Purchase Price'],['sale_price','Sale Price']],fields:[['sku','SKU','text'],['barcode','Barcode','text'],['product_name','Product Name','text'],['unit','Unit','text'],['purchase_price','Purchase Price','number'],['sale_price','Sale Price','number']]},
  warehouses:{title:'Warehouses',action:'warehouses',create:'create_warehouse',cols:[['warehouse_code','Code'],['warehouse_name','Warehouse'],['address','Address']],fields:[['warehouse_code','Warehouse Code','text'],['warehouse_name','Warehouse Name','text'],['address','Address','text']]}
};
function isMoney(key){return /price|amount|balance|credit_limit/.test(key)}
function setHeader(){
  $('navCompany').textContent=model.company.name;
  $('accessBadge').textContent=(model.subscription.plan_name||'No Plan')+' · '+(model.subscription.access_mode==='write'?'ACTIVE':'READ ONLY');
  $('usersNav').classList.toggle('hidden',model.user.role!=='company_admin');
  if(model.subscription.access_mode!=='write'){$('readOnlyNote').classList.remove('hidden');$('readOnlyNote').textContent='Subscription expired. Data dekh sakte hain, lekin renewal tak new entries blocked hain.'}
}
function dashboard(){
  $('workspaceTitle').textContent=model.company.name;
  $('workspaceSubtitle').innerHTML='<span class="dashboardPill">Dashboard</span><span class="ownerChip"><span class="ownerAvatar">'+esc((model.user.full_name||'O').trim().charAt(0).toUpperCase())+'</span><span><small>Company Owner</small><b>'+esc(model.user.full_name)+'</b></span></span>';
  $('addRecord').classList.add('hidden');
  const s=model.stats||{};const icon=(k)=>({Users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6"/><circle cx="17" cy="9" r="2"/><path d="M15 14c4 0 6 2 6 6"/></svg>',Suppliers:'<svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',Customers:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></svg>',Products:'<svg viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>',Warehouses:'<svg viewBox="0 0 24 24"><path d="M3 10l9-7 9 7v11H3zM8 21v-7h8v7"/></svg>','Supplier Payable':'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5zM8 9h8M8 13h5"/><path d="M16 14c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2M16 13v10"/></svg>','Customer Receivable':'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5zM8 9h8M8 13h5"/><path d="M16 14c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2M16 13v10"/></svg>'}[k]||'');const items=[['Users',s.users],['Suppliers',s.suppliers],['Customers',s.clients],['Products',s.products],['Warehouses',s.warehouses],['Supplier Payable',money(s.supplier_payable)],['Customer Receivable',money(s.client_receivable)]];$('workspaceBody').innerHTML='<div class="stats">'+items.map(([k,v],i)=>'<div class="stat '+(i===6?'wide':'')+'"><span class="statIcon">'+icon(k)+'</span><small>'+k+'</small><b>'+esc(v??0)+'</b><span class="statChevron">›</span></div>').join('')+'</div><div class="card subscription"><h2>Subscription</h2><div class="subgrid"><div><small>Plan</small><b>'+esc(model.subscription.plan_name||'—')+'</b></div><div><small>Expires</small><b>'+date(model.subscription.expires_on)+'</b></div><div><small>Access</small><b>'+esc(model.subscription.access_mode)+'</b></div><div><small>Role</small><b>'+esc(model.user.role)+'</b></div><div><small>User Limit</small><b>'+esc(model.limits.user_limit??'Unlimited')+'</b></div><div><small>Warehouse Limit</small><b>'+esc(model.limits.warehouse_limit??'Unlimited')+'</b></div></div></div>';
}
function cell(key,value){
  if(key==='active')return value?'<span class="pill active">Active</span>':'<span class="pill inactive">Inactive</span>';
  if(key==='status')return '<span class="pill '+esc(String(value||'').toLowerCase())+'">'+esc(value??'—')+'</span>';
  if(/_date$|due_date/.test(key))return esc(date(value));
  return isMoney(key)?esc(money(value)):esc(value??'—');
}
async function show(view){
  currentView=view;document.querySelectorAll('#workspaceNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='dashboard')return dashboard();
  if(view==='users'&&model.user.role!=='company_admin')return dashboard();
  const d=defs[view];$('workspaceTitle').textContent=d.title;$('workspaceSubtitle').textContent=model.company.name+' · '+d.title;$('addRecord').classList.toggle('hidden',model.subscription.access_mode!=='write');
  $('workspaceBody').innerHTML='<div class="card">Loading…</div>';
  const j=await json('/api/bizora-company?action='+d.action),rows=j.records||[];optionCache[view]=rows;
  const userActions=view==='users'?'<th>Action</th>':'';
  $('workspaceBody').innerHTML='<div class="card">'+(view==='users'&&j.limit?'<p class="limitnote">Plan user limit: '+esc(j.limit)+' active users</p>':'')+'<div class="tablewrap"><table><thead><tr>'+d.cols.map(c=>'<th>'+c[1]+'</th>').join('')+userActions+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+d.cols.map(c=>'<td>'+cell(c[0],r[c[0]])+'</td>').join('')+(view==='users'?'<td><button class="secondary userStatusBtn" data-id="'+r.id+'" data-active="'+(r.active?'0':'1')+'">'+(r.active?'Deactivate':'Activate')+'</button></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(d.cols.length+(view==='users'?1:0))+'">No records yet</td></tr>')+'</tbody></table></div></div>';
  if(view==='users')document.querySelectorAll('.userStatusBtn').forEach(b=>b.onclick=()=>setUserStatus(Number(b.dataset.id),b.dataset.active==='1'));
}
async function partyOptions(kind){
  const action=kind==='supplier'?'suppliers':'clients';
  if(!optionCache[action])optionCache[action]=(await json('/api/bizora-company?action='+action)).records||[];
  return optionCache[action].map(r=>({value:r.id,label:r.business_name+' · '+(r[kind+'_code']||'')}));
}
async function renderField([name,label,type]){
  const required=['user_code','full_name','password','supplier_code','business_name','client_code','sku','product_name','warehouse_code','warehouse_name','supplier_id','client_id','invoice_number','amount'].includes(name)?' required':'';
  const today=new Date().toISOString().slice(0,10);
  if(type==='supplier'||type==='client'){const opts=await partyOptions(type);return '<label>'+label+'<select name="'+name+'"'+required+'><option value="">Select '+label+'</option>'+opts.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label>'}
  if(type.startsWith('select:')){const opts=type.slice(7).split(',');return '<label>'+label+'<select name="'+name+'"'+required+'>'+opts.map(o=>'<option value="'+esc(o)+'">'+esc(o.replaceAll('_',' '))+'</option>').join('')+'</select></label>'}
  if(type==='textarea')return '<label>'+label+'<textarea name="'+name+'"></textarea></label>';
  const value=type==='date'?' value="'+today+'"':'';
  const min=type==='number'?' min="0" step="0.01"':'';
  const minlength=type==='password'?' minlength="8"':'';
  return '<label>'+label+'<input name="'+name+'" type="'+type+'"'+value+min+minlength+required+'></label>';
}
async function openForm(){
  const d=defs[currentView];if(!d)return;$('recordTitle').textContent='Add '+d.title.replace(/s$/,'');$('recordHint').textContent=model.company.name+' only';
  const parts=[];for(const f of d.fields)parts.push(await renderField(f));$('recordFields').innerHTML=parts.join('');$('recordDialog').showModal();
}
async function setUserStatus(id,active){
  if(!confirm((active?'Activate':'Deactivate')+' this user?'))return;
  try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_user_status',user_id:id,active})});await show('users');model=await json('/api/bizora-company?action=overview');setHeader()}catch(e){alert(e.message)}
}
const openMenu=()=>{$('workspaceNav').classList.add('open');$('navBackdrop').classList.add('open');document.body.classList.add('menu-open');$('workspaceNav').setAttribute('aria-hidden','false');$('menuToggle').setAttribute('aria-expanded','true')};
const closeMenu=()=>{$('workspaceNav').classList.remove('open');$('navBackdrop').classList.remove('open');document.body.classList.remove('menu-open');$('workspaceNav').setAttribute('aria-hidden','true');$('menuToggle').setAttribute('aria-expanded','false')};
$('menuToggle').onclick=openMenu;$('closeMenu').onclick=closeMenu;$('navBackdrop').onclick=closeMenu;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
$('workspaceNav').onclick=e=>{const b=e.target.closest('[data-view]');if(b){closeMenu();show(b.dataset.view).catch(err=>$('workspaceBody').innerHTML='<div class="card error">'+esc(err.message)+'</div>')}};
$('addRecord').onclick=()=>openForm().catch(err=>alert(err.message));$('closeRecord').onclick=$('cancelRecord').onclick=()=>$('recordDialog').close();
$('recordForm').onsubmit=async e=>{e.preventDefault();const d=defs[currentView],btn=$('saveRecord');btn.disabled=true;btn.textContent='Saving…';try{const data=Object.fromEntries(new FormData(e.currentTarget));await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:d.create,...data})});$('recordDialog').close();e.currentTarget.reset();optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await show(currentView)}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Save'}};
$('companyLogout').onclick=async()=>{await fetch('/api/bizora-company-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});location.replace('/company-login.html')};
(async()=>{model=await json('/api/bizora-company?action=overview');setHeader();dashboard()})().catch(e=>{$('workspaceBody').innerHTML='<div class="card error">'+esc(e.message)+'</div>'});
