(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[char]);
  const money = value => 'PKR ' + Number(value || 0).toLocaleString('en-PK');
  const sizeLabel = bytes => bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  let rows = [], editing = null;

  $('back').onclick = () => { location.href = '/ecommerce-orders.html'; };
  async function req(url, options) {
    const response = await fetch(url, options), json = await response.json().catch(() => ({}));
    if (response.status === 401) { location.replace('/login.html'); throw Error('Login required'); }
    if (!response.ok) throw Error(json.error || 'Request failed');
    return json;
  }

  function render() {
    const query = $('search').value.trim().toLowerCase();
    const list = rows.filter(item => !query || [item.name,item.sku,item.category].some(value => String(value || '').toLowerCase().includes(query)));
    $('list').innerHTML = list.length ? list.map(item => '<article class="product">' +
      (item.product_image_url ? '<img src="' + esc(item.product_image_url) + '" alt="">' : '<div class="pic">KT</div>') +
      '<div><h3>' + esc(item.name) + '</h3><small>' + esc(item.sku) + ' · ' + esc(item.category || 'General') + ' · ' + esc(item.status) + '<br>Stock: ' + esc(item.stock_quantity) + ' ' + esc(item.unit) + '</small></div>' +
      '<div class="price"><b>' + money(item.sale_price) + '</b><div class="actions"><button data-edit="' + item.id + '">Edit</button><button class="delete" data-delete="' + item.id + '">Delete</button></div></div></article>').join('') : '<div class="empty">No e-commerce products.</div>';
    document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => open(rows.find(item => String(item.id) === button.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => {
      const item = rows.find(product => String(product.id) === button.dataset.delete);
      if (!confirm('Delete ' + item.name + '?')) return;
      try { await req('/api/data?resource=ecommerce&action=products&id=' + item.id, {method:'DELETE'}); load(); }
      catch (error) { alert(error.message); }
    });
  }

  async function load() {
    try { rows = (await req('/api/data?resource=ecommerce&action=products', {cache:'no-store'})).records || []; render(); }
    catch (error) { $('list').innerHTML = '<div class="empty">' + esc(error.message) + '</div>'; }
  }

  function open(item = null) {
    editing = item; $('formTitle').textContent = item ? 'Edit Product' : 'Add Product'; $('form').reset();
    for (const element of $('form').elements) if (element.name) element.value = item?.[element.name] ?? (element.name === 'unit' ? 'pcs' : element.name === 'status' ? 'active' : '');
    $('imageStatus').textContent = item?.product_image_url ? 'Current image saved — choose a file to replace it' : 'Optional image — large photos compress automatically';
    $('modal').classList.remove('hidden');
  }

  const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Image compression failed')), 'image/jpeg', quality));
  async function compressImage(file) {
    if (!file.type.startsWith('image/')) throw Error('Please select a JPG, PNG or WebP image');
    const bitmap = await createImageBitmap(file), maxEdge = 1600, scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    let blob; for (const quality of [0.82,0.72,0.62,0.52,0.42]) { blob = await canvasBlob(canvas, quality); if (blob.size <= 650000) break; }
    if (!blob || blob.size > 730000) throw Error('Image is still too large. Please choose a smaller photo.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type:'image/jpeg',lastModified:Date.now()});
  }

  $('close').onclick = () => $('modal').classList.add('hidden'); $('add').onclick = () => open(); $('refresh').onclick = load; $('search').oninput = render;
  $('image').onchange = () => { const file = $('image').files?.[0]; $('imageStatus').textContent = file ? `${file.name} (${sizeLabel(file.size)}) — will be optimized before upload` : 'Optional image — large photos compress automatically'; };
  $('form').onsubmit = async event => {
    event.preventDefault(); const button = event.target.querySelector('.save'); button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(event.target).entries()), original = $('image').files?.[0];
      if (original) {
        $('imageStatus').textContent = 'Optimizing image…'; const file = await compressImage(original); $('imageStatus').textContent = `Uploading optimized image (${sizeLabel(file.size)})…`;
        const response = await fetch('/api/upload-document?name=' + encodeURIComponent(file.name), {method:'POST',headers:{'Content-Type':file.type},body:file});
        const json = await response.json().catch(() => ({})); if (!response.ok) throw Error(json.error || 'Image upload failed'); data.product_image_url = json.url;
      }
      await req('/api/data?resource=ecommerce&action=products' + (editing ? '&id=' + editing.id : ''), {method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      $('modal').classList.add('hidden'); await load();
    } catch (error) { $('imageStatus').textContent = error.message; alert(error.message); }
    finally { button.disabled = false; }
  };
  load();
})();
