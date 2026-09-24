'use strict';
const $=id=>document.getElementById(id);
let model=null,currentView='dashboard',optionCache={},invoiceEditContext=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
const date=v=>v?String(v).slice(0,10):'—';
async function json(url,options){const r=await fetch(url,{cache:'no-store',...options}),j=await r.json().catch(()=>({}));if(r.status===401){location.replace('/company-login.html');throw new Error('Login required')}if(!r.ok)throw new Error(j.error||'Request failed');return j}
const defs={
  users:{title:'Users',action:'users',create:'create_user',cols:[['user_code','User ID'],['full_name','Name'],['email','Email'],['role','Role'],['active','Status']],fields:[['user_code','User ID','text'],['full_name','Full Name','text'],['email','Email','email'],['role','Role','select:company_admin,manager,accountant,salesman,cashier'],['password','Temporary Password','password']]},
  suppliers:{title:'Suppliers',action:'suppliers',create:'create_supplier',cols:[['supplier_code','Code'],['business_name','Business'],['contact_person','Contact'],['mobile_number','Mobile'],['opening_balance','Opening Balance'],['status','Status']],fields:[['supplier_code','Supplier Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['opening_balance','Opening Balance','number']]},
  'supplier-bills':{title:'Supplier Invoices',action:'supplier_invoices',create:'create_supplier_invoice',cols:[['invoice_number','Invoice'],['business_name','Supplier'],['invoice_date','Date'],['due_date','Due'],['amount','Amount'],['grn_status','GRN Status'],['status','Payment Status']],fields:[['supplier_id','Supplier','supplier'],['invoice_number','Invoice Number','text'],['invoice_date','Invoice Date','date'],['due_date','Due Date','date'],['amount','Amount','number'],['notes','Notes','textarea']]},
  'supplier-payments':{title:'Supplier Payments',action:'supplier_payments',create:'create_supplier_payment',cols:[['payment_date','Date'],['business_name','Supplier'],['amount','Amount'],['allocated_amount','Allocated'],['payment_method','Method'],['reference_number','Reference'],['status','Status']],fields:[['supplier_id','Supplier','supplier'],['payment_date','Payment Date','date'],['amount','Amount','number'],['payment_method','Method','select:CASH,BANK,ONLINE,CHEQUE,EASYPAISA,JAZZCASH'],['reference_number','Reference','text'],['notes','Notes','textarea']]},
  clients:{title:'Customers',action:'clients',create:'create_client',cols:[['client_code','Code'],['business_name','Business'],['contact_person','Contact'],['mobile_number','Mobile'],['credit_limit','Credit Limit'],['opening_balance','Opening Balance'],['status','Status']],fields:[['client_code','Customer Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['credit_limit','Credit Limit','number'],['opening_balance','Opening Balance','number']]},
  'client-bills':{title:'Customer Invoices',action:'client_invoices',create:'create_client_invoice',cols:[['invoice_number','Invoice'],['business_name','Customer'],['invoice_date','Date'],['due_date','Due'],['warehouse_name','Warehouse'],['item_count','Items'],['total_quantity','Quantity'],['amount','Amount'],['status','Status']]},
  'client-payments':{title:'Customer Payments',action:'client_receipts',create:'create_client_receipt',cols:[['receipt_date','Date'],['business_name','Customer'],['amount','Amount'],['allocated_amount','Allocated'],['payment_method','Method'],['reference_number','Reference'],['status','Status']],fields:[['client_id','Customer','client'],['receipt_date','Receipt Date','date'],['amount','Amount','number'],['payment_method','Method','select:CASH,BANK,ONLINE,CHEQUE,EASYPAISA,JAZZCASH'],['reference_number','Reference','text'],['notes','Notes','textarea']]},
  products:{title:'Products',action:'products',create:'create_product',cols:[['sku','SKU'],['barcode','Barcode'],['product_name','Product'],['unit','Unit'],['purchase_price','Purchase Price'],['sale_price','Sale Price'],['active','Status']],fields:[['sku','SKU','text'],['barcode','Barcode','text'],['product_name','Product Name','text'],['unit','Unit','text'],['purchase_price','Purchase Price','number'],['sale_price','Sale Price','number']]},
  warehouses:{title:'Warehouses',action:'warehouses',create:'create_warehouse',cols:[['warehouse_code','Code'],['warehouse_name','Warehouse'],['address','Address'],['active','Status']],fields:[['warehouse_code','Warehouse Code','text'],['warehouse_name','Warehouse Name','text'],['address','Address','text']]},
  grns:{title:'Goods Receiving (GRN)',action:'grns',create:'create_grn',cols:[['grn_number','GRN'],['received_date','Date'],['supplier_name','Supplier'],['supplier_invoice_number','Supplier Invoice'],['warehouse_name','Warehouse'],['item_count','Items'],['total_quantity','Quantity'],['status','Status']],fields:[['supplier_id','Supplier','supplier'],['supplier_invoice_id','Supplier Invoice','supplier_invoice'],['warehouse_id','Warehouse','warehouse'],['product_id','Product','product'],['quantity','Quantity','number'],['unit_cost','Unit Cost','number'],['received_date','Received Date','date'],['notes','Notes','textarea']]},
  'inventory-stock':{title:'Warehouse Stock',action:'inventory_stock',cols:[['warehouse_name','Warehouse'],['sku','SKU'],['product_name','Product'],['unit','Unit'],['quantity','Quantity'],['stock_value','Stock Value']]},
  'inventory-ledger':{title:'Inventory Ledger',action:'inventory_ledger',cols:[['movement_date','Date / Time'],['movement_type','Type'],['warehouse_name','Warehouse'],['sku','SKU'],['product_name','Product'],['qty_in','Qty In'],['qty_out','Qty Out'],['unit_cost','Unit Cost'],['reference_number','Reference']]},
  'stock-transfers':{title:'Stock Transfers',action:'stock_transfers',create:'create_stock_transfer',cols:[['transfer_number','Transfer'],['transfer_date','Date'],['from_warehouse','From'],['to_warehouse','To'],['item_count','Items'],['total_quantity','Quantity'],['status','Status']]},
  'stock-adjustments':{title:'Stock Adjustments',action:'stock_adjustments',create:'create_stock_adjustment',cols:[['adjustment_number','Adjustment'],['adjustment_date','Date'],['warehouse_name','Warehouse'],['sku','SKU'],['product_name','Product'],['adjustment_type','Type'],['quantity','Quantity'],['reason','Reason'],['status','Status']]}
};
function isMoney(key){return /price|amount|balance|credit_limit/.test(key)}
const featureOn=key=>model?.subscription?.features?.[key]===true;
const roleCanView=view=>view==='dashboard'||model?.role_access?.views?.includes(view)===true;
const roleCanWrite=view=>model?.subscription?.access_mode==='write'&&model?.role_access?.write_views?.includes(view)===true;
const viewFeatures={users:'core_erp',suppliers:'supplier_management','supplier-bills':'supplier_management','supplier-payments':'supplier_management','supplier-statement':'supplier_management',clients:'customer_management','client-bills':'customer_management','client-payments':'customer_management','client-statement':'customer_management',products:'products',warehouses:'warehouses',grns:'grn','inventory-stock':'inventory_ledger','inventory-ledger':'inventory_ledger','stock-transfers':'inventory_ledger','stock-adjustments':'inventory_ledger','supplier-returns':'inventory_ledger','client-returns':'inventory_ledger',cashier:'cashier',ecommerce:'ecommerce','ocr-drafts':'ocr','automation-center':'automation',communications:'automation',reports:'basic_reports','advanced-reports':'advanced_reports','audit-center':'core_erp'};
function setHeader(){
  $('navCompany').textContent=model.company.name;
  $('accessBadge').textContent=(model.subscription.plan_name||'No Plan')+' · '+(model.subscription.access_mode==='write'?'ACTIVE':'READ ONLY');
  document.querySelectorAll('#workspaceNav [data-feature]').forEach(el=>{
    const view=el.dataset.view,planOk=featureOn(el.dataset.feature),roleOk=!view||roleCanView(view);
    el.classList.toggle('hidden',!planOk||!roleOk);
  });
  $('usersNav').classList.toggle('hidden',!roleCanView('users')||!featureOn('core_erp'));
  if(model.subscription.access_mode!=='write'){$('readOnlyNote').classList.remove('hidden');$('readOnlyNote').textContent='Subscription expired. Data dekh sakte hain, lekin renewal tak new entries blocked hain.'}
  else $('readOnlyNote').classList.add('hidden');
}
function dashboard(){
  $('workspaceTitle').textContent=model.company.name;
  $('workspaceSubtitle').innerHTML='<span class="dashboardPill">Dashboard</span><span class="ownerChip"><span class="ownerAvatar">'+esc((model.user.full_name||'O').trim().charAt(0).toUpperCase())+'</span><span><small>'+esc(model.user.role==='company_admin'?'Company Admin':model.user.role.replaceAll('_',' '))+'</small><b>'+esc(model.user.full_name)+'</b></span></span>';
  $('addRecord').classList.add('hidden');
  const s=model.stats||{};
  const icon=(k)=>({Users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6"/><circle cx="17" cy="9" r="2"/><path d="M15 14c4 0 6 2 6 6"/></svg>',Suppliers:'<svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',Customers:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></svg>',Products:'<svg viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>',Warehouses:'<svg viewBox="0 0 24 24"><path d="M3 10l9-7 9 7v11H3zM8 21v-7h8v7"/></svg>','Supplier Payable':'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5zM8 9h8M8 13h5"/><path d="M16 14c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2M16 13v10"/></svg>','Customer Receivable':'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5zM8 9h8M8 13h5"/><path d="M16 14c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2M16 13v10"/></svg>'}[k]||'');
  const items=[['Users',s.users],['Suppliers',s.suppliers],['Customers',s.clients],['Products',s.products],['Warehouses',s.warehouses],['Supplier Payable',money(s.supplier_payable)],['Customer Receivable',money(s.client_receivable)]];
  const featureLabels=[
    ['core_erp','Core ERP'],['basic_reports','Basic Reports'],['inventory_ledger','Inventory Ledger'],['grn','Goods Receiving (GRN)'],
    ['advanced_reports','Advanced Reports'],['cashier','Cashier / Counter Sale'],
    ['ecommerce','E-commerce'],['ocr','OCR Automation'],['automation','Workflow Automation']
  ];
  const featureHtml=featureLabels.map(([key,label])=>'<div class="featureItem '+(featureOn(key)?'included':'locked')+'"><span class="featureState">'+(featureOn(key)?'✓':'🔒')+'</span><span><b>'+esc(label)+'</b><small>'+(featureOn(key)?'Included in '+esc(model.subscription.plan_name||'plan'):'Upgrade required')+'</small></span></div>').join('')+
    '<div class="featureItem auditPayItem"><span class="featureState">₨</span><span><b>Pay-per-Audit Service</b><small>'+money(model.audit_service?.per_audit_price||0)+' per audit · available on demand</small></span></div>';
  $('workspaceBody').innerHTML=
    '<div class="stats">'+items.map(([k,v],i)=>'<div class="stat '+(i===6?'wide':'')+'"><span class="statIcon">'+icon(k)+'</span><small>'+k+'</small><b>'+esc(v??0)+'</b><span class="statChevron">›</span></div>').join('')+'</div>'+
    '<div class="card subscription"><h2>Subscription</h2><div class="subgrid"><div><small>Plan</small><b>'+esc(model.subscription.plan_name||'—')+'</b></div><div><small>Expires</small><b>'+date(model.subscription.expires_on)+'</b></div><div><small>Access</small><b>'+esc(model.subscription.access_mode)+'</b></div><div><small>Role</small><b>'+esc(model.user.role)+'</b></div><div><small>User Limit</small><b>'+esc(model.limits.user_limit??'Unlimited')+'</b></div><div><small>Warehouse Limit</small><b>'+esc(model.limits.warehouse_limit??'Unlimited')+'</b></div></div></div>'+
    '<div class="card capabilityCard"><div class="capHead"><div><span class="capEyebrow">SUBSCRIPTION ACCESS</span><h2>'+esc(model.subscription.plan_name||'Plan')+' Features</h2></div><span class="planBadge">'+esc(model.subscription.plan_name||'No Plan')+'</span></div><div class="featureGrid">'+featureHtml+'</div></div>';
}
function cell(key,value){
  if(key==='active')return value?'<span class="pill active">Active</span>':'<span class="pill inactive">Inactive</span>';
  if(key==='grn_status'){const v=String(value||'').toLowerCase();return '<span class="grnPill '+esc(v)+'">'+esc(v==='not_itemized'?'Not Itemized':v||'—')+'</span>';}
  if(key==='status')return '<span class="pill '+esc(String(value||'').toLowerCase())+'">'+esc(value??'—')+'</span>';
  if(key==='movement_date')return value?esc(new Date(value).toLocaleString('en-GB')):'—';
  if(/_date$|due_date/.test(key))return esc(date(value));
  return isMoney(key)?esc(money(value)):esc(value??'—');
}
async function show(view){
  currentView=view;document.querySelectorAll('#workspaceNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='dashboard')return dashboard();
  if(!roleCanView(view))return dashboard();
  const needed=viewFeatures[view];
  if(needed&&!featureOn(needed)){
    $('workspaceTitle').textContent='Upgrade Required';
    $('workspaceSubtitle').textContent=(model.subscription.plan_name||'Current plan')+' does not include this module';
    $('addRecord').classList.add('hidden');
    $('workspaceBody').innerHTML='<div class="card upgradeCard"><h2>Module not included</h2><p>This feature is not available in the current '+esc(model.subscription.plan_name||'subscription')+' plan.</p></div>';
    return;
  }
  if(view==='supplier-statement')return openPartyStatement('supplier');
  if(view==='client-statement')return openPartyStatement('client');
  if(view==='supplier-returns')return openReturns('supplier');
  if(view==='client-returns')return openReturns('client');
  if(view==='cashier')return openCashier();
  if(view==='ecommerce')return openEcommerce();
  if(view==='ocr-drafts')return openOcrDrafts();
  if(view==='automation-center')return openAutomationCenter();
  if(view==='communications')return openCommunications();
  if(view==='reports')return openReports(false);
  if(view==='advanced-reports')return openReports(true);
  if(view==='audit-center')return openAuditCenter();
  const d=defs[view];$('workspaceTitle').textContent=d.title;$('workspaceSubtitle').textContent=model.company.name+' · '+d.title;$('addRecord').classList.toggle('hidden',!roleCanWrite(view)||!d.create);
  $('workspaceBody').innerHTML='<div class="card">Loading…</div>';
  const j=await json('/api/bizora-company?action='+d.action),rows=j.records||[];optionCache[view]=rows;
  const userActions=view==='users'?'<th>Action</th>':'';
  $('workspaceBody').innerHTML='<div class="card">'+(view==='users'&&j.limit?'<p class="limitnote">Plan user limit: '+esc(j.limit)+' active users</p>':'')+'<div class="tablewrap"><table><thead><tr>'+d.cols.map(c=>'<th>'+c[1]+'</th>').join('')+userActions+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+d.cols.map(c=>'<td>'+cell(c[0],r[c[0]])+'</td>').join('')+(view==='users'?'<td><button class="secondary userStatusBtn" data-id="'+r.id+'" data-active="'+(r.active?'0':'1')+'">'+(r.active?'Deactivate':'Activate')+'</button></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(d.cols.length+(view==='users'?1:0))+'">No records yet</td></tr>')+'</tbody></table></div></div>';
  if(view==='users'){
    document.querySelectorAll('.userStatusBtn').forEach(b=>b.onclick=e=>{e.stopPropagation();setUserStatus(Number(b.dataset.id),b.dataset.active==='1')});
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openUserRecord(row)}});
  }
  if(['suppliers','clients','products','warehouses'].includes(view)){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openMasterRecord(view,row)}});
  }
  if(view==='supplier-bills'){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openSupplierInvoiceDetail(row)}});
  }
  if(view==='client-bills'){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openCustomerInvoiceDetail(row)}});
  }
  if(view==='supplier-payments'){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openPaymentDetail('supplier',row)}});
  }
  if(view==='client-payments'){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openPaymentDetail('client',row)}});
  }
  if(view==='grns'){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openInventoryDocument('grn',row)}});
  }
  if(view==='stock-transfers'){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openInventoryDocument('transfer',row)}});
  }
  if(view==='stock-adjustments'){
    document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openInventoryDocument('adjustment',row)}});
  }
  if(view==='inventory-stock'||view==='inventory-ledger')await installWarehouseFilter(view,rows);
}
async function openUserRecord(row){
  if(!model?.role_access?.can_manage_users)return;
  $('workspaceTitle').textContent='User Details';
  $('workspaceSubtitle').textContent=model.company.name+' · Role & Login Control';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML=
    '<div class="masterToolbar"><button id="userBack" class="secondary">← Users</button><span class="masterState '+(row.active?'active':'inactive')+'">'+(row.active?'Active':'Inactive')+'</span></div>'+
    '<form id="userEditForm" class="card userEditCard">'+
      '<div class="userEditHead"><div class="userEditAvatar">'+esc((row.full_name||'U').charAt(0).toUpperCase())+'</div><div><span class="capEyebrow">COMPANY USER</span><h2>'+esc(row.full_name)+'</h2><p>'+esc(row.user_code)+' · Last login '+(row.last_login_at?esc(new Date(row.last_login_at).toLocaleString('en-GB')):'Never')+'</p></div></div>'+
      '<div class="formGrid"><label>User ID<input value="'+esc(row.user_code)+'" disabled></label><label>Full Name<input name="full_name" value="'+esc(row.full_name)+'" required></label><label>Email<input name="email" type="email" value="'+esc(row.email||'')+'"></label><label>Role<select name="role">'+['company_admin','manager','accountant','salesman','cashier'].map(x=>'<option value="'+x+'" '+(row.role===x?'selected':'')+'>'+esc(x.replaceAll('_',' '))+'</option>').join('')+'</select></label><label>New Password<input name="password" type="password" minlength="8" placeholder="Leave blank to keep current password"></label></div>'+
      '<div class="roleGuide"><b>Role Access</b><p>Company Admin: full control · Manager: operational control · Accountant: accounts & reports · Salesman: sales/customer work · Cashier: counter billing.</p></div>'+
      '<div class="masterActions"><button id="userToggle" type="button" class="'+(row.active?'dangerAction':'secondary')+'">'+(row.active?'Deactivate':'Activate')+'</button><button id="saveUserEdit" class="primary">Save User</button></div>'+
    '</form>';
  $('userBack').onclick=()=>show('users');
  $('userToggle').onclick=()=>setUserStatus(row.id,!row.active);
  $('userEditForm').onsubmit=async e=>{
    e.preventDefault();const btn=$('saveUserEdit'),data=Object.fromEntries(new FormData(e.currentTarget));btn.disabled=true;btn.textContent='Saving…';
    try{
      await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_user',user_id:row.id,...data})});
      optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await show('users');
    }catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Save User'}
  };
}

