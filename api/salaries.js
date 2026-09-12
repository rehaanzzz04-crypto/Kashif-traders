import { requireUser, bodyOf, cleanText, canAccess } from './_auth.js';
import { ensureEntryNumbers,attachEntryNumbers } from './_entry-number.js';
const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const amt=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:null};
const monthKey=v=>{if(!v)return null;const s=String(v);const m=s.match(/^(\d{4})-(\d{2})/);if(m)return `${m[1]}-${m[2]}`;const d=new Date(v);return Number.isNaN(d.getTime())?null:`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`};
const monthStart=v=>{const k=monthKey(v);return k?`${k}-01`:null};
async function ensureSalaryProfile(sql){
 await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthly_salary numeric(14,2) NOT NULL DEFAULT 0`;
 await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_effective_from date`;
 await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_status text NOT NULL DEFAULT 'active'`;
}
async function profile(sql,employeeId){return (await sql`SELECT id,employee_code,full_name,designation,monthly_salary,salary_effective_from,salary_status FROM employees WHERE id=${employeeId}`)[0]||null}
async function committed(sql,employeeId,month,excludeId=null){
 const r=excludeId?await sql`SELECT COALESCE(SUM(amount),0)::numeric AS total FROM salary_requests WHERE employee_id=${employeeId} AND status IN ('pending','approved','paid') AND COALESCE(salary_month,date_trunc('month',requested_at)::date)=${month}::date AND id<>${excludeId}`:await sql`SELECT COALESCE(SUM(amount),0)::numeric AS total FROM salary_requests WHERE employee_id=${employeeId} AND status IN ('pending','approved','paid') AND COALESCE(salary_month,date_trunc('month',requested_at)::date)=${month}::date`;
 return Number(r[0]?.total||0);
}
const autoPaymentRef=row=>{const ym=(monthKey(row.salary_month||row.requested_at)||'0000-00').replace('-','');return `SALPAY-${ym}-${String(row.id).padStart(6,'0')}`};
export default async function handler(req,res){
 try{
  const auth=await requireUser(req,res);if(!auth)return;const{sql,user}=auth;await ensureEntryNumbers(sql);await ensureSalaryProfile(sql);
  if(user.designation!=='admin'&&!(await canAccess(sql,user.designation,'salary-advances')))return res.status(403).json({error:'Access denied'});
  if(req.method==='GET'){
   const rows=user.designation==='admin'?await sql`SELECT * FROM salary_requests ORDER BY requested_at DESC,id DESC LIMIT 500`:await sql`SELECT * FROM salary_requests WHERE employee_id=${user.id} ORDER BY requested_at DESC,id DESC LIMIT 200`;
   const profiles=user.designation==='admin'?await sql`SELECT id,employee_code,full_name,designation,monthly_salary,salary_effective_from,salary_status FROM employees WHERE status='active' ORDER BY full_name`:await sql`SELECT id,employee_code,full_name,designation,monthly_salary,salary_effective_from,salary_status FROM employees WHERE id=${user.id}`;
   const numbered=[];for(const row of rows){const final=['approved','paid'].includes(row.status);numbered.push(...await attachEntryNumbers(sql,'salary_requests',[row],{assignMissing:final}))}
   return res.status(200).json({records:numbered,salary_profiles:profiles});
  }
  if(req.method==='POST'){
   const b=bodyOf(req),type=cleanText(b.request_type),amount=amt(b.amount),reason=cleanText(b.reason);
   if(!['monthly_salary','salary_advance'].includes(type))return res.status(400).json({error:'Valid request type required'});
   if(!amount)return res.status(400).json({error:'Valid amount required'});
   const p=await profile(sql,user.id);if(!p)return res.status(404).json({error:'Employee profile not found'});
   const fixed=Number(p.monthly_salary||0);if(p.salary_status!=='active'||fixed<=0)return res.status(409).json({error:'Fixed monthly salary is not configured or is inactive. Ask Admin to update Employee profile.'});
   const requestedMonth=monthStart(b.salary_month),dbMonth=(await sql`SELECT to_char(date_trunc('month',current_date),'YYYY-MM') AS m`)[0]?.m,nowMonth=dbMonth?`${dbMonth}-01`:null;
   const salaryMonth=type==='monthly_salary'?requestedMonth:(requestedMonth||nowMonth);
   if(!salaryMonth)return res.status(400).json({error:'Salary month required'});
   if(type==='monthly_salary'){
    const dup=await sql`SELECT id,status FROM salary_requests WHERE employee_id=${user.id} AND request_type='monthly_salary' AND COALESCE(salary_month,date_trunc('month',requested_at)::date)=${salaryMonth}::date AND status IN ('pending','approved','paid') LIMIT 1`;
    if(dup[0])return res.status(409).json({error:'Salary request already exists for this month'});
   }
   const used=await committed(sql,user.id,salaryMonth),remaining=Math.max(0,fixed-used);
   if(amount>remaining)return res.status(409).json({error:`Monthly salary limit exceeded. Fixed salary PKR ${fixed.toLocaleString()}, already requested/paid PKR ${used.toLocaleString()}, remaining PKR ${remaining.toLocaleString()}.`});
   const rows=await sql`INSERT INTO salary_requests(employee_id,employee_code,employee_name,designation,request_type,salary_month,amount,reason,status) VALUES(${user.id},${user.employee_code},${user.full_name},${user.designation},${type},${salaryMonth}::date,${amount},${reason},'pending') RETURNING *`;
   return res.status(201).json({record:{...rows[0],entry_number:null},pending_approval:true,fixed_salary:fixed,remaining_after:remaining-amount,message:'Sent to Admin for approval — final number is assigned only after approval'});
  }
  if(req.method==='PATCH'){
   if(user.designation!=='admin')return res.status(403).json({error:'Admin only'});const b=bodyOf(req),rid=id(req.query?.id||b.id);if(!rid)return res.status(400).json({error:'Valid request id required'});
   const cur=(await sql`SELECT * FROM salary_requests WHERE id=${rid}`)[0];if(!cur)return res.status(404).json({error:'Salary request not found'});
   const action=String(b.action||'').toLowerCase();
   if(action==='approve'||action==='reject'){
    if(cur.status!=='pending')return res.status(409).json({error:'Request already reviewed'});
    if(action==='approve'){
      const p=await profile(sql,cur.employee_id),fixed=Number(p?.monthly_salary||0),m=monthStart(cur.salary_month||cur.requested_at),other=m?await committed(sql,cur.employee_id,m,cur.id):0;
      if(!p||p.salary_status!=='active'||fixed<=0)return res.status(409).json({error:'Employee fixed salary is not configured or is inactive'});
      if(!m)return res.status(400).json({error:'Invalid salary month on request'});
      if(other+Number(cur.amount)>fixed)return res.status(409).json({error:`Cannot approve: monthly salary limit would be exceeded. Fixed salary PKR ${fixed.toLocaleString()}, other requests/payments PKR ${other.toLocaleString()}.`});
    }
    const st=action==='approve'?'approved':'rejected';
    const rows=await sql`UPDATE salary_requests SET status=${st},reviewed_by_employee_id=${user.id},reviewed_by_code=${user.employee_code},reviewed_by_name=${user.full_name},reviewed_at=now(),review_note=${cleanText(b.note)} WHERE id=${rid} AND status='pending' RETURNING *`;
    const record=(await attachEntryNumbers(sql,'salary_requests',rows,{assignMissing:st==='approved'}))[0]||null;
    return res.status(200).json({record});
   }
   if(action==='pay'){
    if(cur.status!=='approved')return res.status(409).json({error:'Approve request before payment'});
    const ref=cleanText(b.payment_reference)||autoPaymentRef(cur);
    const rows=await sql`UPDATE salary_requests SET status='paid',paid_at=now(),payment_method=${cleanText(b.payment_method)||'Cash'},payment_reference=${ref} WHERE id=${rid} AND status='approved' RETURNING *`;
    const record=(await attachEntryNumbers(sql,'salary_requests',rows))[0]||null;
    return res.status(200).json({record,payment_reference:record?.payment_reference||ref});
   }
   return res.status(400).json({error:'Valid action required'});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){console.error('Salaries API error',e);return res.status(500).json({error:e?.message||'Salary request failed'});}
}
