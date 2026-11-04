import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
 creditStatementData, createCustomerCreditPdf, createCustomerCreditThermalPdf
} from '../lib/customer-credit-pdf.js';
import { customerCreditWhatsappNumber } from '../lib/customer-credit-whatsapp.js';

const sampleCustomer={id:11,name:'Ali Super Store',mobile:'03001234567'};
const data=[
 {id:1,entry_type:'bill',entry_date:'2026-11-01',bill_no:'B-001',amount:'150000',notes:''},
 {id:2,entry_type:'payment',entry_date:'2026-11-02',bill_no:'P-001',amount:'50000',payment_method:'Cash'},
 {id:3,entry_type:'bill',entry_date:'2026-11-02',bill_no:'B-002',amount:'200000',notes:'Bulk order'},
 {id:4,entry_type:'payment',entry_date:'2026-11-03',bill_no:'P-002',amount:'100000',payment_method:'Bank Transfer'}
];

test('Customer Credit calculates debit, credit, running balance and closing amount',()=>{
 const a=creditStatementData(data);
 assert.equal(a.opening,0);
 assert.equal(a.bills,350000);
 assert.equal(a.payments,150000);
 assert.equal(a.balance,200000);
 assert.deepEqual(a.rows.map(r=>r.balance),[150000,100000,300000,200000]);
});

test('Date range carries forward opening balance and excludes out-of-range transactions',()=>{
 const a=creditStatementData(data,'2026-11-02','2026-11-02');
 assert.equal(a.opening,150000);
 assert.equal(a.bills,200000);
 assert.equal(a.payments,50000);
 assert.equal(a.balance,300000);
 assert.equal(a.rows.length,2);
});

test('Customer advances display as negative balance without losing payments',()=>{
 const a=creditStatementData([
 {entry_type:'payment',entry_date:'2026-11-01',amount:1000,id:1}
 ]);
 assert.equal(a.balance,-1000);
 assert.equal(a.payments,1000);
});

test('Thermal PDF is precisely 80 mm wide and paginates long statements',async()=>{
 const rows=Array.from({length:28},(_,i)=>({
 id:i+1,entry_type:'bill',entry_date:'2026-11-01',bill_no:'B-'+(i+1),amount:100,
 notes:'Test batch'
 }));
 const result=await createCustomerCreditThermalPdf(sampleCustomer,creditStatementData(rows));
 const pdf=await PDFDocument.load(result.buffer);
 assert.equal(pdf.getPageCount(),2);
 const expected=80*72/25.4;
 for(const page of pdf.getPages()){
  assert.ok(Math.abs(page.getWidth()-expected)<0.02);
  assert.ok(page.getHeight()>=234);
 }
 assert.match(result.filename,/80mm\.pdf$/);
});

test('Professional PDF can render and contains at least one A4-size portrait page',async()=>{
 const result=await createCustomerCreditPdf(sampleCustomer,creditStatementData(data));
 const pdf=await PDFDocument.load(result.buffer);
 assert.ok(pdf.getPageCount()>=1);
 assert.equal(pdf.getPage(0).getWidth(),595);
 assert.equal(pdf.getPage(0).getHeight(),842);
 assert.match(result.filename,/Statement\.pdf$/);
});

test('WhatsApp recipient uses saved number with normalized Pakistan country code',()=>{
 assert.equal(customerCreditWhatsappNumber('0300-1234567'),'923001234567');
 assert.equal(customerCreditWhatsappNumber('+92 300 1234567'),'923001234567');
 assert.equal(customerCreditWhatsappNumber('0092 300 1234567'),'923001234567');
 assert.equal(customerCreditWhatsappNumber('3001234567'),'923001234567');
 assert.equal(customerCreditWhatsappNumber(''),null);
 assert.equal(customerCreditWhatsappNumber('123'),null);
});
