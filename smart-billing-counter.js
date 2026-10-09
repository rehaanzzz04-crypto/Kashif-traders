'use strict';(()=>{
const $=id=>document.getElementById(id),money=n=>'PKR '+Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2}),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),arr=v=>Array.isArray(v)?v:(()=>{try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return []}})();
let activeOrder=null,orders=[],ordersBusy=false,orderLoadBusy=false;
const initialPageTitle=document.title;
let knownOrderIds=null,orderAudio=null,ringAfterUnlock=false,lastBellSoundAt=0;
let bellEnabled=true;
try{bellEnabled=localStorage.getItem('kt_smart_order_bell_v1')!=='off'}catch{}
function freshOrderCount(before,after){
 if(before===null)return 0; // First load is a baseline, not a new arrival.
 let count=0;for(const id of after)if(!before.has(id))count++;
 return count;
}
function syncBellToggle(){
 const control=$('orderBellToggle');
 control.setAttribute('aria-pressed',String(bellEnabled));
 control.setAttribute('aria-label',bellEnabled?'Mute customer order bell':'Enable customer order bell');
 control.title=bellEnabled?'Customer order notification bell on':'Customer order notification bell muted';
 control.textContent=bellEnabled?'🔊':'🔕';
}
function soundOrderBell(){
 if(!bellEnabled)return;
 if(!orderAudio||orderAudio.state!=='running'){ringAfterUnlock=true;return}
 const now=Date.now();
 if(now-lastBellSoundAt<3000)return; // Debounce overlapping order fetches.
 lastBellSoundAt=now;
 try{
  const start=orderAudio.currentTime+.02;
  [[880,0],[1175,.19]].forEach(([frequency,delay])=>{
   const tone=orderAudio.createOscillator(),volume=orderAudio.createGain(),t=start+delay;
   tone.type='sine';tone.frequency.setValueAtTime(frequency,t);
   volume.gain.setValueAtTime(.0001,t);
   volume.gain.exponentialRampToValueAtTime(.15,t+.016);
   volume.gain.exponentialRampToValueAtTime(.0001,t+.33);
   tone.connect(volume);volume.connect(orderAudio.destination);
   tone.start(t);tone.stop(t+.34);
  });
 }catch{}
}
function unlockOrderAudio(){
 if(!bellEnabled)return;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  if(!orderAudio)orderAudio=new Context();
  const after=()=>{if(ringAfterUnlock&&orderPending().length){ringAfterUnlock=false;soundOrderBell()}};
  if(orderAudio.state!=='running')orderAudio.resume().then(after).catch(()=>{});
  else after();
 }catch{}
}
['pointerdown','keydown','touchstart'].forEach(eventName=>document.addEventListener(eventName,unlockOrderAudio,{passive:true}));
$('orderBellToggle').onclick=()=>{
 bellEnabled=!bellEnabled;ringAfterUnlock=false;
 try{localStorage.setItem('kt_smart_order_bell_v1',bellEnabled?'on':'off')}catch{}
 syncBellToggle();
 if(bellEnabled)unlockOrderAudio();
};
syncBellToggle();
function updateOrderButton(pendingCount){
 const btn=$('navOrders');
 btn.classList.toggle('has-orders',pendingCount>0);
 btn.setAttribute('aria-label','Customer Orders, '+pendingCount+' pending');
 btn.title=pendingCount>0?pendingCount+' pending customer order(s)':'No pending customer orders';
 document.title=pendingCount>0?'('+pendingCount+') 🔔 '+initialPageTitle:initialPageTitle;
 if(!pendingCount)ringAfterUnlock=false;
}

