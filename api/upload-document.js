import { neon } from '@neondatabase/serverless';
import { getSessionUser,canAccess } from './_auth.js';

export const config={api:{bodyParser:false}};
const clean=v=>String(v??'').trim();
const asId=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const resourceView={supplier_invoices:'supplier-bills',supplier_payments:'supplier-payments',client_invoices:'client-sales',client_receipts:'client-receipts',documents:'documents'};
function parseDataUrl(value){const m=clean(value).match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);if(!m)return null;const mime=m[1]||'application/octet-stream';try{return{mime,buffer:m[2]?Buffer.from(m[3]||'','base64'):Buffer.from(decodeURIComponent(m[3]||''),'utf8')}}catch{return null}}
function extension(mime){const m=clean(mime).toLowerCase();if(m.includes('jpeg'))return'jpg';if(m.includes('png'))return'png';if(m.includes('webp'))return'webp';if(m.includes('gif'))return'gif';if(m.includes('pdf'))return'pdf';if(m.includes('svg'))return'svg';return'bin'}
function safeFilename(v,fallback){return(clean(v)||fallback).replace(/[\r\n"\\/]+/g,'-').slice(0,160)}
function requestOrigin(req){const proto=clean(req.headers?.['x-forwarded-proto']||'https').split(',')[0],host=clean(req.headers?.['x-forwarded-host']||req.headers?.host).split(',')[0];return host?`${proto}://${host}`:''}
async function serveAttachment(req,res,sql,user){const resource=clean(req.query?.resource),recordId=asId(req.query?.id),view=resourceView[resource];if(!view||!recordId)return res.status(400).json({error:'Valid attachment resource and id required'});if(!(await canAccess(sql,user.designation,view)))return res.status(403).json({error:'Access denied'});let rows=[];if(resource==='supplier_invoices')rows=await sql`SELECT attachment_url url,NULL::text file_name,NULL::text mime_type FROM supplier_invoices WHERE id=${recordId}`;else if(resource==='supplier_payments')rows=await sql`SELECT attachment_url url,NULL::text file_name,NULL::text mime_type FROM supplier_payments WHERE id=${recordId}`;else if(resource==='client_invoices')rows=await sql`SELECT attachment_url url,NULL::text file_name,NULL::text mime_type FROM client_invoices WHERE id=${recordId}`;else if(resource==='client_receipts')rows=await sql`SELECT attachment_url url,NULL::text file_name,NULL::text mime_type FROM client_receipts WHERE id=${recordId}`;else if(resource==='documents')rows=await sql`SELECT file_url url,file_name,mime_type FROM documents WHERE id=${recordId}`;const row=rows[0],value=clean(row?.url);if(!value)return res.status(404).json({error:'Attachment not found'});const data=parseDataUrl(value);if(data){const mime=clean(row?.mime_type)||data.mime,filename=safeFilename(row?.file_name,`${resource.replace(/_/g,'-')}-${recordId}.${extension(mime)}`);res.setHeader('Content-Type',mime);res.setHeader('Content-Disposition',`inline; filename="${filename}"`);res.setHeader('Cache-Control','private, max-age=3600');res.setHeader('X-Content-Type-Options','nosniff');return res.status(200).send(data.buffer)}if(/^https?:\/\//i.test(value))return res.redirect(302,value);if(value.startsWith('/')){const origin=requestOrigin(req);if(origin)return res.redirect(302,origin+value)}return res.status(422).json({error:'Attachment URL is not supported'})}
export default async function handler(req,res){
 try{
  const db=process.env.DATABASE_URL;if(!db)return res.status(503).json({error:'Database is not configured'});
  const sql=neon(db),user=await getSessionUser(req,sql);if(!user)return res.status(401).json({error:'Authentication required'});
  if(req.method==='GET')return serveAttachment(req,res,sql,user);
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4000000)return res.status(413).json({error:'Document is too large'});chunks.push(chunk)}
  const type=String(req.headers['content-type']||'application/octet-stream').split(';')[0];if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(type))return res.status(415).json({error:'Only JPG, PNG, WebP or PDF is allowed'});
  const raw=String(req.query?.name||'document').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100),name=Date.now()+'-'+raw,data=Buffer.concat(chunks);
  if(process.env.BLOB_READ_WRITE_TOKEN){try{const {put}=await import('@vercel/blob');const blob=await put('kashif-traders/documents/'+name,data,{access:'public',contentType:type,addRandomSuffix:true});return res.status(201).json({url:blob.url,storage:'blob'})}catch(e){console.error('Blob upload fallback',e)}}
  if(size>750000)return res.status(413).json({error:'Without cloud storage, attachment must be under 750 KB'});
  const url='data:'+type+';base64,'+data.toString('base64');return res.status(201).json({url,storage:'inline'});
 }catch(e){console.error('Document upload/view error',e);return res.status(500).json({error:req.method==='GET'?'Attachment could not be opened':'Document upload failed'})}
}
