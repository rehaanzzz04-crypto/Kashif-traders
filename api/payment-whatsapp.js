import { requireUser, bodyOf } from './_auth.js';
import { sendWhatsAppText,sendWhatsAppImage,supplierStatement,clientStatement,statementText } from './_whatsapp.js';

const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const clean=v=>String(v??'').trim();

async function ensure(sql){await sql`CREATE TABLE IF NOT EXISTS whatsapp_delivery_log (id BIGSERIAL PRIMARY KEY,resource_key TEXT NOT NULL,record_id BIGINT NOT NULL,to_number TEXT,status TEXT NOT NULL DEFAULT 'pending',message_id TEXT,error_message TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),sent_at TIMESTAMPTZ,UNIQUE(resource_key,record_id))`}

async function supplierPayment(sql,recordId){
 const rows=await sql`SELECT p.*,s.business_name,s.whatsapp_number,s.mobile_number FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=${recordId}`;const p=rows[0];if(!p)throw Error('Supplier payment not found');
 const to=clean(p.whatsapp_number||p.mobile_number);if(!to)throw Error('Supplier WhatsApp number missing');
 const st=await supplierStatement(sql,p.supplier_id);return {record:p,to,statement:statementText(st,'Supplier')};
}
async function clientReceipt(sql,recordId){
 const rows=await sql`SELECT r.*,c.business_name,c.whatsapp_number,c.mobile_number FROM client_receipts r JOIN clients c ON c.id=r.client_id WHERE r.id=${recordId}`;const p=rows[0];if(!p)throw Error('Client payment not found');
 const to=clean(p.whatsapp_number||p.mobile_number);if(!to)throw Error('Client WhatsApp number missing');
 const st=await clientStatement(sql,p.client_id);return {record:p,to,statement:statementText(st,'Client')};
}

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const auth=await requireUser(req,res);if(!auth)return;const {sql,user}=auth;if(user.designation!=='admin')return res.status(403).json({error:'Admin only'});
 const b=bodyOf(req),resource=clean(b.resource),recordId=id(b.id);if(!recordId||!['supplier_payments','client_receipts'].includes(resource))return res.status(400).json({error:'Valid payment resource and id required'});
 await ensure(sql);
 try{
  const existing=await sql`SELECT * FROM whatsapp_delivery_log WHERE resource_key=${resource} AND record_id=${recordId}`;if(existing[0]?.status==='sent')return res.status(200).json({sent:true,duplicate:true});
  const info=resource==='supplier_payments'?await supplierPayment(sql,recordId):await clientReceipt(sql,recordId);
  if(!existing[0])await sql`INSERT INTO whatsapp_delivery_log(resource_key,record_id,to_number,status) VALUES(${resource},${recordId},${info.to},'pending') ON CONFLICT(resource_key,record_id) DO NOTHING`;
  const slip=clean(info.record.attachment_url);let imageSent=false;
  if(/^https:\/\//i.test(slip)){try{await sendWhatsAppImage(info.to,slip,`Kashif Traders payment slip — PKR ${Number(info.record.amount||0).toLocaleString('en-PK')}`);imageSent=true}catch(e){console.error('Payment slip WhatsApp image failed',e)}}
  const sent=await sendWhatsAppText(info.to,info.statement);const messageId=clean(sent?.messages?.[0]?.id);
  await sql`UPDATE whatsapp_delivery_log SET status='sent',message_id=${messageId||null},error_message=NULL,sent_at=now() WHERE resource_key=${resource} AND record_id=${recordId}`;
  return res.status(200).json({sent:true,image_sent:imageSent,message_id:messageId||null});
 }catch(e){console.error('Payment WhatsApp delivery error',e);await sql`INSERT INTO whatsapp_delivery_log(resource_key,record_id,status,error_message) VALUES(${resource},${recordId},'failed',${clean(e?.message||e)}) ON CONFLICT(resource_key,record_id) DO UPDATE SET status='failed',error_message=EXCLUDED.error_message`;return res.status(502).json({error:e?.message||'WhatsApp delivery failed'})}
}