let products=[],cart=[],selected=new Set(),category='all',galleryPage=0,searchTimer=null,customerList=[],bills=[],billStatus='pending',active=null,busy=false,lastInvoice=null,lastPrinted='',lastPrintTime=0,barcodeStream=null,scannerLoop=0,scannerDetector=null,searchVersion=0,method='Cash',manualReceived=false;
const galleryChunk=48;const stamp=x=>x?new Date(x).toLocaleString('en-PK',{timeZone:'Asia/Karachi',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
function visibleInvoice(b){const raw=String(b?.invoice_number||b?.invoice_reference||'');const match=/^CS-\d{8}-(\d+)$/.exec(raw);return match?'CS-'+Number(match[1]):raw}
function status(t,type='info'){const el=$('status');el.textContent=t;el.className='status'+(type==='error'?' error':type==='warning'?' warning':'')}
async function api(url,opts){const r=await fetch(url,{cache:'no-store',...opts}),j=await r.json().catch(()=>({}));if(r.status===401){location.replace('/login.html');throw Error('Login required')}if(!r.ok)throw Error(j.error||'Request failed');return j}
function localDay(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=type=>parts.find(x=>x.type===type)?.value||'';return get('year')+'-'+get('month')+'-'+get('day')}
$('saleDate').value=localDay();
function subtotal(){return cart.reduce((n,p)=>n+Number(p.qty)*Number(p.rate),0)}function totals(){const sub=subtotal(),discount=Math.min(sub,Math.max(0,Number($('discount').value)||0));return {sub,discount,total:Math.max(0,sub-discount)}}function calcDue(){const t=totals(),pay=$('payment').value;return Math.max(0,t.total-(pay==='Credit'?0:Math.max(0,Number($('received').value)||0)))}
function syncReceived(){const p=$('payment').value,t=totals();if(p==='Credit'){$('received').value=0;$('received').disabled=true}else{$('received').disabled=false;if(!manualReceived&&p!=='Partial')$('received').value=t.total.toFixed(2)}$('due').textContent=money(calcDue())}
function renderTotals(){const t=totals();$('itemCount').textContent='('+cart.length+')';$('totalItems').textContent=cart.reduce((n,x)=>n+Number(x.qty),0).toLocaleString('en-PK',{maximumFractionDigits:3});$('subtotal').textContent=money(t.sub);$('grand').textContent=money(t.total);syncReceived();$('selectedCount').textContent=selected.size+' products selected';$('selectedAmount').textContent=money(products.filter(p=>selected.has(String(p.id))).reduce((n,p)=>n+Number(p.sale_price||0),0))}
function renderCart(){const body=$('items');body.innerHTML=cart.length?cart.map((p,i)=>'<tr><td><span class="name-main">'+esc(p.name)+'</span><span class="name-sub">'+esc(p.sku||p.barcode||'')+'</span></td><td><div class="qty-control"><button data-step="-1" data-i="'+i+'">−</button><input aria-label="Quantity" type="number" min=".001" step=".001" data-qty="'+i+'" value="'+Number(p.qty)+'"><button data-step="1" data-i="'+i+'">+</button></div></td><td><input aria-label="Sale Rate" type="number" min="0" step=".01" data-rate="'+i+'" value="'+Number(p.rate)+'"></td><td><b>'+money(Number(p.qty)*Number(p.rate))+'</b></td><td><button class="line-remove" data-remove="'+i+'">×</button></td></tr>').join(''):'<tr><td colspan="5" class="empty">Gallery se products select karein.</td></tr>';
body.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i),p=cart[i],step=Number(b.dataset.step);p.qty=Math.max(p.unit==='kg'||/loose|khula|gram/i.test(p.name)?0.001:1,Math.round((Number(p.qty)+step)*1000)/1000);renderCart()});
body.querySelectorAll('[data-qty]').forEach(el=>el.onchange=()=>{cart[Number(el.dataset.qty)].qty=Math.max(.001,Number(el.value)||1);renderCart()});
body.querySelectorAll('[data-rate]').forEach(el=>el.onchange=()=>{cart[Number(el.dataset.rate)].rate=Math.max(0,Number(el.value)||0);renderCart()});
body.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{cart.splice(Number(el.dataset.remove),1);renderCart()});renderTotals()}
function addProduct(p){const old=cart.find(x=>String(x.id)===String(p.id));if(old)old.qty+=1;else cart.push({id:p.id,name:p.name,number:p.sku||'',sku:p.sku||'',barcode:p.barcode||'',unit:p.unit||'pcs',qty:1,rate:Number(p.sale_price||0),defaultRate:Number(p.sale_price||0)});renderCart()}
function categories(){const cats=['All',...new Set(products.map(p=>p.category||'Others'))];$('categories').innerHTML=cats.map(c=>'<button type="button" data-category="'+esc(c)+'" class="'+(category===(c==='All'?'all':c)?'active':'')+'">'+esc(c)+'</button>').join('');$('categories').querySelectorAll('button').forEach(b=>b.onclick=()=>{category=b.dataset.category==='All'?'all':b.dataset.category;galleryPage=0;categories();renderGallery()})}
function filtered(){const q=$('productSearch').value.trim().toLowerCase();return products.filter(p=>(category==='all'||(p.category||'Others')===category)&&(!q||[p.name,p.sku,p.barcode,p.category].some(v=>String(v||'').toLowerCase().includes(q)))).sort((a,b)=>{if(!q)return String(a.name).localeCompare(String(b.name));const rank=p=>String(p.barcode||'').toLowerCase()===q?0:String(p.name||'').toLowerCase().startsWith(q)?1:2;return rank(a)-rank(b)||String(a.name).localeCompare(String(b.name))})}
function renderGallery(){const rows=filtered(),show=rows.slice(0,(galleryPage+1)*galleryChunk);$('gallery').innerHTML=show.map(p=>'<button type="button" class="product '+(selected.has(String(p.id))?'selected':'')+'" data-product="'+p.id+'"><span class="tick">✓</span>'+(p.product_image_url?'<img src="'+esc(p.product_image_url)+'" loading="lazy" decoding="async" alt="">':'<span class="placeholder">KT</span>')+'<strong>'+esc(p.name)+'</strong><span class="price">'+money(p.sale_price)+'</span></button>').join('')+(rows.length>show.length?'<button id="moreProducts" class="outline load-more">Show More Products ('+show.length+' / '+rows.length+')</button>':'')||'<div class="empty">Koi product nahi mila.</div>';for(const btn of $('gallery').querySelectorAll('[data-product]'))btn.onclick=()=>{const id=String(btn.dataset.product);if(selected.has(id))selected.delete(id);else selected.add(id);btn.classList.toggle('selected',selected.has(id));renderTotals()};const more=$('moreProducts');if(more)more.onclick=()=>{galleryPage++;renderGallery()}}
let productsLoadInFlight=null;
let catalogCacheConfirmed=false;
async function showStoredProducts(){
 try{
  const snapshot=await window.KT_OFFLINE?.savedCatalog?.();
  if(!snapshot?.records?.length)return false;
  products=activeProductList(snapshot.records);
  if(!products.length)return false;
  catalogCacheConfirmed=true;category='all';galleryPage=0;categories();renderGallery();
  status(products.length+' products offline available hain. Last saved: '+new Date(snapshot.savedAt).toLocaleString('en-PK')+'.');
  return true;
 }catch(e){console.warn('Offline product snapshot unavailable',e);return false}
}
async function confirmProductCache(records){
 if(!records.length)return;
 const result=await window.KT_OFFLINE?.storeCatalog?.(records);
 catalogCacheConfirmed=Boolean(result?.saved);
 if(!catalogCacheConfirmed)status('Products show ho rahi hain, lekin offline save confirm nahi hua: '+(result?.reason||'Storage unavailable'),'warning');
}

