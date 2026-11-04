(()=>{
'use strict';
const $=id=>document.getElementById(id), money=n=>'Rs '+Number(n||0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let customers=[],selected=null,statement=null,filter='all',editing='customer',canEdit=false;
const alert=s=>{$('notice').textContent=s||'';};
async function api(path,body){const r=await fetch('/api/data?resource=customer_credit&action='+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));if(!r.ok){const detail=j.existing_customer?' Existing customer: '+j.existing_customer.name+(j.existing_customer.mobile?' ('+j.existing_customer.mobile+')':'')+'. Please select the existing record.':'';throw Error((j.error||('Request failed ('+r.status+')'))+detail);}return j;}
async function loadCustomers(preserve=true){try{const d=await api('customers');customers=d.customers||[];canEdit=d.can_edit;const bills=customers.reduce((t,c)=>t+Number(c.billed),0),received=customers.reduce((t,c)=>t+Number(c.received),0);$('allBills').textContent=money(bills);$('allPaid').textContent=money(received);$('allDue').textContent=money(bills-received);$('allCustomers').textContent=customers.length;renderCustomers();if(selected&&preserve&&customers.some(x=>Number(x.id)===selected))await loadStatement(selected);else if(!selected&&customers.length)await loadStatement(customers[0].id);}catch(e){alert(e.message);$('customerList').innerHTML='<div class="empty">Unable to load customers. Sign in and check internet connection.</div>';}}
function renderCustomers(){const query=$('search').value.trim().toLowerCase();const rows=customers.filter(c=>(c.name+' '+(c.mobile||'')).toLowerCase().includes(query)&& (filter==='all'||(filter==='due'?Number(c.billed)-Number(c.received)>0:Number(c.billed)-Number(c.received)<=0)));$('customerList').innerHTML=rows.length?rows.map(c=>{const due=Number(c.billed)-Number(c.received);return '<button class="customerrow '+(Number(c.id)===selected?'active':'')+'" data-customer="'+Number(c.id)+'"><span><strong>'+esc(c.name)+'</strong><small>'+esc(c.mobile||'No mobile')+' · '+Number(c.entries||0)+' entries</small></span><b class="'+(due>0?'due':'')+'">'+money(due)+'</b></button>'}).join(''):'<div class="empty">No customers found.</div>';}
async function loadStatement(id){try{const d=await api('statement&customer_id='+encodeURIComponent(id));selected=Number(id);statement=d;canEdit=d.can_edit;$('customerTitle').textContent=d.customer.name;$('customerInfo').textContent=(d.customer.mobile||'No mobile')+(d.customer.notes?' · '+d.customer.notes:'');$('editCustomer').hidden=!canEdit;$('sumBills').textContent=money(d.totals.billed);$('sumPaid').textContent=money(d.totals.received);$('sumDue').textContent=money(Number(d.totals.billed)-Number(d.totals.received));$('statementWarning').textContent=d.has_more?'Only first 5,000 entries displayed. Totals include all records.':'';renderCustomers();renderStatement();}catch(e){alert(e.message);}}
function renderStatement(){if(!statement)return;const from=$('fromDate').value,to=$('toDate').value;let running=0;let html='';let displayed=0;for(const e of statement.entries){const date=String(e.entry_date).slice(0,10),amt=Number(e.amount);running+=e.entry_type==='bill'?amt:-amt;if((from&&date<from)||(to&&date>to))continue;displayed++;html+='<tr><td><b>'+esc(date)+'</b><small>'+esc(e.bill_no||(e.entry_type==='bill'?'Bill #':'Payment #')+e.id)+'</small></td><td><b>'+(e.entry_type==='bill'?'Credit Bill':'Payment Received')+'</b><small>'+esc(e.payment_method||e.notes||'—')+'</small>'+(e.payment_method&&e.notes?'<small>'+esc(e.notes)+'</small>':'')+'</td><td>'+(e.entry_type==='bill'?money(amt):'—')+'</td><td>'+(e.entry_type==='payment'?money(amt):'—')+'</td><td><b>'+money(running)+'</b></td><td class="screenonly">'+(canEdit?'<button class="rowaction" data-edit="'+Number(e.id)+'">Edit</button> <button class="rowaction" data-void="'+Number(e.id)+'">Void</button>':'—')+'</td></tr>';} $('statementBody').innerHTML=html||'<tr><td colspan="6" class="empty">'+(displayed?'':'No transactions for selected dates.')+'</td></tr>';}
function openEditor(type,row=null){editing=type;$('entryForm').reset();$('recordId').value=row?.id||'';$('customerFields').hidden=type!=='customer';$('entryFields').hidden=type==='customer';$('methodField').hidden=type!=='payment';$('referenceLabel').firstChild.textContent=type==='payment'?'Payment Reference (optional)':'Bill Number / Reference';$('dialogTitle').textContent=(row?'Edit ':'Add ')+(type==='customer'?'Customer':type==='bill'?'Credit Bill':'Payment');$('notes').value=row?.notes||'';if(type==='customer'){$('name').value=row?.name||'';$('mobile').value=row?.mobile||'';}else{$('customerId').innerHTML=customers.map(c=>'<option value="'+Number(c.id)+'">'+esc(c.name)+'</option>').join('');$('customerId').value=row?.customer_id||selected||customers[0]?.id||'';$('entryDate').value=row?String(row.entry_date).slice(0,10):today();$('amount').value=row?.amount||'';$('reference').value=row?.bill_no||'';$('method').value=row?.payment_method||'Cash';} $('editor').showModal();}
$('entryForm').addEventListener('submit',async e=>{e.preventDefault();let body,action=editing==='customer'?'customer':'entry';if(editing==='customer'){body={name:$('name').value,mobile:$('mobile').value,notes:$('notes').value};}else{body={customer_id:Number($('customerId').value),entry_type:editing,entry_date:$('entryDate').value,amount:$('amount').value,bill_no:$('reference').value,payment_method:$('method').value,notes:$('notes').value};}if($('recordId').value)body.id=Number($('recordId').value);if(!body.id&&editing!=='customer'&&!body.customer_id)return alert('Create a customer first.');$('save').disabled=true;try{const d=await api(action,body);$('editor').close();if(editing==='customer'&&!body.id)selected=Number(d.customer.id);if(editing!=='customer')selected=Number(body.customer_id);alert('Record saved successfully.');await loadCustomers();}catch(err){alert(err.message);}finally{$('save').disabled=false;}});
$('statementBody').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]'),voidBtn=e.target.closest('[data-void]');if(!canEdit||!statement)return;if(edit){const x=statement.entries.find(e=>Number(e.id)===Number(edit.dataset.edit));if(x)openEditor(x.entry_type,x);}if(voidBtn){const id=Number(voidBtn.dataset.void);if(!confirm('Void this record? Its amount will be removed from customer balance. An audit history will be retained.'))return;try{await api('void',{id});alert('Entry voided.');await loadCustomers();}catch(err){alert(err.message);}}});
$('customerList').addEventListener('click',e=>{const b=e.target.closest('[data-customer]');if(b)loadStatement(Number(b.dataset.customer));});$('newCustomer').onclick=()=>openEditor('customer');$('newBill').onclick=()=>openEditor('bill');$('newPayment').onclick=()=>openEditor('payment');$('editCustomer').onclick=()=>statement&&openEditor('customer',statement.customer);$('closeDialog').onclick=$('cancelDialog').onclick=()=>$('editor').close();$('refresh').onclick=()=>loadCustomers();$('search').oninput=renderCustomers;document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderCustomers();});$('fromDate').onchange=$('toDate').onchange=renderStatement;$('resetDates').onclick=()=>{$('fromDate').value='';$('toDate').value='';renderStatement();};
function paramsForStatement(action){
 const q=new URLSearchParams({resource:'customer_credit',action,customer_id:String(selected)});
 if($('fromDate').value)q.set('from',$('fromDate').value);
 if($('toDate').value)q.set('to',$('toDate').value);
 return q;
}
function validSelection(){
 if(!statement||!selected){alert('Select a customer first');return false;}
 if(statement.has_more){alert('This customer has more than 5,000 records. Use a shorter date range after full export is available.');return false;}
 if($('fromDate').value&&$('toDate').value&&$('fromDate').value>$('toDate').value){alert('From date must not be after To date.');return false;}
 return true;
}
async function fetchStatementPdf(action){
 const r=await fetch('/api/data?'+paramsForStatement(action),{credentials:'same-origin',cache:'no-store'});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Statement PDF failed');}
 return r.blob();
}
function blobDownload(blob,filename){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function pdfFileName(thermal=false){
 const name=(statement?.customer?.name||'Customer').replace(/[^a-z0-9_-]+/gi,'-').slice(0,45);
 return 'KT-'+name+'-'+(thermal?'80mm-':'')+'Credit-Statement.pdf';
}
async function performPdf(button,thermal){
 if(!validSelection())return;
 if(thermal){
  const q=paramsForStatement('thermal_pdf');
  // Use a dedicated HTML print surface: PDFs opened in Android's viewer
  // cannot reliably call window.print().
  const page=new URL('/customer-credit-print.html',location.origin);
  page.searchParams.set('customer_id',String(selected));
  if($('fromDate').value)page.searchParams.set('from',$('fromDate').value);
  if($('toDate').value)page.searchParams.set('to',$('toDate').value);
  const target=window.open(page.href,'_blank');
  if(!target)location.href=page.href;
  return;
 }
 const old=button.textContent;button.disabled=true;button.textContent='Preparing…';
 try{
  const blob=await fetchStatementPdf('pdf');
  blobDownload(blob,pdfFileName(false));
  alert('Professional PDF downloaded.');
 }catch(e){alert(e.message);}
 finally{button.disabled=false;button.textContent=old;}
}
function normalizedMobile(value){
 let d=String(value||'').replace(/\D/g,'');
 if(/^00923\d{9}$/.test(d))d=d.slice(2);
 else if(/^03\d{9}$/.test(d))d='92'+d.slice(1);
 else if(/^3\d{9}$/.test(d))d='92'+d;
 return /^923\d{9}$/.test(d)?d:null;
}
async function whatsappShare(){
 if(!validSelection())return;
 const phone=normalizedMobile(statement.customer.mobile);
 if(!phone){alert('Customer ka valid WhatsApp mobile number save karein.');return;}
 const button=$('whatsappStatement'),old=button.textContent;
 button.disabled=true;button.textContent='Preparing PDF…';
 try{
  // Share the actual PDF file using the device share sheet. wa.me only
  // sends text, and cannot attach a PDF automatically.
  const blob=await fetchStatementPdf('pdf');
  const filename=pdfFileName(false);
  let shared=false;
  const file=new File([blob],filename,{type:'application/pdf'});
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   try{
    await navigator.share({files:[file],title:'Kashif Traders Customer Credit Statement',
     text:'Credit statement for '+statement.customer.name+' ('+statement.customer.mobile+'). Select WhatsApp and the saved customer contact.'});
    shared=true;
   }catch(err){
    if(err?.name==='AbortError')return;
    // Some embedded browsers have Share but refuse file attachments.
   }
  }
  if(shared){alert('PDF device share menu ko diya gaya. WhatsApp mein sahi customer chat select karke send confirm karein.');return;}
  blobDownload(blob,filename);
  alert('Is browser mein direct file sharing available nahi. PDF download ho gayi hai. WhatsApp mein '+statement.customer.mobile+' ki chat khol kar paperclip se Documents > '+filename+' attach karein.');
  // Do NOT send any misleading text-only message or claim the PDF was sent.
 }catch(err){alert(err.message||'PDF share failed');}
 finally{button.disabled=false;button.textContent=old;}
}
$('printStatement').onclick=()=>performPdf($('printStatement'),true);
$('pdfStatement').onclick=()=>performPdf($('pdfStatement'),false);
$('whatsappStatement').onclick=whatsappShare;
$('exportCsv').onclick=()=>{if(!statement)return alert('Select a customer first');let balance=0;const rows=[['Date','Reference','Type','Notes','Debit PKR','Credit PKR','Running Balance PKR']];for(const e of statement.entries){const date=String(e.entry_date).slice(0,10),amt=Number(e.amount);balance+=e.entry_type==='bill'?amt:-amt;if(($('fromDate').value&&date<$('fromDate').value)||($('toDate').value&&date>$('toDate').value))continue;rows.push([date,e.bill_no||'',e.entry_type,e.notes||'',e.entry_type==='bill'?amt.toFixed(2):'',e.entry_type==='payment'?amt.toFixed(2):'',balance.toFixed(2)]);}const csv=rows.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='KT-Customer-Credit-'+statement.customer.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
loadCustomers();
})();