async function openMasterRecord(view,row){
  const config={
    suppliers:{title:'Supplier',id:'supplier_id',update:'update_supplier',status:'set_supplier_status',active:String(row.status||'active')==='active',
      fields:[['supplier_code','Supplier Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['opening_balance','Opening Balance','number']]},
    clients:{title:'Customer',id:'client_id',update:'update_client',status:'set_client_status',active:String(row.status||'active')==='active',
      fields:[['client_code','Customer Code','text'],['business_name','Business Name','text'],['contact_person','Contact Person','text'],['mobile_number','Mobile','tel'],['credit_limit','Credit Limit','number'],['opening_balance','Opening Balance','number']]},
    products:{title:'Product',id:'product_id',update:'update_product',status:'set_product_status',active:row.active!==false,
      fields:[['sku','SKU','text'],['barcode','Barcode','text'],['product_name','Product Name','text'],['unit','Unit','text'],['purchase_price','Purchase Price','number'],['sale_price','Sale Price','number']]},
    warehouses:{title:'Warehouse',id:'warehouse_id',update:'update_warehouse',status:'set_warehouse_status',active:row.active!==false,
      fields:[['warehouse_code','Warehouse Code','text'],['warehouse_name','Warehouse Name','text'],['address','Address','textarea']]}
  }[view];
  if(!config)return;
  $('workspaceTitle').textContent=config.title+' Details';
  $('workspaceSubtitle').textContent=model.company.name+' · Master Data';
  $('addRecord').classList.add('hidden');
  const fieldHtml=config.fields.map(([name,label,type])=>{
    const v=row[name]??'',min=type==='number'?' min="0" step="0.01"':'';
    if(type==='textarea')return '<label>'+label+'<textarea name="'+name+'">'+esc(v)+'</textarea></label>';
    return '<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(v)+'"'+min+(name.endsWith('_code')||name==='sku'||name==='product_name'||name==='business_name'||name==='warehouse_name'?' required':'')+'></label>';
  }).join('');
  $('workspaceBody').innerHTML=
    '<div class="masterToolbar"><button id="masterBack" class="secondary">← '+esc(defs[view].title)+'</button><span class="masterState '+(config.active?'active':'inactive')+'">'+(config.active?'Active':'Inactive')+'</span></div>'+
    '<form id="masterEditForm" class="card masterEditCard"><div class="masterEditHead"><div><span class="capEyebrow">MASTER DATA</span><h2>Edit '+esc(config.title)+'</h2><p>Historical invoices and transactions remain unchanged.</p></div></div><div class="formGrid">'+fieldHtml+'</div>'+
    '<div class="masterActions"><button id="masterToggle" type="button" class="'+(config.active?'dangerAction':'secondary')+'">'+(config.active?'Deactivate':'Activate')+'</button><button id="masterSave" class="primary">Save Changes</button></div></form>';
  $('masterBack').onclick=()=>show(view);
  $('masterEditForm').onsubmit=async e=>{
    e.preventDefault();const btn=$('masterSave');btn.disabled=true;btn.textContent='Saving…';
    try{const data=Object.fromEntries(new FormData(e.currentTarget));await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:config.update,[config.id]:row.id,...data})});optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await show(view)}
    catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Save Changes'}
  };
  $('masterToggle').onclick=async()=>{
    const next=!config.active;if(!confirm((next?'Activate ':'Deactivate ')+config.title+'?'))return;
    try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:config.status,[config.id]:row.id,...((view==='suppliers'||view==='clients')?{status:next?'active':'inactive'}:{active:next})})});optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await show(view)}
    catch(err){alert(err.message)}
  };
}

async function openInventoryDocument(kind,row){
  const isGrn=kind==='grn',isTransfer=kind==='transfer',title=isGrn?'Goods Receiving (GRN)':isTransfer?'Stock Transfer':'Stock Adjustment';
  $('workspaceTitle').textContent=title;
  $('workspaceSubtitle').textContent=model.company.name+' · Inventory Control';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading '+esc(title)+'…</div></div>';
  let record=row,items=[];
  if(isGrn){const d=await json('/api/bizora-company?action=grn_detail&grn_id='+row.id);record=d.record||row;items=d.items||[]}
  else if(isTransfer){const d=await json('/api/bizora-company?action=stock_transfer_detail&transfer_id='+row.id);record=d.record||row;items=d.items||[]}
  else items=[{sku:row.sku,product_name:row.product_name,unit:row.unit,quantity:row.quantity,unit_cost:row.unit_cost,notes:row.reason||row.notes||''}];
  const status=String(record.status||'posted').toLowerCase(),canCancel=status==='posted'&&model.subscription.access_mode==='write';
  const numberLabel=isGrn?record.grn_number:isTransfer?record.transfer_number:record.adjustment_number;
  const docDate=isGrn?record.received_date:isTransfer?record.transfer_date:record.adjustment_date;
  const meta=isGrn?[
    ['Supplier',record.supplier_name||'—'],['Supplier Invoice',record.supplier_invoice_number||'—'],['Warehouse',record.warehouse_name||'—'],['Status',status]
  ]:isTransfer?[
    ['From',record.from_warehouse||'—'],['To',record.to_warehouse||'—'],['Items',items.length],['Status',status]
  ]:[
    ['Warehouse',record.warehouse_name||'—'],['Product',record.product_name||'—'],['Type',record.adjustment_type||'—'],['Status',status]
  ];
  $('workspaceBody').innerHTML=
    '<div class="inventoryDocActions"><button id="inventoryDocBack" class="secondary">← Back</button><div><span class="inventoryDocStatus '+esc(status)+'">'+esc(status)+'</span><button id="printInventoryDoc" class="secondary">Print / Save PDF</button>'+(canCancel?'<button id="cancelInventoryDoc" class="dangerAction">Cancel & Reverse</button>':'')+'</div></div>'+
    '<div class="card inventoryDoc inventoryPrintable">'+
      '<div class="inventoryDocTitle"><div><span class="capEyebrow">'+esc(title.toUpperCase())+'</span><h2>'+esc(model.company.name)+'</h2><p>'+esc(numberLabel)+'</p></div><div><b>'+esc(numberLabel)+'</b><span>'+date(docDate)+'</span></div></div>'+
      '<div class="inventoryDocMeta">'+meta.map(x=>'<div><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join('')+'</div>'+
      '<div class="tablewrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Unit Cost</th>'+(isGrn?'<th>Rejected</th><th>Batch</th><th>Expiry</th>':'')+'<th>Notes</th></tr></thead><tbody>'+
        (items.length?items.map(x=>'<tr><td>'+esc(x.sku||'—')+'</td><td><b>'+esc(x.product_name||'—')+'</b></td><td>'+esc(x.quantity||0)+' '+esc(x.unit||'')+'</td><td>'+money(x.unit_cost)+'</td>'+(isGrn?'<td>'+esc(x.rejected_qty||0)+'</td><td>'+esc(x.batch_no||'—')+'</td><td>'+date(x.expiry_date)+'</td>':'')+'<td>'+esc(x.notes||'')+'</td></tr>').join(''):'<tr><td colspan="'+(isGrn?8:5)+'">No items</td></tr>')+
      '</tbody></table></div>'+
      (record.notes?'<div class="inventoryDocNotes"><small>Notes</small><p>'+esc(record.notes)+'</p></div>':'')+
    '</div>';
  $('inventoryDocBack').onclick=()=>show(isGrn?'grns':isTransfer?'stock-transfers':'stock-adjustments');
  $('printInventoryDoc').onclick=()=>{document.body.classList.add('inventory-print');window.print();setTimeout(()=>document.body.classList.remove('inventory-print'),500)};
  if($('cancelInventoryDoc'))$('cancelInventoryDoc').onclick=async()=>{
    const msg=isGrn?'Cancel this GRN and reverse its stock? System will block if stock/returns depend on it.':isTransfer?'Cancel this transfer and move stock back? System will block if destination stock is no longer available.':'Cancel this adjustment and reverse its stock movement?';
    if(!confirm(msg))return;
    const action=isGrn?'cancel_grn':isTransfer?'cancel_stock_transfer':'cancel_stock_adjustment',key=isGrn?'grn_id':isTransfer?'transfer_id':'adjustment_id';
    try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,[key]:record.id})});optionCache={};await show(isGrn?'grns':isTransfer?'stock-transfers':'stock-adjustments')}
    catch(e){alert(e.message)}
  };
}

