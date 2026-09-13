import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { generateExcelExport } from './excel-export-core.js';
import { generateSupplierBillsExcel } from './supplier-bills-excel-core.js';

const GROUPS=[
 {folder:'Suppliers',files:[['suppliers','Suppliers.xlsx'],['supplier_bills','Supplier-Bills.xlsx'],['supplier_payments','Supplier-Payments.xlsx'],['supplier_bill_items','Supplier-Bill-Items.xlsx']]},
 {folder:'Clients',files:[['clients','Clients.xlsx'],['client_invoices','Client-Bills.xlsx'],['client_receipts','Client-Payments.xlsx']]},
 {folder:'Inventory',files:[['products','Products.xlsx'],['goods_receiving','Goods-Receiving.xlsx'],['inventory_ledger','Inventory-Ledger.xlsx']]},
 {folder:'Warehouse',files:[['warehouses','Warehouses.xlsx'],['warehouse_stock','Warehouse-Stock.xlsx'],['stock_transfers','Stock-Transfers.xlsx'],['stock_adjustments','Stock-Adjustments.xlsx']]},
 {folder:'Documents',files:[['documents','Documents.xlsx']]},
 {folder:'HR',files:[['employees','Employees.xlsx'],['salary_requests','Salary-Advances.xlsx']]}
];

async function makeWorkbook(sql,type){
 if(type==='supplier_bills')return generateSupplierBillsExcel(sql,{from:null,to:null});
 return generateExcelExport(sql,type);
}

export async function generateCompleteExcelBackup(sql){
 const output=new PassThrough(),chunks=[];
 const finished=new Promise((resolve,reject)=>{output.on('data',c=>chunks.push(c));output.on('end',()=>resolve(Buffer.concat(chunks)));output.on('error',reject)});
 const zip=archiver('zip',{zlib:{level:6}});zip.on('warning',e=>{if(e.code!=='ENOENT')throw e});zip.on('error',e=>output.destroy(e));zip.pipe(output);
 let files=0,records=0;
 for(const group of GROUPS){
  for(const [type,name] of group.files){
   const doc=await makeWorkbook(sql,type);
   zip.append(doc.buffer,{name:`${group.folder}/${name}`});files++;records+=Number(doc.count||0);
  }
 }
 const stamp=new Date().toISOString().slice(0,10);
 zip.append(`Kashif Traders Complete Excel Backup\nGenerated: ${new Date().toISOString()}\nExcel files: ${files}\nFinal ERP records exported: ${records}\n`,{name:'README.txt'});
 await zip.finalize();
 const buffer=await finished;
 return{buffer,filename:`Kashif-Traders-Excel-Backup-${stamp}.zip`,files,records};
}

export const excelBackupGroups=Object.freeze(GROUPS.map(g=>({folder:g.folder,files:g.files.map(x=>x[1])})));
