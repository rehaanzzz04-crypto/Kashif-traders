'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
const params=new URLSearchParams(location.search),company=(params.get('company')||'').trim().toUpperCase();
let store=null,products=[],cart=[];
async function json(url,options){const r=await fetch(url,{cache:'no-store',...options}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
function productImage(p){return p.image_url?'<img src="'+esc(p.image_url)+'" alt="'+esc(p.product_name)+'" loading="lazy">':'<div class="productPlaceholder"><span>BZ</span></div>'}
function renderProducts(){
  const q=$('storeSearch').value.trim().toLowerCase();
  const rows=products.filter(p=>[p.product_name,p.sku,p.description].join(' ').toLowerCase().includes(q));
  $('productGrid').innerHTML=rows.length?rows.map(p=>'<article class="productCard">'+productImage(p)+'<div class="productBody"><small>'+esc(p.sku)+'</small><h3>'+esc(p.product_name)+'</h3><p>'+esc(p.description||'')+'</p><div class="productBottom"><div><b>'+money(p.price)+'</b><span>Stock '+esc(p.stock_qty)+'</span></div><button type="button" class="addProduct" data-id="'+p.id+'">Add</button></div></div></article>').join(''):'<div class="storeEmpty">No matching products.</div>';
  document.querySelectorAll('.addProduct').forEach(b=>b.onclick=()=>addProduct(Number(b.dataset.id)));
}
function addProduct(id){
  const p=products.find(x=>Number(x.id)===id);if(!p)return;
  const found=cart.find(x=>Number(x.id)===id);
  if(found){if(found.qty+1>Number(p.stock_qty))return alert('Available stock '+p.stock_qty);found.qty++}
  else cart.push({...p,qty:1});
  renderCart();openCart();
}
function renderCart(){
  $('cartCount').textContent=cart.reduce((n,x)=>n+Number(x.qty||0),0).toLocaleString('en-PK',{maximumFractionDigits:3});
  $('cartItems').innerHTML=cart.length?cart.map((x,i)=>'<div class="cartItem" data-index="'+i+'><div><b>'+esc(x.product_name)+'</b><small>'+money(x.price)+' each</small></div><div class="qtyControl"><button type="button" data-step="-1">−</button><input value="'+x.qty+'" inputmode="decimal"><button type="button" data-step="1">+</button></div><button type="button" class="removeCart">×</button></div>').join(''):'<div class="storeEmpty">Your cart is empty.</div>';
  const subtotal=cart.reduce((n,x)=>n+Number(x.qty)*Number(x.price),0),delivery=Number(store?.delivery_charge||0);
  $('cartSubtotal').textContent=money(subtotal);$('cartDelivery').textContent=money(delivery);$('cartTotal').textContent=money(subtotal+(cart.length?delivery:0));
  $('cartItems').querySelectorAll('.cartItem').forEach(row=>{
    const i=Number(row.dataset.index),x=cart[i],input=row.querySelector('input');
    row.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const next=Math.max(.001,Number(x.qty)+Number(b.dataset.step));if(next>Number(x.stock_qty))return alert('Available stock '+x.stock_qty);x.qty=next;renderCart()});
    input.onchange=()=>{const next=Math.max(.001,Number(input.value||0));if(next>Number(x.stock_qty)){alert('Available stock '+x.stock_qty);x.qty=Number(x.stock_qty)}else x.qty=next;renderCart()};
    row.querySelector('.removeCart').onclick=()=>{cart.splice(i,1);renderCart()};
  });
}
function openCart(){document.body.classList.add('cartOpen')}
function closeCart(){document.body.classList.remove('cartOpen')}
async function load(){
  if(!company){$('storeName').textContent='Store link is incomplete';$('productGrid').innerHTML='<div class="storeEmpty">Company store code missing.</div>';return}
  const data=await json('/api/bizora-store?company='+encodeURIComponent(company));
  store=data.store;products=data.products||[];
  document.title=(store.store_name||store.company_name)+' — Bizora Store';
  $('storeName').textContent=store.store_name||store.company_name;$('storeAddress').textContent=store.address||'Secure ordering powered by Bizora ERP';
  const contacts=[];if(store.contact_phone)contacts.push('<span>Call '+esc(store.contact_phone)+'</span>');if(store.whatsapp_number)contacts.push('<span>WhatsApp '+esc(store.whatsapp_number)+'</span>');
  $('storeContact').innerHTML=contacts.join('');
  $('cartDelivery').textContent=money(store.delivery_charge);renderProducts();renderCart();
}
$('storeSearch').oninput=renderProducts;$('cartToggle').onclick=openCart;$('cartClose').onclick=closeCart;
$('checkoutForm').onsubmit=async e=>{
  e.preventDefault();if(!cart.length)return alert('Cart is empty');
  const btn=$('placeOrder');btn.disabled=true;btn.textContent='Placing Order…';
  try{
    const data=Object.fromEntries(new FormData(e.currentTarget));
    data.company_code=company;data.action='place_order';data.items=cart.map(x=>({product_id:x.id,quantity:x.qty}));
    const result=await json('/api/bizora-store',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    cart=[];renderCart();e.currentTarget.reset();closeCart();
    $('orderSuccess').classList.remove('hidden');$('orderSuccess').innerHTML='<span class="storeEyebrow">ORDER RECEIVED</span><h2>Thank you!</h2><p>Your order <b>'+esc(result.order.order_number)+'</b> has been submitted to '+esc(result.store_name)+'.</p><div><span>Total</span><b>'+money(result.order.total)+'</b></div>';
    $('orderSuccess').scrollIntoView({behavior:'smooth',block:'center'});
    const fresh=await json('/api/bizora-store?company='+encodeURIComponent(company));store=fresh.store;products=fresh.products||[];renderProducts();
  }catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Place Order'}
};
load().catch(e=>{$('storeName').textContent='Store unavailable';$('productGrid').innerHTML='<div class="storeEmpty">'+esc(e.message)+'</div>'});