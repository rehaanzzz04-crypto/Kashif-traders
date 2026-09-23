import { neon } from "@neondatabase/serverless";
import { getSessionUser } from "./_auth.js";
const db=()=>{if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL_NOT_CONFIGURED");return neon(process.env.DATABASE_URL)};
async function ensure(sql){await sql`CREATE TABLE IF NOT EXISTS erp_audit_reports(id BIGSERIAL PRIMARY KEY,audit_type TEXT NOT NULL,period_start DATE NOT NULL,period_end DATE NOT NULL,generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),generated_by TEXT,summary JSONB NOT NULL DEFAULT '{}'::jsonb,findings JSONB NOT NULL DEFAULT '[]'::jsonb)`;await sql`CREATE INDEX IF NOT EXISTS erp_audit_reports_generated_idx ON erp_audit_reports(generated_at DESC)`;}
const n=v=>Number(v||0);
async function build(sql,type){
 const days=type==="180_day"?180:30;
 const [sb,sp,cb,cp,grn,zeroItems,zeroLedger,adj]=await Promise.all([
  sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM supplier_invoices`,
  sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM supplier_payments`,
  sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM client_invoices`,
  sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM client_receipts`,
  sql`SELECT COUNT(*)::int count,COUNT(*) FILTER (WHERE lower(COALESCE(bill_match_status,'pending'))='pending')::int pending FROM goods_receiving`,
  sql`SELECT COUNT(*)::int count FROM supplier_bill_items WHERE COALESCE(unit_price,0)=0 OR COALESCE(line_total,0)=0`,
  sql`SELECT COUNT(*)::int count FROM inventory_ledger WHERE COALESCE(unit_cost,0)=0`,
  sql`SELECT COUNT(*)::int count FROM stock_adjustments WHERE COALESCE(unit_cost,0)=0`
 ]);
 const summary={supplier_bills:sb[0],supplier_payments:sp[0],client_bills:cb[0],client_payments:cp[0],grn:grn[0]};
 const findings=[];
 if(n(grn[0]?.pending))findings.push({code:"GRN_PENDING",count:n(grn[0].pending),message:"GRNs require bill matching review"});
 if(n(zeroItems[0]?.count))findings.push({code:"ZERO_SUPPLIER_ITEM_COST",count:n(zeroItems[0].count),message:"Supplier bill items have zero price/line total"});
 if(n(zeroLedger[0]?.count))findings.push({code:"ZERO_LEDGER_COST",count:n(zeroLedger[0].count),message:"Inventory ledger movements have zero unit cost"});
 if(n(adj[0]?.count))findings.push({code:"ZERO_ADJUSTMENT_COST",count:n(adj[0].count),message:"Stock adjustments have zero unit cost"});
 return{days,summary,findings};
}
export default async function handler(req,res){
 try{
  const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"Authentication required"});
  if(String(user.designation||"").toLowerCase()!=="admin")return res.status(403).json({error:"Admin only"});
  const sql=db();await ensure(sql);
  if(req.method==="GET"){const rows=await sql`SELECT id,audit_type,period_start,period_end,generated_at,generated_by,summary,findings FROM erp_audit_reports ORDER BY generated_at DESC LIMIT 24`;return res.status(200).json({records:rows});}
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{}),auditType=body.audit_type==="180_day"?"180_day":"monthly";
  const a=await build(sql,auditType),end=new Date(),start=new Date(end.getTime()-a.days*86400000);
  const rows=await sql`INSERT INTO erp_audit_reports(audit_type,period_start,period_end,generated_by,summary,findings) VALUES(${auditType},${start.toISOString().slice(0,10)},${end.toISOString().slice(0,10)},${user.full_name||user.employee_code||"Admin"},${JSON.stringify(a.summary)}::jsonb,${JSON.stringify(a.findings)}::jsonb) RETURNING *`;
  return res.status(201).json({record:rows[0]});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||"Audit failed"})}
}