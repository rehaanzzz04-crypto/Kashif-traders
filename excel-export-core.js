import ExcelJS from 'exceljs';
import { attachEntryNumbers } from './api/_entry-number.js';

const text=v=>v===undefined||v===null?'':String(v);
const titleCase=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const safeName=s=>(String(s||'export').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'export');
const dated=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d};
const moneyKey=k=>/(amount|balance|price|cost|salary|credit_limit)$/i.test(k)||/(amount|balance|price|cost|salary)/i.test(k);
const qtyKey=k=>/(quantity|qty|stock|reorder_level)/i.test(k);
const dateKey=k=>/(^|_)(date|at)$|date$|_at$/i.test(k)||/effective_from|salary_month|expiry_date/i.test(k);
const linkKey=k=>/(url|file_url|attachment_url)/i.test(k);

const META={
 suppliers:{title:'Suppliers',file:'Suppliers',entry:'suppliers'},
 supplier_payments:{title:'Supplier Payments',file:'Supplier-Payments',entry:'supplier_payments'},
 clients:{title:'Clients',file:'Clients',entry:'clients'},
 client_invoices:{title:'Client Bills',file:'Client-Bills',entry:'client_invoices'},
 client_receipts:{title:'Client Payments',file:'Client-Payments',entry:'client_receipts'},
 products:{title:'Products',file:'Products',entry:'products'},
 goods_receiving:{title:'Goods Receiving',file:'Goods-Receiving',entry:'goods_receipts'},
 inventory_ledger:{title:'Inventory Ledger',file:'Inventory-Ledger'},
 warehouses:{title:'Warehouses',file:'Warehouses',entry:'warehouses'},
 warehouse_stock:{title:'Warehouse Stock',file:'Warehouse-Stock'},
 stock_transfers:{title:'Stock Transfers',file:'Stock-Transfers',entry:'stock_transfers'},
 stock_adjustments:{title:'Stock Adjustments',file:'Stock-Adjustments',entry:'stock_adjustments'},
 supplier_bill_items:{title:'Supplier Bill Items',file:'Supplier-Bill-Items',entry:'supplier_invoice_items'},
 documents:{title:'Documents',file:'Documents',entry:'documents'},
 employees:{title:'Employees',file:'Employees'},
 salary_requests:{title:'Salary & Advances',file:'Salary-Advances',entry:'salary_requests'}
};

function normalizeRows(rows=[]){return rows.map(r=>{const out={};for(const [k,v] of Object.entries(r||{}))out[k]=dateKey(k)&&v?dated(v)??v:v;return out});}
async function numberRows(sql,key,rows){return key?attachEntryNumbers(sql,key,rows):rows;}

