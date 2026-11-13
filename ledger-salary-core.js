import { requireUser, bodyOf } from './api/_auth.js';
const txt=v=>String(v??'').trim();
const num=v=>Number(v);
const validMonth=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
async function setup(sql){
 await sql`CREATE TABLE IF NOT EXISTS kt_standalone_ledger(id BIGSERIAL PRIMARY KEY,entry_type TEXT NOT NULL CHECK(entry_type IN ('sale','supplier_payment','expense','given','received')),entry_date DATE NOT NULL DEFAULT CURRENT_DATE,person_name TEXT,amount NUMERIC(14,2) NOT NULL CHECK(amount>0),details TEXT,created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

 await sql`CREATE TABLE IF NOT EXISTS kt_ledger_salary_employees(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,monthly_salary NUMERIC(14,2) NOT NULL CHECK(monthly_salary>0),active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ DEFAULT now())`;
 await sql`ALTER TABLE kt_ledger_salary_employees ADD COLUMN IF NOT EXISTS joining_date DATE`;
 await sql`CREATE TABLE IF NOT EXISTS kt_ledger_salary_months(id BIGSERIAL PRIMARY KEY,employee_id BIGINT NOT NULL REFERENCES kt_ledger_salary_employees(id),salary_month TEXT NOT NULL,salary_amount NUMERIC(14,2) NOT NULL CHECK(salary_amount>0),created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(employee_id,salary_month))`;
 await sql`CREATE TABLE IF NOT EXISTS kt_ledger_salary_payments(id BIGSERIAL PRIMARY KEY,employee_id BIGINT NOT NULL REFERENCES kt_ledger_salary_employees(id),salary_month TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('advance','salary')),amount NUMERIC(14,2) NOT NULL CHECK(amount>0),paid_on DATE NOT NULL,remarks TEXT,ledger_id BIGINT NOT NULL REFERENCES kt_standalone_ledger(id),created_at TIMESTAMPTZ DEFAULT now())`;
 await sql`ALTER TABLE kt_ledger_salary_payments DROP CONSTRAINT IF EXISTS kt_ledger_salary_payments_ledger_id_key`;
 await sql`ALTER TABLE kt_ledger_salary_payments ADD COLUMN IF NOT EXISTS request_key TEXT`;
 await sql`DROP INDEX IF EXISTS kt_ledger_salary_payments_request_key_idx`;
 await sql`CREATE UNIQUE INDEX IF NOT EXISTS kt_ledger_salary_payments_request_key_idx ON kt_ledger_salary_payments(request_key) WHERE request_key IS NOT NULL`;
}
export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
 const auth=await requireUser(req,res);if(!auth)return;
 const {sql,user}=auth;
 if(String(user.designation||'').toLowerCase()!=='admin')return res.status(403).json({error:'Admin access required'});
 await setup(sql);
 if(req.method==='GET'){
 const month=txt(req.query?.month)||new Date().toISOString().slice(0,7);
 if(!validMonth(month))return res.status(400).json({error:'Invalid month'});
 const employees=await sql`SELECT e.id,e.name,e.joining_date::text,e.monthly_salary::text,e.active,COALESCE(m.salary_amount,e.monthly_salary)::text AS month_salary,COALESCE(p.advances,0)::text AS advances,COALESCE(p.salary_paid,0)::text AS salary_paid FROM kt_ledger_salary_employees e LEFT JOIN kt_ledger_salary_months m ON m.employee_id=e.id AND m.salary_month=${month} LEFT JOIN LATERAL (SELECT COALESCE(SUM(amount) FILTER (WHERE kind='advance'),0) advances,COALESCE(SUM(amount) FILTER (WHERE kind='salary'),0) salary_paid FROM kt_ledger_salary_payments WHERE employee_id=e.id AND salary_month=${month}) p ON TRUE ORDER BY e.name,e.id`;
 const history=await sql`SELECT e.id AS employee_id,to_char(gs.mon,'YYYY-MM') AS salary_month,COALESCE(m.salary_amount,e.monthly_salary)::text AS month_salary,COALESCE(p.advances,0)::text AS advances,COALESCE(p.salary_paid,0)::text AS salary_paid FROM kt_ledger_salary_employees e CROSS JOIN LATERAL generate_series(date_trunc('month',COALESCE(e.joining_date,CURRENT_DATE))::date,date_trunc('month',(${month} || '-01')::date)::date,interval '1 month') gs(mon) LEFT JOIN kt_ledger_salary_months m ON m.employee_id=e.id AND m.salary_month=to_char(gs.mon,'YYYY-MM') LEFT JOIN LATERAL (SELECT COALESCE(SUM(amount) FILTER (WHERE kind='advance'),0) advances,COALESCE(SUM(amount) FILTER (WHERE kind='salary'),0) salary_paid FROM kt_ledger_salary_payments WHERE employee_id=e.id AND salary_month=to_char(gs.mon,'YYYY-MM')) p ON TRUE WHERE e.joining_date IS NOT NULL ORDER BY e.id,gs.mon DESC LIMIT 5000`;
 const payments=await sql`SELECT p.id,p.employee_id,p.salary_month,p.kind,p.amount::text,p.paid_on::text,p.remarks,p.ledger_id,e.name FROM kt_ledger_salary_payments p JOIN kt_ledger_salary_employees e ON e.id=p.employee_id WHERE p.salary_month=${month} ORDER BY p.paid_on,p.id`;
 return res.status(200).json({employees,payments,history,month});
 }
 const b=bodyOf(req),action=txt(b.action);
 if(action==='employee'){
 const name=txt(b.name),salary=num(b.monthly_salary),joining=txt(b.joining_date);
 if(!name||name.length>120||!Number.isFinite(salary)||salary<=0||salary>100000000)return res.status(400).json({error:'Valid employee name and monthly salary required'});
 if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(joining)||joining>new Date().toISOString().slice(0,10))return res.status(400).json({error:'Valid joining date required'});
 const employeeId=Number(b.employee_id);
 if(Number.isInteger(employeeId)&&employeeId>0){
 const updated=await sql`UPDATE kt_ledger_salary_employees SET name=${name},monthly_salary=${salary},joining_date=${joining}::date WHERE id=${employeeId} RETURNING id`;
 if(!updated.length)return res.status(404).json({error:'Employee not found'});
 return res.json({ok:true,id:employeeId});
 }
 const created=await sql`INSERT INTO kt_ledger_salary_employees(name,monthly_salary,joining_date) VALUES(${name},${salary},${joining}::date) RETURNING id`;
 return res.status(201).json({ok:true,id:created[0].id});
 }
 if(action==='payment'){
 const employeeId=Number(b.employee_id),kind=txt(b.kind),amount=num(b.amount),date=txt(b.paid_on),remarks=txt(b.remarks),requestKey=txt(b.request_key);
 if(!Number.isInteger(employeeId)||employeeId<1||!['advance','salary'].includes(kind)||!Number.isFinite(amount)||amount<=0||amount>100000000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||remarks.length>500||!/^[a-zA-Z0-9_-]{12,100}$/.test(requestKey))return res.status(400).json({error:'Invalid payment details'});
 const previous=await sql`SELECT id,ledger_id FROM kt_ledger_salary_payments WHERE request_key LIKE ${requestKey + ':%'} LIMIT 1`;
 if(previous.length)return res.json({ok:true,already_recorded:true,id:previous[0].id,ledger_id:previous[0].ledger_id});
 const employee=await sql`SELECT id,name,monthly_salary,joining_date::text FROM kt_ledger_salary_employees WHERE id=${employeeId} AND active=TRUE`;
 if(!employee.length||!employee[0].joining_date)return res.status(400).json({error:'Active employee and joining date required'});
 if(date<employee[0].joining_date)return res.status(400).json({error:'Payment date is before joining date'});
 const months=await sql`SELECT to_char(g.mon,'YYYY-MM') AS salary_month,COALESCE(m.salary_amount,${employee[0].monthly_salary})::text AS salary_amount,COALESCE(p.paid,0)::text AS paid FROM generate_series(date_trunc('month',${employee[0].joining_date}::date),date_trunc('month',${date}::date),interval '1 month') g(mon) LEFT JOIN kt_ledger_salary_months m ON m.employee_id=${employeeId} AND m.salary_month=to_char(g.mon,'YYYY-MM') LEFT JOIN LATERAL(SELECT COALESCE(SUM(amount),0) AS paid FROM kt_ledger_salary_payments WHERE employee_id=${employeeId} AND salary_month=to_char(g.mon,'YYYY-MM')) p ON TRUE ORDER BY g.mon`;
 let left=Math.round(amount*100),allocations=[];
 for(const m of months){const remaining=Math.max(0,Math.round((Number(m.salary_amount)-Number(m.paid))*100));if(!remaining)continue;const cents=Math.min(left,remaining);if(cents>0){allocations.push({month:m.salary_month,amount:cents/100});left-=cents}if(!left)break}
 if(left>0)return res.status(400).json({error:'Amount exceeds salary outstanding through the payment date'});
 // All month allocations and the single Ledger expense are inserted in one SQL statement.
 const allocationJson=JSON.stringify(allocations),description=`Employee ${kind==='advance'?'salary advance':'salary payment'} | Auto allocated: ${allocations.map(x=>x.month).join(', ')} | ${remarks}`.slice(0,1000);
 const created=await sql`WITH input AS (SELECT month,amount FROM jsonb_to_recordset(${allocationJson}::jsonb) AS a(month text,amount numeric)), frozen AS (INSERT INTO kt_ledger_salary_months(employee_id,salary_month,salary_amount) SELECT ${employeeId},i.month,${employee[0].monthly_salary} FROM input i ON CONFLICT(employee_id,salary_month) DO NOTHING RETURNING id), ledger AS (INSERT INTO kt_standalone_ledger(entry_type,entry_date,person_name,amount,details,created_by) VALUES('expense',${date}::date,${employee[0].name},${amount},${description},${user.id}) RETURNING id), allocations AS (INSERT INTO kt_ledger_salary_payments(employee_id,salary_month,kind,amount,paid_on,remarks,ledger_id,request_key) SELECT ${employeeId},i.month,${kind},i.amount,${date}::date,${remarks},ledger.id,${requestKey} || ':' || i.month FROM input i CROSS JOIN ledger RETURNING id,ledger_id,salary_month,amount) SELECT id,ledger_id,salary_month,amount::text FROM allocations`;
 return res.status(201).json({ok:true,allocations:created});
 }
 return res.status(400).json({error:'Unknown action'});
 }catch(e){console.error('Standalone salary:',e);return res.status(500).json({error:'Salary request failed'});}
}
