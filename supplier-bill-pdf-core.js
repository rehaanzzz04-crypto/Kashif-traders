import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
const green=rgb(.03,.29,.23),gold=rgb(.78,.59,.18),ink=rgb(.08,.12,.11),soft=rgb(.96,.94,.87),white=rgb(1,1,1);
const clean=v=>String(v??'').replace(/[^\x20-\x7e\xa0-\xff]/g,' ').trim();
const money=v=>Number(v||0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>v?String(v instanceof Date?v.toISOString():v).slice(0,10):'-';
export async function generateItemizedSupplierBillPdf(sql,recordId,{sourceImage,optimizeBillImage}) {
  const rows=await sql`SELECT i.*,s.business_name,s.opening_balance,e.entry_number FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id LEFT JOIN erp_entry_numbers e ON e.resource_key='supplier_invoices' AND e.record_id=i.id AND e.status='active' WHERE i.id=${recordId}`;
  const r=rows[0];if(!r)throw Error('Supplier bill not found');
  const [items,bills,payments]=await Promise.all([
    sql`SELECT i.*,p.name product_name,p.unit FROM supplier_invoice_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.supplier_invoice_id=${recordId} ORDER BY i.id`,
    sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_invoices WHERE supplier_id=${r.supplier_id}`,
    sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_payments WHERE supplier_id=${r.supplier_id}`
  ]);
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  let page,y;
  const text=(value,x,yy,size=9,f=font,color=ink)=>page.drawText(clean(value),{x,y:yy,size,font:f,color});
  const fit=(value,width,size=9,f=font)=>{let t=clean(value);while(t.length&&f.widthOfTextAtSize(t,size)>width)t=t.slice(0,-1);return t;};
  const right=(value,x,yy,size=9,f=font)=>text(value,x-f.widthOfTextAtSize(clean(value),size),yy,size,f);
  const newPage=(title='SUPPLIER BILL')=>{page=pdf.addPage([595,842]);page.drawRectangle({x:0,y:760,width:595,height:82,color:green});text('KT',34,790,30,bold,gold);text('KASHIF TRADERS',105,798,21,bold,white);text('TRADING & ACCOUNTS WORKSPACE',105,778,9,font,white);text(title,34,726,14,bold,green);y=700;};
  const room=h=>{if(y-h<90)newPage('SUPPLIER BILL - CONTINUED');};
  const tableHead=()=>{page.drawRectangle({x:34,y:y-8,width:527,height:25,color:green});text('Product',42,y,9,bold,white);text('Unit',282,y,9,bold,white);text('Qty',335,y,9,bold,white);text('Rate (PKR)',390,y,9,bold,white);text('Total (PKR)',477,y,9,bold,white);y-=30;};
  newPage();text(fit(r.business_name,510,14,bold),34,y,14,bold);y-=26;
  text('ERP No: '+(r.entry_number||'SB-'+r.id),34,y);text('Supplier Invoice: '+(r.invoice_number||'-'),310,y);y-=18;
  text('Invoice Date: '+date(r.invoice_date),34,y);text('Due Date: '+date(r.due_date),310,y);y-=35;
  tableHead();
  for(const item of items){
    const name=clean(item.description||item.product_name||'Product'),lines=[];let rest=name;
    while(rest){const part=fit(rest,225);if(!part)break;lines.push(part);rest=rest.slice(part.length).trim();}
    const height=Math.max(30,lines.length*13+12);
    if(y-height<90){newPage('SUPPLIER BILL - PRODUCTS');tableHead();}
    lines.forEach((line,n)=>text(line,42,y-n*13));text(fit(item.unit||'',38),282,y);
    right(money(item.quantity),380,y,8);right(money(item.unit_price),465,y,8);right(money(Number(item.quantity)*Number(item.unit_price)),553,y,8);
    y-=height;page.drawLine({start:{x:34,y:y+10},end:{x:561,y:y+10},thickness:.5,color:soft});
  }
  if(!items.length){text('No product details saved for this bill.',42,y);y-=30;}
  room(76);y-=8;text('Products Total (PKR)',34,y,10,bold);right(money(items.reduce((n,i)=>n+Number(i.quantity)*Number(i.unit_price),0)),553,y,10,bold);y-=30;
  page.drawRectangle({x:34,y:y-12,width:527,height:34,color:green});text('BILL AMOUNT (PKR)',44,y,11,bold,white);text(money(r.amount),390,y,14,bold,white);y-=42;
  room(225);text('CURRENT SUPPLIER ACCOUNT POSITION',34,y,11,bold,green);y-=28;
  const billTotal=Number(bills[0]?.total||0),payTotal=Number(payments[0]?.total||0);
  for(const [label,value] of [['Opening Balance',r.opening_balance],['Total Supplier Bills',billTotal],['Total Supplier Payments',payTotal],['Current Outstanding',Number(r.opening_balance||0)+billTotal-payTotal]]){text(label,42,y);right('PKR '+money(value),553,y);y-=25;}
  room(55);text('Status: '+(r.status||'unpaid'),34,y,9,bold);y-=20;if(r.notes)text('Notes: '+fit(r.notes,470),34,y);
  const src=await sourceImage(r.attachment_url);
  if(src){const prepared=await optimizeBillImage(src);let image;try{image=prepared.type.includes('png')?await pdf.embedPng(prepared.buf):await pdf.embedJpg(prepared.buf);}catch{}if(image){newPage('ORIGINAL SUPPLIER BILL IMAGE');const scale=Math.min(527/image.width,600/image.height),width=image.width*scale,height=image.height*scale;page.drawImage(image,{x:34+(527-width)/2,y:90+(600-height)/2,width,height});}}
  pdf.getPages().forEach((p,index)=>{page=p;p.drawLine({start:{x:34,y:70},end:{x:561,y:70},thickness:1,color:gold});text('Quality Products | Reliable Supply | Growing Together',34,48,8,bold,green);text(`Page ${index+1} of ${pdf.getPageCount()}`,490,48,8,bold,green);});
  return {buffer:Buffer.from(await pdf.save()),filename:(clean(r.invoice_number||'supplier-bill-'+r.id).replace(/[^a-z0-9_-]+/gi,'-')||'supplier-bill')+'.pdf'};
}