async function openSupplierInvoiceDetail(row){
  $('workspaceTitle').textContent='Supplier Invoice';
  $('workspaceSubtitle').textContent=row.invoice_number+' · '+row.business_name;
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card">Loading invoice products…</div>';
  const data=await json('/api/bizora-company?action=supplier_invoice_items&invoice_id='+row.id),items=data.records||[];
  const grnStatus=String(row.grn_status||'').toLowerCase(),payStatus=String(row.status||'unpaid').toLowerCase();
  const canCancel=payStatus!=='cancelled'&&roleCanWrite('supplier-bills');
  $('workspaceBody').innerHTML=
    '<div class="detailToolbar invoiceDetailActions"><button id="backToInvoices" class="secondary">← Back</button><div><span class="grnPill '+esc(grnStatus)+'">'+esc(grnStatus==='not_itemized'?'Not Itemized':grnStatus)+'</span><span class="invoiceStatus '+esc(payStatus)+'">'+esc(payStatus)+'</span><button id="printSupplierInvoice" class="secondary">Print / Save PDF</button>'+(canCancel?'<button id="editSupplierInvoice" class="secondary">Edit Invoice</button><button id="cancelSupplierInvoice" class="dangerAction">Cancel Invoice</button>':'')+'</div></div>'+
    '<div id="invoicePrintable" class="card invoiceDetailCard invoicePrintable">'+
      '<div class="invoicePrintTitle"><div><span class="capEyebrow">SUPPLIER INVOICE</span><h2>'+esc(model.company.name)+'</h2><p>'+esc(row.business_name)+'</p></div><div><b>'+esc(row.invoice_number)+'</b><span>'+date(row.invoice_date)+'</span></div></div>'+
      '<div class="invoiceDetailHead"><div><span>Supplier</span><b>'+esc(row.business_name)+'</b></div><div><span>Invoice</span><b>'+esc(row.invoice_number)+'</b></div><div><span>Date</span><b>'+date(row.invoice_date)+'</b></div><div><span>Amount</span><b>'+money(row.amount)+'</b></div></div>'+
      '<div class="tablewrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Unit</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Purchase Price</th><th>Line Total</th></tr></thead><tbody>'+
      (items.length?items.map(x=>'<tr><td>'+esc(x.sku)+'</td><td><b>'+esc(x.product_name)+'</b></td><td>'+esc(x.unit)+'</td><td>'+esc(x.quantity)+'</td><td>'+esc(x.received_quantity)+'</td><td>'+esc(x.remaining_quantity)+'</td><td>'+money(x.unit_price)+'</td><td>'+money(Number(x.quantity||0)*Number(x.unit_price||0))+'</td></tr>').join(''):'<tr><td colspan="8">No product lines found.</td></tr>')+
      '</tbody></table></div>'+
      '<div class="invoicePrintTotal"><span>Invoice Total</span><b>'+money(row.amount)+'</b></div>'+
    '</div>';
  $('backToInvoices').onclick=()=>show('supplier-bills');
  $('printSupplierInvoice').onclick=()=>{document.body.classList.add('invoice-print');window.print();setTimeout(()=>document.body.classList.remove('invoice-print'),500)};
  if($('editSupplierInvoice'))$('editSupplierInvoice').onclick=()=>openSupplierInvoiceForm({row,items}).catch(e=>alert(e.message));
  if($('cancelSupplierInvoice'))$('cancelSupplierInvoice').onclick=async()=>{
    if(!confirm('Cancel this supplier invoice? GRN ya allocated payment ho to system cancellation block karega.'))return;
    try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel_supplier_invoice',invoice_id:row.id})});optionCache={};await show('supplier-bills')}
    catch(e){alert(e.message)}
  };
}
async function installWarehouseFilter(view,rows){
  let warehouses=optionCache.warehouses;
  if(!warehouses)warehouses=(await json('/api/bizora-company?action=warehouses')).records||[],optionCache.warehouses=warehouses;
  const card=$('workspaceBody').querySelector('.card');if(!card)return;
  const bar=document.createElement('div');bar.className='warehouseFilter';
  bar.innerHTML='<label>Warehouse<select id="warehouseFilterSelect"><option value="">All Warehouses</option>'+warehouses.map(w=>'<option value="'+w.id+'">'+esc(w.warehouse_name)+'</option>').join('')+'</select></label>';
  card.prepend(bar);
  $('warehouseFilterSelect').onchange=async e=>{
    const id=e.target.value,url='/api/bizora-company?action='+(view==='inventory-stock'?'inventory_stock':'inventory_ledger')+(id?'&warehouse_id='+encodeURIComponent(id):'');
    const j=await json(url),d=defs[view],filtered=j.records||[];
    const tbody=card.querySelector('tbody');
    tbody.innerHTML=filtered.length?filtered.map(r=>'<tr>'+d.cols.map(c=>'<td>'+cell(c[0],r[c[0]])+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+d.cols.length+'">No records for this warehouse</td></tr>';
  };
}
async function partyOptions(kind){
  const actionMap={supplier:'suppliers',client:'clients',product:'products',warehouse:'warehouses',supplier_invoice:'supplier_invoices'};
  const action=actionMap[kind];
  if(!optionCache[action])optionCache[action]=(await json('/api/bizora-company?action='+action)).records||[];
  const source=(optionCache[action]||[]).filter(r=>{
    if(kind==='supplier'||kind==='client')return String(r.status||'active')==='active';
    if(kind==='product'||kind==='warehouse')return r.active!==false;
    return true;
  });
  return source.map(r=>{
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
function supplierInvoiceItemRow(products,item=null){
  const options='<option value="">Select Product</option>'+products.map(p=>'<option value="'+p.id+'" data-price="'+Number(p.purchase_price||0)+'" '+(item&&Number(p.id)===Number(item.product_id)?'selected':'')+'>'+esc(p.product_name)+' · '+esc(p.sku||'')+'</option>').join('');
  return '<div class="lineItem invoiceLine">'+
    '<label>Product<select class="lineProduct" required>'+options+'</select></label>'+
    '<label>Quantity<input class="lineQty" type="number" min="0.001" step="0.001" value="'+esc(item?.quantity??1)+'" required></label>'+
    '<label>Purchase Price<input class="linePrice" type="number" min="0" step="0.01" value="'+esc(item?.unit_price??0)+'" required></label>'+
    '<label>Description<input class="lineDescription" type="text" value="'+esc(item?.description||'')+'" placeholder="Optional"></label>'+
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
function customerInvoiceItemRow(products,item=null){
  const options='<option value="">Select Product</option>'+products.map(p=>'<option value="'+p.id+'" '+(item&&Number(p.id)===Number(item.product_id)?'selected':'')+'>'+esc(p.product_name)+' · '+esc(p.sku||'')+'</option>').join('');
  return '<div class="lineItem customerInvoiceLine">'+
    '<label>Product<select class="customerLineProduct" required>'+options+'</select></label>'+
    '<label>Quantity<input class="customerLineQty" type="number" min="0.001" step="0.001" value="'+esc(item?.quantity??1)+'" required></label>'+
    '<label>Sale Price<input class="customerLinePrice" type="number" min="0" step="0.01" value="'+esc(item?.unit_price??0)+'" required></label>'+
    '<label>Description<input class="customerLineDescription" type="text" value="'+esc(item?.description||'')+'" placeholder="Optional"></label>'+
    '<button type="button" class="removeLine secondary">×</button>'+
  '</div>';
}
function updateCustomerInvoiceTotal(){
  const rows=[...document.querySelectorAll('#customerInvoiceItems .customerInvoiceLine')];
  const total=rows.reduce((n,row)=>n+Number(row.querySelector('.customerLineQty')?.value||0)*Number(row.querySelector('.customerLinePrice')?.value||0),0);
  const el=$('customerInvoiceTotal');if(el)el.textContent=money(total);
}
async function openCustomerInvoiceForm(edit=null){
  const [customers,warehouses]=await Promise.all([partyOptions('client'),partyOptions('warehouse')]);
  const products=optionCache.products||(await json('/api/bizora-company?action=products')).records||[];optionCache.products=products;
  const today=new Date().toISOString().slice(0,10),row=edit?.row||null,existing=edit?.items||[];
  invoiceEditContext=row?{type:'client',action:'update_client_invoice',invoice_id:row.id}:null;
  $('recordTitle').textContent=row?'Edit Customer Invoice':'Add Customer Invoice';
  $('recordHint').textContent=(row?'Protected product-wise edit · ':'Product-wise sales invoice · ')+model.company.name;
  $('recordFields').innerHTML=
    '<div class="formGrid">'+
      '<label>Customer<select name="client_id" required><option value="">Select Customer</option>'+customers.map(o=>'<option value="'+o.value+'" '+(row&&Number(o.value)===Number(row.client_id)?'selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select></label>'+
      '<label>Invoice Number<input name="invoice_number" value="'+esc(row?.invoice_number||'')+'" required></label>'+
      '<label>Warehouse<select name="warehouse_id" required><option value="">Select Warehouse</option>'+warehouses.map(o=>'<option value="'+o.value+'" '+(row&&String(o.label).startsWith(String(row.warehouse_name||''))?'selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select></label>'+
      '<label>Invoice Date<input name="invoice_date" type="date" value="'+date(row?.invoice_date||today)+'" required></label>'+
      '<label>Due Date<input name="due_date" type="date" value="'+(row?.due_date?date(row.due_date):today)+'"></label>'+
    '</div>'+
    '<div class="lineHead"><div><b>Invoice Products</b><small>Sale price can be changed per invoice</small></div><button id="addCustomerInvoiceLine" type="button" class="secondary">+ Add Product</button></div>'+
    '<div id="customerInvoiceItems" class="lineItems">'+(existing.length?existing.map(x=>customerInvoiceItemRow(products,x)).join(''):customerInvoiceItemRow(products))+'</div>'+
    '<div class="invoiceTotalBox"><span>Invoice Total</span><b id="customerInvoiceTotal">PKR 0</b></div>'+
    '<label>Notes<textarea name="notes">'+esc(row?.notes||'')+'</textarea></label>';
  const holder=$('customerInvoiceItems');
  holder.onclick=e=>{if(e.target.closest('.removeLine')){const rows=holder.querySelectorAll('.customerInvoiceLine');if(rows.length>1)e.target.closest('.customerInvoiceLine').remove();updateCustomerInvoiceTotal()}};
  holder.onchange=e=>{if(e.target.classList.contains('customerLineProduct')){const opt=e.target.selectedOptions[0],row=e.target.closest('.customerInvoiceLine');const product=products.find(p=>String(p.id)===String(opt?.value));row.querySelector('.customerLinePrice').value=Number(product?.sale_price||0);updateCustomerInvoiceTotal()}};
  holder.oninput=updateCustomerInvoiceTotal;
  $('addCustomerInvoiceLine').onclick=()=>{holder.insertAdjacentHTML('beforeend',customerInvoiceItemRow(products));updateCustomerInvoiceTotal()};
  updateCustomerInvoiceTotal();$('recordDialog').showModal();
}
async function openCustomerInvoiceDetail(row){
  $('workspaceTitle').textContent='Customer Invoice';
  $('workspaceSubtitle').textContent=row.invoice_number+' · '+row.business_name;
  $('addRecord').classList.add('hidden');$('workspaceBody').innerHTML='<div class="card">Loading invoice products…</div>';
  const data=await json('/api/bizora-company?action=client_invoice_items&invoice_id='+row.id),items=data.records||[],payStatus=String(row.status||'unpaid').toLowerCase();
  const canCancel=payStatus!=='cancelled'&&roleCanWrite('client-bills');
  $('workspaceBody').innerHTML=
    '<div class="detailToolbar invoiceDetailActions"><button id="backToCustomerInvoices" class="secondary">← Back</button><div><span class="invoiceStatus '+esc(payStatus)+'">'+esc(payStatus)+'</span><button id="shareCustomerInvoiceWhatsApp" class="secondary">Share WhatsApp</button><button id="printCustomerInvoice" class="secondary">Print / Save PDF</button>'+(canCancel?'<button id="editCustomerInvoice" class="secondary">Edit Invoice</button><button id="cancelCustomerInvoice" class="dangerAction">Cancel Invoice</button>':'')+'</div></div>'+
    '<div id="invoicePrintable" class="card invoiceDetailCard invoicePrintable">'+
      '<div class="invoicePrintTitle"><div><span class="capEyebrow">CUSTOMER INVOICE</span><h2>'+esc(model.company.name)+'</h2><p>'+esc(row.business_name)+'</p></div><div><b>'+esc(row.invoice_number)+'</b><span>'+date(row.invoice_date)+'</span></div></div>'+
      '<div class="invoiceDetailHead"><div><span>Customer</span><b>'+esc(row.business_name)+'</b></div><div><span>Invoice</span><b>'+esc(row.invoice_number)+'</b></div><div><span>Warehouse</span><b>'+esc(row.warehouse_name||'—')+'</b></div><div><span>Amount</span><b>'+money(row.amount)+'</b></div></div>'+
      '<div class="tablewrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Unit</th><th>Quantity</th><th>Sale Price</th><th>Line Total</th></tr></thead><tbody>'+
      (items.length?items.map(x=>'<tr><td>'+esc(x.sku)+'</td><td><b>'+esc(x.product_name)+'</b></td><td>'+esc(x.unit)+'</td><td>'+esc(x.quantity)+'</td><td>'+money(x.unit_price)+'</td><td>'+money(Number(x.quantity||0)*Number(x.unit_price||0))+'</td></tr>').join(''):'<tr><td colspan="6">No product lines found.</td></tr>')+
      '</tbody></table></div>'+
      '<div class="invoicePrintTotal"><span>Invoice Total</span><b>'+money(row.amount)+'</b></div>'+
    '</div>';
  $('backToCustomerInvoices').onclick=()=>show('client-bills');
  $('shareCustomerInvoiceWhatsApp').onclick=()=>prepareWhatsAppShare('client_invoice',row.id).catch(e=>alert(e.message));
  $('printCustomerInvoice').onclick=()=>{document.body.classList.add('invoice-print');window.print();setTimeout(()=>document.body.classList.remove('invoice-print'),500)};
  if($('editCustomerInvoice'))$('editCustomerInvoice').onclick=()=>openCustomerInvoiceForm({row,items}).catch(e=>alert(e.message));
  if($('cancelCustomerInvoice'))$('cancelCustomerInvoice').onclick=async()=>{
    if(!confirm('Cancel this customer invoice? Allocated payment ho to cancellation block hogi. Stock sale hui ho to system automatically restore karega.'))return;
    try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel_client_invoice',invoice_id:row.id})});optionCache={};await show('client-bills')}
    catch(e){alert(e.message)}
  };
}
function reportDateControls(title){
  const today=new Date().toISOString().slice(0,10),month=today.slice(0,8)+'01';
  return '<div class="reportHead"><div><span class="capEyebrow">'+esc(title)+'</span><h2>Date Range</h2></div><div class="reportDates"><label>From<input id="reportFrom" type="date" value="'+month+'"></label><label>To<input id="reportTo" type="date" value="'+today+'"></label><button id="runReport" class="primary">Apply</button></div></div>';
}
async function openReports(advanced=false){
  $('workspaceTitle').textContent=advanced?'Advanced Reports':'Business Reports';
  $('workspaceSubtitle').textContent=model.company.name+' · '+(advanced?'Profit & Product Analysis':'Sales, Purchases & Balances');
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card reportCard">'+reportDateControls(advanced?'ADVANCED REPORTING':'BUSINESS REPORTING')+'<div id="reportContent" class="emptyLines">Loading report…</div></div>';
  const load=async()=>{
    const from=$('reportFrom').value,to=$('reportTo').value,box=$('reportContent');
    box.className='';box.innerHTML='<div class="emptyLines">Loading report…</div>';
    if(advanced){
      const d=await json('/api/bizora-company?action=advanced_reports&date_from='+encodeURIComponent(from)+'&date_to='+encodeURIComponent(to)),s=d.summary||{},rows=d.top_products||[];
      box.innerHTML='<div class="reportKpis"><div><small>Revenue</small><b>'+money(s.revenue)+'</b></div><div><small>COGS</small><b>'+money(s.cogs)+'</b></div><div><small>Gross Profit</small><b>'+money(s.gross_profit)+'</b></div></div>'+
        '<div class="reportSectionTitle"><b>Top Products</b><span>'+date(d.date_from)+' → '+date(d.date_to)+'</span></div>'+
        '<div class="tablewrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Unit</th><th>Sold Qty</th><th>Sales Value</th><th>Gross Profit</th></tr></thead><tbody>'+
        (rows.length?rows.map(x=>'<tr><td>'+esc(x.sku)+'</td><td><b>'+esc(x.product_name)+'</b></td><td>'+esc(x.unit)+'</td><td>'+esc(x.sold_quantity)+'</td><td>'+money(x.sales_value)+'</td><td><b>'+money(x.gross_profit)+'</b></td></tr>').join(''):'<tr><td colspan="6">No sales data for this period</td></tr>')+
        '</tbody></table></div>';
    }else{
      const d=await json('/api/bizora-company?action=reports_summary&date_from='+encodeURIComponent(from)+'&date_to='+encodeURIComponent(to)),s=d.summary||{},rows=d.daily||[];
      const k=[['Customer Sales',s.customer_sales],['Customer Returns',s.customer_returns],['Customer Receipts',s.customer_receipts],['Supplier Purchases',s.supplier_purchases],['Supplier Returns',s.supplier_returns],['Supplier Payments',s.supplier_payments],['Customer Receivable',s.customer_receivable],['Supplier Payable',s.supplier_payable],['Stock Value',s.stock_value]];
      box.innerHTML='<div class="reportKpis">'+k.map(x=>'<div><small>'+esc(x[0])+'</small><b>'+money(x[1])+'</b></div>').join('')+'</div>'+
        '<div class="reportSectionTitle"><b>Daily Activity</b><span>'+date(d.date_from)+' → '+date(d.date_to)+'</span></div>'+
        '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Sales</th><th>Receipts</th><th>Purchases</th><th>Payments</th></tr></thead><tbody>'+
        (rows.length?rows.map(x=>'<tr><td>'+date(x.day)+'</td><td>'+money(x.sales)+'</td><td>'+money(x.receipts)+'</td><td>'+money(x.purchases)+'</td><td>'+money(x.payments)+'</td></tr>').join(''):'<tr><td colspan="5">No activity for this period</td></tr>')+
        '</tbody></table></div>';
    }
  };
  $('runReport').onclick=()=>load().catch(e=>alert(e.message));await load();
}
async function openAuditCenter(){
  $('workspaceTitle').textContent='Audit Service';
  $('workspaceSubtitle').textContent=model.company.name+' · Pay per Audit';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card reportCard"><div class="emptyLines">Loading audit service…</div></div>';
  const data=await json('/api/bizora-company?action=audit_service'),price=data.price,requests=data.requests||[];
  const today=new Date().toISOString().slice(0,10),month=today.slice(0,8)+'01';
  $('workspaceBody').innerHTML=
    '<div class="card auditServiceCard">'+
      '<div class="auditServiceHero"><div><span class="capEyebrow">PAY-PER-AUDIT</span><h2>'+esc(model.subscription.plan_name||'Plan')+' Audit</h2><p>Jab zarurat ho tab ek audit buy karein. Har audit ka charge sirf ek martaba lagega.</p></div><div class="auditPrice"><small>Per Audit</small><b>'+money(price?.per_audit_price||0)+'</b><span>'+esc(price?.plan_name||model.subscription.plan_name||'Plan')+'</span></div></div>'+
      '<form id="auditRequestForm" class="auditRequestForm">'+
        '<div class="formGrid"><label>Audit From<input name="period_from" type="date" value="'+month+'" required></label><label>Audit To<input name="period_to" type="date" value="'+today+'" required></label>'+
        '<label>Payment Method<select name="payment_method" required><option>CASH</option><option>BANK</option><option>ONLINE</option><option>CHEQUE</option><option>EASYPAISA</option><option>JAZZCASH</option></select></label>'+
        '<label>Payment Reference<input name="payment_reference" required placeholder="Transaction / receipt reference"></label></div>'+
        '<label>Notes<textarea name="notes" placeholder="Optional notes for Bizora audit team"></textarea></label>'+
        '<div class="auditApplyBar"><div><small>Audit Charge</small><b>'+money(price?.per_audit_price||0)+'</b></div><button class="primary" id="applyAudit" '+(!price?.active?'disabled':'')+'>Pay & Apply Audit</button></div>'+
      '</form>'+
    '</div>'+
    '<div class="card auditHistoryCard"><div class="reportSectionTitle"><b>Your Audit Requests</b><span>'+requests.length+' total</span></div>'+
      '<div class="tablewrap"><table><thead><tr><th>Requested</th><th>Period</th><th>Price</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>'+
      (requests.length?requests.map(r=>'<tr><td>'+esc(new Date(r.requested_at).toLocaleString('en-GB'))+'</td><td>'+date(r.period_from)+' → '+date(r.period_to)+'</td><td>'+money(r.price)+'</td><td><span class="auditStatus '+esc(r.payment_status)+'">'+esc(r.payment_status)+'</span><br><small>'+esc(r.payment_reference||'')+'</small></td><td><span class="auditStatus '+esc(r.status)+'">'+esc(r.status)+'</span></td><td>'+(r.payment_status==='verified'&&['approved','completed'].includes(r.status)?'<button class="secondary viewAudit" data-id="'+r.id+'">View Audit</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="6">No audit requests yet</td></tr>')+
      '</tbody></table></div></div>';
  $('auditRequestForm').onsubmit=async e=>{
    e.preventDefault();const btn=$('applyAudit');btn.disabled=true;btn.textContent='Submitting…';
    try{
      const body=Object.fromEntries(new FormData(e.currentTarget));
      await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request_audit',...body})});
      alert('Audit request submitted. Super Admin payment verify karne ke baad audit available ho jayega.');
      await openAuditCenter();
    }catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Pay & Apply Audit'}
  };
  document.querySelectorAll('.viewAudit').forEach(b=>b.onclick=()=>viewPurchasedAudit(Number(b.dataset.id)).catch(e=>alert(e.message)));
}
async function viewPurchasedAudit(requestId){
  $('workspaceTitle').textContent='Purchased Audit';
  $('workspaceSubtitle').textContent=model.company.name+' · Approved Audit Report';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading purchased audit…</div></div>';
  const d=await json('/api/bizora-company?action=audit_events&request_id='+requestId),rows=d.records||[],r=d.request||{},sum=d.summary||{},ctrl=d.controls||{},types=d.event_types||[];
  const issues=[
    ['Negative Stock',ctrl.negative_stock_items||0],
    ['Overdue Customer Invoices',ctrl.overdue_customer_invoices||0],
    ['Overdue Supplier Invoices',ctrl.overdue_supplier_invoices||0],
    ['Unallocated Customer Receipts',ctrl.unallocated_customer_receipts||0],
    ['Unallocated Supplier Payments',ctrl.unallocated_supplier_payments||0]
  ];
  $('workspaceBody').innerHTML=
    '<div class="detailToolbar"><button id="backToAuditService" class="secondary">← Audit Service</button><div class="auditToolbarRight"><span class="auditStatus completed">Paid Audit</span><button id="printAudit" class="secondary">Print / Save PDF</button></div></div>'+
    '<div id="auditPrintable" class="card reportCard auditReportPrint">'+
      '<div class="auditReportTitle"><div><span class="capEyebrow">BIZORA PAID AUDIT</span><h2>'+esc(d.company?.name||model.company.name)+'</h2><p>'+esc(d.company?.code||model.company.code||'')+' · '+esc(r.plan_name||model.subscription.plan_name||'Plan')+'</p></div><div class="auditReportBadge"><small>Audit Period</small><b>'+date(r.period_from)+' → '+date(r.period_to)+'</b><span>Paid '+money(r.price)+'</span></div></div>'+
      '<div class="reportKpis">'+
        [['Customer Sales',sum.customer_sales],['Customer Receipts',sum.customer_receipts],['Supplier Purchases',sum.supplier_purchases],['Supplier Payments',sum.supplier_payments],['Gross Profit',sum.gross_profit],['GRNs',sum.grn_count],['Transfers',sum.transfer_count],['Adjustments',sum.adjustment_count]].map(x=>'<div><small>'+esc(x[0])+'</small><b>'+(/GRNs|Transfers|Adjustments/.test(x[0])?esc(x[1]||0):money(x[1]))+'</b></div>').join('')+
      '</div>'+
      '<div class="auditControlGrid">'+issues.map(x=>'<div class="'+(Number(x[1])>0?'attention':'clear')+'"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b><small>'+(Number(x[1])>0?'Review required':'No issue detected')+'</small></div>').join('')+'</div>'+
      '<div class="auditMetaStrip"><span><b>'+esc(sum.audit_event_count||0)+'</b> audit events</span><span><b>'+esc(sum.active_users||0)+'</b> active users</span><span><b>'+esc(types.length)+'</b> event types</span></div>'+
      '<div class="reportSectionTitle"><b>Event Type Summary</b><span>Audit activity by category</span></div>'+
      '<div class="tablewrap"><table><thead><tr><th>Event Type</th><th>Count</th></tr></thead><tbody>'+
      (types.length?types.map(x=>'<tr><td><b>'+esc(x.event_type)+'</b></td><td>'+esc(x.event_count)+'</td></tr>').join(''):'<tr><td colspan="2">No audit events</td></tr>')+
      '</tbody></table></div>'+
      '<div class="reportSectionTitle auditEventsTitle"><b>Detailed Audit Trail</b><span>'+rows.length+' events</span></div>'+
      '<div class="tablewrap"><table><thead><tr><th>Date / Time</th><th>Actor</th><th>Event</th><th>Entity</th><th>ID</th><th>Details</th></tr></thead><tbody>'+
      (rows.length?rows.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString('en-GB'))+'</td><td><b>'+esc(x.actor_name)+'</b></td><td>'+esc(x.event_type)+'</td><td>'+esc(x.entity_type||'—')+'</td><td>'+esc(x.entity_id||'—')+'</td><td class="auditMeta">'+esc(JSON.stringify(x.metadata||{}))+'</td></tr>').join(''):'<tr><td colspan="6">No audit events in this purchased period</td></tr>')+
      '</tbody></table></div>'+
    '</div>';
  $('backToAuditService').onclick=()=>openAuditCenter().catch(e=>alert(e.message));
  $('printAudit').onclick=()=>window.print();
}

function installReturnsModule(){
  if(document.querySelector('[data-view="supplier-returns"]'))return;
  const sections=[...document.querySelectorAll('#workspaceNav .navSection')];
  const purchasing=sections.find(x=>/Purchasing/i.test(x.querySelector('.navSectionTitle')?.textContent||''));
  const sales=sections.find(x=>/^Sales$/i.test((x.querySelector('.navSectionTitle')?.textContent||'').trim()));
  const make=(view,label)=>{const b=document.createElement('button');b.type='button';b.dataset.view=view;b.dataset.feature='inventory_ledger';b.innerHTML='<span class="navIcon"><svg viewBox="0 0 24 24"><path d="M4 7h13"/><path d="M7 4L4 7l3 3"/><path d="M20 17H7"/><path d="M17 14l3 3-3 3"/></svg></span><span class="navLabel">'+label+'</span><span class="navChevron">›</span>';return b};
  if(purchasing)purchasing.appendChild(make('supplier-returns','Supplier Returns'));
  if(sales)sales.appendChild(make('client-returns','Customer Returns'));
}
async function openReturns(kind){
  const isSupplier=kind==='supplier',action=isSupplier?'supplier_returns':'client_returns';
  $('workspaceTitle').textContent=isSupplier?'Supplier Returns':'Customer Returns';
  $('workspaceSubtitle').textContent=model.company.name+' · Product Returns';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading returns…</div></div>';
  const data=await json('/api/bizora-company?action='+action),rows=data.records||[];
  $('workspaceBody').innerHTML=
    '<div class="returnToolbar"><div><span class="capEyebrow">'+(isSupplier?'PURCHASE RETURN':'SALES RETURN')+'</span><h2>'+(isSupplier?'Supplier Returns':'Customer Returns')+'</h2></div>'+(roleCanWrite(isSupplier?'supplier-returns':'client-returns')?'<button id="newReturn" class="primary">+ New Return</button>':'')+'</div>'+
    '<div class="card"><div class="tablewrap"><table><thead><tr><th>Return</th><th>Date</th><th>'+(isSupplier?'Supplier':'Customer')+'</th><th>Invoice</th>'+(isSupplier?'<th>Warehouse</th>':'')+'<th>Amount</th><th>Status</th></tr></thead><tbody>'+
      (rows.length?rows.map(r=>'<tr><td><b>'+esc(r.return_number)+'</b></td><td>'+date(r.return_date)+'</td><td>'+esc(r.business_name)+'</td><td>'+esc(r.invoice_number)+'</td>'+(isSupplier?'<td>'+esc(r.warehouse_name)+'</td>':'')+'<td>'+money(r.amount)+'</td><td><span class="pill '+esc(r.status)+'">'+esc(r.status)+'</span></td></tr>').join(''):'<tr><td colspan="'+(isSupplier?7:6)+'">No returns yet</td></tr>')+
    '</tbody></table></div></div>';
  document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const r=rows[i];if(r){tr.classList.add('clickableRow');tr.onclick=()=>openReturnDetail(kind,r).catch(e=>alert(e.message))}});
  if($('newReturn'))$('newReturn').onclick=()=>openReturnForm(kind).catch(e=>alert(e.message));
}
async function openReturnDetail(kind,row){
  const isSupplier=kind==='supplier',action=isSupplier?'supplier_return_detail&return_id=':'client_return_detail&return_id=';
  $('workspaceTitle').textContent=isSupplier?'Supplier Return':'Customer Return';
  $('workspaceSubtitle').textContent=row.return_number+' · '+row.business_name;
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading return…</div></div>';
  const d=await json('/api/bizora-company?action='+action+row.id),r=d.record||row,items=d.items||[],status=String(r.status||'posted').toLowerCase();
  const canCancel=status==='posted'&&roleCanWrite(isSupplier?'supplier-returns':'client-returns');
  $('workspaceBody').innerHTML=
    '<div class="returnDetailActions"><button id="returnDetailBack" class="secondary">← '+(isSupplier?'Supplier Returns':'Customer Returns')+'</button><div><span class="returnDocStatus '+esc(status)+'">'+esc(status)+'</span><button id="printReturnDoc" class="secondary">Print / Save PDF</button>'+(canCancel?'<button id="cancelReturnDoc" class="dangerAction">Cancel & Reverse</button>':'')+'</div></div>'+
    '<div class="card returnDocument returnPrintable">'+
      '<div class="returnDocTitle"><div><span class="capEyebrow">'+(isSupplier?'SUPPLIER RETURN':'CUSTOMER RETURN')+'</span><h2>'+esc(model.company.name)+'</h2><p>'+esc(r.business_name)+'</p></div><div><b>'+esc(r.return_number)+'</b><span>'+date(r.return_date)+'</span></div></div>'+
      '<div class="returnDocMeta"><div><small>'+(isSupplier?'Supplier':'Customer')+'</small><b>'+esc(r.business_name)+'</b></div><div><small>Invoice</small><b>'+esc(r.invoice_number)+'</b></div>'+(isSupplier?'<div><small>Warehouse</small><b>'+esc(r.warehouse_name)+'</b></div>':'')+'<div><small>Status</small><b>'+esc(status)+'</b></div></div>'+
      '<div class="tablewrap"><table><thead><tr><th>SKU</th><th>Product</th>'+(isSupplier?'':'<th>Warehouse</th>')+'<th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>'+
        (items.length?items.map(x=>'<tr><td>'+esc(x.sku||'—')+'</td><td><b>'+esc(x.product_name)+'</b><small>'+esc(x.unit||'')+'</small></td>'+(isSupplier?'':'<td>'+esc(x.warehouse_name||'—')+'</td>')+'<td>'+esc(x.quantity)+'</td><td>'+money(x.unit_price)+'</td><td>'+money(x.line_total)+'</td></tr>').join(''):'<tr><td colspan="'+(isSupplier?5:6)+'">No return items</td></tr>')+
      '</tbody></table></div>'+
      '<div class="returnDocTotal"><span>Return Credit</span><b>'+money(r.amount)+'</b></div>'+
      (r.notes?'<div class="returnDocNotes"><small>Notes</small><p>'+esc(r.notes)+'</p></div>':'')+
    '</div>';
  $('returnDetailBack').onclick=()=>openReturns(kind).catch(e=>alert(e.message));
  $('printReturnDoc').onclick=()=>{document.body.classList.add('return-print');window.print();setTimeout(()=>document.body.classList.remove('return-print'),500)};
  if($('cancelReturnDoc'))$('cancelReturnDoc').onclick=async()=>{
    const msg=isSupplier?'Cancel this supplier return? Returned stock will be restored to the warehouse and supplier payable will be recalculated.':'Cancel this customer return? Returned stock will be removed again; cancellation will be blocked if that stock has already been consumed or moved.';
    if(!confirm(msg))return;
    try{
      await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:isSupplier?'cancel_supplier_return':'cancel_client_return',return_id:r.id})});
      optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await openReturns(kind);
    }catch(e){alert(e.message)}
  };
}

async function openReturnForm(kind){
  const isSupplier=kind==='supplier';
  $('workspaceTitle').textContent=isSupplier?'New Supplier Return':'New Customer Return';
  $('workspaceSubtitle').textContent=model.company.name+' · Product-wise Return';
  $('addRecord').classList.add('hidden');
  const invoices=(await json('/api/bizora-company?action='+(isSupplier?'supplier_invoices':'client_invoices'))).records||[];
  const eligible=invoices.filter(x=>String(x.status)!=='cancelled'&&(isSupplier?['partial','complete'].includes(String(x.grn_status)):Number(x.item_count||0)>0));
  const warehouses=isSupplier?await partyOptions('warehouse'):[];
  const today=new Date().toISOString().slice(0,10);
  $('workspaceBody').innerHTML=
    '<div class="returnToolbar"><button id="returnBack" class="secondary">← '+(isSupplier?'Supplier Returns':'Customer Returns')+'</button></div>'+
    '<form id="returnForm" class="card returnForm">'+
      '<div class="formGrid"><label>'+(isSupplier?'Supplier':'Customer')+' Invoice<select id="returnInvoice" name="'+(isSupplier?'supplier_invoice_id':'client_invoice_id')+'" required><option value="">Select Invoice</option>'+eligible.map(x=>'<option value="'+x.id+'">'+esc(x.invoice_number)+' · '+esc(x.business_name)+'</option>').join('')+'</select></label>'+
      (isSupplier?'<label>Return From Warehouse<select name="warehouse_id" required><option value="">Select Warehouse</option>'+warehouses.map(x=>'<option value="'+x.value+'">'+esc(x.label)+'</option>').join('')+'</select></label>':'')+
      '<label>Return Date<input name="return_date" type="date" value="'+today+'" required></label></div>'+
      '<div class="lineHead"><div><b>Return Products</b><small>Only eligible quantities can be returned</small></div></div>'+
      '<div id="returnItems" class="lineItems"><div class="emptyLines">Select invoice to load returnable products.</div></div>'+
      '<div class="returnTotal"><span>Return Credit</span><b id="returnTotalAmount">PKR 0</b></div>'+
      '<label>Notes<textarea name="notes" placeholder="Reason / notes"></textarea></label>'+
      '<div class="returnSubmit"><button id="postReturn" class="primary">Post Return</button></div>'+
    '</form>';
  $('returnBack').onclick=()=>openReturns(kind).catch(e=>alert(e.message));
  const updateTotal=()=>{const total=[...document.querySelectorAll('.returnLine')].reduce((n,row)=>n+Number(row.querySelector('.returnQty')?.value||0)*Number(row.dataset.price||0),0);$('returnTotalAmount').textContent=money(total)};
  $('returnInvoice').onchange=async e=>{
    const id=Number(e.target.value||0),holder=$('returnItems');if(!id){holder.innerHTML='<div class="emptyLines">Select invoice to load returnable products.</div>';return}
    holder.innerHTML='<div class="emptyLines">Loading returnable products…</div>';
    const d=await json('/api/bizora-company?action='+(isSupplier?'supplier_return_items&invoice_id=':'client_return_items&invoice_id=')+id),items=(d.records||[]).filter(x=>Number(x.returnable_quantity)>0);
    holder.innerHTML=items.length?items.map(x=>'<div class="lineItem returnLine" data-item-id="'+(isSupplier?x.supplier_invoice_item_id:x.client_invoice_item_id)+'" data-product-id="'+x.product_id+'" data-price="'+Number(x.unit_price||0)+'">'+
      '<div class="lineProductName"><b>'+esc(x.product_name)+'</b><small>'+esc(x.sku||'')+' · '+(isSupplier?'Received '+esc(x.received_quantity):'Sold '+esc(x.sold_quantity))+' · Returned '+esc(x.returned_quantity)+' · Returnable '+esc(x.returnable_quantity)+(isSupplier?'':' · '+esc(x.warehouse_name||''))+'</small></div>'+
      '<label>Return Qty<input class="returnQty" type="number" min="0" max="'+Number(x.returnable_quantity)+'" step="0.001" value="0"></label>'+
      '<label>Rate<input type="number" value="'+Number(x.unit_price||0)+'" disabled></label>'+
    '</div>').join(''):'<div class="emptyLines">No returnable quantity available on this invoice.</div>';
    holder.oninput=updateTotal;updateTotal();
  };
  $('returnForm').onsubmit=async e=>{
    e.preventDefault();const btn=$('postReturn'),fd=Object.fromEntries(new FormData(e.currentTarget));
    const items=[...document.querySelectorAll('.returnLine')].map(row=>({[isSupplier?'supplier_invoice_item_id':'client_invoice_item_id']:Number(row.dataset.itemId),product_id:Number(row.dataset.productId),quantity:Number(row.querySelector('.returnQty').value||0)})).filter(x=>x.quantity>0);
    if(!items.length)return alert('At least one return quantity required');
    btn.disabled=true;btn.textContent='Posting Return…';
    try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:isSupplier?'create_supplier_return':'create_client_return',...fd,items})});optionCache={};await openReturns(kind)}
    catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Post Return'}
  };
}

