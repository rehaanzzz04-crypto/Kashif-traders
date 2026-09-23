'use strict';
(()=>{
  const nav=document.getElementById('nav');if(!nav)return;
  const inventory=[...nav.querySelectorAll('.section')].find(x=>x.textContent.trim()==='Inventory');if(!inventory)return;
  const style=document.createElement('style');
  style.textContent='.cashSaleMenuLink{position:relative;width:100%;display:grid;grid-template-columns:34px 1fr 14px;align-items:center;gap:9px;padding:8px 9px;margin:2px 0;border:1px solid transparent;border-radius:12px;background:transparent;color:#dce9e2;text-align:left;font-weight:720;cursor:pointer}.cashSaleMenuLink:hover{background:#ffffff0d}';
  document.head.appendChild(style);
  const add=(label,icon,url)=>{const b=document.createElement('button');b.type='button';b.className='cashSaleMenuLink';b.innerHTML='<span class="ico">'+icon+'</span><span class="label">'+label+'</span><span class="arr">›</span>';b.onclick=()=>location.href=url;nav.insertBefore(b,inventory)};
  const installSales=role=>{
    if(nav.querySelector('[data-kt-sales-section]'))return;
    const section=document.createElement('div');section.className='section';section.dataset.ktSalesSection='1';section.textContent='Sales';nav.insertBefore(section,inventory);
    if(role==='cashier'){add('Cashier Billing','CB','/cashier-sales.html');add('E-Commerce','EC','/ecommerce-dashboard.html')}
    else if(role==='salesman'){add('Cash Sale','CS','/cash-sale.html')}
    else{add('Cash Sale','CS','/cash-sale.html');add('Cashier Billing','CB','/cashier-sales.html');add('E-Commerce','EC','/ecommerce-dashboard.html')}
  };
  let savedRole='';try{savedRole=String(JSON.parse(localStorage.getItem('kt_offline_user_v1')||'null')?.user?.designation||'').toLowerCase()}catch{}
  const localRole=String(window.KT_USER?.designation||savedRole||'').toLowerCase();
  if(localRole)installSales(localRole);
  else fetch('/api/auth?action=me',{cache:'no-store'}).then(r=>r.json()).then(j=>installSales(String(j?.user?.designation||'').toLowerCase())).catch(()=>{});
})();
