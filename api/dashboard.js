import { neon } from '@neondatabase/serverless';
import { getSessionUser,canAccess } from './_auth.js';
import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';

const money=n=>'PKR '+Number(n||0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
export async function reportPdf(d){
  const pdf=await PDFDocument.create();
  pdf.setTitle('Kashif Traders Business Report');
  pdf.setAuthor('Kashif Traders');
  pdf.setSubject('Reports & Analytics');
  const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),p=pdf.addPage([595,842]);
  const green=rgb(.09,.25,.21),gold=rgb(.72,.57,.27),ink=rgb(.09,.13,.11),muted=rgb(.42,.48,.45),paper=rgb(.98,.97,.94),white=rgb(1,1,1);
  p.drawRectangle({x:0,y:748,width:595,height:94,color:green});
  p.drawText('KASHIF TRADERS',{x:34,y:798,size:22,font:bold,color:white});
  p.drawText('REPORTS & ANALYTICS - BUSINESS SUMMARY',{x:34,y:778,size:10,font:bold,color:rgb(.91,.83,.63)});
  p.drawText(new Date().toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}),{x:410,y:798,size:8,font,color:white});
  const cards=[['Supplier Payable',d.totalSupplierPayable],['Client Receivable',d.totalClientReceivable],['Supplier Purchases',d.totalSupplierPurchases],['Supplier Payments',d.totalSupplierPayments],['Client Sales',d.totalClientSales],['Client Payments',d.totalClientReceipts]];
  cards.forEach(([label,value],i)=>{const col=i%2,row=Math.floor(i/2),x=34+col*264,y=675-row*120;p.drawRectangle({x,y,width:244,height:92,color:paper,borderColor:rgb(.86,.84,.78),borderWidth:1});p.drawRectangle({x,y: y+88,width:244,height:4,color:gold});p.drawText(label.toUpperCase(),{x:x+16,y:y+60,size:8,font:bold,color:muted});p.drawText(money(value),{x:x+16,y:y+29,size:16,font:bold,color:green})});
  p.drawText(`Suppliers: ${Number(d.supplierCount||0)}     Clients: ${Number(d.clientCount||0)}`,{x:34,y:300,size:11,font:bold,color:ink});
  p.drawText('This report was generated from live Kashif Traders ERP records.',{x:34,y:268,size:9,font,color:muted});
  p.drawLine({start:{x:34,y:70},end:{x:561,y:70},thickness:1,color:gold});
  p.drawText('Quality Products  |  Reliable Supply  |  Growing Together',{x:34,y:48,size:8,font:bold,color:green});
  return Buffer.from(await pdf.save());
}

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
    const data={
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
    };
    if(String(req.query?.format||'').toLowerCase()==='pdf'){
      const buffer=await reportPdf(data),date=new Date().toISOString().slice(0,10);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition',`attachment; filename="Kashif-Traders-Business-Report-${date}.pdf"`);
      res.setHeader('Cache-Control','no-store');
      return res.status(200).send(buffer);
    }
    res.status(200).json(data);
  }catch(e){console.error(e);res.status(500).json({error:'Database query failed'});}
}