function installOcrModule(){
  if(document.querySelector('[data-view="ocr-drafts"]'))return;
  const nav=document.querySelector('#workspaceNav .navScroll');if(!nav)return;
  const section=document.createElement('div');section.className='navSection';
  section.innerHTML='<div class="navSectionTitle">Automation</div><button data-view="ocr-drafts" data-feature="ocr"><span class="navIcon"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5"/><path d="M8 12h8M8 16h6"/></svg></span><span class="navLabel">OCR Draft Review</span><span class="navChevron">›</span></button>';
  nav.appendChild(section);
}
async function openOcrDrafts(){
  $('workspaceTitle').textContent='OCR Draft Review';
  $('workspaceSubtitle').textContent=model.company.name+' · Premium Invoice Intake';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading OCR drafts…</div></div>';
  const d=await json('/api/bizora-company?action=ocr_drafts'),rows=d.records||[];
  $('workspaceBody').innerHTML=
    '<div class="ocrToolbar"><div><span class="capEyebrow">PREMIUM OCR AUTOMATION</span><h2>Supplier Invoice Drafts</h2><p>Scan image locally, review extracted data, then post a verified supplier invoice.</p></div>'+(roleCanWrite('ocr-drafts')?'<button id="newOcrDraft" class="primary">+ Scan Invoice</button>':'')+'</div>'+
    '<div class="card"><div class="tablewrap"><table><thead><tr><th>Draft</th><th>Created</th><th>Supplier</th><th>Invoice</th><th>Detected Total</th><th>ERP Total</th><th>Confidence</th><th>Status</th></tr></thead><tbody>'+
      (rows.length?rows.map(r=>'<tr><td><b>'+esc(r.draft_number)+'</b><small>'+esc(r.source_file_name||'Manual OCR text')+'</small></td><td>'+esc(new Date(r.created_at).toLocaleString('en-GB'))+'</td><td>'+esc(r.supplier_name||'—')+'</td><td>'+esc(r.invoice_number||'—')+'</td><td>'+money(r.detected_total||0)+'</td><td>'+money(r.calculated_total||0)+'</td><td>'+esc(r.ocr_confidence===null||r.ocr_confidence===undefined?'—':Number(r.ocr_confidence).toFixed(1)+'%')+'</td><td><span class="ocrStatus '+esc(r.status)+'">'+esc(r.status)+'</span></td></tr>').join(''):'<tr><td colspan="8">No OCR drafts yet</td></tr>')+
    '</tbody></table></div></div>';
  document.querySelectorAll('#workspaceBody tbody tr').forEach((tr,i)=>{const row=rows[i];if(row){tr.classList.add('clickableRow');tr.onclick=()=>openOcrDraftReview(row.id).catch(e=>alert(e.message))}});
  if($('newOcrDraft'))$('newOcrDraft').onclick=()=>openOcrCapture().catch(e=>alert(e.message));
}
async function loadTesseract(){
  if(window.Tesseract)return window.Tesseract;
  await new Promise((resolve,reject)=>{
    const existing=document.getElementById('bizoraTesseract');
    if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('OCR library could not load')),{once:true});return}
    const s=document.createElement('script');s.id='bizoraTesseract';s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.async=true;s.crossOrigin='anonymous';s.onload=resolve;s.onerror=()=>reject(new Error('OCR library could not load. You can still paste OCR text manually.'));document.head.appendChild(s);
  });
  if(!window.Tesseract)throw new Error('OCR library unavailable');
  return window.Tesseract;
}
function normalizeOcrDate(raw){
  const s=String(raw||'').trim();
  let m=s.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  m=s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})/);if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  return '';
}
function parseOcrInvoiceText(text,products){
  const raw=String(text||''),lines=raw.split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  let invoice_number='',invoice_date='',detected_total=null;
  for(const line of lines){
    if(!invoice_number&&/(invoice|inv\.?)[\s#:.-]*(no|number)?/i.test(line)){
      const m=line.match(/(?:invoice|inv\.?)\s*(?:no|number)?\s*[:#.-]?\s*([A-Z0-9\/_-]{3,})/i);if(m)invoice_number=m[1];
    }
    if(!invoice_date&&/(date|dated)/i.test(line)){const m=line.match(/(20\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-\/.]\d{1,2}[-\/.]20\d{2})/);if(m)invoice_date=normalizeOcrDate(m[1])}
    if(/grand\s*total|net\s*total|invoice\s*total|total\s*amount/i.test(line)){
      const nums=line.match(/\d[\d,]*(?:\.\d+)?/g);if(nums?.length)detected_total=Number(nums[nums.length-1].replaceAll(',',''));
    }
  }
  if(detected_total===null){
    const totals=lines.filter(x=>/^total\b/i.test(x));if(totals.length){const nums=totals[totals.length-1].match(/\d[\d,]*(?:\.\d+)?/g);if(nums?.length)detected_total=Number(nums[nums.length-1].replaceAll(',',''))}
  }
  const suggestions=[];
  for(const line of lines){
    if(/total|subtotal|tax|discount|balance|amount due/i.test(line))continue;
    const nums=[...(line.matchAll(/\d[\d,]*(?:\.\d+)?/g))].map(m=>({text:m[0],index:m.index,value:Number(m[0].replaceAll(',',''))}));
    if(nums.length<3)continue;
    const q=nums[nums.length-3].value,p=nums[nums.length-2].value,t=nums[nums.length-1].value;
    if(q<=0||p<0||t<0||Math.abs(q*p-t)>Math.max(2,t*.04))continue;
    const desc=line.slice(0,nums[nums.length-3].index).replace(/[|:-]+$/,'').trim();if(desc.length<2)continue;
    const n=desc.toLowerCase();
    const match=products.find(x=>n.includes(String(x.sku||'').toLowerCase())&&String(x.sku||'').length>2)||products.find(x=>n.includes(String(x.product_name||'').toLowerCase()));
    suggestions.push({product_id:match?.id||null,description:desc,quantity:q,unit_price:p});
    if(suggestions.length>=80)break;
  }
  return {invoice_number,invoice_date,detected_total,items:suggestions};
}
function ocrLine(products,item={}){
  return '<div class="ocrLine" data-id="'+esc(item.id||'')+'"><label>Product<select class="ocrProduct"><option value="">Map Product</option>'+products.map(p=>'<option value="'+p.id+'" '+(Number(item.product_id)===Number(p.id)?'selected':'')+'>'+esc(p.product_name)+' · '+esc(p.sku||'')+'</option>').join('')+'</select></label><label>Description<input class="ocrDescription" value="'+esc(item.description||item.product_name||'')+'"></label><label>Qty<input class="ocrQty" type="number" min="0.001" step="0.001" value="'+esc(item.quantity??1)+'"></label><label>Price<input class="ocrPrice" type="number" min="0" step="0.01" value="'+esc(item.unit_price??0)+'"></label><button type="button" class="secondary ocrRemove">×</button></div>';
}
async function openOcrCapture(){
  $('workspaceTitle').textContent='Scan Supplier Invoice';
  $('workspaceSubtitle').textContent=model.company.name+' · OCR Intake';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML=
    '<div class="ocrCaptureGrid"><div class="card ocrCaptureCard"><span class="capEyebrow">LOCAL IMAGE OCR</span><h2>Capture / Upload Invoice</h2><p>The image is processed in your browser. Bizora saves the OCR text and reviewed draft; this phase does not upload the original image file.</p><label>Invoice Image<input id="ocrImage" type="file" accept="image/*" capture="environment"></label><button id="runOcr" class="primary">Run OCR</button><div id="ocrProgress" class="ocrProgress hidden"><div><span id="ocrProgressBar"></span></div><small id="ocrProgressText">Starting OCR…</small></div></div>'+
    '<div class="card ocrTextCard"><label>OCR Text<textarea id="ocrText" placeholder="OCR text will appear here. You can also paste text manually."></textarea></label><div class="ocrTextActions"><button id="ocrBack" class="secondary">← Drafts</button><button id="reviewOcrText" class="primary">Review Draft</button></div></div></div>';
  $('ocrBack').onclick=()=>openOcrDrafts().catch(e=>alert(e.message));
  $('runOcr').onclick=async()=>{
    const file=$('ocrImage').files?.[0];if(!file)return alert('Invoice image select karein');
    const btn=$('runOcr'),box=$('ocrProgress');btn.disabled=true;box.classList.remove('hidden');
    try{
      const T=await loadTesseract();
      const result=await T.recognize(file,'eng',{logger:m=>{if(m.status){$('ocrProgressText').textContent=m.status+(m.progress!==undefined?' '+Math.round(m.progress*100)+'%':'');$('ocrProgressBar').style.width=Math.round((m.progress||0)*100)+'%'}}});
      $('ocrText').value=result?.data?.text||'';$('ocrText').dataset.confidence=String(result?.data?.confidence??'');$('ocrText').dataset.filename=file.name;
      $('ocrProgressText').textContent='OCR complete';$('ocrProgressBar').style.width='100%';
    }catch(e){alert(e.message)}finally{btn.disabled=false}
  };
  $('reviewOcrText').onclick=async()=>{
    const text=$('ocrText').value.trim();if(!text)return alert('OCR text required');
    const products=(await json('/api/bizora-company?action=products')).records||[],parsed=parseOcrInvoiceText(text,products);
    await openOcrDraftReview(null,{source_text:text,source_file_name:$('ocrText').dataset.filename||null,ocr_confidence:$('ocrText').dataset.confidence||null,...parsed});
  };
}
async function openOcrDraftReview(draftId=null,seed=null){
  $('workspaceTitle').textContent='OCR Draft Review';
  $('workspaceSubtitle').textContent=model.company.name+' · Verify Before Posting';
  $('addRecord').classList.add('hidden');
  const [suppliers,products]=await Promise.all([
    json('/api/bizora-company?action=suppliers').then(x=>x.records||[]),
    json('/api/bizora-company?action=products').then(x=>x.records||[])
  ]);
  let record=seed||{},items=seed?.items||[];
  if(draftId){const d=await json('/api/bizora-company?action=ocr_draft_detail&draft_id='+draftId);record=d.record||{};items=d.items||[]}
  const locked=['posted','rejected'].includes(String(record.status||'draft')),today=new Date().toISOString().slice(0,10);
  $('workspaceBody').innerHTML=
    '<div class="ocrReviewActions"><button id="ocrReviewBack" class="secondary">← OCR Drafts</button><div><span class="ocrStatus '+esc(record.status||'draft')+'">'+esc(record.status||'draft')+'</span>'+(record.status==='posted'&&record.posted_invoice_number?'<span class="ocrPostedInvoice">Posted: '+esc(record.posted_invoice_number)+'</span>':'')+'</div></div>'+
    '<div class="card ocrReviewCard"><div class="ocrReviewHead"><div><span class="capEyebrow">DRAFT REVIEW</span><h2>'+esc(record.draft_number||'New OCR Draft')+'</h2><p>Correct OCR lines until detected total and ERP calculated total match.</p></div><div class="ocrConfidence"><small>OCR Confidence</small><b>'+esc(record.ocr_confidence===null||record.ocr_confidence===undefined||record.ocr_confidence===''?'—':Number(record.ocr_confidence).toFixed(1)+'%')+'</b></div></div>'+
      '<form id="ocrDraftForm">'+
        '<div class="formGrid"><label>Supplier<select name="supplier_id" '+(locked?'disabled':'')+'><option value="">Select Supplier</option>'+suppliers.filter(x=>String(x.status||'active')==='active').map(x=>'<option value="'+x.id+'" '+(Number(record.supplier_id)===Number(x.id)?'selected':'')+'>'+esc(x.business_name)+' · '+esc(x.supplier_code)+'</option>').join('')+'</select></label><label>Invoice Number<input name="invoice_number" value="'+esc(record.invoice_number||'')+'" '+(locked?'disabled':'')+'></label><label>Invoice Date<input name="invoice_date" type="date" value="'+esc(record.invoice_date?date(record.invoice_date):record.invoice_date||today)+'" '+(locked?'disabled':'')+'></label><label>Due Date<input name="due_date" type="date" value="'+esc(record.due_date?date(record.due_date):'')+'" '+(locked?'disabled':'')+'></label></div>'+
        '<div class="ocrTotals"><label>Detected Total<input id="ocrDetectedTotal" name="detected_total" type="number" min="0" step="0.01" value="'+esc(record.detected_total??'')+'" '+(locked?'disabled':'')+'></label><div><small>ERP Calculated Total</small><b id="ocrCalculatedTotal">'+money(record.calculated_total||0)+'</b></div><div id="ocrMatch" class="ocrMatch"></div></div>'+
        '<div class="lineHead"><div><b>OCR Line Items</b><small>Map each line to a Bizora product before posting.</small></div>'+(!locked?'<button id="addOcrLine" type="button" class="secondary">+ Line</button>':'')+'</div>'+
        '<div id="ocrLines" class="ocrLines">'+(items.length?items.map(x=>ocrLine(products,x)).join(''):(!locked?ocrLine(products,{}):'<div class="emptyLines">No OCR lines</div>'))+'</div>'+
        '<label>OCR Source Text<textarea name="source_text" class="ocrSourceText" '+(locked?'disabled':'')+'>'+esc(record.source_text||'')+'</textarea></label>'+
        '<label>Notes<textarea name="notes" '+(locked?'disabled':'')+'>'+esc(record.notes||'')+'</textarea></label>'+
        (!locked?'<div class="ocrDraftButtons"><button id="rejectOcrDraft" type="button" class="dangerAction" '+(!draftId?'disabled':'')+'>Reject Draft</button><button id="saveOcrDraft" type="submit" class="secondary">Save Draft</button><button id="postOcrDraft" type="button" class="primary">Verify & Post Invoice</button></div>':'')+
      '</form>'+
    '</div>';
  $('ocrReviewBack').onclick=()=>openOcrDrafts().catch(e=>alert(e.message));
  if(locked)return;
  const lines=$('ocrLines'),calc=()=>{
    const total=[...lines.querySelectorAll('.ocrLine')].reduce((n,row)=>n+Number(row.querySelector('.ocrQty').value||0)*Number(row.querySelector('.ocrPrice').value||0),0);
    $('ocrCalculatedTotal').textContent=money(total);
    const detected=Number($('ocrDetectedTotal').value||0),hasDetected=$('ocrDetectedTotal').value!=='';
    $('ocrMatch').className='ocrMatch '+(!hasDetected?'neutral':Math.abs(detected-total)<=.01?'ok':'mismatch');
    $('ocrMatch').textContent=!hasDetected?'No detected total':Math.abs(detected-total)<=.01?'✓ Totals match':'Mismatch '+money(Math.abs(detected-total));
    return total;
  };
  lines.oninput=calc;lines.onclick=e=>{const b=e.target.closest('.ocrRemove');if(b&&lines.querySelectorAll('.ocrLine').length>1){b.closest('.ocrLine').remove();calc()}};
  $('ocrDetectedTotal').oninput=calc;$('addOcrLine').onclick=()=>{lines.insertAdjacentHTML('beforeend',ocrLine(products,{}));calc()};calc();
  const payload=()=>{const fd=Object.fromEntries(new FormData($('ocrDraftForm')));return {action:'save_ocr_draft',draft_id:draftId||null,source_file_name:record.source_file_name||null,ocr_confidence:record.ocr_confidence??null,...fd,items:[...lines.querySelectorAll('.ocrLine')].map(row=>({product_id:Number(row.querySelector('.ocrProduct').value||0)||null,description:row.querySelector('.ocrDescription').value,quantity:Number(row.querySelector('.ocrQty').value||0),unit_price:Number(row.querySelector('.ocrPrice').value||0)})).filter(x=>x.quantity>0)}};
  const save=async()=>{const saved=await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});draftId=saved.record.id;record={...record,...saved.record};return saved.record};
  $('ocrDraftForm').onsubmit=async e=>{e.preventDefault();const b=$('saveOcrDraft');b.disabled=true;b.textContent='Saving…';try{await save();alert('OCR draft saved');await openOcrDraftReview(draftId)}catch(err){alert(err.message)}finally{b.disabled=false;b.textContent='Save Draft'}};
  $('postOcrDraft').onclick=async()=>{const b=$('postOcrDraft');b.disabled=true;b.textContent='Verifying…';try{await save();const posted=await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'post_ocr_draft',draft_id:draftId})});alert('Verified supplier invoice posted: '+posted.invoice.invoice_number);optionCache={};await openOcrDraftReview(draftId)}catch(err){alert(err.message)}finally{b.disabled=false;b.textContent='Verify & Post Invoice'}};
  $('rejectOcrDraft').onclick=async()=>{if(!draftId||!confirm('Reject this OCR draft?'))return;try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reject_ocr_draft',draft_id:draftId})});await openOcrDrafts()}catch(err){alert(err.message)}};
}

