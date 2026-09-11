import { requireUser, bodyOf } from './_auth.js';
import { extractDocument } from './_ocr-core.js';

const clean=v=>String(v??'').trim();
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const auth=await requireUser(req,res);if(!auth)return;const b=bodyOf(req),dataUrl=clean(b.dataUrl||b.image);
 if(!dataUrl)return res.status(400).json({error:'Payment slip image required'});
 try{
  const f=await extractDocument(dataUrl,'bank_transfer_payment_slip');const n=Number(String(f.amount||'').replace(/,/g,''));
  return res.status(200).json({payment_date:f.date||'',amount:Number.isFinite(n)&&n>0?n:'',payment_method:'BANK',bank:f.bank||'',reference_number:f.reference_number||'',notes:f.notes||'',document_type:f.document_type||''});
 }catch(e){console.error('Payment OCR error',e);const code=e?.message||'';if(code==='OCR_PARSE_FAILED')return res.status(422).json({error:'Payment slip could not be read clearly'});return res.status(502).json({error:'Payment slip OCR failed'})}
}
