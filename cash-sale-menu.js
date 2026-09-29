'use strict';
(() => {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const inventory = [...nav.querySelectorAll('.section')]
    .find(x => x.textContent.trim() === 'Inventory');
  if (!inventory) return;

  const style = document.createElement('style');
  style.textContent = '.cashSaleMenuLink{position:relative;width:100%;display:grid;grid-template-columns:34px 1fr 14px;align-items:center;gap:9px;padding:8px 9px;margin:2px 0;border:1px solid transparent;border-radius:12px;background:transparent;color:#dce9e2;text-align:left;font-weight:720;cursor:pointer}.cashSaleMenuLink:hover{background:#ffffff0d}';
  document.head.appendChild(style);

  const addSection = label => {
    const section = document.createElement('div');
    section.className = 'section';
    section.textContent = label;
    nav.insertBefore(section, inventory);
    return section;
  };

  const add = (label, icon, url) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cashSaleMenuLink';
    b.innerHTML = '<span class="ico">' + icon + '</span><span class="label">' + label + '</span><span class="arr">›</span>';
    b.onclick = () => { location.href = url; };
    nav.insertBefore(b, inventory);
    return b;
  };

  fetch('/api/auth?action=me', { cache: 'no-store' })
    .then(r => r.json())
    .then(j => {
      const role = String(j?.user?.designation || '').toLowerCase();

      if (role === 'salesman') {
        addSection('Sales');
        add('Cash Sale', '$', '/cash-sale.html');
        return;
      }

      addSection('Sales');

      if (role !== 'cashier') {
        add('Cash Sale', '$', '/cash-sale.html');
      }

      add('Customer Accounts', 'CA', '/cash-sale-customers.html');
      add('Cashier Billing', 'Rs', '/cashier-sales.html');

      addSection('E-Commerce');
      add('E-Commerce', 'EC', '/ecommerce-dashboard.html');
    })
    .catch(err => console.error('Sales menu load failed', err));
})();