import { requireUser, bodyOf, cleanText, canAccess } from './_auth.js';
const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const amt=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:null};
export default async function handler(req,res){
 try{
  const auth=await requireUser(req,res);if(!auth)return;const{sql,user}=auth;
  if(user.designation!=='admin'&&!(await canAccess(sql,user.designation,'salary-advances')))return res.status(403).json({error:'Access denied'});
  if(req.method==='GET'){
   const rows=user.designation==='admin'?await sql`SELECT * FROM salary_requests ORDER BY requested_at DESC,id DESC LIMIT 500`:await sql`SELECT * FROM salary_requests WHERE employee_id=${user.id} ORDER BY requested_at DESC,id DESC LIMIT 200`;
   return res.status(200).json({records:rows});
  }
  if(req.method==='POST'){
   const b=bodyOf(req),type=cleanText(b.request_type),amount=amt(b.amount),month=cleanText(b.salary_month),reason=cleanText(b.reason);
   if(!['monthly_salary','salary_advance'].includes(type))return res.status(400).json({error:'Valid request type required'});
   if(!amount)return res.status(400).json({error:'Valid amount required'});
   if(type==='monthly_salary'&&!month)return res.status(400).json({error:'Salary month required'});
   if(type==='monthly_salary'){
    const dup=await sql`SELECT id,status FROM salary_requests WHERE employee_id=${user.id} AND request_type='monthly_salary' AND salary_month=${month}::date AND status IN ('pending','approved','paid') LIMIT 1`;
    if(dup[0])return res.status(409).json({error:'Salary request already exists for this month'});
   }
   const salaryMonth=type==='monthly_salary'?month:null;
   const rows=await sql`INSERT INTO salary_requests(employee_id,employee_code,employee_name,designation,request_type,salary_month,amount,reason,status) VALUES(${user.id},${user.employee_code},${user.full_name},${user.designation},${type},${salaryMonth}::date,${amount},${reason},'pending') RETURNING *`;
   return res.status(201).json({record:rows[0],pending_approval:true,message:'Sent to Admin for approval'});
  }
  if(req.method==='PATCH'){
   if(user.designation!=='admin')return res.status(403).json({error:'Admin only'});const b=bodyOf(req),rid=id(req.query?.id||b.id);if(!rid)return res.status(400).json({error:'Valid request id required'});
   const cur=(await sql`SELECT * FROM salary_requests WHERE id=${rid}`)[0];if(!cur)return res.status(404).json({error:'Salary request not found'});
   const action=String(b.action||'').toLowerCase();
   if(action==='approve'||action==='reject'){
    if(cur.status!=='pending')return res.status(409).json({error:'Request already reviewed'});
    const st=action==='approve'?'approved':'rejected';
    const rows=await sql`UPDATE salary_requests SET status=${st},reviewed_by_employee_id=${user.id},reviewed_by_code=${user.employee_code},reviewed_by_name=${user.full_name},reviewed_at=now(),review_note=${cleanText(b.note)} WHERE id=${rid} AND status='pending' RETURNING *`;
    return res.status(200).json({record:rows[0]});
   }
   if(action==='pay'){
    if(cur.status!=='approved')return res.status(409).json({error:'Approve request before payment'});
    const rows=await sql`UPDATE salary_requests SET status='paid',paid_at=now(),payment_method=${cleanText(b.payment_method)||'Cash'},payment_reference=${cleanText(b.payment_reference)} WHERE id=${rid} AND status='approved' RETURNING *`;
    return res.status(200).json({record:rows[0]});
   }
   return res.status(400).json({error:'Valid action required'});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){console.error('Salaries API error',e);return res.status(500).json({error:e?.message||'Salary request failed'});}
}
