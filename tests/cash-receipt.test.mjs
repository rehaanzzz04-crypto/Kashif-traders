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
 const heights=[...pdf.matchAll(/MediaBox \[0 0 204.09 ([\d.]+)\]/g)].map(m=>Number(m[1]));
 assert.ok(heights.length>=1);assert.ok(heights.every(h=>h<=595.28));
 const height=heights.reduce((a,b)=>a+b,0);assert.ok(height>previous);previous=height;
 assert.match(pdf,/\(Thank you\.\)/);assert.match(pdf,/\(CS-1\)/);assert.match(pdf,/\(Total Items\)/);assert.ok(pdf.includes("("+count+") Tj"));
 for(const m of pdf.matchAll(/([\d.]+) ([\d.]+) Td /g)){assert.ok(Number(m[1])>=0&&Number(m[1])<204.09);assert.ok(Number(m[2])>=7&&Number(m[2])<=595.28);}
 }
});

test('payment keeps the saved receipt selected across refresh, including an empty Pending list',async()=>{
 for(const pending of [[],[{id:2,status:'pending'}]]) {
  const nodes={};const $=id=>nodes[id] ||= {textContent:'',scrollIntoView(){},focus(){}};
  const saved={id:1,status:'paid',invoice_number:'CS-1',items:[{name:'Milk',qty:1,rate:200}]};
  const context=vm.createContext({$,active:{id:1,status:'pending'},busy:false,editing:false,receiptReadyId:null,bills:[],status:'pending',encodeURIComponent,
   fetch:async(url,options)=>({ok:true,status:200,json:async()=>options.method==='PATCH'?{record:saved}:{records:pending}}),
   closePayment(){},setActions(){},renderList(){},selectBill(row){context.active=row;context.receiptReadyId=null;},clearDetail(){context.active=null;}
  });
  const patch=source.slice(source.indexOf('  async function patchBill('),source.indexOf('  async function confirmPayment('));
  const load=source.slice(source.indexOf('  async function load('),source.indexOf('  fetch("/api/auth'));
  vm.runInContext(patch+load,context);
  await vm.runInContext('patchBill({status:"paid"},"Saved")',context);
  assert.equal(context.active.id,1);assert.equal(context.active.status,'paid');assert.equal(context.busy,false);
  await vm.runInContext('load()',context);assert.equal(context.active.id,1);
  assert.match(nodes.cashierStatus.textContent,/receipt print/);
 }
});

test('72mm receipt printable width fits long product names, amounts and footer',async()=>{
 const data={invoice:'CS-122',date:'08-Oct-2026, 4:41 pm',customer:'Very Long Bakery Customer Business Account',createdBy:'Ali',paidBy:'Cashier',payment:'Cash',items:[{name:'Full Cream Milk Powder Premium Bakery Pack 25KG',qty:12.5,unit:'kg',rate:12500,amount:156250},{name:'Salsa Ketchup Sashy',qty:4,unit:'pcs',rate:250,amount:1000}],subtotal:157250,discount:0,total:157250,received:157250,due:0,status:'Paid'};
 const pdf=await vm.runInNewContext(pdfCode+';pdfBlob()',{Blob,receiptData:()=>data,qtyText:String,thermalMoney:String}).text();
 const width=Number(pdf.match(/MediaBox \[0 0 ([\d.]+) ([\d.]+)/)[1]);
 assert.equal(width,204.09);
 const draws=[...pdf.matchAll(/BT \/F[12] ([\d.]+) Tf ([\d.]+) ([\d.]+) Td \(([^)]*)\) Tj ET/g)];
 assert.ok(draws.length>15,'receipt has content');
 for(const d of draws){
   const size=Number(d[1]),x=Number(d[2]),value=d[4];
   assert.ok(x>=7 && x+value.length*size*.6<=174.1,'text clipped: '+value);
 }
 const footer=draws.find(d=>d[4]==='Thank you.');
 assert.ok(footer && Number(footer[3])>=7 && Number(footer[3])<=10,'short footer/end gap');
});

test('receipt amount and total columns stay inside safe area',async()=>{
 const items=[{name:'SALVA KETCHUP SASHY',qty:4,unit:'pcs',rate:250,amount:1000},{name:'WARDA KETCHUP POUCH 4KG',qty:1,unit:'pcs',rate:800,amount:800}];
 for(const total of [1800,123456789.99]){
   const data={invoice:'CS-1',date:'08-Oct-2026, 4:41 pm',customer:'Walk-in Customer',createdBy:'Ali amjad',paidBy:'Ali amjad',payment:'Cash',items,subtotal:total,discount:0,total,received:total,due:0,status:'Paid'};
   const pdf=await vm.runInNewContext(pdfCode+';pdfBlob()',{Blob,receiptData:()=>data,qtyText:String,thermalMoney:v=>Number(v).toLocaleString('en-PK',{maximumFractionDigits:2})}).text();
   const draws=[...pdf.matchAll(/BT \/F[12] ([\d.]+) Tf ([\d.]+) ([\d.]+) Td \(([^)]*)\) Tj ET/g)];
   for(const d of draws) {
     const x=Number(d[2]),end=x+d[4].length*Number(d[1])*.6;
     assert.ok(x>=7 && end<=174.1, 'not inside printer safe area: '+d[4]);
   }
   assert.ok(draws.length>=20);
   assert.match(pdf,/\(Total Items\)/);
 }
});


