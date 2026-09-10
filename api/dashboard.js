import { neon } from '@neondatabase/serverless';

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const url=process.env.DATABASE_URL;
  if(!url) return res.status(503).json({error:'DATABASE_URL is not configured'});
  try{
    const sql=neon(url);
    const [sp,cp,si,spay,ci,cr,sc,cc,recentSupplierBills,recentClientInvoices]=await Promise.all([
      sql`SELECT COALESCE(SUM(s.opening_balance),0)+COALESCE((SELECT SUM(i.amount) FROM supplier_invoices i),0)-COALESCE((SELECT SUM(p.amount) FROM supplier_payments p),0) AS v FROM suppliers s`,
      sql`SELECT COALESCE(SUM(c.opening_balance),0)+COALESCE((SELECT SUM(i.amount) FROM client_invoices i),0)-COALESCE((SELECT SUM(r.amount) FROM client_receipts r),0) AS v FROM clients c`,
      sql`SELECT COALESCE(SUM(amount),0) AS v FROM supplier_invoices`,
      sql`SELECT COALESCE(SUM(amount),0) AS v FROM supplier_payments`,
      sql`SELECT COALESCE(SUM(amount),0) AS v FROM client_invoices`,
      sql`SELECT COALESCE(SUM(amount),0) AS v FROM client_receipts`,
      sql`SELECT COUNT(*)::int AS v FROM suppliers`,
      sql`SELECT COUNT(*)::int AS v FROM clients`,
      sql`SELECT i.invoice_number,i.amount,s.business_name FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id ORDER BY i.invoice_date DESC,i.id DESC LIMIT 5`,
      sql`SELECT i.invoice_number,i.amount,c.business_name FROM client_invoices i JOIN clients c ON c.id=i.client_id ORDER BY i.invoice_date DESC,i.id DESC LIMIT 5`
    ]);
    res.status(200).json({
      totalSupplierPayable:sp[0]?.v||0,totalClientReceivable:cp[0]?.v||0,
      totalSupplierPurchases:si[0]?.v||0,totalSupplierPayments:spay[0]?.v||0,
      totalClientSales:ci[0]?.v||0,totalClientReceipts:cr[0]?.v||0,
      supplierCount:sc[0]?.v||0,clientCount:cc[0]?.v||0,recentSupplierBills,recentClientInvoices
    });
  }catch(e){console.error(e);res.status(500).json({error:'Database query failed'});}
}
