import { requireUser,bodyOf } from './_auth.js';
import { notifySupplierPayment } from './_whatsapp.js';
const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const auth=await requireUser(req,res);if(!auth)return;const {sql,user}=auth;if(user.designation!=='admin')return res.status(403).json({error:'Admin access required'});
  const b=bodyOf(req),recordId=id(b.id||b.record_id);if(!recordId)return res.status(400).json({error:'Valid supplier payment id required'});
  const rows=await sql`SELECT * FROM supplier_payments WHERE id=${recordId}`;if(!rows[0])return res.status(404).json({error:'Supplier payment not found'});
  const result=await notifySupplierPayment(sql,rows[0]);if(!result.sent)return res.status(result.reason==='not_configured'?503:502).json({error:result.reason||'WhatsApp follow-up failed'});
  return res.status(200).json(result);
 }catch(e){console.error('Supplier payment WhatsApp API error',e);return res.status(500).json({error:e?.message||'WhatsApp follow-up failed'})}
}
