(() => {
  const $ = (id) => document.getElementById(id),
    money = (v) =>
      "PKR " +
      Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 }),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          })[c],
      );
  const state = { items: [], timer: null, request: 0, sending: false };
  $("csDate").value = new Date().toISOString().slice(0, 10);
  $("csBack").onclick = () => (location.href = "/");

  let saleCustomers = [];
  function renderCustomers(selectedId = "") {
    const select = $("csCustomer"), current = String(selectedId || select.value || "");
    select.innerHTML = '<option value="">Walk-in Customer</option>' + saleCustomers.map(c =>
      '<option value="' + c.id + '">' + esc(c.name) + (c.mobile ? " · " + esc(c.mobile) : "") + '</option>'
    ).join("");
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }
  async function loadCustomers(selectedId = "") {
    try {
      const r = await fetch("/api/data?resource=cash_sale_customers",{cache:"no-store"}), data = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(data.error || "Customers load nahi ho sakay");
      saleCustomers = data.records || [];
      renderCustomers(selectedId);
    } catch (e) { $("csStatus").textContent = e.message; }
  }
  const customerModal = $("csCustomerModal"), customerForm = $("csCustomerForm");
  $("csAddCustomer").onclick = () => { customerForm.reset(); $("csCustomerStatus").textContent = ""; customerModal.classList.remove("cs-hidden"); };
  $("csCustomerCancel").onclick = () => customerModal.classList.add("cs-hidden");
  customerModal.onclick = e => { if (e.target === customerModal) customerModal.classList.add("cs-hidden"); };
  customerForm.onsubmit = async e => {
    e.preventDefault();
    const save = $("csCustomerSave"); save.disabled = true; $("csCustomerStatus").textContent = "Customer save ho raha hai...";
    try {
      const body = Object.fromEntries(new FormData(customerForm).entries());
      const r = await fetch("/api/data?resource=cash_sale_customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}), data = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(data.error || "Customer save nahi ho saka");
      customerModal.classList.add("cs-hidden");
      await loadCustomers(data.record.id);
      $("csStatus").textContent = data.record.name + " Cash Sale customer account mein save ho gaya.";
    } catch (e2) { $("csCustomerStatus").textContent = e2.message; }
    finally { save.disabled = false; }
  };
  async function requestProducts(search) {
    const token = ++state.request,
      params = new URLSearchParams({
        resource: "sale_products",
        search,
        status: "active",
      }),
      r = await fetch("/api/data?" + params, { cache: "no-store" });
    if (r.status === 401) {
      location.replace("/login.html");
      return [];
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || "Products load nahi ho sakay");
    return token === state.request ? j.records || [] : [];
  }
  function renderResults(rows) {
    const box = $("csResults");
    if (!rows.length) {
      box.innerHTML = '<div class="cs-empty">No Sale Product found</div>';
      box.classList.remove("cs-hidden");
      return;
    }
    box.innerHTML = rows
      .map(
        (x) =>
          '<button type="button" class="cs-result" data-id="' +
          x.id +
          '"><span><b>' +
          esc(x.name) +
          "</b><small>" +
          esc(x.entry_number || x.sku || "—") +
          " · Barcode: " +
          esc(x.barcode || "Not assigned") +
          '</small></span><span class="cs-result-price">' +
          money(x.sale_price) +
          "</span></button>",
      )
      .join("");
    box.classList.remove("cs-hidden");
    box.querySelectorAll("[data-id]").forEach(
      (b) =>
        (b.onclick = () => {
          const x = rows.find((r) => String(r.id) === b.dataset.id);
          if (x) addProduct(x);
        }),
    );
  }
  function addProduct(x) {
    const old = state.items.find((i) => i.id === x.id);
    if (old) old.qty += 1;
    else
      state.items.push({
        id: x.id,
        name: x.name,
        number: x.entry_number || x.sku || "—",
        barcode: x.barcode || "",
        unit: x.unit || "pcs",
        qty: 1,
        defaultRate: Number(x.sale_price || 0),
        rate: Number(x.sale_price || 0),
      });
    $("csSearch").value = "";
    $("csResults").classList.add("cs-hidden");
    renderItems();
    $("csStatus").textContent = x.name + " bill mein add ho gaya.";
  }
  function renderItems() {
    const body = $("csItems");
    if (!state.items.length)
      body.innerHTML =
        '<tr><td colspan="6"><div class="cs-empty"><b>No products added</b>Barcode ya product search use karein</div></td></tr>';
    else
      body.innerHTML = state.items
        .map(
          (x, i) =>
            '<tr><td class="cs-product-name"><b>' +
            esc(x.name) +
            "</b><small>" +
            esc(x.number) +
            " · " +
            esc(x.barcode || "No barcode") +
            '</small></td><td><input class="cs-qty" data-i="' +
            i +
            '" type="number" min="1" value="' +
            x.qty +
            '"></td><td>' +
            money(x.defaultRate) +
            '</td><td><input class="cs-rate" data-i="' +
            i +
            '" type="number" min="0" value="' +
            x.rate +
            '"></td><td><b>' +
            money(x.qty * x.rate) +
            '</b></td><td><button class="cs-remove" data-i="' +
            i +
            '" type="button">×</button></td></tr>',
        )
        .join("");
    body.querySelectorAll(".cs-qty").forEach(
      (el) =>
        (el.onchange = () => {
          state.items[+el.dataset.i].qty = Math.max(
            0.001,
            Number(el.value) || 1,
          );
          renderItems();
        }),
    );
    body.querySelectorAll(".cs-rate").forEach(
      (el) =>
        (el.onchange = () => {
          state.items[+el.dataset.i].rate = Math.max(0, Number(el.value) || 0);
          renderItems();
        }),
    );
    body.querySelectorAll(".cs-remove").forEach(
      (el) =>
        (el.onclick = () => {
          state.items.splice(+el.dataset.i, 1);
          renderItems();
        }),
    );
    renderSummary();
  }
  function renderSummary() {
    const subtotal = state.items.reduce((n, x) => n + x.qty * x.rate, 0),
      discount = Math.max(0, Number($("csDiscount").value) || 0),
      grand = Math.max(0, subtotal - discount);
    $("csItemCount").textContent = state.items.reduce((n, x) => n + x.qty, 0);
    $("csSubtotal").textContent = money(subtotal);
    $("csGrand").textContent = money(grand);
    $("csSave").disabled = !state.items.length || state.sending;
  }
  $("csSearch").oninput = () => {
    clearTimeout(state.timer);
    const s = $("csSearch").value.trim();
    if (!s) {
      $("csResults").classList.add("cs-hidden");
      return;
    }
    state.timer = setTimeout(async () => {
      try {
        renderResults(await requestProducts(s));
      } catch (e) {
        $("csStatus").textContent = e.message;
      }
    }, 250);
  };
  $("csSearch").onkeydown = (e) => {
    if (e.key === "Escape") $("csResults").classList.add("cs-hidden");
  };
  $("csDiscount").oninput = renderSummary;
  $("csClear").onclick = () => {
    state.items = [];
    $("csDiscount").value = "0";
    renderItems();
    $("csStatus").textContent = "Test sale cleared.";
  };
  let scannerStream = null, scannerFrame = 0, barcodeDetector = null;
  function stopScanner() {
    cancelAnimationFrame(scannerFrame);
    if (scannerStream) scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
    $("csScannerVideo").srcObject = null;
  }
  async function findBarcode(value) {
    const code = String(value || "").trim();
    if (!code) { $("csScannerStatus").textContent = "Barcode enter karein."; return; }
    $("csScannerStatus").textContent = "Searching " + code + "...";
    try {
      const rows = await requestProducts(code), product = rows.find(x => String(x.barcode || "").trim() === code);
      if (!product) { $("csScannerStatus").textContent = "Sale Product barcode nahi mila."; return; }
      addProduct(product); stopScanner(); $("csScanner").classList.add("cs-hidden"); $("csBarcodeInput").value = "";
    } catch (e) { $("csScannerStatus").textContent = e.message; }
  }
  async function detectBarcode() {
    if (!scannerStream || !barcodeDetector) return;
    try {
      const codes = await barcodeDetector.detect($("csScannerVideo"));
      if (codes[0]?.rawValue) { $("csBarcodeInput").value = codes[0].rawValue; await findBarcode(codes[0].rawValue); return; }
    } catch {}
    scannerFrame = requestAnimationFrame(detectBarcode);
  }
  $("csScan").onclick = () => { $("csScanner").classList.remove("cs-hidden"); $("csScannerStatus").textContent = "Start Camera tap karein."; };
  $("csScannerClose").onclick = () => { stopScanner(); $("csScanner").classList.add("cs-hidden"); };
  $("csBarcodeFind").onclick = () => findBarcode($("csBarcodeInput").value);
  $("csBarcodeInput").onkeydown = e => { if (e.key === "Enter") findBarcode(e.target.value); };
  $("csScannerStart").onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { $("csScannerStatus").textContent = "Camera unavailable—barcode manually enter karein."; return; }
    $("csScannerStart").disabled = true; $("csScannerStatus").textContent = "Opening camera...";
    try {
      scannerStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      $("csScannerVideo").srcObject = scannerStream; await $("csScannerVideo").play();
      if ("BarcodeDetector" in window) { barcodeDetector = new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","upc_a","upc_e"]}); $("csScannerStatus").textContent = "Scanning barcode..."; detectBarcode(); }
      else $("csScannerStatus").textContent = "Camera open hai. Is device par auto-detect unavailable ho to barcode manually enter karein.";
    } catch (e) { $("csScannerStatus").textContent = "Camera open nahi hua—barcode manually enter karein."; }
    finally { $("csScannerStart").disabled = false; }
  };
  let saleProductImage = null, editingSaleProduct = null, managedSaleProducts = [];
  const productModal = $("csProductModal"), productForm = $("csProductForm"),
    productCamera = $("csProductCamera"), productGallery = $("csProductGallery"),
    productImageStatus = $("csProductImageStatus");
  function openSaleProductForm(product = null) {
    editingSaleProduct = product;
    productForm.reset();
    for (const input of productForm.elements) if (input.name) input.value = product?.[input.name] ?? (input.name === "unit" ? "pcs" : input.name === "status" ? "active" : "");
    $("csProductNumber").value = product?.sku || "Generated automatically after Save";
    $("csProductFormTitle").textContent = product ? "Edit Sale Product" : "Add Sale Product";
    $("csProductFormNote").textContent = product ? "Product ki details update karein ya Products list se delete karein." : "Yeh product sirf Sale page ke catalog mein save hoga.";
    $("csProductSave").textContent = product ? "Update Product" : "Save Product";
    saleProductImage = null;
    productImageStatus.textContent = product?.product_image_url ? "Current image saved hai. Replace karna ho to new image select karein." : "Image optional hai.";
    $("csProductManager").classList.add("cs-hidden");
    productForm.classList.remove("cs-hidden");
    productModal.classList.remove("cs-hidden");
  }
  $("csAddProduct").onclick = () => openSaleProductForm();
  $("csProductCancel").onclick = () => productModal.classList.add("cs-hidden");
  $("csProductCameraBtn").onclick = () => productCamera.click();
  $("csProductGalleryBtn").onclick = () => productGallery.click();
  const pickSaleProductImage = (input) => {
    const file = input.files && input.files[0];
    if (!file) return;
    saleProductImage = file;
    productImageStatus.textContent = file.name + " selected";
    input.value = "";
  };
  productCamera.onchange = () => pickSaleProductImage(productCamera);
  productGallery.onchange = () => pickSaleProductImage(productGallery);
  function renderManagedSaleProducts() {
    const query = $("csManageSearch").value.trim().toLowerCase(), rows = managedSaleProducts.filter(product => !query || [product.name, product.sku, product.category, product.barcode].some(value => String(value || "").toLowerCase().includes(query)));
    $("csManageList").innerHTML = rows.length ? rows.map(product => '<article class="cs-manage-row">' + (product.product_image_url ? '<img src="' + esc(product.product_image_url) + '" alt="">' : '<div class="cs-manage-pic">KT</div>') + '<div><b>' + esc(product.name) + '</b><small>' + esc(product.sku || "—") + ' · ' + esc(product.category || "General") + ' · ' + esc(product.status) + '<br>' + money(product.sale_price) + ' · Barcode: ' + esc(product.barcode || "—") + '</small></div><div class="cs-manage-actions"><button data-product-edit="' + product.id + '" type="button">Edit</button><button class="danger" data-product-delete="' + product.id + '" type="button">Delete</button></div></article>').join("") : '<div class="cs-empty">Koi product nahi mila.</div>';
    $("csManageList").querySelectorAll("[data-product-edit]").forEach(button => button.onclick = () => openSaleProductForm(managedSaleProducts.find(product => String(product.id) === button.dataset.productEdit)));
    $("csManageList").querySelectorAll("[data-product-delete]").forEach(button => button.onclick = async () => { const product = managedSaleProducts.find(item => String(item.id) === button.dataset.productDelete); if (!product || !confirm(product.name + " delete karna hai?")) return; button.disabled = true; try { const response = await fetch("/api/data?resource=sale_products&id=" + product.id, {method:"DELETE"}), json = await response.json().catch(() => ({})); if (!response.ok) throw Error(json.error || "Product delete nahi ho saka"); $("csStatus").textContent = product.name + " delete ho gaya."; await loadManagedSaleProducts(); } catch (error) { alert(error.message); button.disabled = false; } });
  }
  async function loadManagedSaleProducts() {
    $("csManageList").innerHTML = '<div class="cs-empty">Products loading…</div>';
    try { const response = await fetch("/api/data?resource=sale_products", {cache:"no-store"}), json = await response.json().catch(() => ({})); if (!response.ok) throw Error(json.error || "Products load nahi ho sakay"); managedSaleProducts = json.records || []; renderManagedSaleProducts(); } catch (error) { $("csManageList").innerHTML = '<div class="cs-empty">' + esc(error.message) + '</div>'; }
  }
  $("csManageProducts").onclick = () => { productForm.classList.add("cs-hidden"); $("csProductManager").classList.remove("cs-hidden"); $("csProductFormTitle").textContent = "Manage Sale Products"; $("csProductFormNote").textContent = "Product edit ya delete karein."; loadManagedSaleProducts(); };
  $("csManageSearch").oninput = renderManagedSaleProducts;
  $("csNewProduct").onclick = () => openSaleProductForm();
  $("csManageClose").onclick = () => productModal.classList.add("cs-hidden");
  async function uploadSaleProductImage(file) {
    productImageStatus.textContent = "Uploading image...";
    const r = await fetch("/api/upload-document?name=" + encodeURIComponent(file.name || "sale-product.jpg"), {
      method: "POST",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || "Product image upload failed");
    return j.url;
  }
  productForm.onsubmit = async (e) => {
    e.preventDefault();
    const save = $("csProductSave");
    save.disabled = true;
    $("csStatus").textContent = "Sale product save ho raha hai...";
    try {
      const body = Object.fromEntries(new FormData(productForm).entries());
      if (saleProductImage) body.product_image_url = await uploadSaleProductImage(saleProductImage);
      const r = await fetch("/api/data?resource=sale_products" + (editingSaleProduct ? "&id=" + editingSaleProduct.id : ""), {
        method: editingSaleProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "Sale product save nahi ho saka");
      productModal.classList.add("cs-hidden");
      $("csSearch").value = j.record.name;
      renderResults([j.record]);
      $("csStatus").textContent = j.record.name + (editingSaleProduct ? " update ho gaya." : " Sale Products mein save ho gaya.");
    } catch (err) {
      $("csStatus").textContent = err.message;
      productImageStatus.textContent = err.message;
    } finally {
      save.disabled = false;
    }
  };
  $("csSave").onclick = async () => {
    if (!state.items.length || state.sending) return;
    state.sending = true;
    renderSummary();
    $("csStatus").textContent = "Bill cashier ko bheja ja raha hai...";
    try {
      const r = await fetch("/api/data?resource=cash_sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: $("csCustomer").value.trim() || "Walk-in Customer",
            sale_date: $("csDate").value,
            discount: $("csDiscount").value,
            items: state.items,
          }),
        }),
        j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "Bill send nahi ho saka");
      $("csStatus").textContent =
        j.record.invoice_number + " cashier ko bhej diya gaya.";
      state.items = [];
      $("csDiscount").value = "0";
      $("csCustomer").value = "";
      renderItems();
    } catch (e) {
      $("csStatus").textContent = e.message;
    } finally {
      state.sending = false;
      renderSummary();
    }
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".cs-search-wrap"))
      $("csResults").classList.add("cs-hidden");
  });
  fetch("/api/auth?action=me", { cache: "no-store" })
    .then((r) => {
      if (r.status === 401) location.replace("/login.html");
    })
    .catch(() => {
      $("csStatus").textContent = "Connection check failed.";
    });
  loadCustomers();
  renderItems();
})();
