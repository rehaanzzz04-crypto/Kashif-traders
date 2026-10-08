const sanitize=v=>String(v??"").replace(/[\x00-\x1f\x7f-\x9f]/g," ").replace(/[^\x20-\x7e]/g,"?").trim();
const money=v=>(Number.isFinite(Number(v))&&Number(v)>=0?Number(v):0).toLocaleString("en-US",{maximumFractionDigits:2});
const WIDTH=42;
const bar="-".repeat(WIDTH);
const pair=(k,v)=>wrap(v,29).map((s,i)=>(i?" ".repeat(13):sanitize(k).padEnd(13))+s);
const col=(a,b,c)=>sanitize(a).slice(0,12).padEnd(13)+" "+sanitize(b).slice(0,12).padStart(12)+" "+sanitize(c).slice(0,15).padStart(15);
const total=(a,b)=>sanitize(a).slice(0,22).padEnd(23)+sanitize(b).slice(0,19).padStart(19);
function wrap(text,max=WIDTH){
 const words=sanitize(text).split(/\s+/).filter(Boolean);const out=[];let line="";
 for(let w of words){
  if(line&&(line+" "+w).length>max){out.push(line);line="";}
  while(w.length>max){out.push(w.slice(0,max));w=w.slice(max);}
  if(!w)continue;
  if(line&&(line+" "+w).length>max){out.push(line);line=w;}else line+=(line?" ":"")+w;
 }
 if(line)out.push(line);return out.length?out:[""];
}
export function receiptLines(d){
 if(!d||typeof d!=="object"||!Array.isArray(d.items)||!d.items.length||d.items.length>100)throw Error("Receipt requires 1-100 items");
 if(!/^[\w-]{1,48}$/.test(String(d.invoice||"")))throw Error("Invoice number invalid");
 const lines=["KASHIF TRADERS","Cash Sale Receipt",bar,...pair("Receipt No",d.invoice),...pair("Date",d.date),...pair("Customer",d.customer),
 ...pair("Created by",d.createdBy),...pair("Paid by",d.paidBy),...pair("Payment",d.payment),bar,col("Qty","Rate","Amount"),bar];
 for(const item of d.items){
  if(!item||typeof item.name!=="string"||!item.name.trim()||item.name.length>250)throw Error("Product name invalid");
  for(const key of ["qty","rate","amount"])if(!Number.isFinite(Number(item[key]))||Number(item[key])<0||Number(item[key])>1000000000)throw Error("Product value invalid");
  lines.push(...wrap(item.name),col(item.qty+" "+(item.unit||"pcs"),money(item.rate),money(item.amount)),bar);
 }
 for(const key of ["subtotal","total","received","due","discount"])if(!Number.isFinite(Number(d[key]??0))||Number(d[key]??0)<0||Number(d[key]??0)>1000000000)throw Error("Total amount invalid");
 lines.push(total("Total Items",String(d.items.length)),total("Subtotal",money(d.subtotal)));
 if(d.discount)lines.push(total("Discount",money(d.discount)));
 lines.push(total("Total PKR",money(d.total)),total("Received",money(d.received)));
 if(d.due>0)lines.push(total("Due",money(d.due)),total("Status",d.status));
 lines.push(bar,"             Thank you.");
 if(lines.length>450||lines.some(s=>s.length>WIDTH))throw Error("Thermal receipt safety limit");
 return lines;
}
export function rawReceipt(d,{cut=false}={}){
 const lines=receiptLines(d),chunks=[Buffer.from([27,64,27,77,0])];
 for(let i=0;i<lines.length;i++){
  if(i===0)chunks.push(Buffer.from([27,97,1,27,69,1]));
  if(i===2)chunks.push(Buffer.from([27,97,0,27,69,0]));
  chunks.push(Buffer.from(lines[i]+"\n","ascii"));
 }
 chunks.push(Buffer.from("\n","ascii")); // one tiny margin; no page feed
 if(cut)chunks.push(Buffer.from([29,86,0]));
 return Buffer.concat(chunks);
}
