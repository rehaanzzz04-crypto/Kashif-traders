import { db,bodyOf,cleanText,hashPin,newSalt,newToken,hashToken,setSessionCookie,clearSessionCookie,getSessionUser,getRoleAccess } from './_auth.js';

export default async function handler(req,res){
  try{
    const sql=db();
    const action=String(req.query?.action||'status');
    if(req.method==='GET'&&action==='status'){
      const count=await sql`SELECT COUNT(*)::int AS count FROM employees`;
      const user=await getSessionUser(req,sql);
      const access=user?await getRoleAccess(sql,user.designation):[];
      return res.status(200).json({hasEmployees:Number(count[0]?.count||0)>0,user:user?{...user,access}:null});
    }
    if(req.method==='POST'&&action==='bootstrap'){
      const count=await sql`SELECT COUNT(*)::int AS count FROM employees`;
      if(Number(count[0]?.count||0)>0)return res.status(409).json({error:'Admin already configured'});
      const b=bodyOf(req),fullName=cleanText(b.full_name),pin=String(b.pin||'').trim();
      if(!fullName)return res.status(400).json({error:'Admin name is required'});
      if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:'PIN must be 4 to 8 digits'});
      const salt=newSalt(),pinHash=hashPin(pin,salt);
      const rows=await sql`INSERT INTO employees(employee_code,full_name,mobile_number,designation,pin_salt,pin_hash,status) VALUES('ADM-0001',${fullName},${cleanText(b.mobile_number)},'admin',${salt},${pinHash},'active') RETURNING id,employee_code,full_name,mobile_number,designation,status`;
      const token=newToken(),tokenHash=hashToken(token);
      await sql`INSERT INTO employee_sessions(employee_id,token_hash,expires_at) VALUES(${rows[0].id},${tokenHash},now()+interval '12 hours')`;
      await sql`UPDATE employees SET last_login_at=now() WHERE id=${rows[0].id}`;
      setSessionCookie(res,token);
      return res.status(201).json({user:{...rows[0],access:await getRoleAccess(sql,'admin')}});
    }
    if(req.method==='POST'&&action==='login'){
      const b=bodyOf(req),code=String(b.employee_code||'').trim().toUpperCase(),pin=String(b.pin||'').trim();
      const rows=await sql`SELECT * FROM employees WHERE UPPER(employee_code)=${code} LIMIT 1`;
      const e=rows[0];
      if(!e||e.status!=='active'||hashPin(pin,e.pin_salt)!==e.pin_hash)return res.status(401).json({error:'Invalid employee code or PIN'});
      await sql`DELETE FROM employee_sessions WHERE expires_at<=now()`;
      const token=newToken(),tokenHash=hashToken(token);
      await sql`INSERT INTO employee_sessions(employee_id,token_hash,expires_at) VALUES(${e.id},${tokenHash},now()+interval '12 hours')`;
      await sql`UPDATE employees SET last_login_at=now() WHERE id=${e.id}`;
      setSessionCookie(res,token);
      const access=await getRoleAccess(sql,e.designation);
      return res.status(200).json({user:{id:e.id,employee_code:e.employee_code,full_name:e.full_name,mobile_number:e.mobile_number,designation:e.designation,status:e.status,access}});
    }
    if(req.method==='POST'&&action==='logout'){
      const token=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('kt_session='));
      if(token){const raw=decodeURIComponent(token.slice('kt_session='.length));await sql`DELETE FROM employee_sessions WHERE token_hash=${hashToken(raw)}`;}
      clearSessionCookie(res);return res.status(200).json({ok:true});
    }
    if(req.method==='GET'&&action==='me'){
      const user=await getSessionUser(req,sql);if(!user)return res.status(401).json({error:'Authentication required'});
      return res.status(200).json({user:{...user,access:await getRoleAccess(sql,user.designation)}});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Auth API error',e);return res.status(500).json({error:e?.message||'Authentication request failed'});}
}
