'use strict';
(function(){
  let page=1,pageSize=25,search='',category='',status='';
  const money=v=>'PKR '+Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:0});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function fetchProducts(){
    const params=new URLSearchParams({resource:'products',paged:'1',page:String(page),page_size:String(pageSize),search,category,status});
    const r=await fetch('/api/inventory?'+params.toString(),{cache:'no-store'});
    const j=await r.json(); if(!r.ok) throw new Error(j.error||'Failed to load products'); return j;
  }

  function modal(){
    document.getElementById('invModal')?.remove();
    const m=document.createElement('div');m.id='invModal';m.className='modal';
    m.innerHTML='<div class="box"><h3>Add Product</h3><form id="spForm"><div class="grid">'+
      [['sku','SKU','text'],['name','Product Name','text'],['category','Category','text'],['unit','Unit','text'],['purchase_price','Purchase Price','number'],['sale_price','Sale Price','number'],['reorder_level','Reorder Level','number'],['barcode','Barcode','text']].map(f=>`<div class="field"><label>${f[1]}</label><input name="${f[0]}" type="${f[2]}" ${f[2]==='number'?'step="0.01"':''}></div>`).join('')+
      '<div class="field"><label>Status</label><select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div><div class="actions"><button type="button" class="btn alt" id="spCancel">Cancel</button><button class="btn" type="submit">Save</button></div></form></div>';
    document.body.appendChild(m);
    document.getElementById('spCancel').onclick=()=>m.remove();
    document.getElementById('spForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target).entries());const r=await fetch('/api/inventory?resource=products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(!r.ok){if(typeof toast==='function')toast(j.error||'Save failed',true);return;}m.remove();page=1;render();if(typeof toast==='function')toast('Product saved');};
  }

  async function render(){
    if(typeof invSetActive==='function')invSetActive('products');
    dashboard.classList.add('hidden');moduleBox.classList.remove('hidden');
    moduleBox.innerHTML='<div class="modulehead"><div><h2>Products</h2><p>Scalable product master for large catalogs</p></div><button class="btn" id="spAdd">+ Add Product</button></div><div class="toolbar"><input id="spSearch" class="searchbox" placeholder="Search SKU, product, category or barcode"><select id="spCategory"><option value="">All Categories</option></select><select id="spStatus"><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select><select id="spSize"><option>25</option><option>50</option><option>100</option></select><button class="btn" id="spSearchBtn">Search</button><button class="btn light" id="spClear">Clear</button></div><div id="spSummary" class="summaryline" style="margin-bottom:10px"></div><div id="spTable" class="tablewrap"><div class="empty">Loading…</div></div><div class="toolbar" style="margin-top:12px"><button class="btn light" id="spPrev">← Previous</button><span id="spPageInfo"></span><button class="btn light" id="spNext">Next →</button></div>';
    document.getElementById('spAdd').onclick=modal;
    try{
      const data=await fetchProducts();
      const cats=data.filters?.categories||[];
      document.getElementById('spCategory').innerHTML='<option value="">All Categories</option>'+cats.map(c=>`<option value="${esc(c)}" ${c===category?'selected':''}>${esc(c)}</option>`).join('');
      document.getElementById('spStatus').value=status;document.getElementById('spSize').value=String(pageSize);document.getElementById('spSearch').value=search;
      const rows=data.records||[],pg=data.pagination||{page:1,total:0,total_pages:1,page_size:pageSize};
      document.getElementById('spSummary').innerHTML=`<span>Total Products: <b>${pg.total}</b></span><span>Showing: <b>${rows.length}</b></span><span>Page: <b>${pg.page}/${pg.total_pages}</b></span>`;
      const body=rows.length?rows.map(x=>`<tr><td>${esc(x.sku)}</td><td><b>${esc(x.name)}</b><div style="font-size:11px;color:#6f7a73">${esc(x.category||'')}</div></td><td>${esc(x.unit)}</td><td>${money(x.purchase_price)}</td><td>${money(x.sale_price)}</td><td>${esc(x.stock_on_hand)}</td><td>${esc(x.reorder_level)}</td><td><span class="badge ${x.status==='inactive'?'bad':''}">${esc(x.status)}</span></td></tr>`).join(''):'<tr><td colspan="8" class="empty">No products found</td></tr>';
      document.getElementById('spTable').innerHTML='<table><thead><tr><th>SKU</th><th>Product</th><th>Unit</th><th>Purchase</th><th>Sale</th><th>Stock</th><th>Reorder</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table>';
      document.getElementById('spPageInfo').textContent=`Page ${pg.page} of ${pg.total_pages}`;
      document.getElementById('spPrev').disabled=pg.page<=1;document.getElementById('spNext').disabled=pg.page>=pg.total_pages;
      document.getElementById('spPrev').onclick=()=>{if(page>1){page--;render();}};document.getElementById('spNext').onclick=()=>{if(page<pg.total_pages){page++;render();}};
      document.getElementById('spSearchBtn').onclick=()=>{search=document.getElementById('spSearch').value.trim();category=document.getElementById('spCategory').value;status=document.getElementById('spStatus').value;pageSize=Number(document.getElementById('spSize').value);page=1;render();};
      document.getElementById('spSearch').onkeydown=e=>{if(e.key==='Enter')document.getElementById('spSearchBtn').click();};
      document.getElementById('spClear').onclick=()=>{search='';category='';status='';pageSize=25;page=1;render();};
    }catch(e){document.getElementById('spTable').innerHTML='<div class="empty">'+esc(e.message)+'</div>';}
  }

  nav.addEventListener('click',e=>{const b=e.target.closest('[data-view="products"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();render();},true);
})();
