import { requireUser,bodyOf,cleanText,employeePrefix,newSalt,hashPin } from './_auth.js';

const validRoles=new Set(['admin','manager','accountant','salesman']);
const validStatus=new Set(['active','inactive']);
const money=v=>{if(v===undefined||v===null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null};
async function ensureEmployeeColumns(sql){
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthly_salary numeric(14,2) NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_effective_from date`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_status text NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
}
async function nextEmployeeCode(sql,role){
  const prefix=employeePrefix(role);
  const existing=await sql`SELECT employee_code FROM employees WHERE employee_code LIKE ${prefix+'-%'} ORDER BY employee_code DESC LIMIT 1`;
  const last=existing[0]?.employee_code||'';
  const next=Number(last.split('-')[1]||0)+1;
  return prefix+'-'+String(next).padStart(4,'0');
}

export default async function handler(req,res){
  try{
    const auth=await requireUser(req,res,'employees'); if(!auth)return;
    const {sql,user}=auth; await ensureEmployeeColumns(sql);
    if(req.method==='GET'){
      const rows=await sql`SELECT id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at,monthly_salary,salary_effective_from,salary_status FROM employees WHERE deleted_at IS NULL ORDER BY designation,employee_code`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='POST'){
      const b=bodyOf(req),role=String(b.designation||'').trim().toLowerCase(),fullName=cleanText(b.full_name),pin=String(b.pin||'').trim(),monthlySalary=money(b.monthly_salary),salaryEffective=cleanText(b.salary_effective_from);
      if(!validRoles.has(role))return res.status(400).json({error:'Valid designation is required'});
      if(!fullName)return res.status(400).json({error:'Employee name is required'});
      if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:'PIN must be 4 to 8 digits'});
      if(monthlySalary===null&&b.monthly_salary!==undefined&&b.monthly_salary!=='')return res.status(400).json({error:'Monthly salary must be zero or more'});
      const code=await nextEmployeeCode(sql,role);
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
      const currentRows=await sql`SELECT id,employee_code,designation FROM employees WHERE id=${id} AND deleted_at IS NULL LIMIT 1`;
      const current=currentRows[0];if(!current)return res.status(404).json({error:'Employee not found'});
      const targetRole=role||current.designation;
      const targetPrefix=employeePrefix(targetRole)+'-';
      const newCode=String(current.employee_code||'').startsWith(targetPrefix)?current.employee_code:await nextEmployeeCode(sql,targetRole);
      const roleOrCodeChanged=targetRole!==current.designation||newCode!==current.employee_code;
      const rows=await sql`UPDATE employees SET employee_code=${newCode},full_name=COALESCE(${cleanText(b.full_name)},full_name),mobile_number=COALESCE(${cleanText(b.mobile_number)},mobile_number),designation=${targetRole},status=COALESCE(${status||null},status),monthly_salary=COALESCE(${monthlySalary},monthly_salary),salary_effective_from=COALESCE(${salaryEffective}::date,salary_effective_from),salary_status=COALESCE(${salaryStatus},salary_status),updated_at=now() WHERE id=${id} AND deleted_at IS NULL RETURNING id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at,monthly_salary,salary_effective_from,salary_status`;
      if(!rows[0])return res.status(404).json({error:'Employee not found'});
      if(pin){const salt=newSalt(),pinHash=hashPin(pin,salt);await sql`UPDATE employees SET pin_salt=${salt},pin_hash=${pinHash},updated_at=now() WHERE id=${id}`;}
      if(pin||roleOrCodeChanged)await sql`DELETE FROM employee_sessions WHERE employee_id=${id}`;
      return res.status(200).json({record:rows[0],employee_code_changed:newCode!==current.employee_code});
    }
    if(req.method==='DELETE'){
      const id=Number(req.query?.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Valid employee id required'});
      if(Number(user.id)===id)return res.status(400).json({error:'You cannot delete your own signed-in employee ID'});
      const rows=await sql`UPDATE employees SET status='inactive',salary_status='inactive',deleted_at=now(),updated_at=now() WHERE id=${id} AND deleted_at IS NULL RETURNING id,employee_code,full_name`;
      if(!rows[0])return res.status(404).json({error:'Employee not found'});
      await sql`DELETE FROM employee_sessions WHERE employee_id=${id}`;
      return res.status(200).json({record:rows[0],historical_records_preserved:true});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Employees API error',e);return res.status(500).json({error:e?.message||'Employee request failed'});}
}
