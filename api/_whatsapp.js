const clean=v=>String(v??'').trim();
const digits=v=>clean(v).replace(/\D/g,'');
const graphVersion=()=>clean(process.env.WHATSAPP_GRAPH_VERSION)||'v23.0';
const graphUrl=path=>`https://graph.facebook.com/${graphVersion()}/${path}`;

export function normalizePhone(v){const d=digits(v);return d.startsWith('00')?d.slice(2):d}
export async function resolveWhatsAppMedia(mediaId){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN);if(!token)throw Error('WHATSAPP_ACCESS_TOKEN_NOT_CONFIGURED');const id=clean(mediaId);if(!id)throw Error('WHATSAPP_MEDIA_ID_REQUIRED');
 const meta=await fetch(graphUrl(encodeURIComponent(id)),{headers:{Authorization:`Bearer ${token}`}});const j=await meta.json().catch(()=>({}));if(!meta.ok||!j.url){console.error('WhatsApp media metadata error',meta.status,j);throw Error('WHATSAPP_MEDIA_METADATA_FAILED')}return {url:j.url,mime_type:j.mime_type||'',sha256:j.sha256||'',file_size:Number(j.file_size||0)};
}
export async function downloadWhatsAppDocument(mediaId){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN),meta=await resolveWhatsAppMedia(mediaId);if(meta.file_size>4000000)throw Error('MEDIA_TOO_LARGE');
 const r=await fetch(meta.url,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error('MEDIA_DOWNLOAD_FAILED');const type=(r.headers.get('content-type')||meta.mime_type||'application/octet-stream').split(';')[0];if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(type))throw Error('MEDIA_TYPE_UNSUPPORTED');const buf=Buffer.from(await r.arrayBuffer());if(buf.length>4000000)throw Error('MEDIA_TOO_LARGE');return {dataUrl:`data:${type};base64,${buf.toString('base64')}`,mime_type:type,size:buf.length};
}
export async function downloadWhatsAppImage(mediaId){const doc=await downloadWhatsAppDocument(mediaId);if(!doc.mime_type.startsWith('image/'))throw Error('MEDIA_NOT_IMAGE');return doc}
async function cloudSend(payload){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN),phoneId=clean(process.env.WHATSAPP_PHONE_NUMBER_ID);if(!token||!phoneId)throw Error('WHATSAPP_SEND_NOT_CONFIGURED');
 const r=await fetch(graphUrl(`${encodeURIComponent(phoneId)}/messages`),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',...payload})});const j=await r.json().catch(()=>({}));if(!r.ok){console.error('WhatsApp send error',r.status,j);throw Error('WHATSAPP_SEND_FAILED')}return j;
}
async function uploadImageDataUrl(dataUrl){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN),phoneId=clean(process.env.WHATSAPP_PHONE_NUMBER_ID);if(!token||!phoneId)throw Error('WHATSAPP_SEND_NOT_CONFIGURED');const m=String(dataUrl||'').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);if(!m)throw Error('WHATSAPP_IMAGE_DATA_INVALID');
 const type=m[1].toLowerCase()==='image/jpg'?'image/jpeg':m[1].toLowerCase(),buf=Buffer.from(m[2],'base64');if(buf.length>4000000)throw Error('MEDIA_TOO_LARGE');const form=new FormData();form.append('messaging_product','whatsapp');form.append('type',type);form.append('file',new Blob([buf],{type}),`payment-${Date.now()}.${type==='image/png'?'png':type==='image/webp'?'webp':'jpg'}`);
 const r=await fetch(graphUrl(`${encodeURIComponent(phoneId)}/media`),{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});const j=await r.json().catch(()=>({}));if(!r.ok||!j.id){console.error('WhatsApp media upload error',r.status,j);throw Error('WHATSAPP_MEDIA_UPLOAD_FAILED')}return j.id;
}
export async function sendWhatsAppText(to,body){return cloudSend({to:normalizePhone(to),type:'text',text:{preview_url:false,body:clean(body).slice(0,4096)}})}
export async function sendWhatsAppImage(to,link,caption=''){return cloudSend({to:normalizePhone(to),type:'image',image:{link:clean(link),caption:clean(caption).slice(0,1024)}})}
export async function sendWhatsAppAttachment(to,attachment,caption=''){const src=clean(attachment);if(!src)throw Error('WHATSAPP_ATTACHMENT_MISSING');if(/^https:\/\//i.test(src))return sendWhatsAppImage(to,src,caption);if(/^data:image\//i.test(src)){const mediaId=await uploadImageDataUrl(src);return cloudSend({to:normalizePhone(to),type:'image',image:{id:mediaId,caption:clean(caption).slice(0,1024)}})}throw Error('WHATSAPP_ATTACHMENT_UNSUPPORTED')}
export async function supplierStatement(sql,supplierId){const parties=await sql`SELECT id,business_name,whatsapp_number,mobile_number,opening_balance FROM suppliers WHERE id=${supplierId}`;const p=parties[0];if(!p)throw Error('SUPPLIER_NOT_FOUND');const bills=await sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_invoices WHERE supplier_id=${supplierId}`;const pays=await sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_payments WHERE supplier_id=${supplierId}`;const opening=Number(p.opening_balance||0),billTotal=Number(bills[0]?.total||0),payTotal=Number(pays[0]?.total||0),balance=opening+billTotal-payTotal;return {party:p,opening,billTotal,payTotal,balance}}
export function statementText(s,label='Supplier'){const n=x=>`PKR ${Number(x||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;return `Kashif Traders — ${label} Statement\n${s.party.business_name}\nOpening: ${n(s.opening)}\nBills: ${n(s.billTotal)}\nPayments: ${n(s.payTotal)}\nNew Balance: ${n(s.balance)}`}
export async function notifySupplierPayment(sql,record){
 if(!record?.id||!record?.supplier_id)return {sent:false,reason:'invalid_record'};
 if(!process.env.WHATSAPP_ACCESS_TOKEN||!process.env.WHATSAPP_PHONE_NUMBER_ID)return {sent:false,reason:'not_configured'};
 await sql`CREATE TABLE IF NOT EXISTS whatsapp_payment_delivery (id BIGSERIAL PRIMARY KEY,resource_key TEXT NOT NULL,record_id BIGINT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',image_sent BOOLEAN NOT NULL DEFAULT false,message_id TEXT,error_message TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(resource_key,record_id))`;
 const prior=await sql`SELECT * FROM whatsapp_payment_delivery WHERE resource_key='supplier_payments' AND record_id=${record.id}`;if(prior[0]?.status==='sent')return {sent:true,duplicate:true,image_sent:Boolean(prior[0].image_sent)};
 await sql`INSERT INTO whatsapp_payment_delivery(resource_key,record_id,status) VALUES('supplier_payments',${record.id},'pending') ON CONFLICT(resource_key,record_id) DO UPDATE SET status='pending',error_message=NULL,updated_at=now()`;
 try{
  const s=await supplierStatement(sql,record.supplier_id),to=s.party.whatsapp_number||s.party.mobile_number;if(!to)throw Error('SUPPLIER_WHATSAPP_NUMBER_MISSING');const n=x=>`PKR ${Number(x||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`,heading=`Kashif Traders — Payment Recorded\nAmount: ${n(record.amount)}${record.reference_number?`\nReference: ${record.reference_number}`:''}`;let imageSent=false,imageResult=null;
  if(record.attachment_url){try{imageResult=await sendWhatsAppAttachment(to,record.attachment_url,heading);imageSent=true}catch(e){console.error('Supplier payment slip send failed',e)}}
  const textResult=await sendWhatsAppText(to,`${imageSent?'':heading+'\n\n'}${statementText(s,'Supplier')}`),messageId=textResult?.messages?.[0]?.id||imageResult?.messages?.[0]?.id||null;
  await sql`UPDATE whatsapp_payment_delivery SET status='sent',image_sent=${imageSent},message_id=${messageId},error_message=${imageSent||!record.attachment_url?null:'Payment statement sent; slip image failed'},updated_at=now() WHERE resource_key='supplier_payments' AND record_id=${record.id}`;return {sent:true,image_sent:imageSent,new_balance:s.balance};
 }catch(e){await sql`UPDATE whatsapp_payment_delivery SET status='failed',error_message=${String(e?.message||e).slice(0,500)},updated_at=now() WHERE resource_key='supplier_payments' AND record_id=${record.id}`;console.error('Supplier payment WhatsApp follow-up failed',e);return {sent:false,reason:e?.message||'send_failed'}}
}
