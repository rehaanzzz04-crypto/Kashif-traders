(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = v => "PKR " + Number(v || 0).toLocaleString("en-PK",{maximumFractionDigits:2});
  let products = [], editing = null, imageFile = null;
  let scannerStream = null, scannerFrame = 0, scannerDetector = null;

  const fileLabel = bytes => window.KT_MEDIA?.label ? window.KT_MEDIA.label(bytes) : Math.max(1,Math.round(Number(bytes||0)/1024)) + " KB";
  const CODE39 = {
    "0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn",
    "A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn",
    "K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww","O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn",
    "U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnnn","Z":"nwwnwnnnn","-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","$":"nwnwnwnnn","/":"nwnwnnnwn","+":"nwnnnwnwn","%":"nnnwnwnwn","*":"nwnnwnwnn"
  };
  function barcodeSvg(value){
    const raw=("*"+String(value||"").toUpperCase().replace(/[^0-9A-Z. $/+%\-]/g,"")+"*");
    const narrow=2,wide=5,gap=2,height=70,quiet=10;
    let x=quiet,bars="";
    for(const ch of raw){
      const pattern=CODE39[ch]; if(!pattern) continue;
      for(let i=0;i<9;i++){
        const w=pattern[i]==="w"?wide:narrow;
        if(i%2===0) bars += '<rect x="'+x+'" y="0" width="'+w+'" height="'+height+'" fill="#000"/>';
        x+=w;
      }
      x+=gap;
    }
    const width=x+quiet;
    return {bars,width,height};
  }
  function generatedBarcode(product){ return "KT"+String(product.id).padStart(10,"0"); }

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
    if(product?.product_image_url){
      $("mpImagePreview").src = product.product_image_url;
      $("mpImagePreviewText").textContent = "Current saved product image";
      $("mpImagePreviewWrap").classList.remove("mp-hidden");
    } else {
      $("mpImagePreview").removeAttribute("src");
      $("mpImagePreviewWrap").classList.add("mp-hidden");
    }
    $("mpStatus").textContent = "";
    $("mpModal").classList.remove("mp-hidden");
  }
  function closeForm(){
    $("mpModal").classList.add("mp-hidden");
    editing = null;
    imageFile = null;
    $("mpImagePreview").removeAttribute("src");
    $("mpImagePreviewWrap").classList.add("mp-hidden");
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
          <button class="mp-barcode" data-barcode="${p.id}" type="button">${p.barcode ? "Barcode" : "Generate Barcode"}</button>
          <button class="mp-delete" data-delete="${p.id}" type="button">Delete</button>
        </div>
      </article>`).join("") : '<div class="mp-empty">Koi product nahi mila.</div>';

    $("mpList").querySelectorAll("[data-edit]").forEach(btn => {
      btn.onclick = () => openForm(products.find(p => String(p.id) === btn.dataset.edit));
    });
    $("mpList").querySelectorAll("[data-barcode]").forEach(btn => {
      btn.onclick = () => showBarcode(products.find(p => String(p.id) === btn.dataset.barcode), btn);
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
      // When Manage Products is embedded in Smart Billing, reuse this
      // successful server result in its gallery and offline product cache.
      // No additional API call; never send data across origins.
      if(window.parent!==window){
        try{window.parent.postMessage({type:'kt-manage-products-loaded',records:products},location.origin);}catch{}
      }
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
  const pickImage = async input => {
    const file = input.files?.[0];
    if (!file) return;
    $("mpImageStatus").textContent = "Compressing " + fileLabel(file.size) + "...";
    try {
      imageFile = window.KT_MEDIA?.image ? await window.KT_MEDIA.image(file) : file;
      $("mpImageStatus").textContent = file.name + " · " + fileLabel(file.size) + " → " + fileLabel(imageFile.size);
      const previewUrl = URL.createObjectURL(imageFile);
      $("mpImagePreview").src = previewUrl;
      $("mpImagePreviewText").textContent = "Preview after compression";
      $("mpImagePreviewWrap").classList.remove("mp-hidden");
      $("mpImagePreview").onload = () => setTimeout(()=>URL.revokeObjectURL(previewUrl), 1000);
    } catch (e) {
      imageFile = null;
      $("mpImageStatus").textContent = e.message || "Image compression failed";
      alert(e.message || "Image compression failed");
    }
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


  function stopBarcodeScanner(){
    cancelAnimationFrame(scannerFrame);
    if(scannerStream) scannerStream.getTracks().forEach(track=>track.stop());
    scannerStream=null;
    $("mpScannerVideo").srcObject=null;
  }
  function closeBarcodeScanner(){
    stopBarcodeScanner();
    $("mpBarcodeScanner").classList.add("mp-hidden");
  }
  async function scanLoop(){
    if(!scannerStream || !scannerDetector) return;
    try{
      const found=await scannerDetector.detect($("mpScannerVideo"));
      if(found[0]?.rawValue){
        $("mpScannerValue").value=found[0].rawValue;
        $("mpScannerStatus").textContent="Barcode found: "+found[0].rawValue;
        $("mpBarcode").value=found[0].rawValue;
        closeBarcodeScanner();
        return;
      }
    }catch{}
    scannerFrame=requestAnimationFrame(scanLoop);
  }
  $("mpScanBarcode").onclick=()=>{ $("mpScannerValue").value=$("mpBarcode").value||""; $("mpScannerStatus").textContent="Start Camera tap karein."; $("mpBarcodeScanner").classList.remove("mp-hidden"); };
  $("mpScannerClose").onclick=closeBarcodeScanner;
  $("mpScannerCancel").onclick=closeBarcodeScanner;
  $("mpScannerUse").onclick=()=>{ const v=$("mpScannerValue").value.trim(); if(!v)return $("mpScannerStatus").textContent="Barcode scan ya enter karein."; $("mpBarcode").value=v; closeBarcodeScanner(); };
  $("mpScannerStart").onclick=async()=>{
    if(!navigator.mediaDevices?.getUserMedia){ $("mpScannerStatus").textContent="Camera unavailable—barcode manually enter karein."; return; }
    $("mpScannerStart").disabled=true; $("mpScannerStatus").textContent="Opening camera...";
    try{
      scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      $("mpScannerVideo").srcObject=scannerStream; await $("mpScannerVideo").play();
      if("BarcodeDetector" in window){
        scannerDetector=new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","upc_a","upc_e"]});
        $("mpScannerStatus").textContent="Barcode camera ke samne rakhein...";
        scanLoop();
      } else {
        $("mpScannerStatus").textContent="Is device par auto barcode detect unavailable hai. Barcode manually enter karein.";
      }
    }catch(e){ $("mpScannerStatus").textContent="Camera open nahi hua—barcode manually enter karein."; }
    finally{ $("mpScannerStart").disabled=false; }
  };

  async function showBarcode(product,button){
    if(!product) return;
    let value=String(product.barcode||"").trim();
    if(!value){
      value=generatedBarcode(product);
      button.disabled=true;
      try{
        const r=await fetch("/api/data?resource=sale_products&id="+encodeURIComponent(product.id),{
          method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({barcode:value})
        });
        const j=await r.json().catch(()=>({}));
        if(!r.ok) throw Error(j.error||"Barcode generate nahi ho saka");
        product.barcode=j.record.barcode||value;
        value=product.barcode;
        renderProducts();
        $("mpStatus").textContent=product.name+" ka barcode generate ho gaya.";
      }catch(e){ $("mpStatus").textContent=e.message; alert(e.message); button.disabled=false; return; }
      button.disabled=false;
    }
    const svg=barcodeSvg(value);
    $("mpBarcodeSvg").setAttribute("viewBox","0 0 "+svg.width+" "+svg.height);
    $("mpBarcodeSvg").innerHTML=svg.bars;
    $("mpBarcodeProduct").textContent=product.name;
    $("mpBarcodeValue").textContent=value;
    $("mpBarcodePrice").textContent=money(product.sale_price);
    $("mpBarcodeModal").classList.remove("mp-hidden");
  }
  $("mpBarcodeClose").onclick=()=>$("mpBarcodeModal").classList.add("mp-hidden");
  $("mpBarcodeModal").onclick=e=>{ if(e.target===$("mpBarcodeModal")) $("mpBarcodeModal").classList.add("mp-hidden"); };
  $("mpBarcodePrint").onclick=()=>window.print();

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