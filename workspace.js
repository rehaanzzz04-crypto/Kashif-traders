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
  warehouses:{title:'Warehouses',action:'warehouses',create:'create_warehouse',cols:[['warehouse_code','Code'],['warehouse_name','Warehouse'],['address','Address']],fields:[['warehouse_code','Warehouse Code','text'],['warehouse_name','Warehouse Name','text'],['address','Address','text']]},
  grns:{title:'Goods Receiving (GRN)',action:'grns',create:'create_grn',cols:[['grn_number','GRN'],['received_date','Date'],['supplier_name','Supplier'],['supplier_invoice_number','Supplier Invoice'],['warehouse_name','Warehouse'],['item_count','Items'],['total_quantity','Quantity'],['status','Status']],fields:[['supplier_id','Supplier','supplier'],['supplier_invoice_id','Supplier Invoice','supplier_invoice'],['warehouse_id','Warehouse','warehouse'],['product_id','Product','product'],['quantity','Quantity','number'],['unit_cost','Unit Cost','number'],['received_date','Received Date','date'],['notes','Notes','textarea']]},
  'inventory-stock':{title:'Warehouse Stock',action:'inventory_stock',cols:[['warehouse_name','Warehouse'],['sku','SKU'],['product_name','Product'],['unit','Unit'],['quantity','Quantity'],['stock_value','Stock Value']]},
  'inventory-ledger':{title:'Inventory Ledger',action:'inventory_ledger',cols:[['movement_date','Date / Time'],['movement_type','Type'],['warehouse_name','Warehouse'],['sku','SKU'],['product_name','Product'],['qty_in','Qty In'],['qty_out','Qty Out'],['unit_cost','Unit Cost'],['reference_number','Reference']]}
};
function isMoney(key){return /price|amount|balance|credit_limit/.test(key)}
const featureOn=key=>model?.subscription?.features?.[key]===true;
const viewFeatures={users:'core_erp',suppliers:'supplier_management','supplier-bills':'supplier_management','supplier-payments':'supplier_management',clients:'customer_management','client-bills':'customer_management','client-payments':'customer_management',products:'products',warehouses:'warehouses',grns:'grn','inventory-stock':'inventory_ledger','inventory-ledger':'inventory_ledger'};
function setHeader(){
  $('navCompany').textContent=model.company.name;
  $('accessBadge').textContent=(model.subscription.plan_name||'No Plan')+' · '+(model.subscription.access_mode==='write'?'ACTIVE':'READ ONLY');
  document.querySelectorAll('#workspaceNav [data-feature]').forEach(el=>el.classList.toggle('hidden',!featureOn(el.dataset.feature)));
  $('usersNav').classList.toggle('hidden',model.user.role!=='company_admin'||!featureOn('core_erp'));
  if(model.subscription.access_mode!=='write'){$('readOnlyNote').classList.remove('hidden');$('readOnlyNote').textContent='Subscription expired. Data dekh sakte hain, lekin renewal tak new entries blocked hain.'}
  else $('readOnlyNote').classList.add('hidden');
}
function dashboard(){
  $('workspaceTitle').textContent=model.company.name;
  $('workspaceSubtitle').innerHTML='<span class="dashboardPill">Dashboard</span><span class="ownerChip"><span class="ownerAvatar">'+esc((model.user.full_name||'O').trim().charAt(0).toUpperCase())+'</span><span><small>Company Owner</small><b>'+esc(model.user.full_name)+'</b></span></span>';
  $('addRecord').classList.add('hidden');
  const s=model.stats||{};
  const icon=(k)=>({Users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6"/><circle cx="17" cy="9" r="2"/><path d="M15 14c4 0 6 2 6 6"/></svg>',Suppliers:'<svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',Customers:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></svg>',Products:'<svg viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>',Warehouses:'<svg viewBox="0 0 24 24"><path d="M3 10l9-7 9 7v11H3zM8 21v-7h8v7"/></svg>','Supplier Payable':'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5zM8 9h8M8 13h5"/><path d="M16 14c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2M16 13v10"/></svg>','Customer Receivable':'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5zM8 9h8M8 13h5"/><path d="M16 14c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2M16 13v10"/></svg>'}[k]||'');
  const items=[['Users',s.users],['Suppliers',s.suppliers],['Customers',s.clients],['Products',s.products],['Warehouses',s.warehouses],['Supplier Payable',money(s.supplier_payable)],['Customer Receivable',money(s.client_receivable)]];
  const featureLabels=[
    ['core_erp','Core ERP'],['basic_reports','Basic Reports'],['inventory_ledger','Inventory Ledger'],['grn','Goods Receiving (GRN)'],
    ['audit_reports','Audit Reports'],['advanced_reports','Advanced Reports'],['cashier','Cashier / Counter Sale'],
    ['ecommerce','E-commerce'],['ocr','OCR Automation'],['automation','Workflow Automation']
  ];
  const featureHtml=featureLabels.map(([key,label])=>'<div class="featureItem '+(featureOn(key)?'included':'locked')+'"><span class="featureState">'+(featureOn(key)?'✓':'🔒')+'</span><span><b>'+esc(label)+'</b><small>'+(featureOn(key)?'Included in '+esc(model.subscription.plan_name||'plan'):'Upgrade required')+'</small></span></div>').join('');
  $('workspaceBody').innerHTML=
    '<div class="stats">'+items.map(([k,v],i)=>'<div class="stat '+(i===6?'wide':'')+'"><span class="statIcon">'+icon(k)+'</span><small>'+k+'</small><b>'+esc(v??0)+'</b><span class="statChevron">›</span></div>').join('')+'</div>'+
    '<div class="card subscription"><h2>Subscription</h2><div class="subgrid"><div><small>Plan</small><b>'+esc(model.subscription.plan_name||'—')+'</b></div><div><small>Expires</small><b>'+date(model.subscription.expires_on)+'</b></div><div><small>Access</small><b>'+esc(model.subscription.access_mode)+'</b></div><div><small>Role</small><b>'+esc(model.user.role)+'</b></div><div><small>User Limit</small><b>'+esc(model.limits.user_limit??'Unlimited')+'</b></div><div><small>Warehouse Limit</small><b>'+esc(model.limits.warehouse_limit??'Unlimited')+'</b></div></div></div>'+
    '<div class="card capabilityCard"><div class="capHead"><div><span class="capEyebrow">SUBSCRIPTION ACCESS</span><h2>'+esc(model.subscription.plan_name||'Plan')+' Features</h2></div><span class="planBadge">'+esc(model.subscription.plan_name||'No Plan')+'</span></div><div class="featureGrid">'+featureHtml+'</div></div>';
}
function cell(key,value){
  if(key==='active')return value?'<span class="pill active">Active</span>':'<span class="pill inactive">Inactive</span>';
  if(key==='status')return '<span class="pill '+esc(String(value||'').toLowerCase())+'">'+esc(value??'—')+'</span>';
  if(key==='movement_date')return value?esc(new Date(value).toLocaleString('en-GB')):'—';
  if(/_date$|due_date/.test(key))return esc(date(value));
  return isMoney(key)?esc(money(value)):esc(value??'—');
}
async function show(view){
  currentView=view;document.querySelectorAll('#workspaceNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='dashboard')return dashboard();
  if(view==='users'&&model.user.role!=='company_admin')return dashboard();
  const needed=viewFeatures[view];
  if(needed&&!featureOn(needed)){
    $('workspaceTitle').textContent='Upgrade Required';
    $('workspaceSubtitle').textContent=(model.subscription.plan_name||'Current plan')+' does not include this module';
    $('addRecord').classList.add('hidden');
    $('workspaceBody').innerHTML='<div class="card upgradeCard"><h2>Module not included</h2><p>This feature is not available in the current '+esc(model.subscription.plan_name||'subscription')+' plan.</p></div>';
    return;
  }
  const d=defs[view];$('workspaceTitle').textContent=d.title;$('workspaceSubtitle').textContent=model.company.name+' · '+d.title;$('addRecord').classList.toggle('hidden',model.subscription.access_mode!=='write'||!d.create);
  $('workspaceBody').innerHTML='<div class="card">Loading…</div>';
  const j=await json('/api/bizora-company?action='+d.action),rows=j.records||[];optionCache[view]=rows;
  const userActions=view==='users'?'<th>Action</th>':'';
  $('workspaceBody').innerHTML='<div class="card">'+(view==='users'&&j.limit?'<p class="limitnote">Plan user limit: '+esc(j.limit)+' active users</p>':'')+'<div class="tablewrap"><table><thead><tr>'+d.cols.map(c=>'<th>'+c[1]+'</th>').join('')+userActions+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+d.cols.map(c=>'<td>'+cell(c[0],r[c[0]])+'</td>').join('')+(view==='users'?'<td><button class="secondary userStatusBtn" data-id="'+r.id+'" data-active="'+(r.active?'0':'1')+'">'+(r.active?'Deactivate':'Activate')+'</button></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(d.cols.length+(view==='users'?1:0))+'">No records yet</td></tr>')+'</tbody></table></div></div>';
  if(view==='users')document.querySelectorAll('.userStatusBtn').forEach(b=>b.onclick=()=>setUserStatus(Number(b.dataset.id),b.dataset.active==='1'));
}
async function partyOptions(kind){
  const actionMap={supplier:'suppliers',client:'clients',product:'products',warehouse:'warehouses',supplier_invoice:'supplier_invoices'};
  const action=actionMap[kind];
  if(!optionCache[action])optionCache[action]=(await json('/api/bizora-company?action='+action)).records||[];
  return optionCache[action].map(r=>{
    if(kind==='supplier')return {value:r.id,label:r.business_name+' · '+(r.supplier_code||'')};
    if(kind==='client')return {value:r.id,label:r.business_name+' · '+(r.client_code||'')};
    if(kind==='product')return {value:r.id,label:r.product_name+' · '+(r.sku||'')};
    if(kind==='warehouse')return {value:r.id,label:r.warehouse_name+' · '+(r.warehouse_code||'')};
    if(kind==='supplier_invoice')return {value:r.id,label:(r.invoice_number||'Invoice')+' · '+(r.business_name||'')+' · '+(r.grn_status||'')};
    return {value:r.id,label:String(r.id)};
  });
}
async function renderField([name,label,type]){
  const required=['user_code','full_name','password','supplier_code','business_name','client_code','sku','product_name','warehouse_code','warehouse_name','supplier_id','client_id','invoice_number','amount','warehouse_id','product_id','quantity','unit_cost'].includes(name)?' required':'';
  const today=new Date().toISOString().slice(0,10);
  if(['supplier','client','product','warehouse','supplier_invoice'].includes(type)){const opts=await partyOptions(type);return '<label>'+label+'<select name="'+name+'"'+required+'><option value="">Select '+label+'</option>'+opts.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label>'}
  if(type.startsWith('select:')){const opts=type.slice(7).split(',');return '<label>'+label+'<select name="'+name+'"'+required+'>'+opts.map(o=>'<option value="'+esc(o)+'">'+esc(o.replaceAll('_',' '))+'</option>').join('')+'</select></label>'}
  if(type==='textarea')return '<label>'+label+'<textarea name="'+name+'"></textarea></label>';
  const value=type==='date'?' value="'+today+'"':'';
  const min=type==='number'?' min="0" step="0.01"':'';
  const minlength=type==='password'?' minlength="8"':'';
  return '<label>'+label+'<input name="'+name+'" type="'+type+'"'+value+min+minlength+required+'></label>';
}
function productOptionsHtml(products){
  return '<option value="">Select Product</option>'+products.map(p=>'<option value="'+p.id+'" data-price="'+Number(p.purchase_price||0)+'">'+esc(p.product_name)+' · '+esc(p.sku||'')+'</option>').join('');
}
function supplierInvoiceItemRow(products){
  return '<div class="lineItem invoiceLine">'+
    '<label>Product<select class="lineProduct" required>'+productOptionsHtml(products)+'</select></label>'+
    '<label>Quantity<input class="lineQty" type="number" min="0.001" step="0.001" value="1" required></label>'+
    '<label>Purchase Price<input class="linePrice" type="number" min="0" step="0.01" value="0" required></label>'+
    '<label>Description<input class="lineDescription" type="text" placeholder="Optional"></label>'+
    '<button type="button" class="removeLine secondary">×</button>'+
  '</div>';
}
function wireInvoiceLines(products){
  const holder=$('invoiceItems');
  holder.onclick=e=>{if(e.target.closest('.removeLine')){const rows=holder.querySelectorAll('.invoiceLine');if(rows.length>1)e.target.closest('.invoiceLine').remove();updateInvoiceTotal()}};
  holder.onchange=e=>{if(e.target.classList.contains('lineProduct')){const opt=e.target.selectedOptions[0],row=e.target.closest('.invoiceLine');if(opt?.dataset.price!==undefined)row.querySelector('.linePrice').value=Number(opt.dataset.price||0);updateInvoiceTotal()}};
  holder.oninput=updateInvoiceTotal;
  $('addInvoiceLine').onclick=()=>{holder.insertAdjacentHTML('beforeend',supplierInvoiceItemRow(products));updateInvoiceTotal()};
}
function updateInvoiceTotal(){
  const rows=[...document.querySelectorAll('#invoiceItems .invoiceLine')];
  const total=rows.reduce((n,row)=>n+Number(row.querySelector('.lineQty')?.value||0)*Number(row.querySelector('.linePrice')?.value||0),0);
  const el=$('invoiceTotal');if(el)el.textContent=money(total);
}
async function openSupplierInvoiceForm(){
  const [suppliers,products]=await Promise.all([partyOptions('supplier'),partyOptions('product').then(async()=>optionCache.products||[])]);
  const today=new Date().toISOString().slice(0,10),productRows=optionCache.products||[];
  $('recordTitle').textContent='Add Supplier Invoice';
  $('recordHint').textContent='Product-wise invoice · '+model.company.name;
  $('recordFields').innerHTML=
    '<div class="formGrid">'+
      '<label>Supplier<select name="supplier_id" required><option value="">Select Supplier</option>'+suppliers.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label>'+
      '<label>Invoice Number<input name="invoice_number" required></label>'+
      '<label>Invoice Date<input name="invoice_date" type="date" value="'+today+'" required></label>'+
      '<label>Due Date<input name="due_date" type="date" value="'+today+'"></label>'+
    '</div>'+
    '<div class="lineHead"><div><b>Invoice Products</b><small>Add one or more products</small></div><button id="addInvoiceLine" type="button" class="secondary">+ Add Product</button></div>'+
    '<div id="invoiceItems" class="lineItems">'+supplierInvoiceItemRow(productRows)+'</div>'+
    '<div class="invoiceTotalBox"><span>Invoice Total</span><b id="invoiceTotal">PKR 0</b></div>'+
    '<label>Notes<textarea name="notes"></textarea></label>';
  wireInvoiceLines(productRows);updateInvoiceTotal();$('recordDialog').showModal();
}
async function openGrnForm(){
  if(!optionCache.supplier_invoices)optionCache.supplier_invoices=(await json('/api/bizora-company?action=supplier_invoices')).records||[];
  const invoices=optionCache.supplier_invoices.filter(x=>['pending','partial'].includes(x.grn_status));
  const warehouses=await partyOptions('warehouse'),today=new Date().toISOString().slice(0,10);
  $('recordTitle').textContent='Post Goods Receiving';
  $('recordHint').textContent='Only pending / partially received invoices are shown';
  $('recordFields').innerHTML=
    '<div class="formGrid">'+
      '<label>Supplier Invoice<select name="supplier_invoice_id" id="grnInvoice" required><option value="">Select pending invoice</option>'+invoices.map(x=>'<option value="'+x.id+'">'+esc(x.invoice_number)+' · '+esc(x.business_name)+' · '+esc(x.grn_status)+'</option>').join('')+'</select></label>'+
      '<label>Warehouse<select name="warehouse_id" required><option value="">Select Warehouse</option>'+warehouses.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label>'+
      '<label>Received Date<input name="received_date" type="date" value="'+today+'" required></label>'+
    '</div>'+
    '<div class="lineHead"><div><b>Receive Products</b><small>Enter quantity received now</small></div></div>'+
    '<div id="grnItems" class="lineItems"><div class="emptyLines">Select supplier invoice to load pending products.</div></div>'+
    '<label>Notes<textarea name="notes"></textarea></label>';
  $('grnInvoice').onchange=async e=>{
    const id=Number(e.target.value||0),holder=$('grnItems');if(!id){holder.innerHTML='<div class="emptyLines">Select supplier invoice to load pending products.</div>';return}
    holder.innerHTML='<div class="emptyLines">Loading products…</div>';
    const data=await json('/api/bizora-company?action=supplier_invoice_items&invoice_id='+id),items=(data.records||[]).filter(x=>Number(x.remaining_quantity)>0);
    holder.innerHTML=items.length?items.map(x=>'<div class="lineItem grnLine" data-item-id="'+x.id+'" data-product-id="'+x.product_id+'" data-ordered="'+Number(x.quantity)+'" data-cost="'+Number(x.unit_price||0)+'">'+
      '<div class="lineProductName"><b>'+esc(x.product_name)+'</b><small>'+esc(x.sku||'')+' · Ordered '+esc(x.quantity)+' · Received '+esc(x.received_quantity)+' · Remaining '+esc(x.remaining_quantity)+'</small></div>'+
      '<label>Receive Now<input class="grnQty" type="number" min="0" max="'+Number(x.remaining_quantity)+'" step="0.001" value="'+Number(x.remaining_quantity)+'"></label>'+
      '<label>Rejected<input class="grnRejected" type="number" min="0" step="0.001" value="0"></label>'+
      '<label>Unit Cost<input class="grnCost" type="number" min="0" step="0.01" value="'+Number(x.unit_price||0)+'"></label>'+
      '<label>Batch<input class="grnBatch" type="text"></label>'+
      '<label>Expiry<input class="grnExpiry" type="date"></label>'+
    '</div>').join(''):'<div class="emptyLines">This invoice has no pending products.</div>';
  };
  $('recordDialog').showModal();
}
async function openForm(){
  const d=defs[currentView];if(!d)return;
  if(currentView==='supplier-bills')return openSupplierInvoiceForm();
  if(currentView==='grns')return openGrnForm();
  $('recordTitle').textContent='Add '+d.title.replace(/s$/,'');$('recordHint').textContent=model.company.name+' only';
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
$('recordForm').onsubmit=async e=>{e.preventDefault();const d=defs[currentView],btn=$('saveRecord');btn.disabled=true;btn.textContent='Saving…';try{
  const data=Object.fromEntries(new FormData(e.currentTarget));
  if(currentView==='supplier-bills'){
    data.items=[...document.querySelectorAll('#invoiceItems .invoiceLine')].map(row=>({
      product_id:Number(row.querySelector('.lineProduct').value||0),
      quantity:Number(row.querySelector('.lineQty').value||0),
      unit_price:Number(row.querySelector('.linePrice').value||0),
      description:row.querySelector('.lineDescription').value||''
    }));
    if(!data.items.length||data.items.some(x=>!x.product_id||x.quantity<=0||x.unit_price<0))throw new Error('Valid invoice products required');
  }
  if(currentView==='grns'){
    data.items=[...document.querySelectorAll('#grnItems .grnLine')].map(row=>({
      supplier_invoice_item_id:Number(row.dataset.itemId),
      product_id:Number(row.dataset.productId),
      ordered_qty:Number(row.dataset.ordered),
      received_qty:Number(row.querySelector('.grnQty').value||0),
      rejected_qty:Number(row.querySelector('.grnRejected').value||0),
      unit_cost:Number(row.querySelector('.grnCost').value||0),
      batch_no:row.querySelector('.grnBatch').value||'',
      expiry_date:row.querySelector('.grnExpiry').value||''
    })).filter(x=>x.received_qty>0);
    if(!data.items.length)throw new Error('At least one received product quantity is required');
  }
  await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:d.create,...data})});
  $('recordDialog').close();e.currentTarget.reset();optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await show(currentView)
}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Save'}};
$('companyLogout').onclick=async()=>{await fetch('/api/bizora-company-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});location.replace('/company-login.html')};
(async()=>{model=await json('/api/bizora-company?action=overview');setHeader();dashboard()})().catch(e=>{$('workspaceBody').innerHTML='<div class="card error">'+esc(e.message)+'</div>'});
