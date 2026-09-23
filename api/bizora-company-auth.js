import { bizoraSql,ensureBizoraSchema,body,clean,verifyPassword,setCompanySession,clearCompanySession,getCompanyAccess } from './_bizora-core.js';

export default async function handler(req,res){
  try{
    const sql=bizoraSql();await ensureBizoraSchema(sql);
    const b=body(req),action=clean(req.query?.action||b.action||'me');

    if(req.method==='GET'&&action==='me'){
      const user=await getCompanyAccess(sql,req);
      if(!user)return res.status(401).json({error:'Not signed in'});
      if(user.access_mode==='blocked')return res.status(403).json({error:'Company workspace is suspended'});
      return res.status(200).json({user});
    }

    if(req.method==='POST'&&action==='login'){
      const code=clean(b.company_code).toUpperCase(),login=clean(b.login).toLowerCase(),password=String(b.password||'');
      if(!code||!login||!password)return res.status(400).json({error:'Company Code, User ID/Email and password required'});
      const rows=await sql`SELECT u.*,c.company_code,c.company_name,c.status company_status
        FROM company_users u JOIN companies c ON c.id=u.company_id
        WHERE upper(c.company_code)=${code}
          AND (lower(u.user_code)=${login} OR lower(COALESCE(u.email,''))=${login})
        LIMIT 1`;
      const user=rows[0];
      if(!user?.active||!verifyPassword(password,user.password_hash))return res.status(401).json({error:'Invalid company login'});
      if(['suspended','closed'].includes(String(user.company_status)))return res.status(403).json({error:'Company workspace is suspended'});
      setCompanySession(res,user);
      await sql`UPDATE company_users SET last_login_at=now() WHERE id=${user.id}`;
      return res.status(200).json({ok:true,company:{id:user.company_id,company_code:user.company_code,company_name:user.company_name}});
    }

    if(req.method==='POST'&&action==='logout'){clearCompanySession(res);return res.status(200).json({ok:true})}
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Bizora company auth error',e);return res.status(e.statusCode||500).json({error:e.message||'Company authentication failed'})}
}
