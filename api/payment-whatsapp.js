import { requireUser,bodyOf } from './_auth.js';
import { notifySupplierPayment } from './_whatsapp.js';
import { notifyClientBill,generateClientBillPdf,generateClientPaymentPdf } from '../client-bill-whatsapp-core.js';
const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
export default async function handler(req,res){
 if(req.method!=='POST'&&req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  const auth=await requireUser(req,res);if(!auth)return;const {sql,user}=auth,b=req.method==='POST'?bodyOf(req):{},recordId=id(b.id||b.record_id||req.query?.id);if(!recordId)return res.status(400).json({error:'Valid record id required'});
  const type=String(b.type||req.query?.type||'');
  if(type==='client_bill_pdf'){const doc=await generateClientBillPdf(sql,recordId);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${doc.filename}"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(doc.buffer);}
  if(type==='client_payment_pdf'){const doc=await generateClientPaymentPdf(sql,recordId);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${doc.filename}"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(doc.buffer);}
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(type==='client_bill'){const result=await notifyClientBill(sql,recordId);return res.status(200).json(result);}
  if(user.designation!=='admin')return res.status(403).json({error:'Admin access required'});
  const rows=await sql`SELECT * FROM supplier_payments WHERE id=${recordId}`;if(!rows[0])return res.status(404).json({error:'Supplier payment not found'});
  const result=await notifySupplierPayment(sql,rows[0]);if(!result.sent)return res.status(result.reason==='not_configured'?503:502).json({error:result.reason||'WhatsApp follow-up failed'});
  return res.status(200).json(result);
 }catch(e){console.error('WhatsApp follow-up API error',e);const code=e?.message==='CLIENT_WHATSAPP_NUMBER_MISSING'?422:e?.message==='WHATSAPP_SEND_NOT_CONFIGURED'?503:500;return res.status(code).json({error:e?.message||'WhatsApp follow-up failed'})}
}
