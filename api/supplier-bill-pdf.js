import { neon } from '@neondatabase/serverless';
import { getSessionUser } from './_auth.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const asId = v => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const money = v => `PKR ${Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const text = v => String(v ?? '').trim() || '-';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const url = process.env.DATABASE_URL;
    if (!url) return res.status(503).json({ error: 'DATABASE_URL is not configured' });
    const sql = neon(url);
    const user = await getSessionUser(req, sql);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const invoiceId = asId(req.query?.id);
    if (!invoiceId) return res.status(400).json({ error: 'Valid supplier bill id required' });
    const bills = await sql`SELECT i.*, s.business_name FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id WHERE i.id=${invoiceId}`;
    if (!bills[0]) return res.status(404).json({ error: 'Supplier bill not found' });
    const items = await sql`SELECT ii.*, COALESCE(p.name, ii.description, 'Item') product_name, p.sku, p.unit FROM supplier_invoice_items ii LEFT JOIN products p ON p.id=ii.product_id WHERE ii.supplier_invoice_id=${invoiceId} ORDER BY ii.id`;
    const bill = bills[0];
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const green = rgb(.03, .29, .23), gold = rgb(.78, .59, .18), ink = rgb(.08, .12, .11), soft = rgb(.96, .94, .87);
    page.drawRectangle({ x: 0, y: 760, width: 595, height: 82, color: green });
    page.drawText('KT', { x: 34, y: 785, size: 34, font: bold, color: gold });
    page.drawText('KASHIF TRADERS', { x: 105, y: 798, size: 19, font: bold, color: rgb(1,1,1) });
    page.drawText('SUPPLIER BILL', { x: 34, y: 720, size: 20, font: bold, color: green });
    page.drawText(`Supplier: ${text(bill.business_name)}`, { x: 34, y: 690, size: 11, font: bold, color: ink });
    page.drawText(`Invoice: ${text(bill.invoice_number)}`, { x: 34, y: 670, size: 10, font: regular, color: ink });
    page.drawText(`Date: ${text(bill.invoice_date).slice(0,10)}   Due: ${text(bill.due_date).slice(0,10)}`, { x: 34, y: 652, size: 10, font: regular, color: ink });
    let y = 610;
    page.drawRectangle({ x: 34, y: y - 6, width: 527, height: 24, color: green });
    [['Product',38],['Qty',330],['Rate',390],['Total',480]].forEach(([h,x]) => page.drawText(h,{x,y,size:10,font:bold,color:rgb(1,1,1)}));
    y -= 30;
    let itemTotal = 0;
    for (const item of items) {
      const qty = Number(item.quantity || 0), rate = Number(item.unit_price || 0), total = qty * rate; itemTotal += total;
      page.drawRectangle({ x: 34, y: y - 5, width: 527, height: 22, color: y % 44 === 0 ? soft : rgb(1,1,1) });
      page.drawText(text(item.product_name).slice(0, 42), { x: 38, y, size: 9, font: regular, color: ink });
      page.drawText(String(qty), { x: 330, y, size: 9, font: regular, color: ink });
      page.drawText(money(rate), { x: 390, y, size: 9, font: regular, color: ink });
      page.drawText(money(total), { x: 480, y, size: 9, font: regular, color: ink });
      y -= 22;
      if (y < 90) break;
    }
    page.drawText(items.length ? `Items total: ${money(itemTotal)}` : 'No product items recorded', { x: 34, y: y - 12, size: 11, font: bold, color: green });
    page.drawText(`BILL AMOUNT: ${money(bill.amount)}`, { x: 34, y: y - 38, size: 15, font: bold, color: green });
    page.drawText(`Status: ${text(bill.status)}`, { x: 34, y: y - 60, size: 10, font: regular, color: ink });
    page.drawLine({ start: { x: 34, y: 55 }, end: { x: 561, y: 55 }, thickness: 1, color: gold });
    page.drawText('Quality Products  |  Reliable Supply  |  Growing Together', { x: 34, y: 38, size: 8, font: bold, color: green });
    page.drawText('Page 1 of 1', { x: 505, y: 38, size: 8, font: bold, color: green });
    const buffer = Buffer.from(await pdf.save());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="supplier-bill-${invoiceId}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (e) { console.error('Supplier bill PDF error', e); return res.status(500).json({ error: 'Supplier bill PDF failed' }); }
}