function installAutomationModule(){
  if(document.querySelector('[data-view="automation-center"]'))return;
  const sections=[...document.querySelectorAll('#workspaceNav .navSection')];
  let section=sections.find(x=>/^Automation$/i.test((x.querySelector('.navSectionTitle')?.textContent||'').trim()));
  if(!section){section=document.createElement('div');section.className='navSection';section.innerHTML='<div class="navSectionTitle">Automation</div>';document.querySelector('#workspaceNav .navScroll')?.appendChild(section)}
  const b=document.createElement('button');b.type='button';b.dataset.view='automation-center';b.dataset.feature='automation';
  b.innerHTML='<span class="navIcon"><svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg></span><span class="navLabel">Automation Center</span><span class="navChevron">›</span>';
  section.appendChild(b);
}
async function automationPulse(){
  if(!featureOn('automation')||!roleCanView('automation-center')||model.subscription.access_mode!=='write')return;
  try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'run_automations',force:false})})}catch{}
}
async function openAutomationCenter(){
  $('workspaceTitle').textContent='Automation Center';
  $('workspaceSubtitle').textContent=model.company.name+' · Premium Workflow Automation';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading automation…</div></div>';
  let d=await json('/api/bizora-company?action=automation_center');
  if(!(d.rules||[]).length&&roleCanWrite('automation-center')){
    await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'run_automations',force:true})});
    d=await json('/api/bizora-company?action=automation_center');
  }
  const rules=d.rules||[],alerts=d.alerts||[],stats=d.stats||{},open=alerts.filter(x=>x.status==='open');
  const ruleMeta={
    LOW_STOCK:{label:'Low Stock',help:'Alert when warehouse stock reaches this quantity or lower.',unit:'Qty threshold'},
    OVERDUE_CUSTOMER:{label:'Customer Overdue',help:'Alert when customer invoice remains unpaid after due date.',unit:'Grace days'},
    OVERDUE_SUPPLIER:{label:'Supplier Overdue',help:'Alert when supplier invoice remains unpaid after due date.',unit:'Grace days'},
    PENDING_GRN:{label:'Pending GRN',help:'Alert when supplier invoice goods are still not fully received.',unit:'After days'}
  };
  $('workspaceBody').innerHTML=
    '<div class="automationHead"><div><span class="capEyebrow">PREMIUM AUTOMATION</span><h2>Workflow Automation Center</h2><p>Rules run automatically when the workspace opens, with a 6-hour throttle. No Vercel Cron is required.</p></div>'+(roleCanWrite('automation-center')?'<button id="runAutomationNow" class="primary">Run Now</button>':'')+'</div>'+
    '<div class="automationKpis"><div><small>Open Alerts</small><b>'+esc(stats.open_alerts||0)+'</b></div><div><small>Critical</small><b>'+esc(stats.critical_alerts||0)+'</b></div><div><small>Rules</small><b>'+rules.filter(x=>x.active).length+'/'+rules.length+'</b></div><div><small>Resolved</small><b>'+esc(stats.resolved_alerts||0)+'</b></div></div>'+
    '<div class="automationRules">'+rules.map(r=>{const m=ruleMeta[r.rule_code]||{label:r.rule_name,help:'Automation rule',unit:'Value'},value=r.rule_code==='LOW_STOCK'?(r.parameters?.threshold??5):(r.parameters?.days??0);return '<form class="automationRule" data-code="'+esc(r.rule_code)+'"><div class="automationRuleTop"><div><b>'+esc(m.label)+'</b><p>'+esc(m.help)+'</p></div><label class="automationSwitch"><input class="automationActive" type="checkbox" '+(r.active?'checked':'')+'><span></span></label></div><div class="automationRuleFoot"><label>'+esc(m.unit)+'<input class="automationValue" type="number" min="0" step="1" value="'+esc(value)+'"></label><small>Last run: '+(r.last_run_at?esc(new Date(r.last_run_at).toLocaleString('en-GB')):'Never')+'</small>'+(roleCanWrite('automation-center')?'<button class="secondary">Save</button>':'')+'</div></form>'}).join('')+'</div>'+
    '<div class="card automationAlerts"><div class="reportSectionTitle"><div><b>Open Alerts</b><span>'+open.length+' action item(s)</span></div></div>'+
      (open.length?'<div class="automationAlertList">'+open.map(a=>'<div class="automationAlert '+esc(a.severity)+'"><div class="automationAlertIcon">'+(a.severity==='critical'?'!':a.severity==='warning'?'⚠':'i')+'</div><div><b>'+esc(a.title)+'</b><p>'+esc(a.message)+'</p><small>'+esc(a.rule_code.replaceAll('_',' '))+' · '+esc(new Date(a.last_detected_at).toLocaleString('en-GB'))+'</small></div>'+(roleCanWrite('automation-center')?'<button class="secondary dismissAutomation" data-id="'+a.id+'">Dismiss</button>':'')+'</div>').join('')+'</div>':'<div class="automationClear">✓ No open automation alerts right now.</div>')+
    '</div>';
  if($('runAutomationNow'))$('runAutomationNow').onclick=async()=>{const b=$('runAutomationNow');b.disabled=true;b.textContent='Running…';try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'run_automations',force:true})});await openAutomationCenter()}catch(e){alert(e.message)}finally{b.disabled=false;b.textContent='Run Now'}};
  document.querySelectorAll('.automationRule').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');if(!b)return;b.disabled=true;b.textContent='Saving…';try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_automation_rule',rule_code:form.dataset.code,active:form.querySelector('.automationActive').checked,value:Number(form.querySelector('.automationValue').value||0)})});await openAutomationCenter()}catch(err){alert(err.message)}finally{b.disabled=false;b.textContent='Save'}});
  document.querySelectorAll('.dismissAutomation').forEach(b=>b.onclick=async()=>{try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dismiss_automation_alert',alert_id:Number(b.dataset.id)})});await openAutomationCenter()}catch(e){alert(e.message)}});
}

function installCommunicationModule(){
  if(document.querySelector('[data-view="communications"]'))return;
  const section=[...document.querySelectorAll('#workspaceNav .navSection')].find(x=>/^Automation$/i.test((x.querySelector('.navSectionTitle')?.textContent||'').trim()));
  if(!section)return;
  const b=document.createElement('button');b.type='button';b.dataset.view='communications';b.dataset.feature='automation';
  b.innerHTML='<span class="navIcon"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg></span><span class="navLabel">WhatsApp Sharing</span><span class="navChevron">›</span>';
  section.appendChild(b);
}
function openWhatsAppLink(phone,message){
  const url='https://wa.me/'+encodeURIComponent(phone)+'?text='+encodeURIComponent(message);
  window.open(url,'_blank','noopener');
}
async function prepareWhatsAppShare(entityType,entityId){
  const d=await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare_whatsapp_share',entity_type:entityType,entity_id:entityId})});
  openWhatsAppLink(d.share.phone,d.share.message);
}
async function openCommunications(){
  $('workspaceTitle').textContent='WhatsApp Sharing';
  $('workspaceSubtitle').textContent=model.company.name+' · Premium Communication Tools';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading communication settings…</div></div>';
  const d=await json('/api/bizora-company?action=communication_center'),s=d.settings||{},logs=d.logs||[],canEdit=['company_admin','manager','accountant'].includes(model.user.role)&&roleCanWrite('communications');
  $('workspaceBody').innerHTML=
    '<div class="communicationHead"><div><span class="capEyebrow">PREMIUM COMMUNICATION</span><h2>WhatsApp Sharing Center</h2><p>Invoice aur customer balance ka message WhatsApp mein open hota hai. Final send user WhatsApp se karta hai.</p></div><span class="communicationMode">Manual Share</span></div>'+
    '<form id="communicationForm" class="card communicationCard"><div class="formGrid"><label>Business WhatsApp<input name="whatsapp_number" value="'+esc(s.whatsapp_number||'')+'" placeholder="e.g. 923001234567" '+(!canEdit?'disabled':'')+'></label><label>Default Country Code<input name="default_country_code" value="'+esc(s.default_country_code||'92')+'" '+(!canEdit?'disabled':'')+'></label></div><label>Invoice Message Template<textarea name="invoice_template" '+(!canEdit?'disabled':'')+'>'+esc(s.invoice_template||'')+'</textarea></label><label>Statement Message Template<textarea name="statement_template" '+(!canEdit?'disabled':'')+'>'+esc(s.statement_template||'')+'</textarea></label><div class="communicationTags"><span>{{customer}}</span><span>{{company}}</span><span>{{invoice}}</span><span>{{amount}}</span><span>{{due}}</span><span>{{status}}</span><span>{{balance}}</span></div>'+(canEdit?'<div class="masterActions"><button class="primary">Save Settings</button></div>':'')+'</form>'+
    '<div class="card communicationLogs"><div class="reportSectionTitle"><div><b>Recent WhatsApp Opens</b><span>'+logs.length+' recent record(s)</span></div></div><div class="tablewrap"><table><thead><tr><th>Date</th><th>Recipient</th><th>Type</th><th>Status</th></tr></thead><tbody>'+
      (logs.length?logs.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString('en-GB'))+'</td><td>'+esc(x.recipient)+'</td><td>'+esc(String(x.template_code||x.entity_type||'').replaceAll('_',' '))+'</td><td><span class="pill active">'+esc(x.status)+'</span></td></tr>').join(''):'<tr><td colspan="4">No WhatsApp shares yet</td></tr>')+
    '</tbody></table></div></div>';
  if(canEdit)$('communicationForm').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button'),data=Object.fromEntries(new FormData(e.currentTarget));btn.disabled=true;btn.textContent='Saving…';try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_communication_settings',active:true,...data})});await openCommunications()}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Save Settings'}};
}

