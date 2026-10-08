import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const api=fs.readFileSync(new URL('../api/data.js',import.meta.url),'utf8');
const helper=api.slice(api.indexOf('function cashInvoiceView('),api.indexOf('async function ensureCashSaleSchema('));
test('daily display retains distinct references and legacy numbers',()=>{
 const view=vm.runInNewContext(helper+';cashInvoiceView');
 const rows=view([{invoice_number:'CS-20261008-1'},{invoice_number:'CS-20261009-1'},{invoice_number:'CS-1791458289073'}]);
 assert.equal(rows[0].invoice_number,'CS-1');assert.equal(rows[1].invoice_number,'CS-1');
 assert.notEqual(rows[0].invoice_reference,rows[1].invoice_reference);
 assert.equal(rows[0].invoice_day,'2026-10-08');assert.equal(rows[2].invoice_number,'CS-1791458289073');
 assert.equal(view({record:{invoice_number:'CS-20261008-27'}}).record.invoice_number,'CS-27');
});
const source=fs.readFileSync(new URL('../cashier-sales-ui.js',import.meta.url),'utf8');
const pdfCode=source.slice(source.indexOf('  function wrapThermal('),source.indexOf('  async function shareReceipt('));
test('thermal PDF expands with content and keeps totals/footer within the page',async()=>{
 let previous=0;
 for(const count of [1,6,50]){
 const data={invoice:'CS-1',date:'08-Oct-2026',customer:'A long customer name that wraps into additional lines',createdBy:'Ali',paidBy:'Cashier',payment:'Cash',items:Array.from({length:count},()=>({name:'Full Cream Milk Powder Bakery Pack',qty:2,unit:'kg',rate:1500,amount:3000})),subtotal:count*3000,total:count*3000,discount:0,received:0,due:count*3000,status:'Credit'};
 const pdf=await vm.runInNewContext(pdfCode+';pdfBlob()',{Blob,receiptData:()=>data,qtyText:String,thermalMoney:String}).text();
 const height=Number(pdf.match(/MediaBox \[0 0 226.77 ([\d.]+)/)[1]);assert.ok(height>previous);previous=height;
 assert.match(pdf,/\(Thank you\.\)/);assert.match(pdf,/\(CS-1\)/);
 for(const m of pdf.matchAll(/([\d.]+) ([\d.]+) Td /g)){assert.ok(Number(m[1])>=0&&Number(m[1])<226.77);assert.ok(Number(m[2])>=10&&Number(m[2])<height);}
 }
});
