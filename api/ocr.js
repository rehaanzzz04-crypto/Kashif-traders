import { neon } from '@neondatabase/serverless';
import { getSessionUser } from './_auth.js';
import { extractDocument } from './_ocr-core.js';

const allowedViews=new Set(['supplier-bills','supplier-payments','client-sales','client-receipts','documents']);
function bodyOf(req){if(!req.body)return{};if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{return{}}}return req.body}
const kindFor=view=>view==='supplier-bills'?'supplier_invoice':view==='client-sales'?'client_invoice':view==='supplier-payments'?'supplier_bank_payment':view==='client-receipts'?'client_bank_receipt':'business_document';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const db=process.env.DATABASE_URL;if(!db)return res.status(503).json({error:'Database is not configured'});
  const sql=neon(db),user=await getSessionUser(req,sql);if(!user)return res.status(401).json({error:'Authentication required'});
  const b=bodyOf(req),view=String(b.view||'');if(!allowedViews.has(view))return res.status(400).json({error:'Unsupported document form'});
  const dataUrl=String(b.dataUrl||'');if(dataUrl.length>5600000)return res.status(413).json({error:'Image is too large'});
  const fields=await extractDocument(dataUrl,kindFor(view));
  return res.status(200).json({fields});
 }catch(e){
  if(e.message==='UNSUPPORTED_IMAGE')return res.status(400).json({error:'OCR requires a JPG, PNG or WebP image'});
  if(e.message==='OCR_AUTH_UNAVAILABLE')return res.status(503).json({error:'OCR authentication is not available on this deployment'});
  if(e.message==='OCR_PARSE_FAILED')return res.status(422).json({error:'Could not read document clearly'});
  if(e.message==='OCR_PROVIDER')return res.status(502).json({error:'OCR service temporarily unavailable'});
  console.error('OCR endpoint error',e);return res.status(500).json({error:'OCR request failed'});
 }
}
