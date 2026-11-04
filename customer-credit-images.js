(()=>{
'use strict';
const $=id=>document.getElementById(id);
const LIMIT=3,MAX_BYTES=700000;
let pending=[],existing=[],billId=null,customerId=null,admin=false,viewerUrl=null,selectedImage=null,previewUrls=[],galleryImages=[],galleryIndex=0;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const showError=message=>{const el=$('notice');if(el)el.textContent=message;};
async function request(action,body=null,extra=''){
 const url='/api/data?resource=customer_credit&action='+encodeURIComponent(action)+extra;
 const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
  headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Image request failed');
 return data;
}
function clearUrls(){previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];}
function render(){
 clearUrls();
 const box=$('billImagePreview');if(!box)return;
 const items=existing.map(x=>{
  return '<div class="bill-image-chip existing"><button type="button" data-open-img="'+Number(x.id)+'" class="bill-thumb-link" aria-label="View '+escapeHtml(x.original_name)+'"><span class="bill-file-thumb">IMG</span><span class="bill-filename">'+escapeHtml(x.original_name)+'</span></button>'
   +(admin?'<button type="button" data-remove-img="'+Number(x.id)+'" class="bill-image-remove" aria-label="Remove photo">×</button>':'')+'</div>';
 });
 pending.forEach((item,i)=>{
  const url=URL.createObjectURL(item.blob);previewUrls.push(url);
  items.push('<div class="bill-image-chip"><img alt="Bill photo '+(i+1)+'" src="'+url+'">'
   +'<small>'+Math.round(item.blob.size/1024)+' KB</small><button type="button" data-drop-img="'+i+'" class="bill-image-remove" aria-label="Remove new photo">×</button></div>');
 });
 box.innerHTML=items.join('')||'<div class="bill-image-empty">No bill photos added.</div>';
 const max=LIMIT-existing.length-pending.length;
 $('captureBillImage').disabled=max<=0;
 $('chooseBillImage').disabled=max<=0;
}
function canvasBlob(canvas,quality){
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image compression failed')),'image/jpeg',quality));
}
async function compress(file){
 if(!file||!file.type.startsWith('image/'))throw Error('Please choose an image.');
 const img=new Image(),source=URL.createObjectURL(file);
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Photo could not be opened'));img.src=source;});
  let scale=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight)),quality=.84,blob;
  for(let i=0;i<9;i++){
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Canvas compression is not supported on this device');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   blob=await canvasBlob(canvas,quality);
   if(blob.size<=MAX_BYTES&&canvas.width>=700)return blob;
   quality=Math.max(.64,quality-.04);
   scale*=.86;
  }
  if(blob?.size<=MAX_BYTES)return blob;
  throw Error('Image too detailed to compress safely. Please take a clearer single-bill photo.');
 }finally{URL.revokeObjectURL(source);}
}
async function addFiles(files){
 const remaining=LIMIT-existing.length-pending.length;
 if(remaining<=0){showError('Maximum 3 photos allowed for this bill.');return;}
 if(files.length>remaining){showError('Only '+remaining+' more image(s) allowed.');return;}
 $('billImagePreview').textContent='Compressing photo…';
 for(const f of files){
  try{
   const blob=await compress(f);
   pending.push({blob,name:f.name.replace(/\.[^.]+$/,'')+'.jpg'});
  }catch(e){showError(e.message);}
 }
 render();
}
async function loadBill(id,cid,canEdit){
 billId=Number(id)||null;customerId=Number(cid)||null;admin=Boolean(canEdit);
 existing=[];pending=[];render();
 if(!billId)return;
 try{
  const result=await request('bill_images',null,'&bill_id='+billId);
  existing=result.images||[];render();
 }catch(e){showError('Could not load original bill photos: '+e.message);}
}
function blobToBase64(blob){
 return new Promise((resolve,reject)=>{
  const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('Photo read failed'));r.readAsDataURL(blob);
 });
}
async function saveAfterBill(id,cid){
 if(!pending.length){billId=Number(id);customerId=Number(cid);return {saved:0};}
 const queue=[...pending];let saved=0,errors=[];
 for(const image of queue){
  try{
   const base64=await blobToBase64(image.blob);
   await request('bill_image_upload',{bill_id:Number(id),customer_id:Number(cid),filename:image.name,content_base64:base64});
   saved++;pending.shift();
  }catch(e){errors.push(e.message);break;}
 }
 if(errors.length)throw Error('Bill was saved, but '+pending.length+' photo(s) were not uploaded. Open Edit Bill to retry. '+errors.join('; '));
 return {saved};
}
function reset(type,row,canEdit){
 $('billImageSection').hidden=type!=='bill';
 admin=Boolean(canEdit);
 clearUrls();pending=[];existing=[];billId=null;customerId=null;
 if(type==='bill'&&row)loadBill(row.id,row.customer_id,canEdit);
 else if(type==='bill')render();
}
async function openImage(imageId){
 try{
  const d=await request('bill_image',null,'&image_id='+encodeURIComponent(imageId));
  const bytes=atob(d.content_base64);const array=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);
  const blob=new Blob([array],{type:d.mime_type});
  if(viewerUrl)URL.revokeObjectURL(viewerUrl);
  viewerUrl=URL.createObjectURL(blob);selectedImage=d;
  const image=new Image();image.src=viewerUrl;image.alt='Original credit bill photo';image.draggable=false;
  image.title='Tap image to zoom';
  image.dataset.zoom='1';
  image.addEventListener('click',()=>{
   const z=Number(image.dataset.zoom||'1'),next=z===1?1.8:z===1.8?2.6:1;
   image.dataset.zoom=String(next);image.style.width=(next*100)+'%';
  });
  $('billViewContent').replaceChildren(image);
  $('billViewerTitle').textContent=d.filename||'Original Credit Bill';
  $('deleteBillImage').hidden=!admin;
  if(!$('billImageViewer').open)$('billImageViewer').showModal();
  $('billGalleryPrev').disabled=galleryImages.length<2;
  $('billGalleryNext').disabled=galleryImages.length<2;
  $('billGalleryCount').textContent=galleryImages.length>1?String(galleryIndex+1)+' / '+galleryImages.length:'';
 }catch(e){showError(e.message);}
}
function closeViewer(){
 $('billImageViewer').close();
 $('billViewContent').replaceChildren();
 if(viewerUrl){URL.revokeObjectURL(viewerUrl);viewerUrl=null;}
 selectedImage=null;
}
async function removeImage(imageId){
 if(!admin||!confirm('Remove this original bill image? This cannot be undone.'))return;
 try{
  await request('bill_image_delete',{image_id:Number(imageId)});
  existing=existing.filter(x=>Number(x.id)!==Number(imageId));
  if(selectedImage?.id==imageId)closeViewer();
  window.dispatchEvent(new CustomEvent('credit-bill-image-changed',{detail:{billId}}));
  render();
 }catch(e){showError(e.message);}
}
$('captureBillImage').onclick=()=>$('cameraBillInput').click();
$('chooseBillImage').onclick=()=>$('galleryBillInput').click();
$('cameraBillInput').onchange=e=>{addFiles([...e.target.files]);e.target.value='';};
$('galleryBillInput').onchange=e=>{addFiles([...e.target.files]);e.target.value='';};
$('billImagePreview').addEventListener('click',e=>{
 const open=e.target.closest('[data-open-img]'),drop=e.target.closest('[data-drop-img]'),remove=e.target.closest('[data-remove-img]');
 if(open){galleryImages=existing.slice();galleryIndex=Math.max(0,galleryImages.findIndex(v=>Number(v.id)===Number(open.dataset.openImg)));openImage(Number(open.dataset.openImg));}
 if(drop){pending.splice(Number(drop.dataset.dropImg),1);render();}
 if(remove)removeImage(Number(remove.dataset.removeImg));
});
async function openBillGallery(id){
 try{
  const result=await request('bill_images',null,'&bill_id='+encodeURIComponent(id));
  galleryImages=result.images||[];
  if(!galleryImages.length){showError('This bill has no attached photos.');return;}
  galleryIndex=0;await openImage(galleryImages[galleryIndex].id);
 }catch(e){showError(e.message);}
}
async function moveGallery(delta){
 if(!galleryImages.length)return;
 galleryIndex=(galleryIndex+delta+galleryImages.length)%galleryImages.length;
 await openImage(galleryImages[galleryIndex].id);
}
$('billGalleryPrev').onclick=()=>moveGallery(-1);
$('billGalleryNext').onclick=()=>moveGallery(1);
$('closeBillImage').onclick=closeViewer;
$('billImageViewer').addEventListener('close',()=>{if(viewerUrl)URL.revokeObjectURL(viewerUrl);viewerUrl=null;selectedImage=null;});
$('downloadBillImage').onclick=()=>{
 if(!viewerUrl||!selectedImage)return;
 const a=document.createElement('a');a.href=viewerUrl;a.download=selectedImage.filename||'original-bill.jpg';a.click();
};
$('deleteBillImage').onclick=()=>selectedImage&&removeImage(selectedImage.id);
window.CreditBillImages={reset,saveAfterBill,openBillGallery,openImage,loadBill};
})();