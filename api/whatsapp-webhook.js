import { neon } from '@neondatabase/serverless';
import { extractDocument } from './_ocr-core.js';

const digits=v=>String(v||'').replace(/\D/g,'');
const clean=v=>String(v??'').trim();
const amount=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};

async function ensure(sql){
 await sql`CREATE TABLE IF NOT EXISTS whatsapp_intake (id BIGSERIAL PRIMARY KEY,message_id TEXT UNIQUE,from_number TEXT,from_name TEXT,message_type TEXT,attachment_url TEXT,message_text TEXT,processing_status TEXT NOT NULL DEFAULT 'received',matched_party_type TEXT,matched_party_id BIGINT,ocr_data JSONB,approval_id BIGINT,error_message TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
}
async function imageData(url,token){
 const r=await fetch(url,{headers:token?{Authorization:'Bearer '+token}:{}});if(!r.ok)throw Error('MEDIA_DOWNLOAD_FAILED');
 const type=(r.headers.get('content-type')||'image/jpeg').split(';')[0];if(!type.startsWith('image/'))throw Error('MEDIA_NOT_IMAGE');
 const buf=Buffer.from(await r.arrayBuffer());if(buf.length>4000000)throw Error('MEDIA_TOO_LARGE');return `data:${type};base64,${buf.toString('base64')}`;
}
async function matchSupplier(sql,from){
 const d=digits(from);if(!d)return null;const rows=await sql`SELECT id,business_name,whatsapp_number,mobile_number FROM suppliers WHERE status='active' ORDER BY id`;
 return rows.find(x=>{const w=digits(x.whatsapp_number),m=digits(x.mobile_number);return (w&&d.endsWith(w.slice(-10)))||(m&&d.endsWith(m.slice(-10)))})||null;
}
export default async function handler(req,res){
 if(req.method==='GET'){if(clean(req.query?.['hub.verify_token'])!==clean(process.env.WHATSAPP_VERIFY_TOKEN))return res.status(403).send('Forbidden');return res.status(200).send(clean(req.query?.['hub.challenge']));}
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const db=process.env.DATABASE_URL;if(!db)return res.status(503).json({error:'Database is not configured'});const sql=neon(db);await ensure(sql);
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{},value=body?.entry?.[0]?.changes?.[0]?.value||{},msg=value?.messages?.[0];if(!msg)return res.status(200).json({received:true});
  const mid=clean(msg.id),from=clean(msg.from),name=clean(value?.contacts?.[0]?.profile?.name),type=clean(msg.type),text=clean(msg?.text?.body||msg?.caption||'');
  const existing=mid?await sql`SELECT id FROM whatsapp_intake WHERE message_id=${mid}`:[];if(existing[0])return res.status(200).json({received:true,duplicate:true});
  const inserted=await sql`INSERT INTO whatsapp_intake(message_id,from_number,from_name,message_type,message_text) VALUES(${mid||null},${from},${name||null},${type||null},${text||null}) RETURNING id`;const intakeId=inserted[0].id;
  const supplier=await matchSupplier(sql,from);if(!supplier){await sql`UPDATE whatsapp_intake SET processing_status='needs_review',error_message='Supplier WhatsApp number not matched',updated_at=now() WHERE id=${intakeId}`;return res.status(200).json({received:true,status:'needs_review'});}
  let mediaUrl=clean(msg?.image?.url||msg?.document?.url||'');
  if(!mediaUrl){await sql`UPDATE whatsapp_intake SET processing_status='needs_review',matched_party_type='supplier',matched_party_id=${supplier.id},error_message='Invoice image URL not present in webhook payload',updated_at=now() WHERE id=${intakeId}`;return res.status(200).json({received:true,status:'needs_review'});}
  const dataUrl=await imageData(mediaUrl,process.env.WHATSAPP_ACCESS_TOKEN);const fields=await extractDocument(dataUrl,'supplier_invoice');const total=amount(fields.amount);
  if(!total){await sql`UPDATE whatsapp_intake SET processing_status='needs_review',matched_party_type='supplier',matched_party_id=${supplier.id},ocr_data=${JSON.stringify(fields)}::jsonb,error_message='Invoice amount could not be read',updated_at=now() WHERE id=${intakeId}`;return res.status(200).json({received:true,status:'needs_review'});}
  const newData={supplier_id:supplier.id,invoice_number:fields.invoice_number||null,invoice_date:fields.date||new Date().toISOString().slice(0,10),due_date:fields.due_date||null,amount:total,notes:`WhatsApp invoice from ${supplier.business_name}${fields.notes?' — '+fields.notes:''}`,attachment_url:mediaUrl,status:'unpaid'};
  const approval=await sql`INSERT INTO approval_requests(requested_by_employee_id,requested_by_code,requested_by_name,requested_by_designation,module_key,resource_key,action,new_data) VALUES(NULL,'WHATSAPP','WhatsApp Intake','automation','supplier-bills','supplier_invoices','CREATE',${JSON.stringify(newData)}::jsonb) RETURNING id`;
  await sql`UPDATE whatsapp_intake SET processing_status='pending_approval',matched_party_type='supplier',matched_party_id=${supplier.id},attachment_url=${mediaUrl},ocr_data=${JSON.stringify(fields)}::jsonb,approval_id=${approval[0].id},updated_at=now() WHERE id=${intakeId}`;
  return res.status(200).json({received:true,status:'pending_approval'});
 }catch(e){console.error('WhatsApp intake error',e);return res.status(200).json({received:true,status:'error'});}
}
