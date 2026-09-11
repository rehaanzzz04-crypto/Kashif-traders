import { neon } from '@neondatabase/serverless';
import { requireUser,bodyOf } from './_auth.js';
import { supplierStatement,clientStatement,statementText,sendWhatsAppText,sendWhatsAppImage } from './_whatsapp.js';

const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const auth=await requireUser(req,res);if(!auth)return;const {sql,user}=auth;if(user.designation!=='admin')return res.status(403).json({error:'Admin access required'});
  const b=bodyOf(req),type=String(b.type||''),recordId=id(b.record_id);if(!recordId)return res.status(400).json({error:'Valid record_id required'});
  let record,s,label;
  if(type==='supplier_payment'){
   const rows=await sql`SELECT * FROM supplier_payments WHERE id=${recordId}`;record=rows[0];if(!record)return res.status(404).json({error:'Supplier payment not found'});s=await supplierStatement(sql,record.supplier_id);label='Supplier';
  }else if(type==='client_receipt'){
   const rows=await sql`SELECT * FROM client_receipts WHERE id=${recordId}`;record=rows[0];if(!record)return res.status(404).json({error:'Client payment not found'});s=await clientStatement(sql,record.client_id);label='Client';
  }else return res.status(400).json({error:'Unsupported payment type'});
  const to=s.party.whatsapp_number||s.party.mobile_number;if(!to)return res.status(422).json({error:`${label} WhatsApp number missing`});
  const n=x=>`PKR ${Number(x||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
  const heading=`Kashif Traders — Payment Recorded\nAmount: ${n(record.amount)}${record.reference_number?`\nReference: ${record.reference_number}`:''}`;
  let image_sent=false;if(record.attachment_url&&/^https:\/\//i.test(record.attachment_url)){try{await sendWhatsAppImage(to,record.attachment_url,heading);image_sent=true}catch(e){console.error('Payment image send failed',e)}}
  await sendWhatsAppText(to,`${image_sent?'':heading+'\n\n'}${statementText(s,label)}`);
  return res.status(200).json({sent:true,image_sent,new_balance:s.balance});
 }catch(e){console.error('Payment follow-up error',e);return res.status(500).json({error:e?.message||'WhatsApp follow-up failed'})}
}
