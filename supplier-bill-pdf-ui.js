'use strict';
(() => {
  const request = async (url, options) => {
    const response = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };
  const inventoryUrl = (resource, params) => {
    const query = new URLSearchParams({ resource });
    Object.keys(params || {}).forEach(key => { if (params[key] !== undefined && params[key] !== null) query.set(key, String(params[key])); });
    return `/api/inventory?${query}`;
  };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const money = value => `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
  let state = { invoiceId: null, items: [], products: [], form: null };

  async function load(invoiceId) {
    const [items, products] = await Promise.all([
      request(inventoryUrl('invoice_items', { invoice_id: invoiceId })),
      request(inventoryUrl('products'))
    ]);
    state.invoiceId = Number(invoiceId);
    state.items = (items.records || []).map(item => ({
      product_id: Number(item.product_id), product_name: item.product_name || item.description || 'Item',
      description: item.description || item.product_name || 'Item', quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0)
    }));
    state.products = products.records || [];
  }

  async function persist() {
    const current = await request(inventoryUrl('invoice_items', { invoice_id: state.invoiceId }));
    for (const item of current.records || []) await request(inventoryUrl('invoice_items', { id: item.id }), { method: 'DELETE' });
    for (const item of state.items) await request('/api/inventory?resource=invoice_items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier_invoice_id: state.invoiceId, product_id: item.product_id, description: item.description, quantity: item.quantity, unit_price: item.unit_price }) });
  }

  function render(container) {
    container.innerHTML = state.items.length ? `<div class="tablewrap"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th></th></tr></thead><tbody>${state.items.map((item, index) => `<tr><td>${esc(item.product_name)}</td><td><input type="number" min="0.001" step="0.001" data-item="${index}" data-field="quantity" value="${item.quantity}"></td><td><input type="number" min="0" step="0.01" data-item="${index}" data-field="unit_price" value="${item.unit_price}"></td><td>${money(item.quantity * item.unit_price)}</td><td><button type="button" class="btn small danger" data-remove="${index}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<p>No products added.</p>';
    container.querySelectorAll('[data-item]').forEach(input => input.addEventListener('change', () => { const item = state.items[Number(input.dataset.item)]; item[input.dataset.field] = Number(input.value || 0); render(container); }));
    container.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { state.items.splice(Number(button.dataset.remove), 1); render(container); }));
  }

  async function install(form) {
    if (!form || form === state.form || typeof currentView === 'undefined' || currentView !== 'supplier-bills' || typeof editId === 'undefined' || !editId) return;
    state.form = form;
    const grid = form.querySelector('.grid'); if (!grid) return;
    try { await load(editId); } catch (error) { window.toast && window.toast(error.message, true); return; }
    const box = document.createElement('div'); box.className = 'field full';
    box.innerHTML = `<details open><summary style="cursor:pointer;color:#173f35;font-weight:850">Invoice Products</summary><div class="grid"><select data-product><option value="">Select product</option>${state.products.map(product => `<option value="${product.id}">${esc(product.name)}</option>`).join('')}</select><input data-quantity type="number" min="0.001" step="0.001" value="1"><input data-rate type="number" min="0" step="0.01" placeholder="Purchase price"><button type="button" class="btn light" data-add>+ Add Product</button></div><div data-list></div></details>`;
    grid.appendChild(box);
    const product = box.querySelector('[data-product]'), quantity = box.querySelector('[data-quantity]'), rate = box.querySelector('[data-rate]'), list = box.querySelector('[data-list]');
    product.addEventListener('change', () => { const selected = state.products.find(item => String(item.id) === product.value); if (selected) rate.value = selected.purchase_price || 0; });
    box.querySelector('[data-add]').addEventListener('click', () => { const selected = state.products.find(item => String(item.id) === product.value), qty = Number(quantity.value), price = Number(rate.value); if (!selected || qty <= 0 || price < 0) return window.toast && window.toast('Product, quantity aur rate required', true); state.items.push({ product_id: selected.id, product_name: selected.name, description: selected.name, quantity: qty, unit_price: price }); product.value = ''; quantity.value = '1'; rate.value = ''; render(list); });
    render(list);
    form.addEventListener('submit', () => { setTimeout(() => persist().catch(error => window.toast && window.toast(`Products update failed: ${error.message}`, true)), 900); }, true);
  }

  const observer = new MutationObserver(() => install(document.querySelector('#recordForm')));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => install(document.querySelector('#recordForm')), 300);
})();