function activeProductList(rows){
 return (Array.isArray(rows)?rows:[]).filter(p=>p&&String(p.status??'active').trim().toLowerCase()==='active');
}
async function readProductCatalog(){
 let firstError=null,firstCount=-1;
 const urls=['/api/data?resource=sale_products&status=active&limit=1000','/api/data?resource=sale_products&limit=1000','/api/data?resource=sale_products'];
 // First try a genuine network request. The offline wrapper may otherwise
 // return an old *empty* snapshot which masquerades as an empty database.
 if(navigator.onLine&&window.KT_OFFLINE?.fetchDirect){
   for(const url of urls.slice(0,2)){
     try{
       const r=await window.KT_OFFLINE.fetchDirect(url);
       const data=await r.json().catch(()=>({}));
       if(!r.ok)throw Error(data.error||'Product API HTTP '+r.status);
       const records=activeProductList(data.records);
       if(firstCount<0)firstCount=(data.records||[]).length;
       if(records.length)return {records,source:'live'};
     }catch(error){firstError=error}
   }
 }
 // Still use available offline snapshots when the internet is actually absent.
 for(const url of urls){
   try{
     const data=await api(url),records=activeProductList(data.records);
     if(records.length)return {records,source:data._offline_snapshot_at?'offline':'recovered'};
     if(firstCount<0)firstCount=(data.records||[]).length;
   }catch(error){if(!firstError)firstError=error}
 }
 if(firstCount===0)throw Error('Server ne 0 products return ki hain. Working deployment ki DATABASE_URL / Neon connection verify karein; records delete nahi hue.');
 throw firstError||Error('Product server unavailable. Internet/session check karein.');
}
function galleryLoadError(message){
 $('gallery').innerHTML='<div class="empty smart-product-warning"><strong>Products load nahi ho rahi.</strong><p>'+esc(message)+'</p><button type="button" class="btn" id="retrySmartProducts">↻ Retry Products</button></div>';
 $('retrySmartProducts').onclick=()=>loadProducts();
}
async function loadProducts(){
 if(productsLoadInFlight)return productsLoadInFlight;
 productsLoadInFlight=(async()=>{
   const gallery=$('gallery');
   if(!products.length)gallery.innerHTML='<div class="empty">Products loading…</div>';
   // Render the persisted catalog BEFORE contacting the server.
   const hadOfflineCopy=await showStoredProducts();
   if(!navigator.onLine){
     if(!hadOfflineCopy)galleryLoadError('Is browser/URL par product catalog offline saved nahi. Ek baar online open karke offline-ready confirmation check karein.');
     return;
   }
   try{
     const result=await readProductCatalog();
     // Never wipe a previously loaded catalog just because a refresh returned 0.
     if(!result.records.length&&products.length){
       status('Product refresh khaali aya hai. Pehle se loaded products safe hain; Retry karein.','warning');
       renderGallery();
       return;
     }
     products=result.records;
     category='all';galleryPage=0;
     categories();renderGallery();
     if(products.length){
       await confirmProductCache(products);
       if(catalogCacheConfirmed)status(products.length+' products offline save ho gayi hain. Internet band karke refresh test kar sakte hain.');
     }
     if(!products.length) {
       galleryLoadError('Sale Products mein active products nahi milin. Manage Products se verify karein.');
       status('Active product list khaali hai; data delete nahi kiya gaya.','warning');
     }else if(result.source==='recovered') {
       status(products.length+' products fallback se load ho gayi hain. Active catalog request ko verify karna baqi hai.','warning');
     }
   }catch(e){
     if(products.length){
       renderGallery();
       status('Connection error: saved loaded products display ho rahi hain. '+e.message,'warning');
     }else{
       galleryLoadError(e.message);
       status('Product Gallery unavailable: '+e.message,'error');
     }
   }
 })().finally(()=>{productsLoadInFlight=null});
 return productsLoadInFlight;
}
function loadCustomers(chosen){return api('/api/data?resource=cash_sale_customers').then(j=>{customerList=(j.records||[]).filter(x=>x.status==='active');$('customer').innerHTML='<option value="">Walk-in Customer</option>'+customerList.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');if(chosen)$('customer').value=String(chosen);if(active&&!$('invoiceModal').classList.contains('hidden'))fillBillCustomers($('billCustomer').value||active.customer_id)}).catch(e=>status(e.message,'warning'))}
function setPayment(p){$('payment').value=p;method=p;manualReceived=false;document.querySelectorAll('[data-method]').forEach(b=>b.classList.toggle('active',b.dataset.method===p));syncReceived()}
$('methods').querySelectorAll('button').forEach(b=>b.onclick=()=>setPayment(b.dataset.method));$('payment').onchange=()=>setPayment($('payment').value);$('received').oninput=()=>{manualReceived=true;syncReceived()};$('discount').oninput=()=>{manualReceived=false;renderTotals()};
$('productSearch').oninput=()=>{galleryPage=0;renderGallery()};$('quickSearch').oninput=e=>{$('productSearch').value=e.target.value;galleryPage=0;renderGallery()};$('quickSearch').onkeydown=e=>{if(e.key==='Enter'){const p=filtered()[0];if(p){addProduct(p);$('quickSearch').value='';$('productSearch').value='';renderGallery()}}};
$('addSelected').onclick=()=>{const rows=products.filter(p=>selected.has(String(p.id)));rows.forEach(addProduct);selected.clear();renderGallery();renderTotals();if(rows.length)status(rows.length+' products invoice mein add ho gaye.')};
$('clearCart').onclick=()=>{if(cart.length&&!confirm('Current invoice items clear karein?'))return;cart=[];selected.clear();manualReceived=false;$('discount').value=0;renderGallery();renderCart()};
function newSale(){if((cart.length||activeOrder)&&!confirm('Current unsaved sale / customer order editor clear karein? Order portal mein pending rahega.'))return;activeOrder=null;document.body.classList.remove('order-mode-active');$('orderModeNotice').textContent='';$('customer').disabled=false;cart=[];selected.clear();manualReceived=false;$('customer').value='';$('discount').value=0;$('complete').textContent='Complete Sale & Print';$('pending').textContent='Save as Pending';$('complete').disabled=false;$('pending').disabled=false;setPayment('Cash');renderCart();renderGallery();status('New sale ready.')}
$('newSale').onclick=newSale;$('cancel').onclick=newSale;$('back').onclick=()=>location.assign('/');
$('manageProducts').onclick=()=>openLegacy('/cash-sale-products.html','Manage Products');$('modeGallery').onclick=()=>{$('gallery').scrollIntoView({behavior:'smooth',block:'nearest'})};
function openLegacy(url,title){$('legacyTitle').textContent=title;$('legacyFrame').src=url;$('legacyModal').classList.remove('hidden')}
$('closeLegacy').onclick=()=>{$('legacyModal').classList.add('hidden');$('legacyFrame').src='about:blank';loadProducts()};
let customerModalFromBill=false;
$('newCustomer').onclick=()=>{customerModalFromBill=false;$('customerModal').classList.remove('hidden')};
$('billNewCustomer').onclick=()=>{customerModalFromBill=true;$('customerModal').classList.remove('hidden')};
$('closeCustomer').onclick=()=>$('customerModal').classList.add('hidden');
$('customerForm').onsubmit=async e=>{e.preventDefault();try{const j=await api('/api/data?resource=cash_sale_customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))});if(j.pending_sync){status('Customer sync pending. Online verification baad mein hogi.','warning');return}const sourceWasBill=customerModalFromBill;$('customerModal').classList.add('hidden');e.target.reset();await loadCustomers(sourceWasBill?'':j.record.id);if(sourceWasBill){fillBillCustomers(j.record.id);updateBillSettlementView()}customerModalFromBill=false;status('Customer add ho gaya.')}catch(e){status(e.message,'error')}};
function salePayload(){return {customer_id:Number($('customer').value)||null,customer_name:$('customer').selectedOptions[0]?.textContent||'Walk-in Customer',sale_date:$('saleDate').value,items:cart.map(p=>({...p})),discount:totals().discount}}
async function createSale(finalize){if(activeOrder){await approveSelectedOrder();return}if(busy||!cart.length){if(!cart.length)status('Invoice mein product add karein.','warning');return}const {total}=totals(),payment=$('payment').value,received=Number($('received').value)||0,customer=Number($('customer').value)||0;let target='pending',cashMethod=payment;
if(finalize){if(payment==='Credit'){target='credit'}else if(payment==='Partial'){target='partial';cashMethod='Cash'}else{target='paid'}if((target==='partial'||target==='credit')&&!customer){status('Partial / Credit ke liye registered customer zaroori hai.','warning');return}if(target==='paid'&&received+.005<total){status('Full payment ke liye total amount receive karein.','warning');return}if(target==='partial'&&(received<=0||received+.005>=total)){status('Partial amount 0 se zyada aur grand total se kam honi chahiye.','warning');return}}
busy=true;$('complete').disabled=$('pending').disabled=true;try{
const saved=await api('/api/data?resource=cash_sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(salePayload())});
if(saved.pending_sync){status('Invoice offline queued hai. Sync complete hone se pehle payment ya print nahi kar sakte.','warning');cart=[];renderCart();return}
const invoice=saved.record;if(!invoice?.id)throw Error('Invoice confirmation missing');
lastInvoice=invoice;$('pdf').disabled=false;
if(finalize){const updated=await api('/api/data?resource=cash_sales&id='+encodeURIComponent(invoice.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:target,items:cart,discount:totals().discount,payment_method:target==='credit'?'Credit':cashMethod,amount_received:target==='credit'?0:Math.min(received,total)})});if(updated.pending_sync){status('Invoice saved, payment sync pending. Print payment receipt after server confirmation.','warning');cart=[];renderCart();await loadBills();return}lastInvoice=updated.record;status(lastInvoice.invoice_number+' '+(target==='paid'?'paid':target==='partial'?'partial':'credit')+' save ho gaya.')}
else status(invoice.invoice_number+' pending mein save ho gaya.');
cart=[];selected.clear();manualReceived=false;$('discount').value=0;renderCart();renderGallery();await loadBills();if(finalize){openInvoice(lastInvoice);if(lastInvoice.status==='paid')status('Invoice paid hai. Print button se verified receipt print karein.')}
}catch(e){status(e.message+' — invoice list verify karein; bina confirm kiye dobara save na karein.','error');await loadBills().catch(()=>{})}finally{busy=false;$('complete').disabled=$('pending').disabled=false}}
$('complete').onclick=()=>createSale(true);$('pending').onclick=()=>createSale(false);
function receivedOf(b){return Math.max(0,Number(b.amount_received)||0)}function dueOf(b){return Math.max(0,Number(b.total)-receivedOf(b))}function renderBills(){const q=$('billSearch').value.toLowerCase();const rows=bills.filter(x=>[visibleInvoice(x),x.invoice_reference,x.invoice_day,x.customer_name,x.created_by_name].some(v=>String(v||'').toLowerCase().includes(q)));$('bills').innerHTML=rows.length?rows.map(b=>'<tr><td><b>'+esc(visibleInvoice(b))+'</b></td><td>'+esc(stamp(b.created_at))+'</td><td>'+esc(b.customer_name||'Walk-in')+'</td><td>'+esc(b.created_by_name)+'</td><td>'+arr(b.items).length+'</td><td>'+money(b.total)+'</td><td>'+money(receivedOf(b))+'</td><td>'+money(dueOf(b))+'</td><td><span class="pill '+esc(b.status)+'">'+esc(b.status)+'</span></td><td><button class="outline small" data-open="'+b.id+'">'+(b.status==='pending'?'Edit / Receive':b.status==='partial'||b.status==='credit'?'Receive / Print':'View / Print')+'</button></td></tr>').join(''):'<tr><td colspan="10" class="empty">Is tab mein koi bill nahi.</td></tr>';for(const el of $('bills').querySelectorAll('[data-open]'))el.onclick=()=>openInvoice(bills.find(x=>String(x.id)===el.dataset.open))}
async function loadBills(){const j=await api('/api/data?resource=cash_sales&status='+billStatus+'&limit=150');bills=j.records||[];renderBills();if(billStatus==='pending')$('pendingCount').textContent=bills.length}
function setBillStatus(v){billStatus=v;document.querySelectorAll('[data-bill-status]').forEach(b=>b.classList.toggle('active',b.dataset.billStatus===v));loadBills().catch(e=>status(e.message,'warning'))}
document.querySelectorAll('[data-bill-status]').forEach(b=>b.onclick=()=>setBillStatus(b.dataset.billStatus));$('billSearch').oninput=renderBills;$('refresh').onclick=()=>loadBills().catch(e=>status(e.message,'error'));
function fillBillCustomers(selected){
 const select=$('billCustomer');
 const id=String(selected||'');
 select.innerHTML='<option value="">Walk-in Customer</option>'+customerList.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
 if([...select.options].some(o=>o.value===id))select.value=id;
}
function planPendingSettlement(selection,amount,total,customerId,receivedVia){
 const valid=['Cash','Partial','Bank Transfer','EasyPaisa','JazzCash','Credit'];
 const actual=['Cash','Bank Transfer','EasyPaisa','JazzCash'];
 if(!valid.includes(selection))throw Error('Payment Method select karein.');
 if(!Number.isFinite(total)||total<0)throw Error('Invoice total invalid hai.');
 if(!Number.isFinite(amount)||amount<0)throw Error('Valid received amount enter karein.');
 if(selection==='Credit'){
   if(!customerId)throw Error('Credit ke liye registered customer select karein.');
   return {status:'credit',amount_received:0,payment_method:'Credit'};
 }
 if(selection==='Partial'){
   if(!customerId)throw Error('Partial ke liye registered customer select karein.');
   if(!(amount>0&&amount+0.005<total))throw Error('Partial received amount 0 se zyada aur total se kam honi chahiye.');
   if(!actual.includes(receivedVia))throw Error('Partial payment receive karne ka method select karein.');
   return {status:'partial',amount_received:amount,payment_method:receivedVia};
 }
 if(amount+0.005<total)throw Error('Full payment ke liye complete amount receive karein, warna Partial select karein.');
 return {status:'paid',amount_received:total,payment_method:selection};
}
function updateBillSettlementView(){
 if(!active)return;
 const pending=active.status==='pending',selection=$('billMethod').value;
 const via= pending&&selection==='Partial',credit=pending&&selection==='Credit';
 $('billReceivedViaRow').classList.toggle('hidden',!via);
 $('billCustomerRow').classList.toggle('hidden',!pending);
 $('billCustomerHint').textContent=(via||credit)?'Registered customer select karein; outstanding balance customer account mein save hoga.':'Pending invoice ka customer yahan change kar sakte hain.';
 $('billReceive').disabled=!['pending','partial','credit'].includes(active.status)||credit;
 if(credit)$('billReceive').value='0';
 const total=active.status==='pending'?Math.max(0,Number(active.total)||0):dueOf(active);
 const paid=credit?0:Math.max(0,Math.min(total,Number($('billReceive').value)||0));
 $('billPaymentPreview').innerHTML='<span>Receiving: <b>'+money(paid)+'</b></span><span>Remaining: <b>'+money(Math.max(0,total-paid))+'</b></span>';
}
function openInvoice(b){
 if(!b)return;
 active=b;lastInvoice=b;$('pdf').disabled=false;
 $('invoiceTitle').textContent='Invoice '+visibleInvoice(b);
 $('invoiceInfo').innerHTML='<p>'+esc(b.customer_name||'Walk-in Customer')+' · '+esc(b.status)+' · '+arr(b.items).length+' items</p><p>Total '+money(b.total)+' · Received '+money(receivedOf(b))+' · Balance '+money(dueOf(b))+'</p>';
 $('invoiceStatus').textContent=b.status==='pending'?'Payment method select karein. Partial ya Credit ke liye registered customer required hai.':b.status==='partial'||b.status==='credit'?'Remaining balance receive kar sakte hain.':'Receipt print/share karein.';
 fillBillCustomers(b.customer_id);
 const pending=b.status==='pending',canReceive=['pending','credit','partial'].includes(b.status);
 for(const option of $('billMethod').options)option.disabled=!pending&&['Partial','Credit'].includes(option.value);
 $('billMethod').value='Cash';$('billReceivedVia').value='Cash';
 $('billReceive').value=pending?Math.max(0,Number(b.total)||0):dueOf(b);
 $('billMethod').disabled=!canReceive;
 $('billReceivedVia').disabled=!canReceive;
 $('confirmBill').disabled=!canReceive;
 $('printBill').disabled=!['paid','partial','credit'].includes(b.status);
 $('shareBill').disabled=false;
 $('invoiceModal').classList.remove('hidden');
 updateBillSettlementView();
}
$('billMethod').onchange=()=>{
 if(active?.status==='pending')$('billReceive').value=$('billMethod').value==='Partial'||$('billMethod').value==='Credit'?'0':Math.max(0,Number(active.total)||0);
 updateBillSettlementView();
};
$('billReceive').oninput=updateBillSettlementView;
$('billCustomer').onchange=updateBillSettlementView;
$('closeInvoice').onclick=()=>$('invoiceModal').classList.add('hidden');
$('confirmBill').onclick=async()=>{
 if(!active||busy)return;
 const b=active,amount=Number($('billReceive').value),selection=$('billMethod').value,customerId=Number($('billCustomer').value)||null;
 let payload;
 try{
   if(b.status==='pending'){
     payload=planPendingSettlement(selection,amount,Number(b.total)||0,customerId,$('billReceivedVia').value);
     payload={...payload,customer_id:customerId,items:arr(b.items),discount:Number(b.discount)||0};
   }else if(['partial','credit'].includes(b.status)){
     if(!['Cash','Bank Transfer','EasyPaisa','JazzCash'].includes(selection))throw Error('Payment receive karne ka method select karein.');
     if(!Number.isFinite(amount)||amount<=0)throw Error('Valid received amount enter karein.');
     payload={action:'receive_payment',amount_received:Math.min(amount,dueOf(b)),payment_method:selection};
   }else return;
 }catch(e){$('invoiceStatus').textContent=e.message;return}
 busy=true;$('confirmBill').disabled=true;
 try{
   const j=await api('/api/data?resource=cash_sales&id='+b.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(j.pending_sync){$('invoiceStatus').textContent='Payment sync pending. Print not allowed yet.';return}
   if(!j.record?.id)throw Error('Save confirmation missing; invoice verify karein.');
   active=j.record;lastInvoice=active;openInvoice(active);await loadBills();
   status(visibleInvoice(active)+' — '+active.status+' payment save ho gayi.');
 }catch(e){$('invoiceStatus').textContent=e.message+' — retry se pehle Cashier invoice status verify karein.'}
 finally{busy=false;$('confirmBill').disabled=!active||!['pending','partial','credit'].includes(active.status)}
};
async function printInvoice(b){if(!b||!['paid','partial','credit'].includes(b.status)){status('Paid / Partial / Credit invoice select karein.','warning');return}try{const base='http://127.0.0.1:8788';const h=await fetch(base+'/health',{signal:AbortSignal.timeout(4500)}),health=await h.json();if(!h.ok||!health.ready||health.mode!=='cashier'||health.dryRun!==false)throw Error('Local Cashier USB print bridge ready nahi');if(lastPrinted===String(b.id??b.invoice_reference??b.invoice_number)&&Date.now()-lastPrintTime<20000&&!confirm('Duplicate receipt print karni hai?'))return;const t=Number(b.total)||0,received=Math.min(t,receivedOf(b)),items=arr(b.items).map(p=>({name:String(p.name||'Item'),qty:Number(p.qty)||0,unit:String(p.unit||'pcs'),rate:Number(p.rate)||0,amount:Number(p.qty||0)*Number(p.rate||0)}));if(!items.length||items.length>50)throw Error('USB limit 1-50 products');const payload={jobId:crypto.randomUUID(),confirmPrint:'CASHIER-RECEIPT',receipt:{invoice:visibleInvoice(b),date:stamp(b.paid_at||b.updated_at||b.created_at),customer:b.customer_name||'Walk-in Customer',createdBy:b.created_by_name||'',paidBy:b.paid_by_name||'',payment:b.payment_method||'',items,subtotal:Number(b.subtotal)||items.reduce((n,p)=>n+p.amount,0),discount:Number(b.discount)||0,total:t,received,due:Math.max(0,t-received),status:b.status}};const res=await fetch(base+'/print',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(24000)}),out=await res.json();if(!res.ok||!out.ok||out.dryRun||out.duplicate)throw Error(out.error||'Printer job failed');lastPrinted=String(b.id??b.invoice_reference??b.invoice_number);lastPrintTime=Date.now();status('Receipt printer job accepted. Physical paper verify karein.')}catch(e){status('USB print unavailable: '+e.message+'. Auto retry nahi hogi.','warning')}}
async function shareInvoicePdf(b){
 if(!b){status('PDF Share ke liye saved invoice select karein.','warning');return}
 const pdf=window.KT_SMART_BILLING_PDF;
 if(!pdf){status('Invoice PDF tool load nahi hua. Page refresh karein.','error');return}
 try{
  const result=await pdf.share(b);
  if(result==='shared')status(pdf.invoiceNumber(b)+' ki PDF share ho gayi.');
  if(result==='downloaded')status(pdf.invoiceNumber(b)+' ki PDF download ho gayi. File share kar sakte hain.');
 }catch(e){status('PDF generate nahi hui: '+e.message,'error')}
}
$('printBill').onclick=()=>printInvoice(active);
$('printTop').onclick=()=>printInvoice(lastInvoice);
$('shareBill').onclick=()=>shareInvoicePdf(active);
$('pdf').onclick=()=>shareInvoicePdf(lastInvoice);

function orderPending(){return orders.filter(x=>x.status==='pending'&&!x.cash_sale_id)}
function orderDraftItems(order){
 const base=arr(order.items);
 return base.map(i=>{
  const product=products.find(p=>Number(p.id)===Number(i.product_id));
  return {id:Number(i.product_id),name:i.name||product?.name||'Product',number:product?.sku||'',sku:product?.sku||'',barcode:product?.barcode||'',unit:i.unit||product?.unit||'pcs',qty:Math.max(.001,Number(i.qty)||1),rate:Math.max(0,Number(i.price??product?.sale_price)||0),defaultRate:Math.max(0,Number(i.price??product?.sale_price)||0)}
 });
}
function paintOrders(){
 const pending=orderPending();
 $('orderCount').textContent=pending.length;$('ordersModalCount').textContent=pending.length;updateOrderButton(pending.length);
 $('ordersList').innerHTML=pending.length?pending.map(o=>
  '<div class="order-card"><div><strong>'+esc(o.order_number)+' · '+esc(o.customer_name)+'</strong><small>'+esc(o.customer_code||'')+' · '+arr(o.items).length+' products · '+esc(stamp(o.created_at))+'</small></div><div class="action-row"><button type="button" class="btn small" data-openorder="'+o.id+'">Open in Counter</button><button type="button" class="danger small" data-rejectorder="'+o.id+'">Reject</button></div></div>'
 ).join(''):'<div class="empty">Koi pending customer order nahi.</div>';
 $('ordersList').querySelectorAll('[data-openorder]').forEach(btn=>btn.onclick=()=>openOrder(Number(btn.dataset.openorder)));
 $('ordersList').querySelectorAll('[data-rejectorder]').forEach(btn=>btn.onclick=()=>rejectCustomerOrder(Number(btn.dataset.rejectorder)));
}
async function loadOrders(showError=false){
 if(orderLoadBusy)return;
 orderLoadBusy=true;
 try{
  const j=await api('/api/data?resource=customer_portal&action=admin_orders');
  orders=j.records||[];
  const currentOrderIds=new Set(orderPending().map(o=>String(o.id)));
  const arrivals=freshOrderCount(knownOrderIds,currentOrderIds);
  knownOrderIds=currentOrderIds;
  paintOrders();
  if(arrivals>0){
   $('ordersNotice').textContent=arrivals+' naya Customer Order received. Smart Billing se open karein.';
   soundOrderBell();
  }
  if(activeOrder&&!orderPending().some(o=>Number(o.id)===Number(activeOrder.id))){
   status('Selected customer order doosri screen par process ho chuka hai. New Sale select karein.','warning');
   $('complete').disabled=true;$('pending').disabled=true;
  }
 }catch(e){if(showError){$('ordersNotice').textContent=e.message;status('Customer Orders online server se confirm nahi hue.','warning')}}
 finally{orderLoadBusy=false}
}
async function openOrders(){
 $('ordersModal').classList.remove('hidden');
 $('ordersNotice').textContent='Order select karein. Invoice products, quantity aur rate yahi edit hongay.';
 await loadOrders(true);
}
$('closeOrders').onclick=()=>$('ordersModal').classList.add('hidden');
function openOrder(id){
 const order=orderPending().find(o=>Number(o.id)===id);
 if(!order)return status('Order already processed. Refresh karein.','warning');
 if((cart.length||activeOrder)&&!confirm('Existing unsaved bill ki jagah selected customer order load karein?'))return;
 if(!customerList.some(c=>Number(c.id)===Number(order.customer_id))){status('Order customer account load nahi hua. Refresh karein.','warning');return}
 activeOrder=order;
 cart=orderDraftItems(order);selected.clear();manualReceived=false;$('discount').value=0;
 $('customer').value=String(order.customer_id);$('customer').disabled=true;
 $('saleDate').value=localDay();setPayment('Cash');
 document.body.classList.add('order-mode-active');
 $('orderModeNotice').textContent='Customer Order '+order.order_number+' · '+order.customer_name+' · Edit products, qty, rate and discount. Approve & Create Invoice will save once as Pending. Payment follows in the same counter.';
 $('complete').textContent='Approve & Create Invoice';$('pending').textContent='Approve as Pending';$('complete').disabled=false;$('pending').disabled=false;
 $('ordersModal').classList.add('hidden');renderCart();
 $('mainWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
}
async function approveSelectedOrder(){
 if(!activeOrder||busy||ordersBusy)return;
 const selectedOrder=activeOrder;
 if(!cart.length)return status('Order invoice mein kam az kam aik product required hai.','warning');
 if(cart.some(p=>!(Number(p.qty)>0)||!(Number(p.rate)>0)||!(Number(p.id)>0)))return status('Har product ki valid quantity aur rate required hain.','warning');
 if(!confirm('Customer order '+selectedOrder.order_number+' ko approve karke Pending invoice create karni hai?'))return;
 ordersBusy=true;busy=true;$('complete').disabled=true;$('pending').disabled=true;
 try{
  // Refresh before sending, to avoid approving a recently converted order.
  const fresh=await api('/api/data?resource=customer_portal&action=admin_orders');
  const current=(fresh.records||[]).find(o=>Number(o.id)===Number(selectedOrder.id));
  if(!current||current.status!=='pending'||current.cash_sale_id)throw Error('Order already converted/rejected. Cashier bills refresh karein.');
  const payload={order_id:selectedOrder.id,items:cart.map(i=>({product_id:Number(i.id),qty:Number(i.qty),price:Number(i.rate)})),discount:totals().discount};
  const result=await api('/api/data?resource=customer_portal&action=approve_order',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(result.pending_sync||!result.record?.id)throw Error('Order approval not confirmed. Order list check karein; duplicate request na bhejein.');
  const saved=result.record;
  activeOrder=null;document.body.classList.remove('order-mode-active');$('orderModeNotice').textContent='';
  $('complete').textContent='Complete Sale & Print';$('pending').textContent='Save as Pending';
  $('customer').disabled=false;cart=[];selected.clear();manualReceived=false;$('discount').value=0;
  lastInvoice=saved;$('pdf').disabled=false;
  renderCart();renderGallery();await loadOrders();setBillStatus('pending');openInvoice(saved);
  status(visibleInvoice(saved)+' order se Pending invoice ban gayi. Isi popup se payment receive karein.');
 }catch(e){status(e.message+' Server status verify kiye baghair dobara approve na karein.','error');await loadOrders(true).catch(()=>{})}
 finally{busy=false;ordersBusy=false;$('complete').disabled=false;$('pending').disabled=false;}
}
async function rejectCustomerOrder(id){
 const order=orderPending().find(o=>Number(o.id)===id);
 if(!order||ordersBusy)return;
 if(!confirm('Customer order '+order.order_number+' reject karna hai? Invoice create nahi hogi.'))return;
 ordersBusy=true;
 try{
  // Rejection is an online-only decision. The API's current-state guard wins.
  if(window.KT_OFFLINE?.isOnline && !window.KT_OFFLINE.isOnline())throw Error('Offline mein customer order reject nahi kar sakte.');
  const result=await api('/api/data?resource=customer_portal&action=reject_order',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_id:id})});
  if(result.pending_sync||!result.record?.id)throw Error('Reject not confirmed; order refresh karein.');
  if(activeOrder?.id===id){activeOrder=null;cart=[];document.body.classList.remove('order-mode-active');$('customer').disabled=false;renderCart();}
  await loadOrders(true);status('Customer order reject ho gaya.');
 }catch(e){$('ordersNotice').textContent=e.message;status(e.message,'warning')}
 finally{ordersBusy=false}
}

$('navSale').onclick=()=>$('mainWorkspace').scrollIntoView({behavior:'smooth'});$('navPending').onclick=()=>{setBillStatus('pending');$('recent').scrollIntoView({behavior:'smooth'})};$('navPaid').onclick=()=>{setBillStatus('paid');$('recent').scrollIntoView({behavior:'smooth'})};$('navOrders').onclick=()=>openOrders();$('navReport').onclick=()=>openLegacy('/cashier-sales-report.html','Sales Report');$('billsTop').onclick=()=>$('recent').scrollIntoView({behavior:'smooth'});$('holdTop').onclick=()=>$('pending').click();
$('online').textContent=navigator.onLine?'Online':'Offline';const connection=()=>{$('online').textContent=navigator.onLine?'Online':'Offline';$('online').classList.toggle('offline',!navigator.onLine)};addEventListener('online',connection);addEventListener('offline',connection);
function closeScanner(){cancelAnimationFrame(scannerLoop);barcodeStream?.getTracks().forEach(x=>x.stop());barcodeStream=null;$('scannerVideo').srcObject=null;$('scannerModal').classList.add('hidden')}$('closeScanner').onclick=closeScanner;$('scanTop').onclick=$('scanProduct').onclick=()=>$('scannerModal').classList.remove('hidden');$('findBarcode').onclick=()=>{const code=$('barcode').value.trim();const p=products.find(p=>String(p.barcode||'')===code||String(p.sku||'')===code);if(p){addProduct(p);closeScanner();status(p.name+' added')}else status('Barcode not found.','warning')};$('barcode').onkeydown=e=>{if(e.key==='Enter')$('findBarcode').click()};$('startScanner').onclick=async()=>{try{barcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});$('scannerVideo').srcObject=barcodeStream;await $('scannerVideo').play();if('BarcodeDetector'in window){scannerDetector=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a']});async function tick(){if(!barcodeStream)return;try{const found=await scannerDetector.detect($('scannerVideo'));if(found[0]?.rawValue){$('barcode').value=found[0].rawValue;$('findBarcode').click();return}}catch{}scannerLoop=requestAnimationFrame(tick)}tick()}}catch(e){status('Camera unavailable. Barcode manually enter karein.','warning')}};
api('/api/auth?action=me').then(j=>{$('salesman').value=j.user?.full_name||j.user?.employee_code||'Employee'}).catch(()=>{});loadProducts();loadCustomers();loadBills().catch(e=>status(e.message,'warning'));loadOrders();setInterval(()=>{if(!document.hidden&&!busy&&$('invoiceModal').classList.contains('hidden'))loadBills().catch(()=>{})},12000);setInterval(()=>{if(!document.hidden&&!ordersBusy)loadOrders().catch(()=>{})},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadOrders().catch(()=>{})});renderCart();setPayment('Cash');
})();