function installEcommerceModule(){
  if(document.querySelector('[data-view="ecommerce"]'))return;
  const nav=document.querySelector('#workspaceNav .navScroll');if(!nav)return;
  const section=document.createElement('div');section.className='navSection';
  section.innerHTML='<div class="navSectionTitle">Online Store</div><button data-view="ecommerce" data-feature="ecommerce"><span class="navIcon"><svg viewBox="0 0 24 24"><path d="M4 8h16l-1 12H5z"/><path d="M8 8a4 4 0 0 1 8 0"/><path d="M9 13h6"/></svg></span><span class="navLabel">E-commerce</span><span class="navChevron">›</span></button>';
  nav.appendChild(section);
  if(!document.getElementById('bizoraEcommerceStyles')){
    const style=document.createElement('style');style.id='bizoraEcommerceStyles';style.textContent=`
      .ecomHead{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.ecomHeadActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ecomOpenStore{text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.ecomHead h2{margin:0;color:#14213d}.ecomHead p{margin:4px 0 0;color:#74829a;font-size:10px}
      .ecomTabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.ecomTabs button{border:1px solid #d8e3f1;background:#fff;color:#506079;border-radius:999px;padding:8px 12px;font-size:10px;font-weight:900}.ecomTabs button.active{background:linear-gradient(135deg,#176fe8,#7042e8);color:#fff;border-color:transparent}
      .ecomKpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:13px}.ecomKpis>div{padding:12px;border-radius:16px;border:1px solid #dce7f5;background:linear-gradient(145deg,#fff,#f4f8ff)}.ecomKpis small{display:block;color:#76839a;font-size:8px;text-transform:uppercase}.ecomKpis b{display:block;margin-top:5px;color:#10265a;font-size:19px}
      .ecomGrid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:13px}.ecomForm{padding:14px!important}.ecomForm h3{margin:0 0 10px;color:#17213a;font-size:14px}.ecomForm .formGrid{grid-template-columns:1fr 1fr}.ecomFormActions{display:flex;gap:7px;justify-content:flex-end;margin-top:10px}
      .ecomProductImg{width:46px;height:46px;border-radius:12px;object-fit:cover;background:#eef3fa;border:1px solid #dae4f1}.ecomProductCell{display:flex;align-items:center;gap:8px}.ecomProductCell b{display:block}.ecomProductCell small{display:block;color:#74829a;font-size:8px;margin-top:2px}
      .ecomStatus{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase;background:#f2f4f7;color:#667085}.ecomStatus.pending{background:#fff6df;color:#946200}.ecomStatus.confirmed,.ecomStatus.packed,.ecomStatus.shipped{background:#edf3ff;color:#345bc1}.ecomStatus.completed{background:#e9fbf2;color:#087f58}.ecomStatus.cancelled{background:#fff0f2;color:#b4233c}
      .ecomOrderStatus{min-width:110px;padding:7px!important;font-size:9px!important}.ecomOrderLines{display:grid;gap:7px}.ecomOrderLine{display:grid;grid-template-columns:minmax(0,1fr) 90px 34px;gap:7px;align-items:end;padding:9px;border:1px solid #e0e8f2;border-radius:13px;background:#fbfdff}.ecomOrderLine label{margin:0}.ecomOrderRemove{width:34px;height:34px;padding:0!important;border-radius:10px!important}
      .ecomNote{padding:10px 12px;border-radius:13px;background:#f4f8ff;color:#60708b;font-size:10px;border:1px solid #dce7f5;margin-bottom:12px}
      .ecomPayStatus{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase}.ecomPayStatus.unpaid{background:#fff6df;color:#946200}.ecomPayStatus.paid{background:#e9fbf2;color:#087f58}.ecomPayStatus.refunded{background:#f1edff;color:#6841c4}
      .ecomHeadButtons{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ecomOrderActions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.ecomOrderView{white-space:nowrap}
      .ecomInvoiceActions{display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px;flex-wrap:wrap}.ecomInvoice{padding:18px!important}.ecomInvoiceTitle{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding-bottom:14px;border-bottom:1px solid #e1e8f2}.ecomInvoiceTitle h2{margin:4px 0;color:#14213d}.ecomInvoiceTitle p{margin:0;color:#738098;font-size:10px}.ecomInvoiceBadge{text-align:right}.ecomInvoiceBadge b{display:block;color:#10265a;font-size:16px}.ecomInvoiceMeta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:13px 0}.ecomInvoiceMeta>div{padding:10px;border-radius:13px;background:#f7f9fd;border:1px solid #e4eaf2}.ecomInvoiceMeta small{display:block;color:#7a879d;font-size:8px;text-transform:uppercase}.ecomInvoiceMeta b{display:block;margin-top:3px;color:#17213a;font-size:11px}.ecomInvoiceTotals{margin:12px 0 0 auto;max-width:340px;display:grid;gap:6px}.ecomInvoiceTotals>div{display:flex;justify-content:space-between;gap:15px;color:#5d6c84;font-size:11px}.ecomInvoiceTotals .grand{padding-top:7px;border-top:1px solid #dde5ef;color:#10265a;font-size:16px;font-weight:900}
      .ecomReportToolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.ecomReportRanges{display:flex;gap:6px;flex-wrap:wrap}.ecomReportRanges button.active{background:linear-gradient(135deg,#176fe8,#7042e8)!important;color:#fff!important;border-color:transparent!important}.ecomReportDates{display:flex;gap:7px;align-items:flex-end;flex-wrap:wrap}.ecomReportDates label{margin:0;min-width:135px}.ecomReportKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:14px}.ecomReportKpis>div{padding:12px;border:1px solid #dfe7f2;border-radius:15px;background:linear-gradient(145deg,#fff,#f5f8ff)}.ecomReportKpis small{display:block;color:#75829a;font-size:8px;text-transform:uppercase}.ecomReportKpis b{display:block;margin-top:5px;color:#10265a;font-size:17px}
      .ecomMethodGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 16px}.ecomMethodGrid>div{display:flex;justify-content:space-between;gap:8px;padding:9px 11px;border:1px solid #e1e8f1;border-radius:12px;background:#fbfdff;color:#53627a;font-size:10px}.ecomMethodGrid b{color:#17213a}
      @media(max-width:760px){.ecomInvoiceMeta{grid-template-columns:1fr 1fr}.ecomReportKpis{grid-template-columns:1fr 1fr}.ecomReportToolbar{align-items:stretch;flex-direction:column}.ecomMethodGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:430px){.ecomInvoiceMeta{grid-template-columns:1fr}.ecomMethodGrid{grid-template-columns:1fr}.ecomReportDates{display:grid;grid-template-columns:1fr 1fr}.ecomReportDates button{grid-column:1/-1}}
      @media print{body.ecom-print .topbar,body.ecom-print .sidenav,body.ecom-print .navbackdrop,body.ecom-print .hero,body.ecom-print #readOnlyNote,body.ecom-print .ecomInvoiceActions{display:none!important}body.ecom-print .shell{padding:0!important;margin:0!important;max-width:none!important}body.ecom-print #workspaceBody>*:not(.ecomPrintArea){display:none!important}body.ecom-print .ecomPrintArea{box-shadow:none!important;border:0!important;padding:0!important}body.ecom-print .tablewrap{overflow:visible!important}body.ecom-print table{min-width:0!important}body.ecom-print th,body.ecom-print td{font-size:8px!important;padding:6px!important;color:#111!important}}

      @media(max-width:900px){.ecomGrid{grid-template-columns:1fr}.ecomKpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.ecomHead{align-items:stretch;flex-direction:column}.ecomHeadActions{justify-content:space-between}.ecomKpis{grid-template-columns:1fr 1fr}.ecomForm .formGrid{grid-template-columns:1fr}.ecomOrderLine{grid-template-columns:1fr 80px 32px}}
    `;document.head.appendChild(style);
  }
}
async function openEcommerce(){
  if(!roleCanView('ecommerce'))return dashboard();
  $('workspaceTitle').textContent='E-commerce';
  $('workspaceSubtitle').textContent=model.company.name+' · Separate Online Store';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading e-commerce…</div></div>';
  const [dash,productsData,ordersData]=await Promise.all([
    json('/api/bizora-company?action=ecommerce_dashboard'),
    json('/api/bizora-company?action=ecommerce_products'),
    json('/api/bizora-company?action=ecommerce_orders')
  ]);
  let products=productsData.records||[],orders=ordersData.records||[],tab='overview',editing=null;
  const render=()=>{
    const st=dash.stats||{},settings=dash.settings||{},publicStoreUrl='/store.html?company='+encodeURIComponent(model.company.code);
    $('workspaceBody').innerHTML=
      '<div class="ecomHead"><div><span class="capEyebrow">SEPARATE STORE SYSTEM</span><h2>'+esc(settings.store_name||model.company.name)+'</h2><p>Store products, stock and orders ERP products/invoices se separate hain.</p></div><div class="ecomHeadActions"><button type="button" id="ecomSalesReport" class="secondary">Sales Statement</button><a class="secondary ecomOpenStore" href="'+publicStoreUrl+'" target="_blank" rel="noopener">Open Store</a><span class="planBadge">'+esc(model.subscription.plan_name||'Plan')+'</span></div></div>'+
      '<div class="ecomTabs"><button data-tab="overview" class="'+(tab==='overview'?'active':'')+'">Overview</button><button data-tab="products" class="'+(tab==='products'?'active':'')+'">Products</button><button data-tab="orders" class="'+(tab==='orders'?'active':'')+'">Orders</button><button data-tab="settings" class="'+(tab==='settings'?'active':'')+'">Store Settings</button></div>'+
      (tab==='overview'?'<div class="ecomKpis">'+[['Products',st.products],['Active Products',st.active_products],['Pending Orders',st.pending_orders],['Completed Orders',st.completed_orders],['Completed Sales',money(st.completed_sales)]].map(x=>'<div><small>'+esc(x[0])+'</small><b>'+esc(x[1]??0)+'</b></div>').join('')+'</div><div class="card"><div class="reportSectionTitle"><b>Recent Orders</b><span>'+esc((dash.recent_orders||[]).length)+' latest</span></div>'+orderTable(dash.recent_orders||[])+'</div>':'')+
      (tab==='products'?'<div class="ecomGrid"><div class="card">'+productTable(products)+'</div><form id="ecomProductForm" class="card ecomForm"><h3>'+(editing?'Edit Product':'Add Store Product')+'</h3><div class="formGrid"><label>SKU<input name="sku" required value="'+esc(editing?.sku||'')+'"></label><label>Product Name<input name="product_name" required value="'+esc(editing?.product_name||'')+'"></label><label>Price<input name="price" type="number" min="0" step="0.01" required value="'+esc(editing?.price||0)+'"></label><label>Store Stock<input name="stock_qty" type="number" min="0" step="0.001" required value="'+esc(editing?.stock_qty||0)+'"></label><label>Image URL<input name="image_url" value="'+esc(editing?.image_url||'')+'"></label></div><label>Description<textarea name="description">'+esc(editing?.description||'')+'</textarea></label><div class="ecomFormActions">'+(editing?'<button type="button" id="cancelEcomEdit" class="secondary">Cancel</button>':'')+'<button class="primary">'+(editing?'Save Changes':'Add Product')+'</button></div></form></div>':'')+
      (tab==='orders'?'<div class="ecomGrid"><div class="card">'+orderTable(orders)+'</div><form id="ecomOrderForm" class="card ecomForm"><h3>New Manual Order</h3><div class="ecomNote">Customer storefront phase se pehla orders ko yahan manually test bhi kiya ja sakta hai.</div><div class="formGrid"><label>Customer Name<input name="customer_name" required></label><label>Phone<input name="phone" required></label><label>Payment<select name="payment_method"><option>COD</option><option>CASH</option><option>BANK</option><option>EASYPAISA</option><option>JAZZCASH</option><option>ONLINE</option></select></label><label>Delivery Charge<input name="delivery_charge" type="number" min="0" step="0.01" value="'+Number(settings.delivery_charge||0)+'"></label></div><label>Address<textarea name="address"></textarea></label><div class="lineHead"><div><b>Order Products</b><small>Separate store stock</small></div><button id="addEcomOrderLine" type="button" class="secondary">+ Product</button></div><div id="ecomOrderLines" class="ecomOrderLines"></div><label>Notes<textarea name="notes"></textarea></label><div class="ecomFormActions"><button class="primary">Create Order</button></div></form></div>':'')+
      (tab==='settings'?'<form id="ecomSettingsForm" class="card ecomForm"><h3>Store Settings</h3><div class="formGrid"><label>Store Name<input name="store_name" required value="'+esc(settings.store_name||model.company.name)+'"></label><label>Contact Phone<input name="contact_phone" value="'+esc(settings.contact_phone||'')+'"></label><label>WhatsApp Number<input name="whatsapp_number" value="'+esc(settings.whatsapp_number||'')+'"></label><label>Default Delivery Charge<input name="delivery_charge" type="number" min="0" step="0.01" value="'+Number(settings.delivery_charge||0)+'"></label></div><label>Store Address<textarea name="address">'+esc(settings.address||'')+'</textarea></label><label><input name="active" type="checkbox" '+(settings.active!==false?'checked':'')+'> Store Active</label><div class="ecomFormActions"><button class="primary">Save Settings</button></div></form>':'');
    wire();
  };
  const productTable=rows=>'<div class="tablewrap"><table><thead><tr><th>Product</th><th>Price</th><th>Store Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+(rows.length?rows.map(p=>'<tr><td><div class="ecomProductCell">'+(p.image_url?'<img class="ecomProductImg" src="'+esc(p.image_url)+'" alt="">':'<div class="ecomProductImg"></div>')+'<span><b>'+esc(p.product_name)+'</b><small>'+esc(p.sku)+'</small></span></div></td><td>'+money(p.price)+'</td><td>'+esc(p.stock_qty)+'</td><td><span class="pill '+(p.active?'active':'inactive')+'">'+(p.active?'Active':'Inactive')+'</span></td><td><div class="rowactions"><button class="secondary ecomEdit" data-id="'+p.id+'">Edit</button><button class="secondary ecomToggle" data-id="'+p.id+'" data-active="'+(p.active?'1':'0')+'">'+(p.active?'Disable':'Enable')+'</button></div></td></tr>').join(''):'<tr><td colspan="5">No store products yet</td></tr>')+'</tbody></table></div>';
  const orderTable=rows=>'<div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>'+(rows.length?rows.map(o=>'<tr><td><b>'+esc(o.order_number)+'</b><small>'+esc(new Date(o.created_at).toLocaleString('en-GB'))+'</small></td><td>'+esc(o.customer_name)+'<small>'+esc(o.phone)+'</small></td><td>'+esc(o.item_count??'—')+'</td><td>'+money(o.total)+'</td><td>'+esc(o.payment_method)+'</td><td><select class="ecomOrderStatus" data-id="'+o.id+'">'+['pending','confirmed','packed','shipped','completed','cancelled'].map(x=>'<option value="'+x+'" '+(o.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></td></tr>').join(''):'<tr><td colspan="6">No orders yet</td></tr>')+'</tbody></table></div>';
  const orderLine=()=>'<div class="ecomOrderLine"><label>Product<select class="ecomOrderProduct" required><option value="">Select Product</option>'+products.filter(p=>p.active&&Number(p.stock_qty)>0).map(p=>'<option value="'+p.id+'">'+esc(p.product_name)+' · Stock '+esc(p.stock_qty)+' · '+money(p.price)+'</option>').join('')+'</select></label><label>Qty<input class="ecomOrderQty" type="number" min="0.001" step="0.001" value="1" required></label><button type="button" class="secondary ecomOrderRemove">×</button></div>';
  const reload=async()=>{const [d,p,o]=await Promise.all([json('/api/bizora-company?action=ecommerce_dashboard'),json('/api/bizora-company?action=ecommerce_products'),json('/api/bizora-company?action=ecommerce_orders')]);Object.assign(dash,d);products=p.records||[];orders=o.records||[];editing=null;render()};
  const wire=()=>{
    if($('ecomSalesReport'))$('ecomSalesReport').onclick=()=>openEcommerceSalesReport().catch(e=>alert(e.message));
    document.querySelectorAll('.ecomOrderView').forEach(b=>b.onclick=()=>openEcommerceOrderDetail(Number(b.dataset.id)).catch(e=>alert(e.message)));
    document.querySelectorAll('.ecomTabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;editing=null;render()});
    document.querySelectorAll('.ecomEdit').forEach(b=>b.onclick=()=>{editing=products.find(x=>Number(x.id)===Number(b.dataset.id))||null;render()});
    document.querySelectorAll('.ecomToggle').forEach(b=>b.onclick=async()=>{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_ecommerce_product_status',product_id:Number(b.dataset.id),active:b.dataset.active!=='1'})});await reload()});
    document.querySelectorAll('.ecomOrderStatus').forEach(sel=>sel.onchange=async()=>{try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_ecommerce_order_status',order_id:Number(sel.dataset.id),status:sel.value})});await reload()}catch(e){alert(e.message);await reload()}});
    if($('ecomProductForm'))$('ecomProductForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_ecommerce_product',product_id:editing?.id||null,...data})});await reload()};
    if($('cancelEcomEdit'))$('cancelEcomEdit').onclick=()=>{editing=null;render()};
    if($('ecomSettingsForm'))$('ecomSettingsForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));data.active=e.currentTarget.elements.active.checked;await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_ecommerce_settings',...data})});await reload()};
    if($('ecomOrderForm')){
      const holder=$('ecomOrderLines');holder.innerHTML=orderLine();$('addEcomOrderLine').onclick=()=>holder.insertAdjacentHTML('beforeend',orderLine());holder.onclick=e=>{if(e.target.closest('.ecomOrderRemove')&&holder.querySelectorAll('.ecomOrderLine').length>1)e.target.closest('.ecomOrderLine').remove()};
      $('ecomOrderForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));data.items=[...holder.querySelectorAll('.ecomOrderLine')].map(x=>({product_id:Number(x.querySelector('.ecomOrderProduct').value||0),quantity:Number(x.querySelector('.ecomOrderQty').value||0)}));if(data.items.some(x=>!x.product_id||x.quantity<=0))return alert('Valid order products required');await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_ecommerce_order',...data})});await reload()};
    }
  };
  render();
}

async function openEcommerceOrderDetail(orderId){
  $('workspaceTitle').textContent='E-commerce Order';
  $('workspaceSubtitle').textContent=model.company.name+' · Separate Store Billing';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading order…</div></div>';
  const d=await json('/api/bizora-company?action=ecommerce_order_detail&order_id='+orderId),o=d.order||{},items=d.items||[],store=d.store||{};
  $('workspaceBody').innerHTML=
    '<div class="ecomInvoiceActions"><button id="ecomInvoiceBack" class="secondary">← E-commerce</button><button id="ecomInvoicePrint" class="primary">Print / Save PDF</button></div>'+
    '<div id="ecomPrintable" class="card ecomInvoice ecomPrintArea">'+
      '<div class="ecomInvoiceTitle"><div><span class="capEyebrow">BIZORA E-COMMERCE INVOICE</span><h2>'+esc(store.store_name||model.company.name)+'</h2><p>'+esc(store.address||'Separate online store billing')+'</p></div><div class="ecomInvoiceBadge"><b>'+esc(o.order_number)+'</b><span class="ecomStatus '+esc(o.status)+'">'+esc(o.status)+'</span></div></div>'+
      '<div class="ecomInvoiceMeta"><div><small>Customer</small><b>'+esc(o.customer_name)+'</b></div><div><small>Phone</small><b>'+esc(o.phone)+'</b></div><div><small>Order Date</small><b>'+esc(new Date(o.created_at).toLocaleString('en-GB'))+'</b></div><div><small>Payment Method</small><b>'+esc(o.payment_method)+'</b></div><div><small>Payment Status</small><b><span class="ecomPayStatus '+esc(o.payment_status||'unpaid')+'">'+esc(o.payment_status||'unpaid')+'</span></b></div><div><small>Payment Ref</small><b>'+esc(o.payment_reference||'—')+'</b></div><div><small>Address</small><b>'+esc(o.address||'—')+'</b></div><div><small>Notes</small><b>'+esc(o.notes||'—')+'</b></div></div>'+
      '<div class="tablewrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>'+
        (items.length?items.map(x=>'<tr><td>'+esc(x.sku||'—')+'</td><td><b>'+esc(x.product_name)+'</b></td><td>'+esc(x.quantity)+'</td><td>'+money(x.unit_price)+'</td><td>'+money(x.line_total)+'</td></tr>').join(''):'<tr><td colspan="5">No order items</td></tr>')+
      '</tbody></table></div>'+
      '<div class="ecomInvoiceTotals"><div><span>Subtotal</span><b>'+money(o.subtotal)+'</b></div><div><span>Delivery</span><b>'+money(o.delivery_charge)+'</b></div><div class="grand"><span>Grand Total</span><b>'+money(o.total)+'</b></div></div>'+
    '</div>'+
    '<div class="card ecomForm"><h3>Payment Control</h3><div class="formGrid"><label>Payment Status<select id="ecomPaymentStatus"><option value="unpaid" '+(o.payment_status==='unpaid'?'selected':'')+'>Unpaid</option><option value="paid" '+(o.payment_status==='paid'?'selected':'')+'>Paid</option><option value="refunded" '+(o.payment_status==='refunded'?'selected':'')+'>Refunded</option></select></label><label>Payment Reference<input id="ecomPaymentReference" value="'+esc(o.payment_reference||'')+'" placeholder="Transaction / receipt reference"></label></div><div class="ecomFormActions"><button id="saveEcomPayment" class="primary">Save Payment Status</button></div></div>';
  $('ecomInvoiceBack').onclick=()=>openEcommerce().catch(e=>alert(e.message));
  $('ecomInvoicePrint').onclick=()=>{document.body.classList.add('ecom-print');window.print();setTimeout(()=>document.body.classList.remove('ecom-print'),500)};
  $('saveEcomPayment').onclick=async()=>{
    const b=$('saveEcomPayment');b.disabled=true;b.textContent='Saving…';
    try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_ecommerce_payment_status',order_id:orderId,payment_status:$('ecomPaymentStatus').value,payment_reference:$('ecomPaymentReference').value})});await openEcommerceOrderDetail(orderId)}
    catch(e){alert(e.message)}finally{b.disabled=false;b.textContent='Save Payment Status'}
  };
}
async function openEcommerceSalesReport(){
  $('workspaceTitle').textContent='E-commerce Sales Statement';
  $('workspaceSubtitle').textContent=model.company.name+' · Separate Store';
  $('addRecord').classList.add('hidden');
  const today=new Date(),iso=d=>d.toISOString().slice(0,10),todayIso=iso(today);
  $('workspaceBody').innerHTML=
    '<div class="ecomInvoiceActions"><button id="ecomReportBack" class="secondary">← E-commerce</button><button id="ecomReportPrint" class="primary">Print Statement</button></div>'+
    '<div class="card reportCard ecomPrintArea"><div class="ecomReportToolbar"><div class="ecomReportRanges"><button class="secondary active" data-range="daily">Daily</button><button class="secondary" data-range="weekly">Weekly</button><button class="secondary" data-range="monthly">Monthly</button><button class="secondary" data-range="yearly">Yearly</button></div><div class="ecomReportDates"><label>From<input id="ecomReportFrom" type="date" value="'+todayIso+'"></label><label>To<input id="ecomReportTo" type="date" value="'+todayIso+'"></label><button id="ecomReportApply" class="secondary">Apply</button></div></div><div id="ecomReportContent"><div class="emptyLines">Loading statement…</div></div></div>';
  const setRange=kind=>{const end=new Date(),start=new Date(end);if(kind==='daily')start.setHours(0,0,0,0);if(kind==='weekly')start.setDate(end.getDate()-6);if(kind==='monthly')start.setDate(1);if(kind==='yearly'){start.setMonth(0,1)}$('ecomReportFrom').value=iso(start);$('ecomReportTo').value=iso(end)};
  const load=async()=>{
    const from=$('ecomReportFrom').value,to=$('ecomReportTo').value,d=await json('/api/bizora-company?action=ecommerce_sales_report&date_from='+encodeURIComponent(from)+'&date_to='+encodeURIComponent(to)),s=d.summary||{},days=d.daily||[],methods=d.payment_methods||[];
    $('ecomReportContent').innerHTML=
      '<div class="reportSectionTitle"><div><span class="capEyebrow">E-COMMERCE SALES</span><h2 style="margin:4px 0 0">'+esc(model.company.name)+'</h2></div><span>'+date(d.date_from)+' → '+date(d.date_to)+'</span></div>'+
      '<div class="ecomReportKpis">'+[['Orders',s.order_count],['Completed Orders',s.completed_orders],['Cancelled',s.cancelled_orders],['Gross Orders',money(s.gross_orders)],['Completed Sales',money(s.completed_sales)],['Paid Collection',money(s.paid_collections)],['Unpaid Amount',money(s.unpaid_amount)],['Refunded',money(s.refunded_amount)]].map(x=>'<div><small>'+esc(x[0])+'</small><b>'+esc(x[1]??0)+'</b></div>').join('')+'</div>'+
      '<div class="reportSectionTitle"><b>Payment Methods</b><span>Order value by method</span></div><div class="ecomMethodGrid">'+(methods.length?methods.map(x=>'<div><span>'+esc(x.payment_method)+' · '+esc(x.orders)+' orders</span><b>'+money(x.amount)+'</b></div>').join(''):'<div><span>No orders</span><b>PKR 0</b></div>')+'</div>'+
      '<div class="reportSectionTitle"><b>Daily Summary</b><span>'+days.length+' active days</span></div><div class="tablewrap"><table><thead><tr><th>Date</th><th>Orders</th><th>Order Value</th><th>Completed Sales</th><th>Paid Collection</th></tr></thead><tbody>'+
      (days.length?days.map(x=>'<tr><td>'+date(x.day)+'</td><td>'+esc(x.orders)+'</td><td>'+money(x.order_value)+'</td><td>'+money(x.completed_sales)+'</td><td>'+money(x.paid_collections)+'</td></tr>').join(''):'<tr><td colspan="5">No e-commerce activity in selected period</td></tr>')+'</tbody></table></div>';
  };
  document.querySelectorAll('.ecomReportRanges button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.ecomReportRanges button').forEach(x=>x.classList.toggle('active',x===b));setRange(b.dataset.range);load().catch(e=>alert(e.message))});
  $('ecomReportApply').onclick=()=>{document.querySelectorAll('.ecomReportRanges button').forEach(x=>x.classList.remove('active'));load().catch(e=>alert(e.message))};
  $('ecomReportBack').onclick=()=>openEcommerce().catch(e=>alert(e.message));
  $('ecomReportPrint').onclick=()=>{document.body.classList.add('ecom-print');window.print();setTimeout(()=>document.body.classList.remove('ecom-print'),500)};
  setRange('daily');await load();
}

