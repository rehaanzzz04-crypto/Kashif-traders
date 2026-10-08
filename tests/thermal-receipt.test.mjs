import test from "node:test";
import assert from "node:assert/strict";
import {receiptLines,rawReceipt} from "../local-server/thermal-receipt.mjs";
function data(n=1) {
 return {
  invoice:"CS-3",date:"09-Oct-2026",customer:"Walk-in",createdBy:"Ali",paidBy:"Ali",payment:"Cash",
  items:Array.from({length:n},(_,i)=>({name:"Chocolate Powder Dark "+i,qty:2,unit:"KG",rate:1500,amount:3000})),
  subtotal:3000*n,discount:0,total:3000*n,received:3000*n,due:0,status:"Paid"
 };
}
test("1-100 products give one header, one totals section and max 42 columns",()=>{
 for(const count of [1,5,12,23,28,50,100]) {
  const lines=receiptLines(data(count));
  assert.equal(lines.filter(x=>x==="KASHIF TRADERS").length,1);
  assert.equal(lines.filter(x=>x.includes("Total Items")).length,1);
  assert.equal(lines.filter(x=>x.includes("Thank you.")).length,1);
  assert.ok(lines.every(x=>x.length<=42));
  assert.equal(lines.filter(x=>x.includes("Chocolate Powder Dark")).length,count);
 }
});
test("RAW ESC/POS contains no form feed or auto-cut by default",()=>{
 for(const count of [1,23,50,100]) {
  const b=rawReceipt(data(count));
  assert.deepEqual([...b.subarray(0,2)],[27,64]);
  assert.equal(b.includes(0x0c),false);
  assert.equal(b.indexOf(Buffer.from([0x1d,0x56,0x00])),-1);
  assert.ok(b.length<100000);
 }
});
test("reject control chars in products and prevent oversized bill",()=>{
 const bad=data();
 bad.items[0].name="A\x1b@B";
 const bytes=rawReceipt(bad);
 assert.equal(bytes.indexOf(Buffer.from("A\x1b@B","ascii")),-1);
 assert.throws(()=>receiptLines(data(101)),/1-100/);
 const invalid=data();invalid.items[0].rate=-1;
 assert.throws(()=>rawReceipt(invalid),/invalid/i);
});
