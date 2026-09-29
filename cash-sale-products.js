(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = v => "PKR " + Number(v || 0).toLocaleString("en-PK",{maximumFractionDigits:2});
  let products = [], editing = null, imageFile = null;

  $("mpBack").onclick = () => location.href = "/cash-sale.html";
  $("mpAdd").onclick = () => openForm();
  $("mpRefresh").onclick = () => loadProducts();
  $("mpSearch").oninput = renderProducts;
  $("mpClose").onclick = closeForm;
  $("mpCancel").onclick = closeForm;
  $("mpModal").onclick = e => { if (e.target === $("mpModal")) closeForm(); };

  function openForm(product = null){
    editing = product;
    imageFile = null;
    $("mpForm").reset();
    for (const input of $("mpForm").elements) {
      if (!input.name) continue;
      input.value = product?.[input.name] ?? (input.name === "unit" ? "pcs" : input.name === "status" ? "active" : "");
    }
    $("mpSku").value = product?.sku || "";
    $("mpFormTitle").textContent = product ? "Edit Product" : "Add Product";
    $("mpSave").textContent = product ? "Update Product" : "Save Product";
    $("mpImageStatus").textContent = product?.product_image_url ? "Current image saved hai. Replace karne ke liye new image select karein." : "Image optional hai.";
    $("mpStatus").textContent = "";
    $("mpModal").classList.remove("mp-hidden");
  }
  function closeForm(){
    $("mpModal").classList.add("mp-hidden");
    editing = null;
    imageFile = null;
  }

  function renderProducts(){
    const q = $("mpSearch").value.trim().toLowerCase();
    const rows = products.filter(p => !q || [p.name,p.sku,p.category,p.barcode,p.unit,p.status].some(v => String(v || "").toLowerCase().includes(q)));
    $("mpList").innerHTML = rows.length ? rows.map((p, index) => `
      <article class="mp-row">
        <div class="mp-index">${index + 1}</div>
        <div class="mp-product-cell">
          ${p.product_image_url ? '<img src="' + esc(p.product_image_url) + '" alt="">' : '<div class="mp-pic">KT</div>'}
          <div class="mp-info">
            <b>${esc(p.name)}</b>
            <small>${esc(p.sku || "—")} · ${esc(p.unit || "pcs")} · ${esc(p.status || "active")}</small>
          </div>
        </div>
        <div class="mp-meta">${esc(p.category || "General")} · ${esc(p.barcode || "No barcode")}</div>
        <div class="mp-price">${money(p.sale_price)}</div>
        <div class="mp-actions">
          <button class="mp-edit" data-edit="${p.id}" type="button">Edit</button>
          <button class="mp-delete" data-delete="${p.id}" type="button">Delete</button>
        </div>
      </article>`).join("") : '<div class="mp-empty">Koi product nahi mila.</div>';

    $("mpList").querySelectorAll("[data-edit]").forEach(btn => {
      btn.onclick = () => openForm(products.find(p => String(p.id) === btn.dataset.edit));
    });
    $("mpList").querySelectorAll("[data-delete]").forEach(btn => {
      btn.onclick = () => deleteProduct(btn.dataset.delete, btn);
    });
  }

  async function loadProducts(){
    $("mpList").innerHTML = '<div class="mp-empty">Products loading…</div>';
    try {
      const r = await fetch("/api/data?resource=sale_products",{cache:"no-store"});
      if (r.status === 401) { location.replace("/login.html"); return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "Products load nahi ho sakay");
      products = j.records || [];
      renderProducts();
      $("mpStatus").textContent = products.length + " products loaded.";
    } catch (e) {
      $("mpList").innerHTML = '<div class="mp-empty">' + esc(e.message) + '</div>';
      $("mpStatus").textContent = e.message;
    }
  }

  async function deleteProduct(id, button){
    const product = products.find(p => String(p.id) === String(id));
    if (!product || !confirm(product.name + " delete karna hai?")) return;
    button.disabled = true;
    $("mpStatus").textContent = product.name + " delete ho raha hai...";
    try {
      const r = await fetch("/api/data?resource=sale_products&id=" + encodeURIComponent(id),{method:"DELETE"});
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "Product delete nahi ho saka");
      products = products.filter(p => String(p.id) !== String(id));
      renderProducts();
      $("mpStatus").textContent = product.name + " delete ho gaya.";
    } catch (e) {
      button.disabled = false;
      $("mpStatus").textContent = e.message;
      alert(e.message);
    }
  }

  $("mpCameraBtn").onclick = () => $("mpCamera").click();
  $("mpGalleryBtn").onclick = () => $("mpGallery").click();
  const pickImage = input => {
    const file = input.files?.[0];
    if (!file) return;
    imageFile = file;
    $("mpImageStatus").textContent = file.name + " selected";
    input.value = "";
  };
  $("mpCamera").onchange = () => pickImage($("mpCamera"));
  $("mpGallery").onchange = () => pickImage($("mpGallery"));

  async function uploadImage(file){
    $("mpImageStatus").textContent = "Uploading image...";
    const r = await fetch("/api/upload-document?name=" + encodeURIComponent(file.name || "sale-product.jpg"),{
      method:"POST",
      headers:{"Content-Type":file.type || "image/jpeg"},
      body:file
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || "Product image upload failed");
    return j.url;
  }

  $("mpForm").onsubmit = async e => {
    e.preventDefault();
    const save = $("mpSave");
    save.disabled = true;
    $("mpStatus").textContent = editing ? "Product update ho raha hai..." : "Product save ho raha hai...";
    try {
      const body = Object.fromEntries(new FormData($("mpForm")).entries());
      if (!body.sku) delete body.sku;
      if (imageFile) body.product_image_url = await uploadImage(imageFile);
      const url = "/api/data?resource=sale_products" + (editing ? "&id=" + editing.id : "");
      const r = await fetch(url,{
        method: editing ? "PATCH" : "POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "Product save nahi ho saka");
      closeForm();
      await loadProducts();
      $("mpStatus").textContent = j.record.name + (editing ? " update ho gaya." : " add ho gaya.");
    } catch (e2) {
      $("mpStatus").textContent = e2.message;
      $("mpImageStatus").textContent = e2.message;
    } finally {
      save.disabled = false;
    }
  };

  fetch("/api/auth?action=me",{cache:"no-store"}).then(r => {
    if (r.status === 401) location.replace("/login.html");
  }).catch(() => {});
  loadProducts();
})();