import { neon } from '@neondatabase/serverless';
import { getSessionUser } from './_auth.js';

const allowedViews=new Set(['supplier-bills','supplier-payments','client-sales','client-receipts','documents']);
function bodyOf(req){if(!req.body)return{};if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{return{}}}return req.body}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const db=process.env.DATABASE_URL;if(!db)return res.status(503).json({error:'Database is not configured'});
  const sql=neon(db),user=await getSessionUser(req,sql);if(!user)return res.status(401).json({error:'Authentication required'});
  const b=bodyOf(req),view=String(b.view||'');if(!allowedViews.has(view))return res.status(400).json({error:'Unsupported document form'});
  const dataUrl=String(b.dataUrl||'');if(!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUrl))return res.status(400).json({error:'OCR requires a JPG, PNG or WebP image'});
  if(dataUrl.length>5600000)return res.status(413).json({error:'Image is too large'});
  const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;if(!token)return res.status(503).json({error:'OCR service is not available on this deployment'});
  const prompt='Read this business invoice/payment document. Return ONLY valid JSON with keys invoice_number,date,amount,reference_number,bank,document_type. date must be YYYY-MM-DD when confidently visible. amount must contain digits only with optional decimal. Use empty string for unknown values. Do not guess.';
  const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-5-mini',input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl}]}],max_output_tokens:300})});
  const j=await r.json().catch(()=>({}));if(!r.ok){console.error('OCR provider error',j?.error?.message||r.status);return res.status(502).json({error:'OCR service temporarily unavailable'})}
  const text=(j.output||[]).flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||'';let fields={};try{fields=JSON.parse(text.replace(/^```json\s*|\s*```$/g,''))}catch{return res.status(422).json({error:'Could not read document clearly'})}
  const safe={};for(const k of ['invoice_number','date','amount','reference_number','bank','document_type'])safe[k]=String(fields[k]??'').slice(0,120);
  return res.status(200).json({fields:safe});
 }catch(e){console.error('OCR endpoint error',e);return res.status(500).json({error:'OCR request failed'})}
}
