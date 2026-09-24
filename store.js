'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
const params=new URLSearchParams(location.search),company=(params.get('company')||'').trim().toUpperCase();
let store=null,products=[],categories=[],media=[],cart=[],activeCategory='';

async function json(url,options){const r=await fetch(url,{cache:'no-store',...options}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
function safeUrl(v){return /^https?:\/\//i.test(String(v||''))?String(v):''}
function applyTheme(){
  document.body.className='storebody theme-'+(store.theme_code||'modern');
  document.documentElement.style.setProperty('--primary',store.primary_color||'#176fe8');
  document.documentElement.style.setProperty('--secondary',store.secondary_color||'#7042e8');
  document.documentElement.style.setProperty('--accent',store.accent_color||'#16b8c8');
  document.documentElement.style.setProperty('--page-bg',store.background_color||'#f6f8fc');
}
function renderBrand(){
  const name=store.store_name||store.company_name;
  $('brandName').textContent=name;$('footerCompany').textContent=name;
  if(store.logo_url){$('brandLogo').src=store.logo_url;$('brandLogo').classList.remove('hidden')}
  if(store.header_layout==='name_only')$('brandLogo').classList.add('hidden');
  document.querySelector('.publicHeaderInner').classList.toggle('centerBrand',store.header_layout==='centered');
  document.title=store.seo_title||name;
  document.querySelector('meta[name="description"]').content=store.seo_description||store.hero_subtitle||'';
}
function renderHero(){
  $('heroTitle').textContent=store.hero_title||store.store_name||store.company_name;
  $('heroSubtitle').textContent=store.hero_subtitle||store.address||'';
  const url=safeUrl(store.hero_media_url),type=store.hero_media_type||'image';
  $('heroMedia').innerHTML=url?(type==='video'?'<video src="'+esc(url)+'" autoplay muted loop playsinline></video>':'<img src="'+esc(url)+'" alt="">'):'<div class="heroPlaceholder">'+esc((store.store_name||store.company_name).charAt(0))+'</div>';
}
function renderNav(){
  $('categoryNav').innerHTML=store.show_categories!==false?categories.slice(0,6).map(c=>'<button data-category="'+c.id+'">'+esc(c.category_name)+'</button>').join(''):'';
  document.querySelectorAll('#categoryNav button').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;$('categoryFilter').value=activeCategory;renderProducts();document.body.classList.remove('menuOpen');$('productsSection').scrollIntoView({behavior:'smooth'})});
}
function renderCategories(){
  if(store.show_categories===false||!categories.length){$('categorySection').classList.add('hidden');return}
  $('categorySection').classList.remove('hidden');
  $('categoryCards').innerHTML=categories.map(c=>'<button class="categoryCard" data-category="'+c.id+'>'+(c.image_url?'<img src="'+esc(c.image_url)+'" alt="">':'<span>'+esc(c.category_name.charAt(0))+'</span>')+'<b>'+esc(c.category_name)+'</b></button>').join('');
  $('categoryFilter').innerHTML='<option value="">All Categories</option>'+categories.map(c=>'<option value="'+c.id+'">'+esc(c.category_name)+'</option>').join('');
  document.querySelectorAll('.categoryCard').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;$('categoryFilter').value=activeCategory;renderProducts();$('productsSection').scrollIntoView({behavior:'smooth'})});
}
function productImage(p){
  const imgs=Array.isArray(p.images)?p.images:[],url=safeUrl(p.image_url||imgs[0]);
  return url?'<img src="'+esc(url)+'" alt="'+esc(p.product_name)+'" loading="lazy">':'<div class="productPlaceholder"><span>'+esc(p.product_name.charAt(0))+'</span></div>';
}
function productCard(p){
  return '<article class="productCard">'+productImage(p)+'<div class="productBody"><small>'+esc(p.category_name||p.sku)+'</small><h3>'+esc(p.product_name)+'</h3><p>'+esc(p.description||'')+'</p><div class="productBottom"><div><b>'+money(p.price)+'</b>'+(Number(p.compare_at_price)>Number(p.price)?'<del>'+money(p.compare_at_price)+'</del>':'')+'</div><button type="button" class="addProduct" data-id="'+p.id+'">Add</button></div></div></article>';
}
function wireAddButtons(root=document){root.querySelectorAll('.addProduct').forEach(b=>b.onclick=()=>addProduct(Number(b.dataset.id)))}
function renderProducts(){
  const q=$('storeSearch').value.trim().toLowerCase();
  const rows=products.filter(p=>(!activeCategory||String(p.category_id||'')===String(activeCategory))&&[p.product_name,p.sku,p.description,p.category_name].join(' ').toLowerCase().includes(q));
  $('productGrid').innerHTML=rows.length?rows.map(productCard).join(''):'<div class="storeEmpty">No matching products.</div>';wireAddButtons($('productGrid'));
}
function renderFeatured(){
  const rows=products.filter(p=>p.featured).slice(0,8);
  if(store.show_featured===false||!rows.length){$('featuredSection').classList.add('hidden');return}
  $('featuredSection').classList.remove('hidden');$('featuredGrid').innerHTML=rows.map(productCard).join('');wireAddButtons($('featuredGrid'));
}
function renderMedia(){
  const rows=media.filter(x=>['home','offer','gallery'].includes(x.placement));
  if(store.show_media===false||!rows.length){$('mediaSection').classList.add('hidden');return}
  $('mediaSection').classList.remove('hidden');
  $('mediaGrid').innerHTML=rows.map(x=>'<article class="mediaCard">'+(x.media_type==='video'?'<video src="'+esc(x.media_url)+'" controls playsinline></video>':'<img src="'+esc(x.media_url)+'" alt="'+esc(x.title||'')+'" loading="lazy">')+(x.title?'<b>'+esc(x.title)+'</b>':'')+'</article>').join('');
}
function renderAbout(){
  if(!store.about_text&&!store.about_title){$('aboutSection').classList.add('hidden');return}
  $('aboutSection').classList.remove('hidden');$('aboutTitle').textContent=store.about_title||'About Us';$('aboutText').textContent=store.about_text||'';
}
function renderContact(){
  const chips=[];if(store.contact_phone)chips.push('<a href="tel:'+esc(store.contact_phone)+'">Call '+esc(store.contact_phone)+'</a>');if(store.whatsapp_number)chips.push('<a href="https://wa.me/'+esc(store.whatsapp_number.replace(/\D/g,''))+'" target="_blank">WhatsApp</a>');
  $('contactChips').innerHTML=chips.join('');$('footerText').textContent=store.footer_text||store.address||'';
  const socials=[];[['Instagram',store.instagram_url],['Facebook',store.facebook_url],['TikTok',store.tiktok_url]].forEach(([n,u])=>{if(safeUrl(u))socials.push('<a href="'+esc(u)+'" target="_blank" rel="noopener">'+n+'</a>')});$('socialLinks').innerHTML=socials.join('');
  $('searchSection').classList.toggle('hidden',store.show_search===false&&!chips.length);document.querySelector('.publicSearch').classList.toggle('hidden',store.show_search===false);
}
function addProduct(id){
  const p=products.find(x=>Number(x.id)===id);if(!p)return;const found=cart.find(x=>Number(x.id)===id);
  if(found){if(found.qty+1>Number(p.stock_qty))return alert('Available stock '+p.stock_qty);found.qty++}else cart.push({...p,qty:1});
  renderCart();openCart();
}
function renderCart(){
  $('cartCount').textContent=cart.reduce((n,x)=>n+Number(x.qty||0),0).toLocaleString('en-PK',{maximumFractionDigits:3});
  $('cartItems').innerHTML=cart.length?cart.map((x,i)=>'<div class="cartItem" data-index="'+i+'><div><b>'+esc(x.product_name)+'</b><small>'+money(x.price)+' each</small></div><div class="qtyControl"><button type="button" data-step="-1">−</button><input value="'+x.qty+'" inputmode="decimal"><button type="button" data-step="1">+</button></div><button type="button" class="removeCart">×</button></div>').join(''):'<div class="storeEmpty">Your cart is empty.</div>';
  const subtotal=cart.reduce((n,x)=>n+Number(x.qty)*Number(x.price),0),delivery=Number(store?.delivery_charge||0);
  $('cartSubtotal').textContent=money(subtotal);$('cartDelivery').textContent=money(delivery);$('cartTotal').textContent=money(subtotal+(cart.length?delivery:0));
  $('cartItems').querySelectorAll('.cartItem').forEach(row=>{const i=Number(row.dataset.index),x=cart[i],input=row.querySelector('input');row.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const next=Math.max(.001,Number(x.qty)+Number(b.dataset.step));if(next>Number(x.stock_qty))return alert('Available stock '+x.stock_qty);x.qty=next;renderCart()});input.onchange=()=>{const next=Math.max(.001,Number(input.value||0));x.qty=Math.min(next,Number(x.stock_qty));renderCart()};row.querySelector('.removeCart').onclick=()=>{cart.splice(i,1);renderCart()}});
}
function openCart(){document.body.classList.add('cartOpen')}function closeCart(){document.body.classList.remove('cartOpen')}
async function load(){
  if(!company){$('heroTitle').textContent='Store link is incomplete';$('productGrid').innerHTML='<div class="storeEmpty">Company store code missing.</div>';return}
  const data=await json('/api/bizora-store?company='+encodeURIComponent(company));store=data.store;products=data.products||[];categories=data.categories||[];media=data.media||[];
  applyTheme();renderBrand();renderHero();renderNav();renderCategories();renderFeatured();renderMedia();renderAbout();renderContact();renderProducts();renderCart();
}
$('storeSearch').oninput=renderProducts;$('categoryFilter').onchange=e=>{activeCategory=e.target.value;renderProducts()};$('cartToggle').onclick=openCart;$('cartClose').onclick=closeCart;$('mobileMenu').onclick=()=>document.body.classList.toggle('menuOpen');
$('checkoutForm').onsubmit=async e=>{e.preventDefault();if(!cart.length)return alert('Cart is empty');const btn=$('placeOrder');btn.disabled=true;btn.textContent='Placing Order…';try{const data=Object.fromEntries(new FormData(e.currentTarget));data.company_code=company;data.action='place_order';data.items=cart.map(x=>({product_id:x.id,quantity:x.qty}));const result=await json('/api/bizora-store',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});cart=[];renderCart();e.currentTarget.reset();closeCart();$('orderSuccess').classList.remove('hidden');$('orderSuccess').innerHTML='<span class="eyebrow">ORDER RECEIVED</span><h2>Thank you!</h2><p>Your order <b>'+esc(result.order.order_number)+'</b> has been submitted to '+esc(result.store_name)+'.</p><div><span>Total</span><b>'+money(result.order.total)+'</b></div>';$('orderSuccess').scrollIntoView({behavior:'smooth',block:'center'});const fresh=await json('/api/bizora-store?company='+encodeURIComponent(company));store=fresh.store;products=fresh.products||[];categories=fresh.categories||[];media=fresh.media||[];renderProducts();renderFeatured()}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Place Order'}};
load().catch(e=>{$('heroTitle').textContent='Store unavailable';$('productGrid').innerHTML='<div class="storeEmpty">'+esc(e.message)+'</div>'});
