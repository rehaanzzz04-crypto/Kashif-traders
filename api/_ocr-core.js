import { getVercelOidcToken } from '@vercel/oidc';

const fields=['invoice_number','date','due_date','amount','reference_number','bank','document_type','party_name','notes'];
const clean=v=>String(v??'').trim().slice(0,500);

function parseJson(text){
 const raw=String(text||'').trim();if(!raw)return null;
 const candidates=[raw,raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'')];
 const first=raw.indexOf('{'),last=raw.lastIndexOf('}');if(first>=0&&last>first)candidates.push(raw.slice(first,last+1));
 for(const c of candidates){try{return JSON.parse(c)}catch{}}return null;
}
function responseText(j){
 if(typeof j?.output_text==='string'&&j.output_text.trim())return j.output_text;
 const parts=[];
 for(const item of j?.output||[]){
  if(typeof item?.text==='string')parts.push(item.text);
  if(typeof item?.text?.value==='string')parts.push(item.text.value);
  for(const c of item?.content||[]){
   if(typeof c?.text==='string')parts.push(c.text);
   if(typeof c?.text?.value==='string')parts.push(c.text.value);
   if(typeof c?.output_text==='string')parts.push(c.output_text);
   if(typeof c?.output_text?.value==='string')parts.push(c.output_text.value);
  }
 }
 return parts.filter(Boolean).join('\n');
}
async function gatewayToken(){
 let token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||'';
 if(!token){try{token=await getVercelOidcToken()||''}catch(e){console.error('OIDC token error',e?.message||e)}}return token;
}
function inputPart(dataUrl){
 const s=String(dataUrl||'');
 if(/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s))return {type:'input_image',image_url:s};
 const m=s.match(/^data:application\/pdf;base64,(.+)$/i);if(m)return {type:'input_file',filename:'document.pdf',file_data:m[1]};
 throw new Error('UNSUPPORTED_DOCUMENT');
}
const documentSchema={
 type:'object',
 properties:Object.fromEntries(fields.map(k=>[k,{type:'string'}])),
 required:fields,
 additionalProperties:false
};
export async function extractDocument(dataUrl,kind='business_document'){
 const part=inputPart(dataUrl),token=await gatewayToken();if(!token)throw new Error('OCR_AUTH_UNAVAILABLE');
 const prompt=`Read this ${kind.replaceAll('_',' ')} carefully. Extract only facts visible on the document. Dates must be YYYY-MM-DD when visible. amount must contain digits only with optional decimal, no commas or currency symbols. For a bank transfer/receipt use reference_number and bank. For an invoice use invoice_number. party_name is the supplier/client name printed on the document. Use empty string for unknown values. Never guess.`;
 const body={
  model:'openai/gpt-5-mini',
  input:[{role:'user',content:[{type:'input_text',text:prompt},part]}],
  reasoning:{effort:'low'},
  max_output_tokens:1200,
  text:{format:{type:'json_schema',name:'document_fields',strict:true,schema:documentSchema}}
 };
 const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok){const msg=j?.error?.message||j?.error||'unknown';console.error('OCR provider error',r.status,msg);const e=new Error('OCR_PROVIDER');e.status=r.status;throw e}
 const text=responseText(j),parsed=parseJson(text);
 if(!parsed){console.error('OCR JSON parse failed',{status:j?.status||'',incomplete_reason:j?.incomplete_details?.reason||'',output_types:(j?.output||[]).map(x=>x?.type||'unknown')});throw new Error('OCR_PARSE_FAILED')}
 const safe={};for(const k of fields)safe[k]=clean(parsed[k]);return safe;
}
