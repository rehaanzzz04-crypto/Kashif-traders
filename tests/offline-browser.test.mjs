import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=resolve(new URL('..',import.meta.url).pathname),received=[],ledger=new Map();let nextId=100,activeUser='1';
const server=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  if(u.pathname==='/api/auth'){res.end(JSON.stringify({user:{id:activeUser,full_name:'Test Employee',designation:'admin',access:['dashboard']}}));return;}
  if(req.method==='GET'){const resource=u.searchParams.get('resource');res.end(JSON.stringify({records:resource==='sale_products'?[{id:1,name:'Test Product',sale_price:480,status:'active',barcode:'12345'}]:[]}));return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  const key=req.headers['x-kt-offline-id'],body=JSON.parse(raw||'{}');
  if(!ledger.has(key)){const result={record:{...body,id:nextId++,invoice_number:'TEST-100'}};ledger.set(key,result);received.push({url:req.url,body,owner:req.headers['x-kt-offline-owner']});}
  res.end(JSON.stringify(ledger.get(key)));return;
 }
 try {const file=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+'/'))throw Error();const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/cash-sale.html');
 await page.waitForFunction(()=>Boolean(window.KT_OFFLINE));
 await page.evaluate(async()=>{await fetch('/api/auth?action=me');await fetch('/api/data?resource=sale_products');await fetch('/api/data?resource=cash_sale_customers');await navigator.serviceWorker.ready;});
 await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller);
 assert.equal(await page.locator('#csSave').count(),1);
 await context.setOffline(true);
 const results=await page.evaluate(async()=>{
  const product=await (await fetch('/api/data?resource=sale_products&search=Test&status=active')).json();
  const c=await (await fetch('/api/data?resource=cash_sale_customers',{method:'POST',body:JSON.stringify({name:'Offline Test',status:'active'})})).json();
  const s=await (await fetch('/api/data?resource=cash_sales',{method:'POST',body:JSON.stringify({customer_id:c.record.id,items:[{id:1,qty:1,rate:480}]})})).json();
  return {product,c,s,count:await KT_OFFLINE.count()};
 });
 assert.equal(results.product.records[0].name,'Test Product');assert.ok(results.c.record.id<0);assert.equal(results.count,2);assert.equal(received.length,0);
 await page.reload();assert.equal(await page.locator('#csSave').count(),1);assert.equal(await page.evaluate(()=>KT_OFFLINE.count()),2);
 // Another employee cannot see or send the original employee's queued data.
 await page.evaluate(()=>localStorage.setItem('kt_offline_user_v1',JSON.stringify({user:{id:'2'},saved_at:new Date().toISOString()})));
 assert.equal(await page.evaluate(()=>KT_OFFLINE.count()),0);
 activeUser='2';await context.setOffline(false);await page.evaluate(()=>KT_OFFLINE.sync());assert.equal(received.length,0);
 activeUser='1';await page.evaluate(async()=>{await fetch('/api/auth?action=me');await KT_OFFLINE.sync();});
 assert.equal(await page.evaluate(()=>KT_OFFLINE.count()),0);assert.equal(received.length,2);
 assert.equal(received[1].body.customer_id,100);assert.equal(received[1].owner,'1');
 await page.evaluate(()=>KT_OFFLINE.sync());assert.equal(received.length,2);
 await context.setOffline(true);
 await page.goto(url+'/cashier-sales.html');assert.match(await page.title(),/Cashier/i);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: mobile Cash Sale renders; offline search, linked entries, reload persistence, account isolation, reconnect mapping, repeated sync and offline cashier navigation.');
 await context.close();
} finally {await browser.close();server.close();}
