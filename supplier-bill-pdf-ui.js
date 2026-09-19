'use strict';
(() => {
  const state = { invoiceId: null, items: [], products: [], form: null };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[c]));
  const money = value => `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

  async function json(url, options = {}) {
    const response = await fetch(url, Object.assign({ cache: 'no-store' }, options));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  function inventory(resource, params = {}, options = {}) {
    const query = new URLSearchParams({ resource });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) query.set(key, String(value));
    });
    return json('/api/inventory?' + query, options);
  }

  async function load(invoiceId) {
    if (!invoiceId) return;
    const [items, products] = await Promise.all([
      inventory('invoice_items', { invoice_id: invoiceId }),
      inventory('products')
    ]);

    state.invoiceId = Number(invoiceId);
    state.items = (items.records || []).map(item => ({
      product_id: Number(item.product_id),
      product_name: item.product_name || item.description || 'Item',
      description: item.description || item.product_name || 'Item',
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0)
    }));
    state.products = products.records || [];
  }

  async function saveItems() {
    if (!state.invoiceId) throw new Error('Supplier invoice not selected');

    const existing = await inventory('invoice_items', { invoice_id: state.invoiceId });
    for (const item of existing.records || []) {
      await inventory('invoice_items', { id: item.id }, { method: 'DELETE' });
    }

    for (const item of state.items) {
      await json('/api/inventory?resource=invoice_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_invoice_id: state.invoiceId,
          product_id: item.product_id,
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price)
        })
      });
    }
  }

  function render(container) {
    container.innerHTML = state.items.length
      ? `<div class="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${state.items.map((item, index) => `
                <tr>
                  <td>${esc(item.product_name)}</td>
                  <td><input type="number" min="0.001" step="0.001" data-item-index="${index}" data-item-field="quantity" value="${item.quantity}"></td>
                  <td><input type="number" min="0" step="0.01" data-item-index="${index}" data-item-field="unit_price" value="${item.unit_price}"></td>
                  <td>${money(item.quantity * item.unit_price)}</td>
                  <td><button type="button" class="btn small danger" data-remove-item="${index}">Remove</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      : '<p>No products saved for this bill.</p>';

    container.querySelectorAll('[data-item-field]').forEach(input => {
      input.onchange = () => {
        const item = state.items[Number(input.dataset.itemIndex)];
        if (!item) return;
        item[input.dataset.itemField] = Number(input.value || 0);
        render(container);
      };
    });

    container.querySelectorAll('[data-remove-item]').forEach(button => {
      button.onclick = () => {
        state.items.splice(Number(button.dataset.removeItem), 1);
        render(container);
      };
    });
  }

  function bindForm(form, invoiceId) {
    if (!form || !invoiceId) return;
    if (form.dataset.productsBound === '1') return;

    form.dataset.productsBound = '1';

    load(invoiceId).then(() => {
      const grid = form.querySelector('.grid');
      if (!grid) return;

      const existing = form.querySelector('[data-supplier-products-box]');
      if (existing) existing.remove();

      const box = document.createElement('div');
      box.className = 'field full';
      box.dataset.supplierProductsBox = '1';
      box.innerHTML = `
        <details open>
          <summary style="cursor:pointer;color:#173f35;font-weight:850">Invoice Products</summary>
          <div class="grid" style="margin-top:10px">
            <select data-item-product>
              <option value="">Select product</option>
              ${state.products.map(product => `<option value="${product.id}">${esc(product.name)}</option>`).join('')}
            </select>
            <input data-item-qty type="number" min="0.001" step="0.001" value="1">
            <input data-item-rate type="number" min="0" step="0.01" placeholder="Purchase price">
            <button type="button" class="btn light" data-add-item>+ Add Product</button>
          </div>
          <div data-items-list></div>
        </details>
      `;

      grid.appendChild(box);

      const product = box.querySelector('[data-item-product]');
      const qty = box.querySelector('[data-item-qty]');
      const rate = box.querySelector('[data-item-rate]');
      const list = box.querySelector('[data-items-list]');

      product.onchange = () => {
        const selected = state.products.find(p => String(p.id) === product.value);
        if (selected) rate.value = selected.purchase_price || 0;
      };

      box.querySelector('[data-add-item]').onclick = () => {
        const selected = state.products.find(p => String(p.id) === product.value);
        const quantity = Number(qty.value);
        const unitPrice = Number(rate.value);

        if (!selected || quantity <= 0 || unitPrice < 0) {
          window.toast?.('Product, quantity aur rate required', true);
          return;
        }

        state.items.push({
          product_id: selected.id,
          product_name: selected.name,
          description: selected.name,
          quantity,
          unit_price: unitPrice
        });

        product.value = '';
        qty.value = '1';
        rate.value = '';
        render(list);
      };

      render(list);

      if (!form.dataset.submitBound) {
        form.dataset.submitBound = '1';
        form.addEventListener('submit', () => {
          setTimeout(() => {
            if (!state.invoiceId) return;
            saveItems().catch(error => {
              window.toast?.('Products update failed: ' + error.message, true);
            });
          }, 500);
        }, true);
      }
    }).catch(error => {
      window.toast?.(error.message, true);
    });
  }

  function getEditableInvoiceId() {
    const form = document.querySelector('#recordForm');
    if (!form) return null;

    const fromField = form.querySelector('[name="id"]')?.value || form.querySelector('[data-id]')?.dataset.id;
    if (fromField) return fromField;

    const rowEdit = document.querySelector('#tbody [data-action="edit"]');
    return rowEdit?.dataset.id || null;
  }

  function ensureBind() {
    const form = document.querySelector('#recordForm');
    if (!form) return;

    const invoiceId = getEditableInvoiceId();
    if (!invoiceId) return;
    if (form.dataset.productsBound !== '1') bindForm(form, invoiceId);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action="edit"]');
    if (!button) return;
    setTimeout(() => ensureBind(), 50);
  }, true);

  const observer = new MutationObserver(() => {
    ensureBind();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => ensureBind(), 300);
})();
