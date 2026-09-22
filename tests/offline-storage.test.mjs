import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{IDBFactory}=require('fake-indexeddb');
const source=readFileSync(new URL('../offline-sync.js',import.meta.url),'utf8');
function harness(existing={}) {
 const indexedDB=existing.indexedDB||new IDBFactory(),storage=existing.storage||new Map(),state=existing.state||{online:false,owner:'1',posts:[],results:new Map(),fail:false};
 storage.set('kt_offline_user_v1',storage.get('kt_offline_user_v1')||JSON.stringify({user:{id:'1'},saved_at:new Date().toISOString()}));
 const native=async(url,init={})=>{
  if(!state.online)throw Error('offline');
  if(String(url).includes('/api/auth'))return new Response(JSON.stringify({user:{id:state.owner}}),{headers:{'Content-Type':'application/json'}});
  if((init.method||'GET')==='GET')return new Response(JSON.stringify({records:[{id:1,name:'Product',status:'active',barcode:'12345'}]}),{headers:{'Content-Type':'application/json'}});
  if(state.fail)return new Response(JSON.stringify({error:'Review required',sync_state:'review'}),{status:409});
  const key=init.headers['X-KT-Offline-ID'];
  if(!state.results.has(key)){const body=JSON.parse(init.body||'{}'),id=state.posts.length+100;state.posts.push({url,body,key,owner:init.headers['X-KT-Offline-Owner']});state.results.set(key,{record:{...body,id}});}
  if(state.loseResponse){state.loseResponse=false;throw Error('Response lost');}
  return new Response(JSON.stringify(state.results.get(key)),{headers:{'Content-Type':'application/json'}});
 };
 const context={AbortSignal,URL,Response,Request,Blob,Headers,crypto,indexedDB,console,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},location:{origin:'https://test.invalid'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{get onLine(){return state.online;}},document:{body:null,addEventListener(){}},alert(){}};
 context.window={fetch:native,addEventListener(){},dispatchEvent(){}};
 vm.runInNewContext(source,context);
 const call=async(resource,body,method='POST')=>(await context.window.fetch('/api/data?resource='+resource,{method,body:JSON.stringify(body)})).json();
 return{...context,indexedDB,storage,state,call,context};
}
test('offline bill and customer persist through reload; dependencies map to real IDs',async()=>{
 let h=harness();const customer=await h.call('cash_sale_customers',{name:'Customer'});const sale=await h.call('cash_sales',{customer_id:customer.record.id,items:[{product_id:1,qty:1,rate:480}]});
 assert.ok(sale.pending_sync);assert.equal(await h.window.KT_OFFLINE.count(),2);assert.equal(h.state.posts.length,0);
 h=harness(h);assert.equal(await h.window.KT_OFFLINE.count(),2);h.state.online=true;await h.window.KT_OFFLINE.sync();
 assert.equal(h.state.posts.length,2);assert.equal(h.state.posts[1].body.customer_id,100);assert.equal(await h.window.KT_OFFLINE.count(),0);
 await h.window.KT_OFFLINE.sync();assert.equal(h.state.posts.length,2);
});
test('other employee cannot read or submit pending entries',async()=>{
 const h=harness();await h.call('supplier_payments',{supplier_id:7,amount:480});
 h.storage.set('kt_offline_user_v1',JSON.stringify({user:{id:'2'},saved_at:new Date().toISOString()}));h.state.owner='2';h.state.online=true;
 assert.equal(await h.window.KT_OFFLINE.count(),0);await h.window.KT_OFFLINE.sync();assert.equal(h.state.posts.length,0);
});
test('lost response replays same operation ID and does not post twice',async()=>{
 const h=harness();await h.call('cash_sales',{items:[{product_id:1,qty:1,rate:480}]});h.state.online=true;h.state.loseResponse=true;
 await h.window.KT_OFFLINE.sync();assert.equal(await h.window.KT_OFFLINE.count(),1);await h.window.KT_OFFLINE.sync();assert.equal(h.state.posts.length,1);assert.equal(await h.window.KT_OFFLINE.count(),0);
});
test('rejected or uncertain request remains visible, identical submit cannot create a new ID',async()=>{
 const h=harness();const body={amount:480,supplier_id:1};await h.call('supplier_payments',body);h.state.online=true;h.state.fail=true;await h.window.KT_OFFLINE.sync();
 await h.call('supplier_payments',body);assert.equal(await h.window.KT_OFFLINE.count(),1);assert.equal((await h.window.KT_OFFLINE.items())[0].state,'review');
});
test('cached catalog supports new offline searches after restart',async()=>{
 const h=harness();h.state.online=true;await h.window.fetch('/api/data?resource=sale_products');h.state.online=false;
 const r=await h.window.fetch('/api/data?status=active&search=Prod&resource=sale_products');assert.equal(r.status,200);assert.equal((await r.json()).records.length,1);
});
test('negative monetary input is not treated as a foreign key',async()=>{
 const h=harness();await h.call('supplier_payments',{amount:-5,supplier_id:1});h.state.online=true;await h.window.KT_OFFLINE.sync();assert.equal(h.state.posts[0].body.amount,-5);
});
