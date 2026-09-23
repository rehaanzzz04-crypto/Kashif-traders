import { bizoraSql,ensureBizoraSchema,body,clean,verifyPassword,setSession,clearSession,session } from './_bizora-core.js';

export default async function handler(req,res){
  try{
    const sql=bizoraSql();
    await ensureBizoraSchema(sql);
    const action=clean(req.query?.action||body(req).action||'me');

    if(req.method==='GET'&&action==='me'){
      const s=session(req);if(!s)return res.status(401).json({error:'Not signed in'});
      const rows=await sql`SELECT id,email,full_name,active,last_login_at FROM bizora_admins WHERE id=${s.id}`;
      if(!rows[0]?.active){clearSession(res);return res.status(401).json({error:'Account unavailable'})}
      return res.status(200).json({user:{...rows[0],role:'super_admin'}});
    }

    if(req.method==='POST'&&action==='login'){
      const b=body(req),email=clean(b.email).toLowerCase(),password=String(b.password||'');
      if(!email||!password)return res.status(400).json({error:'Email and password required'});
      const rows=await sql`SELECT id,email,full_name,password_hash,active FROM bizora_admins WHERE lower(email)=${email} LIMIT 1`,admin=rows[0];
      if(!admin?.active||!verifyPassword(password,admin.password_hash))return res.status(401).json({error:'Invalid login'});
      await sql`UPDATE bizora_admins SET last_login_at=now() WHERE id=${admin.id}`;
      setSession(res,admin);
      return res.status(200).json({user:{id:admin.id,email:admin.email,full_name:admin.full_name,role:'super_admin'}});
    }

    if(req.method==='POST'&&action==='logout'){clearSession(res);return res.status(200).json({ok:true})}
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Bizora auth error',e);return res.status(e.statusCode||500).json({error:e.message||'Bizora auth failed'})}
}
