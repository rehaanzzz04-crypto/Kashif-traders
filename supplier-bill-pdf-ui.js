'use strict';
(() => {
  const json = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };
  const inventory = (resource, options = {}) => {
    const params = new URLSearchParams({ resource });
    if (options.invoiceId) params.set('invoice_id', options.invoiceId);
    if (options.id) params.set('id', options.id);
    return json('/api/inventory?' + params, { method: options.method || 'GET', body: options.body ? JSON.stringify(options.body) : undefined });
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const money = value => `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
  let itemState = { invoiceId: null, items: [], products: [], installedForm: null };

  async function loadItems(invoiceId) {
    const [items, productRows] = await Promise.all([
      inventory('invoice_items', { invoiceId }),
      inventory('products')
    ]);
    itemState.invoiceId = String(invoiceId);
    itemState.items = (items.records || []).map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name || item.description || 'Item',
      description: item.description || item.product_name || 'Item',
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0)
    }));
    itemState.products = productRows.records || [];
  }

  async function saveItems() {
    const existing = await inventory('invoice_items', { invoiceId: itemState.invoiceId });
    for (const item of existing.records || []) await inventory('invoice_items', { id: item.id, method: 'DELETE' });
    for (const item of itemState.items) {
      await inventory('invoice_items', { method: 'POST', body: {
        supplier_invoice_id: Number(itemState.invoiceId), product_id: Number(item.product_id),
        description: item.description, quantity: Number(item.quantity), unit_price: Number(item.unit_price)
      }});
    }
  }

  function renderItems(container) {
    const rows = itemState.items.map((item, index) => `<tr>
      <td>${esc(item.product_name)}</td>
      <td><input type="number" min="0.001" step="0.001" data-item-index="${index}" data-item-field="quantity" value="${item.quantity}"></td>
      <td><input type="number" min="0" step="0.01" data-item-index="${index}" data-item-field="unit_price" value="${item.unit_price}"></td>
      <td>${money(item.quantity * item.unit_price)}</td>
      <td><button type="button" class="btn small danger" data-remove-item="${index}">Remove</button></td>
    </tr>`).join('');
    container.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">No products added.</td></tr>'}</tbody></table></div>`;
    container.querySelectorAll('[data-item-field]').forEach(input => input.addEventListener('input', () => {
      const item = itemState.items[Number(input.dataset.itemIndex)];
      item[input.dataset.itemField] = Number(input.value || 0);
      renderItems(container);
    }));
    container.querySelectorAll('[data-remove-item]').forEach(button => button.addEventListener('click', () => {
      itemState.items.splice(Number(button.dataset.removeItem), 1); renderItems(container);
    }));
  }

  async function installItems(form) {
    if (!form || form === itemState.installedForm || typeof currentView === 'undefined' || currentView !== 'supplier-bills' || typeof editId === 'undefined' || !editId) return;
    itemState.installedForm = form;
    const grid = form.querySelector('.grid'); if (!grid) return;
    try { await loadItems(editId); } catch (error) { window.toast?.(error.message, true); return; }
    const box = document.createElement('div'); box.className = 'field full';
    box.innerHTML = `<details open><summary style="cursor:pointer;color:#173f35;font-weight:850">Invoice Products</summary>
      <div class="grid" style="margin-top:10px"><select data-item-product><option value="">Select product</option>${itemState.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
      <input data-item-qty type="number" min="0.001" step="0.001" value="1"><input data-item-rate type="number" min="0" step="0.01" placeholder="Purchase price"><button type="button" class="btn light" data-add-item>+ Add Product</button></div>
      <div data-items-list></div></details>`;
    grid.appendChild(box);
    const product = box.querySelector('[data-item-product]'), qty = box.querySelector('[data-item-qty]'), rate = box.querySelector('[data-item-rate]'), list = box.querySelector('[data-items-list]');
    product.addEventListener('change', () => { const selected = itemState.products.find(p => String(p.id) === product.value); if (selected) rate.value = selected.purchase_price || 0; });
    box.querySelector('[data-add-item]').addEventListener('click', () => {
      const selected = itemState.products.find(p => String(p.id) === product.value), quantity = Number(qty.value), unitPrice = Number(rate.value);
      if (!selected || quantity <= 0 || unitPrice < 0) return window.toast?.('Product, quantity aur rate required', true);
      itemState.items.push({ product_id: selected.id, product_name: selected.name, description: selected.name, quantity, unit_price: unitPrice });
      product.value = ''; qty.value = '1'; rate.value = ''; renderItems(list);
    });
    renderItems(list);
    form.addEventListener('submit', () => setTimeout(async () => { try { await saveItems(); } catch (error) { window.toast?.('Products update failed: ' + error.message, true); } }, 700), true);
  }

  function enhancePdfButtons() {
    if (typeof currentView === 'undefined' || currentView !== 'supplier-bills') return;
    document.querySelectorAll('#tbody [data-supplier-pdf]').forEach(button => {
      const id = button.closest('tr')?.querySelector('[data-action="edit"]')?.dataset.id || button.dataset.id;
      if (id) button.dataset.pdfUrl = `/api/supplier-bill-pdf?id=${encodeURIComponent(id)}`;
    });
  }
  const observer = new MutationObserver(() => { installItems(document.querySelector('#recordForm')); enhancePdfButtons(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => { installItems(document.querySelector('#recordForm')); enhancePdfButtons(); }, 300);
})();