async function load(sql,key){
 if(key==='suppliers')return{main:await sql`SELECT * FROM suppliers ORDER BY business_name,id`};
 if(key==='supplier_payments')return{main:await sql`SELECT p.*,s.business_name supplier_name FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.payment_date DESC,p.id DESC`};
 if(key==='clients')return{main:await sql`SELECT * FROM clients ORDER BY business_name,id`};
 if(key==='client_invoices')return{main:await sql`SELECT i.*,c.business_name client_name FROM client_invoices i JOIN clients c ON c.id=i.client_id ORDER BY i.invoice_date DESC,i.id DESC`};
 if(key==='client_receipts')return{main:await sql`SELECT r.*,c.business_name client_name FROM client_receipts r JOIN clients c ON c.id=r.client_id ORDER BY r.receipt_date DESC,r.id DESC`};
 if(key==='products')return{main:await sql`SELECT p.*,COALESCE(x.stock_on_hand,0)::numeric stock_on_hand FROM products p LEFT JOIN(SELECT product_id,SUM(quantity)::numeric stock_on_hand FROM inventory_movements GROUP BY product_id)x ON x.product_id=p.id ORDER BY p.name,p.id`};
 if(key==='goods_receiving')return{main:await sql`SELECT g.*,s.business_name supplier_name,w.name warehouse_name,i.invoice_number supplier_invoice_number FROM goods_receipts g JOIN suppliers s ON s.id=g.supplier_id JOIN warehouses w ON w.id=g.warehouse_id JOIN supplier_invoices i ON i.id=g.supplier_invoice_id ORDER BY g.receipt_date DESC,g.id DESC`,items:await sql`SELECT gi.*,g.grn_number,p.sku,p.name product_name,p.unit FROM goods_receipt_items gi JOIN goods_receipts g ON g.id=gi.goods_receipt_id JOIN products p ON p.id=gi.product_id ORDER BY gi.goods_receipt_id,gi.id`};
 if(key==='inventory_ledger')return{main:await sql`SELECT m.*,w.name warehouse_name,p.sku,p.name product_name,p.unit FROM inventory_movements m JOIN warehouses w ON w.id=m.warehouse_id JOIN products p ON p.id=m.product_id ORDER BY m.movement_date DESC,m.id DESC`};
 if(key==='warehouses')return{main:await sql`SELECT * FROM warehouses ORDER BY is_default DESC,name,id`};
 if(key==='warehouse_stock')return{main:await sql`SELECT * FROM warehouse_stock ORDER BY warehouse_name,product_name`};
 if(key==='stock_transfers')return{main:await sql`SELECT t.*,fw.name from_warehouse,tw.name to_warehouse FROM stock_transfers t JOIN warehouses fw ON fw.id=t.from_warehouse_id JOIN warehouses tw ON tw.id=t.to_warehouse_id ORDER BY t.transfer_date DESC,t.id DESC`,items:await sql`SELECT ti.*,t.transfer_number,p.sku,p.name product_name,p.unit FROM stock_transfer_items ti JOIN stock_transfers t ON t.id=ti.stock_transfer_id JOIN products p ON p.id=ti.product_id ORDER BY ti.stock_transfer_id,ti.id`};
 if(key==='stock_adjustments')return{main:await sql`SELECT a.*,w.name warehouse_name,p.sku,p.name product_name,p.unit FROM stock_adjustments a JOIN warehouses w ON w.id=a.warehouse_id JOIN products p ON p.id=a.product_id ORDER BY a.adjustment_date DESC,a.id DESC`};
 if(key==='supplier_bill_items')return{main:await sql`SELECT x.*,i.invoice_number,s.business_name supplier_name,p.sku,p.name product_name,p.unit FROM supplier_invoice_items x JOIN supplier_invoices i ON i.id=x.supplier_invoice_id JOIN suppliers s ON s.id=i.supplier_id JOIN products p ON p.id=x.product_id ORDER BY x.supplier_invoice_id,x.id`};
 if(key==='documents')return{main:await sql`SELECT * FROM documents ORDER BY created_at DESC,id DESC`};
 if(key==='employees')return{main:await sql`SELECT id,employee_code,full_name,mobile_number,designation,status,last_login_at,created_at,updated_at,monthly_salary,salary_effective_from,salary_status FROM employees ORDER BY designation,employee_code`};
 if(key==='salary_requests')return{main:await sql`SELECT * FROM salary_requests WHERE status IN ('approved','paid') ORDER BY requested_at DESC,id DESC`};
 throw Error('Unknown Excel export type');
}

