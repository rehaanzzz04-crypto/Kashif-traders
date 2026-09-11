'use strict';
(()=>{
 const supported=new Set(['supplier-bills','supplier-payments','client-sales','client-receipts','documents']);
 const fieldFor=()=>currentView==='documents'?'file_url':'attachment_url';
 const $=(root,sel)=>root.querySelector(sel);
 function note(msg,bad=false){if(typeof toast==='function')toast(msg,bad);}
 async function compressImage(file){
  if(!file.type.startsWith('image/'))return file;
  if(file.size<1800000)return file;
  const bmp=await createImageBitmap(file),max=1800,scale=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close?.();
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
  return new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'});
 }
 function setValue(form,name,value){if(value===undefined||value===null||value==='')return;const el=form.elements[name];if(el&&!el.value)el.value=value;}
 async function scan(file,form,box){
  if(!file)return;
  if(file.size>4000000){note('Document 4 MB se chhota rakhein.',true);return;}
  box.textContent='Scanning document…';
  try{
   const f=await compressImage(file);
   const data=await new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=bad;r.readAsDataURL(f)});
   const res=await fetch('/api/ocr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl:data,view:currentView})});
   const j=await res.json().catch(()=>({}));if(!res.ok)throw Error(j.error||'OCR failed');
   const x=j.fields||{};setValue(form,'invoice_number',x.invoice_number);setValue(form,'invoice_date',x.date);setValue(form,'payment_date',x.date);setValue(form,'receipt_date',x.date);setValue(form,'amount',x.amount);setValue(form,'reference_number',x.reference_number);setValue(form,'bank',x.bank);setValue(form,'document_type',x.document_type);
   box.textContent='OCR complete — details verify karke Save karein.';note('OCR complete');
  }catch(e){box.textContent='OCR unavailable — form manually fill kiya ja sakta hai.';note(e.message,true);}
 }
 async function upload(file,form,box){
  if(!file)return;
  if(file.size>4000000){note('Document 4 MB se chhota rakhein.',true);return;}
  box.textContent='Uploading document…';
  try{
   const f=await compressImage(file),res=await fetch('/api/upload-document?name='+encodeURIComponent(f.name),{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream'},body:f});
   const j=await res.json().catch(()=>({}));if(!res.ok)throw Error(j.error||'Upload failed');
   const name=fieldFor(),el=form.elements[name];if(el)el.value=j.url;
   setValue(form,'file_name',f.name);setValue(form,'mime_type',f.type);
   box.textContent='Document attached.';note('Document attached');
  }catch(e){box.textContent='Upload unavailable — record save ab bhi use ho sakta hai.';note(e.message,true);}
 }
 function enhance(){
  if(!supported.has(currentView))return;
  const modal=document.getElementById('modal'),form=document.getElementById('recordForm');if(!modal||!form||form.dataset.scanReady)return;form.dataset.scanReady='1';
  const url=form.elements[fieldFor()];if(!url)return;
  const wrap=url.closest('.field');if(wrap)wrap.style.display='none';
  const panel=document.createElement('div');panel.className='field full';panel.innerHTML='<label>Scan / Attach Document</label><input id="ktDocFile" type="file" accept="image/*,application/pdf"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn light" id="ktScanBtn">Scan with OCR</button><button type="button" class="btn alt" id="ktUploadBtn">Attach File</button></div><small id="ktScanStatus" style="display:block;margin-top:7px">Camera image ya PDF select karein. OCR sirf image par chalega.</small>';
  const grid=$ (form,'.grid');grid?.appendChild(panel);const input=$ (panel,'#ktDocFile'),status=$ (panel,'#ktScanStatus');
  $ (panel,'#ktScanBtn').onclick=()=>{const f=input.files?.[0];if(!f)return note('Pehle document select karein.',true);if(!f.type.startsWith('image/'))return note('OCR ke liye image/photo select karein.',true);scan(f,form,status)};
  $ (panel,'#ktUploadBtn').onclick=()=>{const f=input.files?.[0];if(!f)return note('Pehle document select karein.',true);upload(f,form,status)};
 }
 const obs=new MutationObserver(()=>{try{enhance()}catch(e){console.error('Document scan UI',e)}});obs.observe(document.body,{childList:true,subtree:true});
})();
