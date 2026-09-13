import { neon } from '@neondatabase/serverless';
import { getSessionUser,canAccess } from './_auth.js';

const db=()=>{const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL_NOT_CONFIGURED');return neon(url)};
const bodyOf=req=>{if(!req.body)return{};if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{return{}}}return req.body};
const asId=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const text=v=>{if(v===undefined||v===null)return null;const s=String(v).trim();return s||null};
const money=v=>{const n=Number(v);return Number.isFinite(n)?n:null};

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const sql=db();
    const user=await getSessionUser(req,sql);
    if(!user)return res.status(401).json({error:'Authentication required'});
    if(user.designation!=='admin')return res.status(403).json({error:'Admin approval required for invoice-linked supplier payments'});
    if(!(await canAccess(sql,user.designation,'supplier-payments')))return res.status(403).json({error:'Access denied'});
    const b=bodyOf(req),supplierId=asId(b.supplier_id),invoiceId=asId(b.supplier_invoice_id),amount=money(b.amount);
    if(!supplierId||!invoiceId||!amount||amount<=0)return res.status(400).json({error:'Supplier, invoice and valid amount are required'});
    const invoiceRows=await sql`SELECT id,supplier_id,invoice_number,amount,status FROM supplier_invoices WHERE id=${invoiceId}`;
    const invoice=invoiceRows[0];
    if(!invoice)return res.status(404).json({error:'Supplier invoice not found'});
    if(Number(invoice.supplier_id)!==supplierId)return res.status(400).json({error:'Selected invoice does not belong to this supplier'});
    const paidRows=await sql`SELECT COALESCE(SUM(amount),0)::numeric AS paid FROM supplier_payments WHERE supplier_invoice_id=${invoiceId}`;
    const alreadyPaid=Number(paidRows[0]?.paid||0),invoiceAmount=Number(invoice.amount||0),remaining=Math.max(0,invoiceAmount-alreadyPaid);
    if(amount>remaining+0.005)return res.status(400).json({error:'Payment exceeds invoice outstanding balance'});
    const rows=await sql`INSERT INTO supplier_payments(supplier_id,supplier_invoice_id,payment_date,amount,payment_method,bank,reference_number,notes,attachment_url) VALUES(${supplierId},${invoiceId},${text(b.payment_date)},${amount},${text(b.payment_method)},${text(b.bank)},${text(b.reference_number)},${text(b.notes)},${text(b.attachment_url)}) RETURNING *`;
    const totalPaid=alreadyPaid+amount,newRemaining=Math.max(0,invoiceAmount-totalPaid),status=newRemaining<=0.005?'paid':totalPaid>0?'partial':'unpaid';
    await sql`UPDATE supplier_invoices SET status=${status},updated_at=now() WHERE id=${invoiceId}`;
    return res.status(201).json({record:rows[0],invoice:{id:invoiceId,invoice_number:invoice.invoice_number,status,amount:invoiceAmount,paid:totalPaid,remaining:newRemaining}});
  }catch(e){
    console.error('Invoice-linked supplier payment error',e);
    const msg=e?.message==='DATABASE_URL_NOT_CONFIGURED'?'DATABASE_URL is not configured':'Supplier payment failed';
    return res.status(e?.message==='DATABASE_URL_NOT_CONFIGURED'?503:500).json({error:msg});
  }
}
