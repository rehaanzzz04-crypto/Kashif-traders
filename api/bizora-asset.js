import { bizoraSql,ensureBizoraSchema,requireCompanyUser,requireFeature,body,clean } from './_bizora-core.js';

const allowedMime=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
const maxBytes=3_200_000;

export default async function handler(req,res){
  const sql=bizoraSql();
  await ensureBizoraSchema(sql);
  try{
    if(req.method==='GET'){
      const id=Math.trunc(Number(req.query?.id||0));
      if(!id)return res.status(400).end('Invalid asset');
      const rows=await sql`SELECT mime_type,encode(content,'base64') content_base64 FROM ecommerce_assets WHERE id=${id} LIMIT 1`;
      const row=rows[0];
      if(!row)return res.status(404).end('Asset not found');
      res.setHeader('Content-Type',row.mime_type);
      res.setHeader('Cache-Control','public, max-age=31536000, immutable');
      return res.status(200).send(Buffer.from(row.content_base64,'base64'));
    }
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const u=await requireCompanyUser(sql,req,res,{write:true});if(!u)return;
    if(!requireFeature(u,res,'ecommerce','E-commerce'))return;
    const b=body(req),mime=clean(b.mime_type).toLowerCase(),name=clean(b.file_name).slice(0,180),raw=clean(b.base64);
    if(!allowedMime.has(mime))return res.status(400).json({error:'Unsupported media type'});
    const base64=raw.includes(',')?raw.slice(raw.indexOf(',')+1):raw;
    let buf;try{buf=Buffer.from(base64,'base64')}catch{return res.status(400).json({error:'Invalid media data'})}
    if(!buf.length||buf.length>maxBytes)return res.status(400).json({error:'Compressed media must be 3 MB or smaller'});
    const rows=await sql`INSERT INTO ecommerce_assets(company_id,file_name,mime_type,byte_size,content,created_by_user_id)
      VALUES(${u.company_id},${name||null},${mime},${buf.length},decode(${base64},'base64'),${u.id})
      RETURNING id,mime_type,byte_size`;
    const rec=rows[0];
    return res.status(201).json({asset:{...rec,url:'/api/bizora-asset?id='+rec.id}});
  }catch(e){console.error('Bizora asset API error',e);return res.status(e.statusCode||500).json({error:e.message||'Asset request failed'})}
}
