(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const customerId=Number(params.get('customer_id'));
const from=params.get('from')||'',to=params.get('to')||'';
const $=id=>document.getElementById(id);
const fmt=n=>'Rs '+Number(n||0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const date=s=>{const d=String(s||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8,10)+'-'+d.slice(5,7)+'-'+d.slice(2,4):d};
const status=message=>{$('status').textContent=message};
let loaded=false;
function show(data){
 const c=data.customer,rows=data.entries||[],range=from||to?date(from||'Beginning')+' to '+date(to||'Latest'):'All Dates';
 let running=0,opening=0,billed=0,paid=0;
 const visible=[];
 for(const e of rows){
   const d=String(e.entry_date).slice(0,10),sum=Number(e.amount||0);
   const delta=e.entry_type==='bill'?sum:-sum;
   if(from&&d<from){running+=delta;opening+=delta;continue;}
   if(to&&d>to)break;
   running+=delta;
   if(e.entry_type==='bill')billed+=sum;else paid+=sum;
   visible.push({...e,amount:sum,balance:running});
 }
 const balance=opening+billed-paid;
 const header='<div class="store">KASHIF TRADERS</div><div class="subtitle">CUSTOMER CREDIT STATEMENT</div><div class="rule"></div>'
  +'<div class="meta"><div class="name">Customer: '+esc(c.name)+'</div>'
  +'<div>Mobile: '+esc(c.mobile||'Not recorded')+'</div>'
  +'<div>Period: '+esc(range)+'</div>'
  +'<div>Printed: '+esc(new Date().toLocaleString('en-GB',{timeZone:'Asia/Karachi'}))+'</div></div><div class="rule"></div>';
 const totalRow=(label,amount)=>'<div class="sumrow"><b>'+label+'</b><b>'+fmt(amount)+'</b></div>';
 const summary='<section class="summary">'+totalRow('Opening',opening)+totalRow('Credit Bills',billed)+totalRow('Payments',paid)
 +'<div class="sumrow final"><b>'+(balance<0?'Advance':'Balance Due')+'</b><b>'+fmt(Math.abs(balance))+'</b></div></section>';
 const transactions=visible.length?visible.map(e=>{
  const isBill=e.entry_type==='bill';
  const reference=String(e.bill_no||((isBill?'BILL-':'PAY-')+e.id));
  return '<section class="trans"><div class="trans-title">'+esc(date(e.entry_date))+'  '+(isBill?'BILL':'PAYMENT')+'  '+esc(reference)+'</div>'
   +'<div class="trans-detail"><span>'+(isBill?'Dr ':'Cr ')+fmt(e.amount)+'</span><b>Bal '+fmt(e.balance)+'</b></div>'
   +(e.notes||e.payment_method?'<div class="trans-note">'+esc(e.notes||e.payment_method)+'</div>':'')+'</section>';
 }).join(''):'<div class="trans">No transactions in selected period.</div>';
 $('receipt').innerHTML=header+summary+'<div class="rule"></div><div class="transactions">'+transactions+'</div><div class="footer">THANK YOU</div>';
 document.title='80mm Credit - '+c.name;
 loaded=true;status('Ready to print. Tap Print 80mm and select the 80mm thermal printer. If the device print service is unavailable, save PDF and print from your printer app.');
}
async function load(){
 if(!Number.isSafeInteger(customerId)||customerId<=0){status('Invalid customer. Go back and select a customer.');return;}
 if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))||(from&&to&&from>to)){status('Invalid statement date range.');return;}
 try{
 const response=await fetch('/api/data?resource=customer_credit&action=statement&customer_id='+encodeURIComponent(customerId),{credentials:'same-origin',cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Could not retrieve statement');
 if(data.has_more)throw Error('Statement has more than 5,000 entries. Please contact admin for complete export.');
 show(data);
 }catch(e){status(e.message||'Statement could not be loaded. Sign in and try again.');}
}
$('printNow').onclick=()=>{if(!loaded){status('Statement has not loaded yet.');return;}window.print();};
$('goBack').onclick=()=>{if(history.length>1)history.back();else location.href='/customer-credit.html';};
$('pdfDownload').onclick=async()=>{
 if(!loaded)return status('Statement has not loaded yet.');
 const button=$('pdfDownload'),old=button.textContent;button.disabled=true;button.textContent='Preparing…';
 try{
 const q=new URLSearchParams({resource:'customer_credit',action:'thermal_pdf',customer_id:String(customerId)});
 if(from)q.set('from',from);if(to)q.set('to',to);
 const response=await fetch('/api/data?'+q,{credentials:'same-origin',cache:'no-store'});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Unable to download 80mm PDF');}
 const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download='Kashif-Traders-Customer-'+customerId+'-80mm.pdf';document.body.appendChild(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
 status('80mm PDF download started.');
 }catch(e){status(e.message);}finally{button.disabled=false;button.textContent=old;}
};
load();
})();