function installCashierModule(){
  if(document.querySelector('[data-view="cashier"]'))return;
  const salesButtons=[...document.querySelectorAll('#workspaceNav .navSection')].find(x=>/Sales/i.test(x.querySelector('.navSectionTitle')?.textContent||''));
  if(!salesButtons)return;
  const btn=document.createElement('button');
  btn.type='button';btn.dataset.view='cashier';btn.dataset.feature='cashier';
  btn.innerHTML='<span class="navIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M7 9h10M7 13h4"/><circle cx="17" cy="15" r="2"/></svg></span><span class="navLabel">Cashier / Counter Sale</span><span class="navChevron">›</span>';
  salesButtons.appendChild(btn);
  if(!document.getElementById('bizoraCashierStyles')){
    const style=document.createElement('style');style.id='bizoraCashierStyles';style.textContent=`
      .cashierShell{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,.85fr);gap:14px}
      .cashierPanel,.cashierCart{padding:16px!important}
      .cashierTop{display:grid;grid-template-columns:1fr 220px;gap:10px;margin-bottom:12px}
      .cashierSearch{position:relative}.cashierSearch input{width:100%;font-size:14px}
      .cashierSuggestions{position:absolute;left:0;right:0;top:100%;z-index:12;margin-top:5px;max-height:280px;overflow:auto;border:1px solid #dbe6f3;border-radius:14px;background:#fff;box-shadow:0 18px 40px rgba(26,55,102,.16)}
      .cashierSuggestions button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:0;border-bottom:1px solid #edf1f6;background:#fff;color:#17213a;text-align:left}
      .cashierSuggestions button:last-child{border-bottom:0}.cashierSuggestions button:hover{background:#f3f7ff}
      .cashierSuggestions small{display:block;color:#74829a;font-size:9px;margin-top:2px}
      .cashierStockTag{font-size:9px;font-weight:900;color:#0c7a59;background:#eaf9f2;border:1px solid #c8eadb;padding:4px 7px;border-radius:999px;white-space:nowrap}
      .cashierCartHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.cashierCartHead h2{margin:0;color:#14213d;font-size:18px}.cashierCartHead small{color:#76839a}
      .cashierItems{display:grid;gap:8px;max-height:480px;overflow:auto;padding-right:2px}
      .cashierItem{display:grid;grid-template-columns:minmax(0,1fr) 92px 105px 34px;gap:7px;align-items:center;padding:10px;border:1px solid #dfe7f2;border-radius:14px;background:#fbfdff}
      .cashierItemName b{display:block;color:#17213a;font-size:12px}.cashierItemName small{display:block;color:#7a879e;font-size:9px;margin-top:2px}
      .cashierItem input{min-width:0;width:100%;padding:8px!important}.cashierRemove{width:34px;height:34px;padding:0!important;border-radius:10px!important}
      .cashierEmpty{padding:28px 14px;text-align:center;border:1px dashed #cad8e9;border-radius:16px;color:#7a879e;background:#fbfdff}
      .cashierTotals{margin-top:12px;border-top:1px solid #e1e8f2;padding-top:12px;display:grid;gap:7px}.cashierTotals div{display:flex;justify-content:space-between;gap:12px;color:#5f6f89;font-size:11px}.cashierTotals .grand{font-size:16px;color:#10265a;font-weight:900}
      .cashierCheckout{display:grid;gap:9px}.cashierCheckout label{margin:0}.cashierCheckout .formGrid{grid-template-columns:1fr 1fr}
      .cashierPayModes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.cashierPayModes label{display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;border:1px solid #dbe5f2;border-radius:12px;background:#fff;color:#33415c;font-size:10px;font-weight:800;cursor:pointer}.cashierPayModes input{width:auto}
      .cashierCheckoutBtn{width:100%;margin-top:4px;min-height:46px!important}
      .cashierRecent{margin-top:14px}.cashierRecent h3{margin:0 0 9px;color:#17213a;font-size:14px}
      .cashierRecentRow{display:grid;grid-template-columns:1fr auto;gap:8px;padding:9px 0;border-bottom:1px solid #edf1f6}.cashierRecentRow:last-child{border-bottom:0}.cashierRecentRow b{display:block;color:#1b2944;font-size:11px}.cashierRecentRow small{display:block;color:#7a879e;font-size:9px;margin-top:2px}
      .cashierStatus{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase}.cashierStatus.paid{background:#e9fbf2;color:#087f58}.cashierStatus.partial{background:#eef3ff;color:#365cc5}.cashierStatus.unpaid{background:#fff5df;color:#946200}
      .cashierReceipt{padding:18px!important}.cashierReceiptHead{text-align:center;padding-bottom:12px;border-bottom:1px dashed #cbd5e1}.cashierReceiptHead h2{margin:3px 0;color:#111827}.cashierReceiptMeta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.cashierReceiptMeta div{padding:9px;border-radius:10px;background:#f7f9fc}.cashierReceiptMeta small{display:block;color:#7a879e;font-size:8px}.cashierReceiptMeta b{display:block;margin-top:2px;color:#17213a;font-size:11px}
      .cashierReceiptActions{display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px}
      @media(max-width:900px){.cashierShell{grid-template-columns:1fr}.cashierItems{max-height:none}}
      @media(max-width:620px){.cashierTop{grid-template-columns:1fr}.cashierItem{grid-template-columns:minmax(0,1fr) 80px 92px 32px}.cashierCheckout .formGrid{grid-template-columns:1fr}.cashierPayModes{grid-template-columns:1fr 1fr 1fr}}
      @media(max-width:430px){.cashierItem{grid-template-columns:1fr 1fr}.cashierItemName{grid-column:1/-1}.cashierRemove{position:absolute;right:8px;top:8px}.cashierItem{position:relative;padding-top:13px}.cashierPayModes{grid-template-columns:1fr}.cashierReceiptMeta{grid-template-columns:1fr}}
      @media print{body.cashier-print .topbar,body.cashier-print .sidenav,body.cashier-print .navbackdrop,body.cashier-print .hero,body.cashier-print #readOnlyNote,body.cashier-print .cashierReceiptActions{display:none!important}body.cashier-print .shell{padding:0!important;margin:0!important}body.cashier-print #workspaceBody>*:not(.cashierReceipt){display:none!important}body.cashier-print .cashierReceipt{display:block!important;box-shadow:none!important;border:0!important}}
    `;document.head.appendChild(style);
  }
}
async function ensureWalkInCustomer(){
  let clients=optionCache.clients;
  if(!clients)clients=(await json('/api/bizora-company?action=clients')).records||[],optionCache.clients=clients;
  let walk=clients.find(x=>String(x.client_code||'').toUpperCase()==='WALKIN'||String(x.business_name||'').toLowerCase()==='walking customer');
  if(walk)return walk;
  try{
    const created=await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_client',client_code:'WALKIN',business_name:'Walking Customer',contact_person:'Counter Sale',mobile_number:'',credit_limit:0,opening_balance:0})});
    walk=created.record;optionCache.clients=[walk,...clients];return walk;
  }catch(e){
    optionCache.clients=(await json('/api/bizora-company?action=clients')).records||[];
    walk=optionCache.clients.find(x=>String(x.client_code||'').toUpperCase()==='WALKIN'||String(x.business_name||'').toLowerCase()==='walking customer');
    if(walk)return walk;throw e;
  }
}
async function openCashier(){
  if(!roleCanView('cashier'))return dashboard();
  $('workspaceTitle').textContent='Cashier / Counter Sale';
  $('workspaceSubtitle').textContent=model.company.name+' · Fast Billing';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading cashier…</div></div>';
  const [clients,warehouses,products,stock,walk]=await Promise.all([
    partyOptions('client'),partyOptions('warehouse'),
    json('/api/bizora-company?action=products').then(x=>x.records||[]),
    json('/api/bizora-company?action=inventory_stock').then(x=>x.records||[]),
    ensureWalkInCustomer()
  ]);
  const productRows=products.filter(x=>x.active!==false);
  const stockByKey=new Map(stock.map(x=>[String(x.warehouse_id)+':'+String(x.product_id),Number(x.quantity||0)]));
  let cart=[];
  $('workspaceBody').innerHTML=
    '<div class="cashierShell">'+
      '<div class="card cashierPanel">'+
        '<div class="cashierTop"><div class="cashierSearch"><input id="cashierSearch" autocomplete="off" placeholder="Search product / SKU / barcode..."><div id="cashierSuggestions" class="cashierSuggestions hidden"></div></div><label>Warehouse<select id="cashierWarehouse"><option value="">Select Warehouse</option>'+warehouses.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label></div>'+
        '<div id="cashierItems" class="cashierItems"><div class="cashierEmpty">Search or scan a product to start billing.</div></div>'+
        '<div class="cashierTotals"><div><span>Items</span><b id="cashierItemCount">0</b></div><div class="grand"><span>Bill Total</span><b id="cashierGrandTotal">PKR 0</b></div></div>'+
      '</div>'+
      '<div class="card cashierCart">'+
        '<div class="cashierCartHead"><div><h2>Checkout</h2><small>Counter sale payment</small></div></div>'+
        '<div class="cashierCheckout">'+
          '<label>Customer<select id="cashierCustomer"><option value="'+walk.id+'">Walking Customer</option>'+clients.filter(o=>Number(o.value)!==Number(walk.id)).map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label>'+
          '<div class="cashierPayModes"><label><input type="radio" name="cashierSaleType" value="paid" checked> Paid</label><label><input type="radio" name="cashierSaleType" value="partial"> Partial</label><label><input type="radio" name="cashierSaleType" value="credit"> Credit</label></div>'+
          '<div class="formGrid"><label>Paid Amount<input id="cashierPaidAmount" type="number" min="0" step="0.01" value="0"></label><label>Payment Method<select id="cashierPaymentMethod"><option>CASH</option><option>BANK</option><option>EASYPAISA</option><option>JAZZCASH</option><option>ONLINE</option><option>CHEQUE</option></select></label></div>'+
          '<label>Reference<input id="cashierReference" placeholder="Optional payment reference"></label>'+
          '<button id="cashierCheckoutBtn" class="primary cashierCheckoutBtn">Create Invoice & Complete Sale</button>'+
        '</div>'+
        '<div class="cashierRecent"><h3>Recent Counter Sales</h3><div id="cashierRecentRows"><div class="emptyLines">Loading…</div></div></div>'+
      '</div>'+
    '</div>';
  const search=$('cashierSearch'),suggestions=$('cashierSuggestions'),warehouse=$('cashierWarehouse'),itemsEl=$('cashierItems'),paid=$('cashierPaidAmount');
  const total=()=>cart.reduce((n,x)=>n+Number(x.qty)*Number(x.price),0);
  const renderCart=()=>{
    if(!cart.length)itemsEl.innerHTML='<div class="cashierEmpty">Search or scan a product to start billing.</div>';
    else itemsEl.innerHTML=cart.map((x,i)=>'<div class="cashierItem" data-index="'+i+'"><div class="cashierItemName"><b>'+esc(x.product_name)+'</b><small>'+esc(x.sku||'')+(x.barcode?' · '+esc(x.barcode):'')+'</small></div><input class="cashierQty" type="number" min="0.001" step="0.001" value="'+x.qty+'"><input class="cashierPrice" type="number" min="0" step="0.01" value="'+x.price+'"><button class="secondary cashierRemove" type="button">×</button></div>').join('');
    $('cashierItemCount').textContent=cart.reduce((n,x)=>n+Number(x.qty||0),0).toLocaleString('en-PK',{maximumFractionDigits:3});
    $('cashierGrandTotal').textContent=money(total());
    const type=document.querySelector('input[name="cashierSaleType"]:checked')?.value||'paid';
    if(type==='paid')paid.value=Number(total().toFixed(2));
  };
  const addProduct=p=>{
    if(!warehouse.value){alert('Pehla warehouse select karein');return}
    const available=stockByKey.get(String(warehouse.value)+':'+String(p.id))||0;
    if(available<=0){alert('Selected warehouse mein is product ka stock available nahi');return}
    const found=cart.find(x=>Number(x.id)===Number(p.id));
    if(found){if(found.qty+1>available){alert('Available stock '+available);return}found.qty+=1}
    else cart.push({...p,qty:1,price:Number(p.sale_price||0),available});
    renderCart();search.value='';suggestions.classList.add('hidden');search.focus();
  };
  const showSuggestions=()=>{
    const q=search.value.trim().toLowerCase();if(!q){suggestions.classList.add('hidden');return}
    const exact=productRows.find(p=>String(p.barcode||'').toLowerCase()===q||String(p.sku||'').toLowerCase()===q);
    if(exact&&q.length>=3){addProduct(exact);return}
    const rows=productRows.filter(p=>[p.product_name,p.sku,p.barcode].join(' ').toLowerCase().includes(q)).slice(0,12);
    suggestions.innerHTML=rows.length?rows.map(p=>{const available=warehouse.value?(stockByKey.get(String(warehouse.value)+':'+String(p.id))||0):0;return '<button type="button" data-id="'+p.id+'"><span><b>'+esc(p.product_name)+'</b><small>'+esc(p.sku||'')+(p.barcode?' · '+esc(p.barcode):'')+' · '+money(p.sale_price)+'</small></span><span class="cashierStockTag">'+(warehouse.value?'Stock '+available:'Select WH')+'</span></button>'}).join(''):'<div class="cashierEmpty">No matching product</div>';
    suggestions.classList.remove('hidden');
  };
  search.oninput=showSuggestions;warehouse.onchange=()=>{cart=[];renderCart();showSuggestions()};
  suggestions.onclick=e=>{const b=e.target.closest('button[data-id]');if(b){const p=productRows.find(x=>String(x.id)===b.dataset.id);if(p)addProduct(p)}};
  itemsEl.oninput=e=>{
    const row=e.target.closest('.cashierItem');if(!row)return;const x=cart[Number(row.dataset.index)];if(!x)return;
    if(e.target.classList.contains('cashierQty')){const q=Math.max(.001,Number(e.target.value||0));if(q>x.available){e.target.value=x.available;x.qty=x.available;alert('Available stock '+x.available)}else x.qty=q}
    if(e.target.classList.contains('cashierPrice'))x.price=Math.max(0,Number(e.target.value||0));renderCart();
  };
  itemsEl.onclick=e=>{const b=e.target.closest('.cashierRemove');if(!b)return;const row=b.closest('.cashierItem');cart.splice(Number(row.dataset.index),1);renderCart()};
  document.querySelectorAll('input[name="cashierSaleType"]').forEach(r=>r.onchange=()=>{
    const t=r.value,box=$('cashierPaidAmount');if(!r.checked)return;
    if(t==='paid')box.value=Number(total().toFixed(2));else if(t==='credit')box.value=0;else box.value=Math.min(Number(box.value||0),total());
    box.disabled=t==='credit';
  });
  async function loadRecent(){
    const invoices=(await json('/api/bizora-company?action=client_invoices')).records||[];
    const rows=invoices.filter(x=>String(x.invoice_number||'').startsWith('CS-')).slice(0,8);
    $('cashierRecentRows').innerHTML=rows.length?rows.map(x=>'<div class="cashierRecentRow"><div><b>'+esc(x.invoice_number)+' · '+esc(x.business_name)+'</b><small>'+date(x.invoice_date)+' · '+money(x.amount)+'</small></div><span class="cashierStatus '+esc(x.status||'unpaid')+'">'+esc(x.status||'unpaid')+'</span></div>').join(''):'<div class="emptyLines">No counter sales yet</div>';
  }
  $('cashierCheckoutBtn').onclick=async()=>{
    const btn=$('cashierCheckoutBtn'),bill=total(),type=document.querySelector('input[name="cashierSaleType"]:checked')?.value||'paid',paidAmount=type==='credit'?0:Number(paid.value||0);
    if(!warehouse.value)return alert('Warehouse select karein');
    if(!cart.length)return alert('Bill mein products add karein');
    if(type==='paid'&&Math.abs(paidAmount-bill)>.01)return alert('Paid sale mein paid amount bill total ke barabar hona chahye');
    if(type==='partial'&&(paidAmount<=0||paidAmount>=bill))return alert('Partial payment 0 se zyada aur bill total se kam honi chahye');
    if(cart.some(x=>x.qty>x.available))return alert('Cart quantity available stock se zyada hai');
    btn.disabled=true;btn.textContent='Saving Sale…';
    try{
      const now=new Date(),invoiceNumber='CS-'+now.toISOString().slice(0,10).replaceAll('-','')+'-'+String(now.getTime()).slice(-8);
      const inv=await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        action:'create_client_invoice',client_id:Number($('cashierCustomer').value),warehouse_id:Number(warehouse.value),invoice_number:invoiceNumber,
        invoice_date:now.toISOString().slice(0,10),due_date:now.toISOString().slice(0,10),notes:'Cashier / Counter Sale',
        items:cart.map(x=>({product_id:x.id,quantity:x.qty,unit_price:x.price,description:'Counter Sale'}))
      })});
      if(paidAmount>0){
        await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          action:'create_client_receipt',client_id:Number($('cashierCustomer').value),invoice_id:inv.record.id,receipt_date:now.toISOString().slice(0,10),amount:paidAmount,
          payment_method:$('cashierPaymentMethod').value,reference_number:$('cashierReference').value||invoiceNumber,notes:'Cashier payment'
        })});
      }
      const receipt={invoiceNumber,date:now.toISOString(),customer:$('cashierCustomer').selectedOptions[0]?.textContent||'Walking Customer',warehouse:warehouse.selectedOptions[0]?.textContent||'',items:cart.map(x=>({...x})),total:bill,paid:paidAmount,balance:bill-paidAmount,method:paidAmount>0?$('cashierPaymentMethod').value:'CREDIT'};
      cart=[];renderCart();optionCache={};await showCashierReceipt(receipt,loadRecent);
    }catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Create Invoice & Complete Sale'}
  };
  renderCart();await loadRecent();search.focus();
}
async function showCashierReceipt(r,back){
  const rows=r.items||[];
  const html='<div class="cashierReceiptActions"><button id="cashierBack" class="secondary">← New Sale</button><button id="cashierPrint" class="primary">Print Receipt</button></div>'+
    '<div class="card cashierReceipt"><div class="cashierReceiptHead"><span class="capEyebrow">BIZORA ERP</span><h2>'+esc(model.company.name)+'</h2><small>Counter Sale Receipt</small></div>'+
    '<div class="cashierReceiptMeta"><div><small>Invoice</small><b>'+esc(r.invoiceNumber)+'</b></div><div><small>Date / Time</small><b>'+esc(new Date(r.date).toLocaleString('en-GB'))+'</b></div><div><small>Customer</small><b>'+esc(r.customer)+'</b></div><div><small>Warehouse</small><b>'+esc(r.warehouse)+'</b></div></div>'+
    '<div class="tablewrap"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.product_name)+'</td><td>'+esc(x.qty)+'</td><td>'+money(x.price)+'</td><td>'+money(Number(x.qty)*Number(x.price))+'</td></tr>').join('')+'</tbody></table></div>'+
    '<div class="cashierTotals"><div class="grand"><span>Bill Total</span><b>'+money(r.total)+'</b></div><div><span>Paid</span><b>'+money(r.paid)+'</b></div><div><span>Balance</span><b>'+money(r.balance)+'</b></div><div><span>Method</span><b>'+esc(r.method)+'</b></div></div></div>';
  $('workspaceBody').innerHTML=html;
  $('cashierBack').onclick=()=>openCashier().catch(e=>alert(e.message));
  $('cashierPrint').onclick=()=>{document.body.classList.add('cashier-print');window.print();setTimeout(()=>document.body.classList.remove('cashier-print'),500)};
}
async function openPaymentDetail(kind,row){
  const isSupplier=kind==='supplier',id=row.id;
  $('workspaceTitle').textContent=isSupplier?'Supplier Payment':'Customer Payment';
  $('workspaceSubtitle').textContent=row.business_name+' · '+money(row.amount);
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card"><div class="emptyLines">Loading payment…</div></div>';
  const d=await json('/api/bizora-company?action='+(isSupplier?'supplier_payment_detail&payment_id=':'client_receipt_detail&receipt_id=')+id),r=d.record||{},alloc=d.allocations||[],status=String(r.status||'posted').toLowerCase();
  const unallocated=Math.max(0,Number(r.amount||0)-alloc.reduce((n,x)=>n+Number(x.amount||0),0));
  $('workspaceBody').innerHTML=
    '<div class="paymentReceiptActions"><button id="paymentBack" class="secondary">← Back</button><div><span class="paymentStatus '+esc(status)+'">'+esc(status)+'</span><button id="printPaymentReceipt" class="secondary">Print / Save PDF</button>'+(status==='posted'&&model.subscription.access_mode==='write'?'<button id="cancelPayment" class="dangerAction">Cancel Payment</button>':'')+'</div></div>'+
    '<div class="card paymentReceipt paymentPrintable">'+
      '<div class="paymentReceiptTitle"><div><span class="capEyebrow">'+(isSupplier?'SUPPLIER PAYMENT':'CUSTOMER PAYMENT')+'</span><h2>'+esc(model.company.name)+'</h2><p>'+esc(r.business_name)+'</p></div><div><b>'+money(r.amount)+'</b><span>'+date(isSupplier?r.payment_date:r.receipt_date)+'</span></div></div>'+
      '<div class="paymentReceiptMeta"><div><small>'+(isSupplier?'Supplier':'Customer')+'</small><b>'+esc(r.business_name)+'</b></div><div><small>Method</small><b>'+esc(r.payment_method)+'</b></div><div><small>Reference</small><b>'+esc(r.reference_number||'—')+'</b></div><div><small>Status</small><b>'+esc(status)+'</b></div></div>'+
      '<div class="reportSectionTitle"><b>Invoice Allocation</b><span>'+alloc.length+' invoice(s)</span></div>'+
      '<div class="tablewrap"><table><thead><tr><th>Invoice</th><th>Allocated Amount</th></tr></thead><tbody>'+
        (alloc.length?alloc.map(x=>'<tr><td><b>'+esc(x.invoice_number)+'</b></td><td>'+money(x.amount)+'</td></tr>').join(''):'<tr><td colspan="2">No invoice allocation</td></tr>')+
      '</tbody></table></div>'+
      '<div class="paymentReceiptTotals"><div><span>Total Payment</span><b>'+money(r.amount)+'</b></div><div><span>Allocated</span><b>'+money(Number(r.amount||0)-unallocated)+'</b></div><div><span>Unallocated</span><b>'+money(unallocated)+'</b></div></div>'+
      (r.notes?'<div class="paymentReceiptNotes"><small>Notes</small><p>'+esc(r.notes)+'</p></div>':'')+
    '</div>';
  $('paymentBack').onclick=()=>show(isSupplier?'supplier-payments':'client-payments');
  $('printPaymentReceipt').onclick=()=>{document.body.classList.add('payment-print');window.print();setTimeout(()=>document.body.classList.remove('payment-print'),500)};
  if($('cancelPayment'))$('cancelPayment').onclick=async()=>{
    if(!confirm('Cancel this payment? Invoice allocations automatically reverse ho jayengi.'))return;
    try{await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:isSupplier?'cancel_supplier_payment':'cancel_client_receipt',[isSupplier?'payment_id':'receipt_id']:id})});optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await show(isSupplier?'supplier-payments':'client-payments')}
    catch(e){alert(e.message)}
  };
}
async function openPaymentForm(kind){
  const isSupplier=kind==='supplier',parties=await partyOptions(kind),today=new Date().toISOString().slice(0,10);
  const invoices=(await json('/api/bizora-company?action='+(isSupplier?'supplier_invoices':'client_invoices'))).records||[];
  $('recordTitle').textContent=isSupplier?'Add Supplier Payment':'Add Customer Payment';
  $('recordHint').textContent='Invoice selection optional — otherwise oldest unpaid invoice is adjusted first';
  $('recordFields').innerHTML='<div class="formGrid">'+
    '<label>'+(isSupplier?'Supplier':'Customer')+'<select name="'+(isSupplier?'supplier_id':'client_id')+'" id="paymentParty" required><option value="">Select '+(isSupplier?'Supplier':'Customer')+'</option>'+parties.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label>'+
    '<label>Unpaid Invoice (Optional)<select name="invoice_id" id="paymentInvoice"><option value="">Auto-adjust oldest unpaid invoice</option></select></label>'+
    '<label>Date<input name="'+(isSupplier?'payment_date':'receipt_date')+'" type="date" value="'+today+'" required></label>'+
    '<label>Amount<input name="amount" type="number" min="0.01" step="0.01" required></label>'+
    '<label>Method<select name="payment_method"><option>CASH</option><option>BANK</option><option>ONLINE</option><option>CHEQUE</option><option>EASYPAISA</option><option>JAZZCASH</option></select></label>'+
    '<label>Reference<input name="reference_number"></label></div><label>Notes<textarea name="notes"></textarea></label>';
  $('paymentParty').onchange=e=>{
    const partyId=Number(e.target.value||0),select=$('paymentInvoice');
    const relevant=invoices.filter(x=>Number(x[isSupplier?'supplier_id':'client_id'])===partyId&&String(x.status)!=='paid'&&String(x.status)!=='cancelled');
    select.innerHTML='<option value="">Auto-adjust oldest unpaid invoice</option>'+relevant.map(x=>'<option value="'+x.id+'">'+esc(x.invoice_number)+' · '+money(x.amount)+' · '+esc(x.status)+'</option>').join('');
  };
  $('recordDialog').showModal();
}
async function openPartyStatement(kind){
  const isSupplier=kind==='supplier',parties=await partyOptions(kind);
  $('workspaceTitle').textContent=isSupplier?'Supplier Statement':'Customer Statement';
  $('workspaceSubtitle').textContent=model.company.name+' · Account Statement';
  $('addRecord').classList.add('hidden');
  $('workspaceBody').innerHTML='<div class="card statementCard"><div class="statementChooser"><label>'+(isSupplier?'Supplier':'Customer')+'<select id="statementParty"><option value="">Select '+(isSupplier?'Supplier':'Customer')+'</option>'+parties.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label></div><div id="statementContent" class="emptyLines">Select account to view statement.</div></div>';
  $('statementParty').onchange=async e=>{
    const id=Number(e.target.value||0),box=$('statementContent');if(!id){box.className='emptyLines';box.innerHTML='Select account to view statement.';return}
    box.className='';box.innerHTML='<div class="emptyLines">Loading statement…</div>';
    const data=await json('/api/bizora-company?action='+(isSupplier?'supplier_statement&supplier_id=':'client_statement&client_id=')+id),rows=data.records||[];
    box.innerHTML='<div class="statementShareBar"><button id="shareStatementWhatsApp" class="secondary">Share Balance on WhatsApp</button></div><div class="statementSummary"><div><small>Account</small><b>'+esc(data.party.business_name)+'</b></div><div><small>Opening Balance</small><b>'+money(data.opening_balance)+'</b></div><div><small>Current Balance</small><b>'+money(data.balance)+'</b></div></div>'+
      '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Running Balance</th><th>Notes</th></tr></thead><tbody>'+
      (rows.length?rows.map(x=>'<tr><td>'+date(x.entry_date)+'</td><td>'+esc(x.entry_type)+'</td><td>'+esc(x.reference||'—')+'</td><td>'+money(x.debit)+'</td><td>'+money(x.credit)+'</td><td><b>'+money(x.running_balance)+'</b></td><td>'+esc(x.notes||'')+'</td></tr>').join(''):'<tr><td colspan="7">No transactions yet</td></tr>')+
      '</tbody></table></div>';
    if(!isSupplier&&$('shareStatementWhatsApp'))$('shareStatementWhatsApp').onclick=()=>prepareWhatsAppShare('client_statement',id).catch(e=>alert(e.message));
  };
}
async function openSupplierInvoiceForm(edit=null){
  const [suppliers,products]=await Promise.all([partyOptions('supplier'),partyOptions('product').then(async()=>optionCache.products||[])]);
  const today=new Date().toISOString().slice(0,10),productRows=optionCache.products||[],row=edit?.row||null,existing=edit?.items||[];
  invoiceEditContext=row?{type:'supplier',action:'update_supplier_invoice',invoice_id:row.id}:null;
  $('recordTitle').textContent=row?'Edit Supplier Invoice':'Add Supplier Invoice';
  $('recordHint').textContent=(row?'Protected product-wise edit · ':'Product-wise invoice · ')+model.company.name;
  $('recordFields').innerHTML=
    '<div class="formGrid">'+
      '<label>Supplier<select name="supplier_id" required><option value="">Select Supplier</option>'+suppliers.map(o=>'<option value="'+o.value+'" '+(row&&Number(o.value)===Number(row.supplier_id)?'selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select></label>'+
      '<label>Invoice Number<input name="invoice_number" value="'+esc(row?.invoice_number||'')+'" required></label>'+
      '<label>Invoice Date<input name="invoice_date" type="date" value="'+date(row?.invoice_date||today)+'" required></label>'+
      '<label>Due Date<input name="due_date" type="date" value="'+(row?.due_date?date(row.due_date):today)+'"></label>'+
    '</div>'+
    '<div class="lineHead"><div><b>Invoice Products</b><small>Add one or more products</small></div><button id="addInvoiceLine" type="button" class="secondary">+ Add Product</button></div>'+
    '<div id="invoiceItems" class="lineItems">'+(existing.length?existing.map(x=>supplierInvoiceItemRow(productRows,x)).join(''):supplierInvoiceItemRow(productRows))+'</div>'+
    '<div class="invoiceTotalBox"><span>Invoice Total</span><b id="invoiceTotal">PKR 0</b></div>'+
    '<label>Notes<textarea name="notes">'+esc(row?.notes||'')+'</textarea></label>';
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
async function openTransferForm(){
  const warehouses=await partyOptions('warehouse'),products=optionCache.products||(await json('/api/bizora-company?action=products')).records||[];
  optionCache.products=products;const today=new Date().toISOString().slice(0,10);
  $('recordTitle').textContent='Post Stock Transfer';$('recordHint').textContent='Move stock between Bizora warehouses';
  $('recordFields').innerHTML='<div class="formGrid"><label>From Warehouse<select name="from_warehouse_id" required><option value="">Select Warehouse</option>'+warehouses.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label><label>To Warehouse<select name="to_warehouse_id" required><option value="">Select Warehouse</option>'+warehouses.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label><label>Transfer Date<input name="transfer_date" type="date" value="'+today+'" required></label></div><div class="lineHead"><div><b>Transfer Products</b><small>Add one or more products</small></div><button id="addTransferLine" type="button" class="secondary">+ Add Product</button></div><div id="transferItems" class="lineItems"></div><label>Notes<textarea name="notes"></textarea></label>';
  const row=()=>'<div class="lineItem transferLine"><label>Product<select class="transferProduct" required>'+productOptionsHtml(products)+'</select></label><label>Quantity<input class="transferQty" type="number" min="0.001" step="0.001" value="1" required></label><label>Unit Cost<input class="transferCost" type="number" min="0" step="0.01" value="0"></label><label>Notes<input class="transferNotes" type="text"></label><button type="button" class="removeLine secondary">×</button></div>';
  const holder=$('transferItems');holder.innerHTML=row();$('addTransferLine').onclick=()=>holder.insertAdjacentHTML('beforeend',row());holder.onclick=e=>{if(e.target.closest('.removeLine')&&holder.querySelectorAll('.transferLine').length>1)e.target.closest('.transferLine').remove()};holder.onchange=e=>{if(e.target.classList.contains('transferProduct')){const opt=e.target.selectedOptions[0],line=e.target.closest('.transferLine');line.querySelector('.transferCost').value=Number(opt?.dataset.price||0)}};
  $('recordDialog').showModal();
}
async function openAdjustmentForm(){
  const warehouses=await partyOptions('warehouse'),products=optionCache.products||(await json('/api/bizora-company?action=products')).records||[];optionCache.products=products;const today=new Date().toISOString().slice(0,10);
  $('recordTitle').textContent='Stock Adjustment';$('recordHint').textContent='Manual stock correction with audit trail';
  $('recordFields').innerHTML='<div class="formGrid"><label>Warehouse<select name="warehouse_id" required><option value="">Select Warehouse</option>'+warehouses.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('')+'</select></label><label>Product<select name="product_id" id="adjustmentProduct" required>'+productOptionsHtml(products)+'</select></label><label>Type<select name="adjustment_type" required><option value="in">Stock In</option><option value="out">Stock Out</option></select></label><label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" required></label><label>Unit Cost<input name="unit_cost" id="adjustmentCost" type="number" min="0" step="0.01" value="0"></label><label>Date<input name="adjustment_date" type="date" value="'+today+'" required></label></div><label>Reason<input name="reason" placeholder="Damage, count correction, opening correction..."></label><label>Notes<textarea name="notes"></textarea></label>';
  $('adjustmentProduct').onchange=e=>$('adjustmentCost').value=Number(e.target.selectedOptions[0]?.dataset.price||0);$('recordDialog').showModal();
}
async function openForm(){
  const d=defs[currentView];if(!d||!roleCanWrite(currentView))return;
  if(currentView==='supplier-bills'){invoiceEditContext=null;return openSupplierInvoiceForm()}
  if(currentView==='client-bills'){invoiceEditContext=null;return openCustomerInvoiceForm()}
  if(currentView==='supplier-payments')return openPaymentForm('supplier');
  if(currentView==='client-payments')return openPaymentForm('client');
  if(currentView==='grns')return openGrnForm();
  if(currentView==='stock-transfers')return openTransferForm();
  if(currentView==='stock-adjustments')return openAdjustmentForm();
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
$('addRecord').onclick=()=>openForm().catch(err=>alert(err.message));$('closeRecord').onclick=$('cancelRecord').onclick=()=>{invoiceEditContext=null;$('recordDialog').close()};
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
  if(currentView==='client-bills'){
    data.items=[...document.querySelectorAll('#customerInvoiceItems .customerInvoiceLine')].map(row=>({
      product_id:Number(row.querySelector('.customerLineProduct').value||0),
      quantity:Number(row.querySelector('.customerLineQty').value||0),
      unit_price:Number(row.querySelector('.customerLinePrice').value||0),
      description:row.querySelector('.customerLineDescription').value||''
    }));
    if(!data.items.length||data.items.some(x=>!x.product_id||x.quantity<=0||x.unit_price<0))throw new Error('Valid customer invoice products required');
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
  if(currentView==='stock-transfers'){
    data.items=[...document.querySelectorAll('#transferItems .transferLine')].map(row=>({product_id:Number(row.querySelector('.transferProduct').value||0),quantity:Number(row.querySelector('.transferQty').value||0),unit_cost:Number(row.querySelector('.transferCost').value||0),notes:row.querySelector('.transferNotes').value||''}));
    if(!data.items.length||data.items.some(x=>!x.product_id||x.quantity<=0||x.unit_cost<0))throw new Error('Valid transfer products required');
  }
  const saveAction=invoiceEditContext?.action||d.create;
  if(invoiceEditContext?.invoice_id)data.invoice_id=invoiceEditContext.invoice_id;
  await json('/api/bizora-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:saveAction,...data})});
  $('recordDialog').close();e.currentTarget.reset();invoiceEditContext=null;optionCache={};model=await json('/api/bizora-company?action=overview');setHeader();await show(currentView)
}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Save'}};
$('companyLogout').onclick=async()=>{await fetch('/api/bizora-company-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});location.replace('/company-login.html')};
(async()=>{model=await json('/api/bizora-company?action=overview');installCashierModule();installReturnsModule();installEcommerceModule();installOcrModule();installAutomationModule();installCommunicationModule();setHeader();dashboard();automationPulse()})().catch(e=>{$('workspaceBody').innerHTML='<div class="card error">'+esc(e.message)+'</div>'});
