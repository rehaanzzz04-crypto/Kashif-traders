import { neon } from '@neondatabase/serverless';
import { getSessionUser } from './_auth.js';

export const config={api:{bodyParser:false}};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const db=process.env.DATABASE_URL;if(!db)return res.status(503).json({error:'Database is not configured'});
  const sql=neon(db),user=await getSessionUser(req,sql);if(!user)return res.status(401).json({error:'Authentication required'});
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4000000)return res.status(413).json({error:'Document is too large'});chunks.push(chunk)}
  const type=String(req.headers['content-type']||'application/octet-stream').split(';')[0];if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(type))return res.status(415).json({error:'Only JPG, PNG, WebP or PDF is allowed'});
  const raw=String(req.query?.name||'document').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100),name=Date.now()+'-'+raw,data=Buffer.concat(chunks);
  if(process.env.BLOB_READ_WRITE_TOKEN){
   try{const {put}=await import('@vercel/blob');const blob=await put('kashif-traders/documents/'+name,data,{access:'public',contentType:type,addRandomSuffix:true});return res.status(201).json({url:blob.url,storage:'blob'})}catch(e){console.error('Blob upload fallback',e)}
  }
  if(size>750000)return res.status(413).json({error:'Without cloud storage, attachment must be under 750 KB'});
  const url='data:'+type+';base64,'+data.toString('base64');
  return res.status(201).json({url,storage:'inline'});
 }catch(e){console.error('Document upload error',e);return res.status(500).json({error:'Document upload failed'})}
}
