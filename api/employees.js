import { requireUser,bodyOf,cleanText,employeePrefix,newSalt,hashPin } from './_auth.js';

const validRoles=new Set(['admin','manager','accountant','salesman']);
const validStatus=new Set(['active','inactive']);

export default async function handler(req,res){
  try{
    const auth=await requireUser(req,res,'employees'); if(!auth)return;
    const {sql}=auth;
    if(req.method==='GET'){
      const rows=await sql`SELECT id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at FROM employees ORDER BY designation,employee_code`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='POST'){
      const b=bodyOf(req),role=String(b.designation||'').trim().toLowerCase(),fullName=cleanText(b.full_name),pin=String(b.pin||'').trim();
      if(!validRoles.has(role))return res.status(400).json({error:'Valid designation is required'});
      if(!fullName)return res.status(400).json({error:'Employee name is required'});
      if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:'PIN must be 4 to 8 digits'});
      const prefix=employeePrefix(role);
      const existing=await sql`SELECT employee_code FROM employees WHERE employee_code LIKE ${prefix+'-%'} ORDER BY employee_code DESC LIMIT 1`;
      const last=existing[0]?.employee_code||'';
      const next=(Number(last.split('-')[1]||0)+1);
      const code=prefix+'-'+String(next).padStart(4,'0');
      const salt=newSalt(),pinHash=hashPin(pin,salt);
      const rows=await sql`INSERT INTO employees(employee_code,full_name,mobile_number,designation,pin_salt,pin_hash,status) VALUES(${code},${fullName},${cleanText(b.mobile_number)},${role},${salt},${pinHash},${validStatus.has(String(b.status||'active'))?String(b.status||'active'):'active'}) RETURNING id,employee_code,full_name,mobile_number,designation,status,created_at`;
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='PATCH'){
      const id=Number(req.query?.id); if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Valid employee id required'});
      const b=bodyOf(req),role=String(b.designation||'').trim().toLowerCase(),status=String(b.status||'').trim().toLowerCase(),pin=String(b.pin||'').trim();
      if(role&&!validRoles.has(role))return res.status(400).json({error:'Invalid designation'});
      if(status&&!validStatus.has(status))return res.status(400).json({error:'Invalid status'});
      if(pin&& !/^\d{4,8}$/.test(pin))return res.status(400).json({error:'PIN must be 4 to 8 digits'});
      const rows=await sql`UPDATE employees SET full_name=COALESCE(${cleanText(b.full_name)},full_name),mobile_number=COALESCE(${cleanText(b.mobile_number)},mobile_number),designation=COALESCE(${role||null},designation),status=COALESCE(${status||null},status),updated_at=now() WHERE id=${id} RETURNING id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at`;
      if(!rows[0])return res.status(404).json({error:'Employee not found'});
      if(pin){const salt=newSalt(),pinHash=hashPin(pin,salt);await sql`UPDATE employees SET pin_salt=${salt},pin_hash=${pinHash},updated_at=now() WHERE id=${id}`;await sql`DELETE FROM employee_sessions WHERE employee_id=${id}`;}
      return res.status(200).json({record:rows[0]});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Employees API error',e);return res.status(500).json({error:e?.message||'Employee request failed'});}
}
