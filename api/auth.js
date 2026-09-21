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
    if(req.method==='POST'&&action==='setup-login'){
      const b=bodyOf(req),code=String(b.employee_code||'').trim().toUpperCase(),pin=String(b.pin||'').trim(),username=cleanText(b.username),password=String(b.password||'');
      if(!code||!pin)return res.status(400).json({error:'Employee code and PIN are required'});
      if(!username||username.length<3||username.length>60)return res.status(400).json({error:'Username must be 3 to 60 characters'});
      if(password.length<6||password.length>128)return res.status(400).json({error:'Password must be at least 6 characters'});
      await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_username text`; await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_salt text`; await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash text`;
      const rows=await sql`SELECT * FROM employees WHERE UPPER(employee_code)=${code} AND deleted_at IS NULL LIMIT 1`,e=rows[0];
      if(!e||e.status!=='active'||hashPin(pin,e.pin_salt)!==e.pin_hash)return res.status(401).json({error:'Employee code or PIN is incorrect'});
      const duplicate=await sql`SELECT id FROM employees WHERE LOWER(login_username)=LOWER(${username}) AND id<>${e.id} AND deleted_at IS NULL LIMIT 1`; if(duplicate[0])return res.status(409).json({error:'This username is already in use'});
      const salt=newSalt(),passwordHash=hashPin(password,salt); await sql`UPDATE employees SET login_username=${username},password_salt=${salt},password_hash=${passwordHash},updated_at=now() WHERE id=${e.id}`; await sql`DELETE FROM employee_sessions WHERE employee_id=${e.id}`;
      return res.status(200).json({ok:true,employee:{employee_code:e.employee_code,full_name:e.full_name,username}});
    }
    if(req.method==='POST'&&action==='password-login'){
      const b=bodyOf(req),username=cleanText(b.username),password=String(b.password||''); if(!username||!password)return res.status(400).json({error:'Username and password are required'});
      await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_username text`; await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_salt text`; await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash text`;
      const rows=await sql`SELECT * FROM employees WHERE LOWER(login_username)=LOWER(${username}) AND deleted_at IS NULL LIMIT 1`,e=rows[0]; if(!e||e.status!=='active'||!e.password_salt||hashPin(password,e.password_salt)!==e.password_hash)return res.status(401).json({error:'Invalid username or password'});
      const token=newToken(),tokenHash=hashToken(token); await sql`INSERT INTO employee_sessions(employee_id,token_hash,expires_at) VALUES(${e.id},${tokenHash},now()+interval '12 hours')`; await sql`UPDATE employees SET last_login_at=now() WHERE id=${e.id}`; setSessionCookie(res,token);
      return res.status(200).json({user:{id:e.id,employee_code:e.employee_code,full_name:e.full_name,designation:e.designation,status:e.status,access:await getRoleAccess(sql,e.designation)}});
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