test('unsafe silent kiosk printing has been removed after excessive blank paper',()=>{
 assert.doesNotMatch(source,/frame\.contentWindow\.print\s*\(/);
 assert.doesNotMatch(source,/directPrintReceipt\s*\(/);
 assert.match(source,/AUTO PRINT PAUSED/);
 assert.match(source,/Print Receipt \(PDF\)/);
 assert.match(source,/URL\.createObjectURL\(pdfBlob\(\)\)/);
});

test('historical paid receipts show received; partial and credit remain accurate',()=>{
 const helper=source.slice(source.indexOf('  const receivedOf ='),source.indexOf('  const balanceOf ='));
 const rec=vm.runInNewContext(helper+';receiptReceivedOf',{paymentArray:x=>Array.isArray(x)?x:[]});
 assert.equal(rec({status:'paid',total:2890}),2890);
 assert.equal(rec({status:'paid',total:2890,amount_received:0,payments:[]}),2890);
 assert.equal(rec({status:'paid',total:2890,amount_received:900}),900);
 assert.equal(rec({status:'partial',total:2890,payments:[{amount:1000},{amount:200}]}),1200);
 assert.equal(rec({status:'credit',total:2890}),0);
});
test('multi-page thermal bills stay within 210mm; totals on final page',async()=>{
 for(const count of [1,5,8,15,30,50]){
 const data={invoice:'CS-3',date:'09-Oct-2026 00:25',customer:'Shop Customer',createdBy:'Ali',paidBy:'Ali',payment:'Cash',items:Array.from({length:count},(_,i)=>({name:'Full Cream Milk Powder Bakery Pack '+i,qty:2,unit:'kg',rate:1500,amount:3000})),subtotal:count*3000,total:count*3000,discount:0,received:count*3000,due:0,status:'Paid'};
 const pdf=await vm.runInNewContext(pdfCode+';pdfBlob()',{Blob,receiptData:()=>data,qtyText:String,thermalMoney:String}).text();
 const boxes=[...pdf.matchAll(/MediaBox \[0 0 204.09 ([\d.]+)\]/g)].map(m=>Number(m[1]));
 assert.equal(Number(pdf.match(/\/Count (\d+)/)[1]),boxes.length);
 assert.ok(boxes.every(h=>h>0&&h<=595.28));
 assert.equal((pdf.match(/\(Total Items\)/g)||[]).length,1);
 assert.equal((pdf.match(/\(Received\)/g)||[]).length,1);
 assert.equal((pdf.match(/\(Thank you\.\)/g)||[]).length,1);
 for(const m of pdf.matchAll(/BT \/F[12] ([\d.]+) Tf ([\d.]+) ([\d.]+) Td \(([^)]*)\) Tj ET/g)){
   assert.ok(Number(m[3])>=7&&Number(m[3])<=595.28,'vertical overflow '+m[4]);
   assert.ok(Number(m[2])>=7&&Number(m[2])+m[4].length*Number(m[1])*.6<=174.1,'horizontal overflow '+m[4]);
 }
 if(count>=30)assert.ok(boxes.length>=2);
 }
});

test('long continuous thermal bill repeats no company header',async()=>{
 for(const count of [5,12,28,50]){
 const data={invoice:'CS-1',date:'09-Oct-2026',customer:'Walk-in',createdBy:'Ali',paidBy:'Ali',payment:'Cash',items:Array.from({length:count},(_,i)=>({name:'Full Cream Milk Powder '+i,qty:2,unit:'kg',rate:1500,amount:3000})),subtotal:count*3000,total:count*3000,discount:0,received:count*3000,due:0,status:'Paid'};
 const pdf=await vm.runInNewContext(pdfCode+';pdfBlob()',{Blob,receiptData:()=>data,qtyText:String,thermalMoney:String}).text();
 const pages=Number(pdf.match(/\/Count (\d+)/)[1]);
 assert.equal((pdf.match(/\(KASHIF TRADERS\)/g)||[]).length,1);
 assert.equal((pdf.match(/\(Cash Sale Receipt\)/g)||[]).length,1);
 assert.doesNotMatch(pdf,/\(cont\.\)/);
 assert.equal((pdf.match(/\(Total Items\)/g)||[]).length,1);
 assert.equal((pdf.match(/\(Thank you\.\)/g)||[]).length,1);
 if(count>=28)assert.ok(pages>1);
 for(const box of pdf.matchAll(/MediaBox \[0 0 204.09 ([\d.]+)\]/g))assert.ok(Number(box[1])<=595.28);
 }
});
test('selected business date controls daily cash sale sequence',()=>{
 assert.match(api,/WITH business_day AS \(/);
 assert.match(api,/SELECT day,1 FROM business_day/);
 assert.match(api,/\(SELECT day FROM business_day\)/);
 const view=vm.runInNewContext(helper+';cashInvoiceView');
 const values=view([{invoice_number:'CS-20261009-1'},{invoice_number:'CS-20261009-2'},{invoice_number:'CS-20261010-1'}]);
 assert.deepEqual(Array.from(values,x=>x.invoice_number),['CS-1','CS-2','CS-1']);
 assert.notEqual(values[0].invoice_reference,values[2].invoice_reference);
});
