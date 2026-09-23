import ExcelJS from 'exceljs';
import { attachEntryNumbers } from './api/_entry-number.js';
import { excelAttachmentLink } from './attachment-links.js';

const text=v=>v==null?'':String(v), title=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), safe=s=>(String(s||'export').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'export');
const dateKey=k=>/(^|_)(date|at)$|date$|_at$/i.test(k)||/effective_from|salary_month|expiry_date/i.test(k), moneyKey=k=>/(amount|balance|price|cost|salary|credit_limit)/i.test(k), qtyKey=k=>/(quantity|qty|stock|reorder_level)/i.test(k), linkKey=k=>/(url|file_url|attachment_url)/i.test(k);
const asDate=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d};
const META={suppliers:['Suppliers','Suppliers','suppliers'],supplier_payments:['Supplier Payments','Supplier-Payments','supplier_payments'],clients:['Clients','Clients','clients'],client_invoices:['Client Bills','Client-Bills','client_invoices'],client_receipts:['Client Payments','Client-Payments','client_receipts'],products:['Products','Products','products'],goods_receiving:['Goods Receiving','Goods-Receiving','goods_receipts'],inventory_ledger:['Inventory Ledger','Inventory-Ledger'],warehouses:['Warehouses','Warehouses','warehouses'],warehouse_stock:['Warehouse Stock','Warehouse-Stock'],stock_transfers:['Stock Transfers','Stock-Transfers','stock_transfers'],stock_adjustments:['Stock Adjustments','Stock-Adjustments','stock_adjustments'],supplier_bill_items:['Supplier Bill Items','Supplier-Bill-Items','supplier_invoice_items'],documents:['Documents','Documents','documents'],employees:['Employees','Employees'],salary_requests:['Salary & Advances','Salary-Advances','salary_requests']};
async function employeeDirectory(sql){
 const rows=await sql`SELECT employee_code,full_name,designation FROM employees`;
 const byName=new Map(),byCode=new Map();
 for(const e of rows||[]){const n=String(e.full_name||'').trim().toLowerCase(),code=String(e.employee_code||'').trim().toLowerCase();if(n)byName.set(n,e);if(code)byCode.set(code,e)}
 return{byName,byCode};
}
function addWorkerDesignations(rows,dir){
 return (rows||[]).map(row=>{
  const r={...row};
  for(const k of Object.keys(r)){
   if(!/(^|_)(created_by|updated_by|received_by|requested_by|reviewed_by|paid_by|cancelled_by|approved_by)(_|$)/i.test(k))continue;
   if(/(_id|_designation)$/i.test(k)||r[k]==null||r[k]==='')continue;
   const base=k.replace(/_name$/i,'');
   const designationKey=base+'_designation';
   if(r[designationKey])continue;
   const v=String(r[k]).trim().toLowerCase();
   const e=dir.byName.get(v)||dir.byCode.get(v);
   if(e?.designation)r[designationKey]=e.designation;
  }
  return r;
 });
}
async function load(sql,k){
 if(k==='suppliers')return{main:await sql`SELECT * FROM suppliers ORDER BY business_name,id`};
 if(k==='supplier_payments')return{main:await sql`SELECT p.*,s.business_name supplier_name FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.payment_date DESC,p.id DESC`};
 if(k==='clients')return{main:await sql`SELECT * FROM clients ORDER BY business_name,id`};
 if(k==='client_invoices')return{main:await sql`SELECT i.*,c.business_name client_name FROM client_invoices i JOIN clients c ON c.id=i.client_id ORDER BY i.invoice_date DESC,i.id DESC`};
 if(k==='client_receipts')return{main:await sql`SELECT r.*,c.business_name client_name FROM client_receipts r JOIN clients c ON c.id=r.client_id ORDER BY r.receipt_date DESC,r.id DESC`};
 if(k==='products')return{main:await sql`SELECT p.*,COALESCE(x.stock_on_hand,0)::numeric stock_on_hand FROM products p LEFT JOIN(SELECT product_id,SUM(quantity)::numeric stock_on_hand FROM inventory_movements GROUP BY product_id)x ON x.product_id=p.id ORDER BY p.name,p.id`};
 if(k==='goods_receiving')return{main:await sql`SELECT g.*,s.business_name supplier_name,w.name warehouse_name,i.invoice_number supplier_invoice_number FROM goods_receipts g JOIN suppliers s ON s.id=g.supplier_id JOIN warehouses w ON w.id=g.warehouse_id JOIN supplier_invoices i ON i.id=g.supplier_invoice_id ORDER BY g.receipt_date DESC,g.id DESC`,items:await sql`SELECT gi.*,g.grn_number,p.sku,p.name product_name,p.unit FROM goods_receipt_items gi JOIN goods_receipts g ON g.id=gi.goods_receipt_id JOIN products p ON p.id=gi.product_id ORDER BY gi.goods_receipt_id,gi.id`};
 if(k==='inventory_ledger')return{main:await sql`SELECT m.*,w.name warehouse_name,p.sku,p.name product_name,p.unit FROM inventory_movements m JOIN warehouses w ON w.id=m.warehouse_id JOIN products p ON p.id=m.product_id ORDER BY m.movement_date DESC,m.id DESC`};
 if(k==='warehouses')return{main:await sql`SELECT * FROM warehouses ORDER BY is_default DESC,name,id`};
 if(k==='warehouse_stock')return{main:await sql`SELECT * FROM warehouse_stock ORDER BY warehouse_name,product_name`};
 if(k==='stock_transfers')return{main:await sql`SELECT t.*,fw.name from_warehouse,tw.name to_warehouse FROM stock_transfers t JOIN warehouses fw ON fw.id=t.from_warehouse_id JOIN warehouses tw ON tw.id=t.to_warehouse_id ORDER BY t.transfer_date DESC,t.id DESC`,items:await sql`SELECT ti.*,t.transfer_number,p.sku,p.name product_name,p.unit FROM stock_transfer_items ti JOIN stock_transfers t ON t.id=ti.stock_transfer_id JOIN products p ON p.id=ti.product_id ORDER BY ti.stock_transfer_id,ti.id`};
 if(k==='stock_adjustments')return{main:await sql`SELECT a.*,w.name warehouse_name,p.sku,p.name product_name,p.unit FROM stock_adjustments a JOIN warehouses w ON w.id=a.warehouse_id JOIN products p ON p.id=a.product_id ORDER BY a.adjustment_date DESC,a.id DESC`};
 if(k==='supplier_bill_items')return{main:await sql`SELECT x.*,i.invoice_number,s.business_name supplier_name,p.sku,p.name product_name,p.unit FROM supplier_invoice_items x JOIN supplier_invoices i ON i.id=x.supplier_invoice_id JOIN suppliers s ON s.id=i.supplier_id JOIN products p ON p.id=x.product_id ORDER BY x.supplier_invoice_id,x.id`};
 if(k==='documents')return{main:await sql`SELECT * FROM documents ORDER BY created_at DESC,id DESC`};
 if(k==='employees')return{main:await sql`SELECT id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at,monthly_salary,salary_effective_from,salary_status FROM employees ORDER BY designation,employee_code`};
 if(k==='salary_requests')return{main:await sql`SELECT * FROM salary_requests WHERE status IN ('approved','paid') ORDER BY requested_at DESC,id DESC`};
 throw Error('Unknown Excel export type');
}
function keys(rows){const s=new Set();rows.forEach(r=>Object.keys(r||{}).forEach(k=>s.add(k)));const p=['entry_number','id','business_name','supplier_name','client_name','employee_code','employee_name','full_name','invoice_number','reference_number','grn_number','transfer_number','sku','product_name','warehouse_name','from_warehouse','to_warehouse'];return[...p.filter(k=>s.has(k)),...[...s].filter(k=>!p.includes(k))]}
function linkText(k){return /attachment_url/i.test(k)?'View Image':/file_url/i.test(k)?'Open Attachment':'Open Link'}
function sheet(wb,name,heading,rows=[],resourceKey=''){const clean=rows.map(r=>Object.fromEntries(Object.entries(r||{}).map(([k,v])=>[k,dateKey(k)&&v?(asDate(v)||v):v]))),ks=keys(clean),last=Math.max(1,ks.length),ws=wb.addWorksheet(String(name).slice(0,31),{views:[{state:'frozen',ySplit:4}]});ws.mergeCells(1,1,1,last);Object.assign(ws.getCell(1,1),{value:`KASHIF TRADERS — ${heading.toUpperCase()}`,font:{bold:true,size:16,color:{argb:'FFFFFFFF'}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF173F35'}},alignment:{vertical:'middle',horizontal:'left'}});ws.getRow(1).height=28;ws.mergeCells(2,1,2,last);ws.getCell(2,1).value='Final ERP records';ws.getCell(2,1).font={italic:true,color:{argb:'FF666666'}};if(!ks.length){ws.getCell('A4').value='No records';return}ws.getRow(4).values=ks.map(title);ws.getRow(4).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2F6657'}};ws.getRow(4).alignment={vertical:'middle',horizontal:'center',wrapText:true};ws.getRow(4).height=34;ws.autoFilter={from:{row:4,column:1},to:{row:4,column:last}};clean.forEach(r=>{const row=ws.addRow(ks.map(k=>r[k]??''));row.alignment={vertical:'top'};ks.forEach((k,i)=>{const c=row.getCell(i+1);if(dateKey(k)&&c.value instanceof Date)c.numFmt=/_at$|last_login_at|created_at|updated_at|reviewed_at|paid_at|requested_at/i.test(k)?'dd-mmm-yyyy hh:mm':'dd-mmm-yyyy';else if(moneyKey(k)&&typeof c.value==='number')c.numFmt='#,##0.00';else if(qtyKey(k)&&typeof c.value==='number')c.numFmt='#,##0.###';if(linkKey(k)&&text(r[k])){const href=excelAttachmentLink(resourceKey,r.id,r[k]);if(href){c.value={text:linkText(k),hyperlink:href};c.font={color:{argb:'FF0563C1'},underline:true}}}if(/notes|remarks|address|reason|description|review_note/i.test(k))c.alignment={vertical:'top',wrapText:true}})});ks.forEach((k,i)=>{let w=Math.max(12,Math.min(34,title(k).length+4));if(dateKey(k))w=/_at$|last_login_at|created_at|updated_at|reviewed_at|paid_at|requested_at/i.test(k)?22:16;if(/name|address|notes|remarks|reason|description|review_note/i.test(k))w=28;if(/entry_number|invoice_number|reference_number|grn_number|transfer_number|barcode/i.test(k))w=Math.max(w,20);if(linkKey(k))w=18;ws.getColumn(i+1).width=w});ws.eachRow((r,n)=>{if(n>=5)r.eachCell(c=>c.border={bottom:{style:'hair',color:{argb:'FFD9D9D9'}}})})}
export async function generateExcelExport(sql,key){if(key==='complete_backup'){const {generateCompleteExcelBackup}=await import('./excel-backup-core.js');return generateCompleteExcelBackup(sql)}const m=META[key];if(!m)throw Error('Unknown Excel export type');const d=await load(sql,key);const dir=await employeeDirectory(sql);d.main=addWorkerDesignations(d.main,dir);if(d.items)d.items=addWorkerDesignations(d.items,dir);d.main=m[2]?await attachEntryNumbers(sql,m[2],d.main||[]):d.main||[];const wb=new ExcelJS.Workbook();wb.creator='Kashif Traders ERP';wb.company='Kashif Traders';wb.created=new Date();sheet(wb,m[0],m[0],d.main,key);if(key==='goods_receiving'&&d.items)sheet(wb,'Goods Receipt Items','Goods Receipt Items',d.items);if(key==='stock_transfers'&&d.items)sheet(wb,'Transfer Items','Stock Transfer Items',d.items);const buffer=Buffer.from(await wb.xlsx.writeBuffer()),stamp=new Date().toISOString().slice(0,10);return{buffer,filename:`Kashif-Traders-${safe(m[1])}-${stamp}.xlsx`,count:d.main.length}}
export const excelExportTypes=Object.freeze([...Object.keys(META),'complete_backup']);
