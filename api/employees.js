import { requireUser,bodyOf,cleanText,employeePrefix,newSalt,hashPin } from './_auth.js';

const validRoles=new Set(['admin','manager','accountant','salesman']);
const validStatus=new Set(['active','inactive']);
const money=v=>{if(v===undefined||v===null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null};
async function ensureSalaryColumns(sql){
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthly_salary numeric(14,2) NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_effective_from date`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_status text NOT NULL DEFAULT 'active'`;
}

export default async function handler(req,res){
  try{
    const auth=await requireUser(req,res,'employees'); if(!auth)return;
    const {sql}=auth; await ensureSalaryColumns(sql);
    if(req.method==='GET'){
      const rows=await sql`SELECT id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at,monthly_salary,salary_effective_from,salary_status FROM employees ORDER BY designation,employee_code`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='POST'){
      const b=bodyOf(req),role=String(b.designation||'').trim().toLowerCase(),fullName=cleanText(b.full_name),pin=String(b.pin||'').trim(),monthlySalary=money(b.monthly_salary),salaryEffective=cleanText(b.salary_effective_from);
      if(!validRoles.has(role))return res.status(400).json({error:'Valid designation is required'});
      if(!fullName)return res.status(400).json({error:'Employee name is required'});
      if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:'PIN must be 4 to 8 digits'});
      if(monthlySalary===null&&b.monthly_salary!==undefined&&b.monthly_salary!=='')return res.status(400).json({error:'Monthly salary must be zero or more'});
      const prefix=employeePrefix(role);
      const existing=await sql`SELECT employee_code FROM employees WHERE employee_code LIKE ${prefix+'-%'} ORDER BY employee_code DESC LIMIT 1`;
      const last=existing[0]?.employee_code||'';
      const next=(Number(last.split('-')[1]||0)+1);
      const code=prefix+'-'+String(next).padStart(4,'0');
      const salt=newSalt(),pinHash=hashPin(pin,salt);
      const rows=await sql`INSERT INTO employees(employee_code,full_name,mobile_number,designation,pin_salt,pin_hash,status,monthly_salary,salary_effective_from,salary_status) VALUES(${code},${fullName},${cleanText(b.mobile_number)},${role},${salt},${pinHash},${validStatus.has(String(b.status||'active'))?String(b.status||'active'):'active'},${monthlySalary??0},${salaryEffective}::date,'active') RETURNING id,employee_code,full_name,mobile_number,designation,status,created_at,monthly_salary,salary_effective_from,salary_status`;
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='PATCH'){
      const id=Number(req.query?.id); if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Valid employee id required'});
      const b=bodyOf(req),role=String(b.designation||'').trim().toLowerCase(),status=String(b.status||'').trim().toLowerCase(),pin=String(b.pin||'').trim(),monthlySalary=money(b.monthly_salary),salaryEffective=cleanText(b.salary_effective_from),salaryStatus=cleanText(b.salary_status);
      if(role&&!validRoles.has(role))return res.status(400).json({error:'Invalid designation'});
      if(status&&!validStatus.has(status))return res.status(400).json({error:'Invalid status'});
      if(pin&& !/^\d{4,8}$/.test(pin))return res.status(400).json({error:'PIN must be 4 to 8 digits'});
      if(b.monthly_salary!==undefined&&b.monthly_salary!==''&&monthlySalary===null)return res.status(400).json({error:'Monthly salary must be zero or more'});
      const rows=await sql`UPDATE employees SET full_name=COALESCE(${cleanText(b.full_name)},full_name),mobile_number=COALESCE(${cleanText(b.mobile_number)},mobile_number),designation=COALESCE(${role||null},designation),status=COALESCE(${status||null},status),monthly_salary=COALESCE(${monthlySalary},monthly_salary),salary_effective_from=COALESCE(${salaryEffective}::date,salary_effective_from),salary_status=COALESCE(${salaryStatus},salary_status),updated_at=now() WHERE id=${id} RETURNING id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at,monthly_salary,salary_effective_from,salary_status`;
      if(!rows[0])return res.status(404).json({error:'Employee not found'});
      if(pin){const salt=newSalt(),pinHash=hashPin(pin,salt);await sql`UPDATE employees SET pin_salt=${salt},pin_hash=${pinHash},updated_at=now() WHERE id=${id}`;await sql`DELETE FROM employee_sessions WHERE employee_id=${id}`;}
      return res.status(200).json({record:rows[0]});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Employees API error',e);return res.status(500).json({error:e?.message||'Employee request failed'});}
}
