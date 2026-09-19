'use strict';
(() => {
  const state = { invoiceId: null, items: [], products: [], form: null };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const money = v => `PKR ${Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
  async function json(url, options) {
    const r = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || `Request failed (${r.status})`);
    return j;
  }
  function inventory(resource, params = {}, options) {
    const q = new URLSearchParams({ resource });
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) q.set(k, String(v)); });
    return json('/api/inventory?' + q, options);
  }
  function supplierBillsActive() { return document.querySelector('#nav [data-view="supplier-bills"].active'); }
  async function load(invoiceId) {
    const [items, products] = await Promise.all([
      inventory('invoice_items', { invoice_id: invoiceId }),
      inventory('products')
    ]);
    state.invoiceId = Number(invoiceId);
    state.items = (items.records || []).map(x => ({ product_id: Number(x.product_id), product_name: x.product_name || x.description || 'Item', description: x.description || x.product_name || 'Item', quantity: Number(x.quantity || 0), unit_price: Number(x.unit_price || 0) }));
    state.products = products.records || [];
  }
  async function saveItems() {
    const current = await inventory('invoice_items', { invoice_id: state.invoiceId });
    for (const item of current.records || []) await inventory('invoice_items', { id: item.id }, { method: 'DELETE' });
    for (const item of state.items) await json('/api/inventory?resource=invoice_items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier_invoice_id: state.invoiceId, product_id: item.product_id, description: item.description, quantity: item.quantity, unit_price: item.unit_price }) });
  }
  function render(container) {
    container.innerHTML = state.items.length ? `<div class="tablewrap"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th></th></tr></thead><tbody>${state.items.map((x, i) => `<tr><td>${esc(x.product_name)}</td><td><input type="number" min="0.001" step="0.001" data-item="${i}" data-field="quantity" value="${x.quantity}"></td><td><input type="number" min="0" step="0.01" data-item="${i}" data-field="unit_price" value="${x.unit_price}"></td><td>${money(x.quantity * x.unit_price)}</td><td><button type="button" class="btn small danger" data-remove="${i}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<p>No products saved for this bill.</p>';
    container.querySelectorAll('[data-item]').forEach(input => input.onchange = () => { const x = state.items[Number(input.dataset.item)]; x[input.dataset.field] = Number(input.value || 0); render(container); });
    container.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { state.items.splice(Number(button.dataset.remove), 1); render(container); });
  }
  async function install(form, invoiceId) {
    if (!form || !invoiceId || form === state.form || !supplierBillsActive()) return;
    state.form = form;
    try { await load(invoiceId); } catch (e) { window.toast?.(e.message, true); return; }
    const grid = form.querySelector('.grid'); if (!grid) return;
    const box = document.createElement('div'); box.className = 'field full';
    box.innerHTML = `<details open><summary style="cursor:pointer;color:#173f35;font-weight:850">Invoice Products</summary><div class="grid"><select data-product><option value="">Select product</option>${state.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><input data-qty type="number" min="0.001" step="0.001" value="1"><input data-rate type="number" min="0" step="0.01" placeholder="Purchase price"><button type="button" class="btn light" data-add>+ Add Product</button></div><div data-list></div></details>`;
    grid.appendChild(box);
    const product = box.querySelector('[data-product]'), qty = box.querySelector('[data-qty]'), rate = box.querySelector('[data-rate]'), list = box.querySelector('[data-list]');
    product.onchange = () => { const p = state.products.find(x => String(x.id) === product.value); if (p) rate.value = p.purchase_price || 0; };
    box.querySelector('[data-add]').onclick = () => { const p = state.products.find(x => String(x.id) === product.value), q = Number(qty.value), r = Number(rate.value); if (!p || q <= 0 || r < 0) return window.toast?.('Product, quantity aur rate required', true); state.items.push({ product_id: p.id, product_name: p.name, description: p.name, quantity: q, unit_price: r }); product.value = ''; qty.value = '1'; rate.value = ''; render(list); };
    render(list);
    form.addEventListener('submit', () => setTimeout(() => saveItems().catch(e => window.toast?.('Products update failed: ' + e.message, true)), 500), true);
  }
  let pendingInvoiceId = null;
  document.addEventListener('click', event => { const edit = event.target.closest('[data-action="edit"]'); if (edit && supplierBillsActive()) { pendingInvoiceId = edit.dataset.id; setTimeout(() => install(document.querySelector('#recordForm'), pendingInvoiceId), 50); } }, true);
  const observer = new MutationObserver(() => { if (pendingInvoiceId) install(document.querySelector('#recordForm'), pendingInvoiceId); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