function orderedKeys(rows){const set=new Set();for(const r of rows)for(const k of Object.keys(r||{}))set.add(k);const preferred=['entry_number','id','business_name','supplier_name','client_name','employee_code','employee_name','full_name','invoice_number','reference_number','grn_number','transfer_number','sku','product_name','warehouse_name','from_warehouse','to_warehouse'];return[...preferred.filter(k=>set.has(k)),...[...set].filter(k=>!preferred.includes(k))];}
function addSheet(wb,name,title,rows){const cleanRows=normalizeRows(rows),keys=orderedKeys(cleanRows),lastCol=Math.max(1,keys.length),ws=wb.addWorksheet(String(name).slice(0,31),{views:[{state:'frozen',ySplit:4}]});ws.mergeCells(1,1,1,lastCol);const head=ws.getCell(1,1);head.value=`KASHIF TRADERS — ${title.toUpperCase()}`;head.font={bold:true,size:16,color:{argb:'FFFFFFFF'}};head.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173F35'}};head.alignment={vertical:'middle',horizontal:'left'};ws.getRow(1).height=28;ws.mergeCells(2,1,2,lastCol);ws.getCell(2,1).value='Final ERP records';ws.getCell(2,1).font={italic:true,color:{argb:'FF666666'}};if(!keys.length){ws.getCell('A4').value='No records';return ws}ws.getRow(4).values=keys.map(titleCase);ws.getRow(4).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2F6657'}};ws.getRow(4).alignment={vertical:'middle',horizontal:'center',wrapText:true};ws.getRow(4).height=30;ws.autoFilter={from:{row:4,column:1},to:{row:4,column:lastCol}};for(const r of cleanRows){const row=ws.addRow(keys.map(k=>r[k]??''));row.alignment={vertical:'top'};keys.forEach((k,i)=>{const c=row.getCell(i+1);if(dateKey(k)&&c.value instanceof Date)c.numFmt=/_at$|last_login_at|created_at|updated_at|reviewed_at|paid_at|requested_at/i.test(k)?'dd-mmm-yyyy hh:mm':'dd-mmm-yyyy';else if(moneyKey(k)&&typeof c.value==='number')c.numFmt='#,##0.00';else if(qtyKey(k)&&typeof c.value==='number')c.numFmt='#,##0.###';if(linkKey(k)&&text(r[k])){c.value={text:'Open Link',hyperlink:text(r[k])};c.font={color:{argb:'FF0563C1'},underline:true}}if(/notes|remarks|address|reason|description|review_note/i.test(k))c.alignment={vertical:'top',wrapText:true}})}keys.forEach((k,i)=>{let width=Math.max(12,Math.min(34,titleCase(k).length+4));if(/name|address|notes|remarks|reason|description/i.test(k))width=28;if(linkKey(k))width=18;ws.getColumn(i+1).width=width});ws.eachRow((row,n)=>{if(n>=5)row.eachCell(cell=>{cell.border={bottom:{style:'hair',color:{argb:'FFD9D9D9'}}}})});return ws;}

export async function generateExcelExport(sql,key){
 if(key==='complete_backup'){const {generateCompleteExcelBackup}=await import('./excel-backup-core.js');return generateCompleteExcelBackup(sql)}
 const meta=META[key];if(!meta)throw Error('Unknown Excel export type');const data=await load(sql,key);data.main=await numberRows(sql,meta.entry,data.main||[]);if(key==='salary_requests')data.main=await numberRows(sql,'salary_requests',data.main||[]);if(key==='supplier_bill_items')data.main=await numberRows(sql,'supplier_invoice_items',data.main||[]);const wb=new ExcelJS.Workbook();wb.creator='Kashif Traders ERP';wb.company='Kashif Traders';wb.created=new Date();addSheet(wb,meta.title,meta.title,data.main||[]);if(key==='goods_receiving'&&data.items)addSheet(wb,'Goods Receipt Items','Goods Receipt Items',data.items);if(key==='stock_transfers'&&data.items)addSheet(wb,'Transfer Items','Stock Transfer Items',data.items);const buffer=Buffer.from(await wb.xlsx.writeBuffer()),stamp=new Date().toISOString().slice(0,10);return{buffer,filename:`Kashif-Traders-${safeName(meta.file)}-${stamp}.xlsx`,count:(data.main||[]).length};
}
export const excelExportTypes=Object.freeze([...Object.keys(META),'complete_backup']);
