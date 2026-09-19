'use strict';
(() => {
  const api = (resource, options = {}) => { let u = '/api/inventory?resource=' + encodeURIComponent(resource); if (options.id) u += '&id=' + encodeURIComponent(options.id); return fetch(u, { method: options.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: options.body ? JSON.stringify(options.body) : undefined, cache: 'no-store' }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Error(j.error || 'Request failed'); return j; }); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = v => 'PKR ' + Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  let editItems = [], products = [];
  async function installItems(form) {
    if (!form || form.dataset.supplierItemsFix === '1' || window.currentView !== 'supplier-bills' || !window.editId) return;
    form.dataset.supplierItemsFix = '1';
    const grid = form.querySelector('.grid'); if (!grid) return;
    try { const [ir, pr] = await Promise.all([api('invoice_items', { id: window.editId }), api('products')]); editItems = (ir.records || []).map(x => ({ ...x, quantity: Number(x.quantity || 1), unit_price: Number(x.unit_price || 0) })); products = pr.records || []; } catch (e) { window.toast?.(e.message, true); return; }
    const box = document.createElement('div'); box.className = 'field full'; box.innerHTML = '<details open><summary style="cursor:pointer;color:#173f35;font-weight:850">Invoice Products</summary><div style="margin-top:10px"><div class="grid"><select id="fixProduct"><option value="">Select product</option>' + products.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') + '</select><input id="fixQty" type="number" min="0.001" step="0.001" value="1"><input id="fixRate" type="number" min="0" step="0.01" placeholder="Purchase price"><button type="button" class="btn light" id="fixAdd">+ Add Product</button></div><div id="fixItems"></div></div></details>';
    grid.appendChild(box);
    const list = box.querySelector('#fixItems');
    const render = () => { list.innerHTML = editItems.length ? '<table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th></th></tr></thead><tbody>' + editItems.map((x, i) => '<tr><td>' + esc(x.product_name || x.description) + '</td><td><input data-i="' + i + '" data-k="quantity" type="number" min="0.001" step="0.001" value="' + x.quantity + '"></td><td><input data-i="' + i + '" data-k="unit_price" type="number" min="0" step="0.01" value="' + x.unit_price + '"></td><td>' + money(x.quantity * x.unit_price) + '</td><td><button type="button" class="btn small danger" data-remove="' + i + '">Remove</button></td></tr>').join('') + '</tbody></table>' : '<p>No products added.</p>'; list.querySelectorAll('[data-i]').forEach(e => e.oninput = () => { editItems[Number(e.dataset.i)][e.dataset.k] = Number(e.value || 0); render(); }); list.querySelectorAll('[data-remove]').forEach(e => e.onclick = () => { editItems.splice(Number(e.dataset.remove), 1); render(); }); };
    box.querySelector('#fixProduct').onchange = e => { const p = products.find(x => String(x.id) === e.target.value); if (p) box.querySelector('#fixRate').value = p.purchase_price || 0; };
    box.querySelector('#fixAdd').onclick = () => { const p = products.find(x => String(x.id) === box.querySelector('#fixProduct').value); const q = Number(box.querySelector('#fixQty').value), r = Number(box.querySelector('#fixRate').value); if (!p || !(q > 0) || r < 0) return window.toast?.('Product, quantity aur rate required', true); editItems.push({ product_id: p.id, product_name: p.name, description: p.name, quantity: q, unit_price: r }); render(); };
    render();
    form.addEventListener('submit', () => { const snapshot = editItems.map(x => ({ product_id: x.product_id, description: x.description || x.product_name, quantity: Number(x.quantity), unit_price: Number(x.unit_price) })); setTimeout(async () => { try { const latest = await api('invoice_items', { id: window.editId }); for (const x of latest.records || []) await api('invoice_items', { id: x.id, method: 'DELETE' }); for (const x of snapshot) await api('invoice_items', { method: 'POST', body: { supplier_invoice_id: window.editId, ...x } }); } catch (e) { window.toast?.('Products update failed: ' + e.message, true); } }, 900); }, true);
  }
  const mo = new MutationObserver(() => installItems(document.querySelector('#recordForm'))); mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => installItems(document.querySelector('#recordForm')), 300);
  window.getSupplierBillPdfUrl = id => '/api/supplier-bill-pdf?id=' + encodeURIComponent(id);
})();
