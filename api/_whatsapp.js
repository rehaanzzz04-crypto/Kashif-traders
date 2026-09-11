const clean=v=>String(v??'').trim();
const digits=v=>clean(v).replace(/\D/g,'');

export function normalizePhone(v){const d=digits(v);return d.startsWith('00')?d.slice(2):d}

export async function resolveWhatsAppMedia(mediaId){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN);if(!token)throw Error('WHATSAPP_ACCESS_TOKEN_NOT_CONFIGURED');
 const id=clean(mediaId);if(!id)throw Error('WHATSAPP_MEDIA_ID_REQUIRED');
 const meta=await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}});
 const j=await meta.json().catch(()=>({}));if(!meta.ok||!j.url){console.error('WhatsApp media metadata error',meta.status,j);throw Error('WHATSAPP_MEDIA_METADATA_FAILED')}
 return {url:j.url,mime_type:j.mime_type||'',sha256:j.sha256||'',file_size:Number(j.file_size||0)};
}

export async function downloadWhatsAppImage(mediaId){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN);const meta=await resolveWhatsAppMedia(mediaId);
 if(meta.file_size>4000000)throw Error('MEDIA_TOO_LARGE');
 const r=await fetch(meta.url,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error('MEDIA_DOWNLOAD_FAILED');
 const type=(r.headers.get('content-type')||meta.mime_type||'image/jpeg').split(';')[0];if(!type.startsWith('image/'))throw Error('MEDIA_NOT_IMAGE');
 const buf=Buffer.from(await r.arrayBuffer());if(buf.length>4000000)throw Error('MEDIA_TOO_LARGE');
 return {dataUrl:`data:${type};base64,${buf.toString('base64')}`,mime_type:type,size:buf.length};
}

async function cloudSend(payload){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN),phoneId=clean(process.env.WHATSAPP_PHONE_NUMBER_ID);if(!token||!phoneId)throw Error('WHATSAPP_SEND_NOT_CONFIGURED');
 const r=await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneId)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',...payload})});
 const j=await r.json().catch(()=>({}));if(!r.ok){console.error('WhatsApp send error',r.status,j);throw Error('WHATSAPP_SEND_FAILED')}return j;
}

export async function sendWhatsAppText(to,body){return cloudSend({to:normalizePhone(to),type:'text',text:{preview_url:false,body:clean(body).slice(0,4096)}})}
export async function sendWhatsAppImage(to,link,caption=''){return cloudSend({to:normalizePhone(to),type:'image',image:{link:clean(link),caption:clean(caption).slice(0,1024)}})}

export async function supplierStatement(sql,supplierId){
 const parties=await sql`SELECT id,business_name,whatsapp_number,mobile_number,opening_balance FROM suppliers WHERE id=${supplierId}`;const p=parties[0];if(!p)throw Error('SUPPLIER_NOT_FOUND');
 const bills=await sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_invoices WHERE supplier_id=${supplierId}`;
 const pays=await sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_payments WHERE supplier_id=${supplierId}`;
 const opening=Number(p.opening_balance||0),billTotal=Number(bills[0]?.total||0),payTotal=Number(pays[0]?.total||0),balance=opening+billTotal-payTotal;
 return {party:p,opening,billTotal,payTotal,balance};
}

export async function clientStatement(sql,clientId){
 const parties=await sql`SELECT id,business_name,whatsapp_number,mobile_number,opening_balance FROM clients WHERE id=${clientId}`;const p=parties[0];if(!p)throw Error('CLIENT_NOT_FOUND');
 const bills=await sql`SELECT COALESCE(SUM(amount),0) total FROM client_invoices WHERE client_id=${clientId}`;
 const pays=await sql`SELECT COALESCE(SUM(amount),0) total FROM client_receipts WHERE client_id=${clientId}`;
 const opening=Number(p.opening_balance||0),billTotal=Number(bills[0]?.total||0),payTotal=Number(pays[0]?.total||0),balance=opening+billTotal-payTotal;
 return {party:p,opening,billTotal,payTotal,balance};
}

export function statementText(s,label='Supplier'){
 const n=x=>`PKR ${Number(x||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
 return `Kashif Traders — ${label} Statement\n${s.party.business_name}\nOpening: ${n(s.opening)}\nBills: ${n(s.billTotal)}\nPayments: ${n(s.payTotal)}\nNew Balance: ${n(s.balance)}`;
}
