import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../cashier-sales-ui.js',import.meta.url),'utf8');
const receiptDocument=source.slice(source.indexOf('  function receiptDocument()'),source.indexOf('  function printReceipt()'));
test('receipt measures content and sets a finite 80mm page before printing',async()=>{
  for(const pixels of [250,600,1500]){
    const html=vm.runInNewContext(receiptDocument+';receiptDocument()',{active:{invoice_number:'CS-20261008-1'},esc:x=>x,receiptMarkup:()=>'<main class="receipt"></main>'});
    const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
    let onload,style,printed=false;
    vm.runInNewContext(script,{
      window:{addEventListener:(event,fn)=>{assert.equal(event,'load');onload=fn;},print:()=>{assert.match(style.textContent,new RegExp('size:80mm '+(Math.ceil(pixels*25.4/96)+2)+'mm'));printed=true;}},
      document:{fonts:{ready:Promise.resolve()},querySelector:()=>({getBoundingClientRect:()=>({height:pixels})}),createElement:()=>({}),head:{appendChild:s=>{style=s;}}},requestAnimationFrame:fn=>fn()
    });
    assert.equal(printed,false);await onload();assert.equal(printed,true);
  }
});
