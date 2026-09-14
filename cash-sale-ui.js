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
      box.innerHTML = '<div class="cs-empty">No ERP product found</div>';
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
  $("csScan").onclick = () => $("csScanner").classList.remove("cs-hidden");
  $("csScannerClose").onclick = () => $("csScanner").classList.add("cs-hidden");
  let saleProductImage = null;
  const productModal = $("csProductModal"), productForm = $("csProductForm"),
    productCamera = $("csProductCamera"), productGallery = $("csProductGallery"),
    productImageStatus = $("csProductImageStatus");
  $("csAddProduct").onclick = () => {
    productForm.reset();
    productForm.elements.unit.value = "pcs";
    productForm.elements.status.value = "active";
    saleProductImage = null;
    productImageStatus.textContent = "Image optional hai.";
    productModal.classList.remove("cs-hidden");
  };
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
      const r = await fetch("/api/data?resource=sale_products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "Sale product save nahi ho saka");
      productModal.classList.add("cs-hidden");
      $("csSearch").value = j.record.name;
      renderResults([j.record]);
      $("csStatus").textContent = j.record.name + " Sale Products mein save ho gaya.";
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
            customer_name: $("csCustomer").value,
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
  renderItems();
})();
