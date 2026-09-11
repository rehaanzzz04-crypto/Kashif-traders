import { neon } from '@neondatabase/serverless';
import { getSessionUser,canAccess } from './_auth.js';

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const url=process.env.DATABASE_URL;
  if(!url) return res.status(503).json({error:'DATABASE_URL is not configured'});
  try{
    const sql=neon(url);
    const user=await getSessionUser(req,sql);
    if(!user)return res.status(401).json({error:'Authentication required'});
    if(!(await canAccess(sql,user.designation,'dashboard'))&&!await canAccess(sql,user.designation,'reports'))return res.status(403).json({error:'Access denied'});

    const rows=await sql`
      SELECT
        (SELECT COALESCE(SUM(opening_balance),0) FROM suppliers)
          +(SELECT COALESCE(SUM(amount),0) FROM supplier_invoices)
          -(SELECT COALESCE(SUM(amount),0) FROM supplier_payments) AS supplier_payable,
        (SELECT COALESCE(SUM(opening_balance),0) FROM clients)
          +(SELECT COALESCE(SUM(amount),0) FROM client_invoices)
          -(SELECT COALESCE(SUM(amount),0) FROM client_receipts) AS client_receivable,
        (SELECT COALESCE(SUM(amount),0) FROM supplier_invoices) AS supplier_purchases,
        (SELECT COALESCE(SUM(amount),0) FROM supplier_payments) AS supplier_payments,
        (SELECT COALESCE(SUM(amount),0) FROM client_invoices) AS client_sales,
        (SELECT COALESCE(SUM(amount),0) FROM client_receipts) AS client_receipts,
        (SELECT COUNT(*)::int FROM suppliers) AS supplier_count,
        (SELECT COUNT(*)::int FROM clients) AS client_count,
        COALESCE((SELECT json_agg(x) FROM (
          SELECT i.invoice_number,i.amount,s.business_name
          FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id
          ORDER BY i.invoice_date DESC,i.id DESC LIMIT 5
        ) x),'[]'::json) AS recent_supplier_bills,
        COALESCE((SELECT json_agg(x) FROM (
          SELECT i.invoice_number,i.amount,c.business_name
          FROM client_invoices i JOIN clients c ON c.id=i.client_id
          ORDER BY i.invoice_date DESC,i.id DESC LIMIT 5
        ) x),'[]'::json) AS recent_client_invoices
    `;
    const r=rows[0]||{};
    res.status(200).json({
      totalSupplierPayable:r.supplier_payable||0,
      totalClientReceivable:r.client_receivable||0,
      totalSupplierPurchases:r.supplier_purchases||0,
      totalSupplierPayments:r.supplier_payments||0,
      totalClientSales:r.client_sales||0,
      totalClientReceipts:r.client_receipts||0,
      supplierCount:r.supplier_count||0,
      clientCount:r.client_count||0,
      recentSupplierBills:r.recent_supplier_bills||[],
      recentClientInvoices:r.recent_client_invoices||[]
    });
  }catch(e){console.error(e);res.status(500).json({error:'Database query failed'});}
}
