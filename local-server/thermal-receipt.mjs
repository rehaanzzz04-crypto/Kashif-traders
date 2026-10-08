// Kashif Traders 80mm ESC/POS receipt; same working-branch content sequence.
// Monospace hardware text, centered enlarged title, bold products and totals.
// Cut remains OFF unless explicitly enabled after supervised device test.
const sanitize=v=>String(v??"").replace(/[\x00-\x1f\x7f-\x9f]/g," ").replace(/[^\x20-\x7e]/g,"?").trim();
const money=v=>(Number.isFinite(Number(v))&&Number(v)>=0?Number(v):0).toLocaleString("en-US",{maximumFractionDigits:2});
const WIDTH=42,bar="-".repeat(WIDTH);
const field=(name,value)=>wrap(value,29).map((s,i)=>({text:(i?" ".repeat(13):sanitize(name).padEnd(13))+s}));
const columns=(a,b,c)=>sanitize(a).slice(0,12).padEnd(13)+" "+sanitize(b).slice(0,12).padStart(12)+" "+sanitize(c).slice(0,15).padStart(15);
const total=(name,value,bold=false)=>({text:sanitize(name).slice(0,22).padEnd(23)+sanitize(value).slice(0,19).padStart(19),bold});
function wrap(value,max=WIDTH) {
 const words=sanitize(value).split(/\s+/).filter(Boolean),out=[];let line="";
 for(let word of words){
  if(line&&(line+" "+word).length>max){out.push(line);line="";}
  while(word.length>max){out.push(word.slice(0,max));word=word.slice(max);}
  if(!word)continue;
  if(line&&(line+" "+word).length>max){out.push(line);line=word;}else line+=(line?" ":"")+word;
 }
 if(line)out.push(line);
 return out.length?out:[""];
}
function receiptParts(d) {
 if(!d||typeof d!=="object"||!Array.isArray(d.items)||!d.items.length||d.items.length>100)throw Error("Receipt requires 1-100 items");
 if(!/^[\w-]{1,48}$/.test(String(d.invoice||"")))throw Error("Invoice number invalid");
 const parts=[
  {text:"KASHIF TRADERS",align:"center",bold:true,large:true},
  {text:"Cash Sale Receipt",align:"center",bold:true},
  {text:bar},
  ...field("Receipt No",d.invoice),...field("Date",d.date),
  ...field("Customer",d.customer),...field("Created by",d.createdBy),
  ...field("Paid by",d.paidBy),...field("Payment",d.payment),
  {text:bar},{text:columns("Qty","Rate","Amount"),bold:true},{text:bar}
 ];
 for(const item of d.items){
  if(!item||typeof item.name!=="string"||!item.name.trim()||item.name.length>250)throw Error("Product name invalid");
  for(const key of ["qty","rate","amount"])if(!Number.isFinite(Number(item[key]))||Number(item[key])<0||Number(item[key])>1000000000)throw Error("Product value invalid");
  parts.push(...wrap(item.name).map(text=>({text,bold:true})));
  parts.push({text:columns(item.qty+" "+(item.unit||"pcs"),money(item.rate),money(item.amount))});
  parts.push({text:bar});
 }
 for(const key of ["subtotal","total","received","due","discount"])if(!Number.isFinite(Number(d[key]??0))||Number(d[key]??0)<0||Number(d[key]??0)>1000000000)throw Error("Total amount invalid");
 parts.push(total("Total Items",String(d.items.length)),total("Subtotal",money(d.subtotal)));
 if(Number(d.discount||0)>0)parts.push(total("Discount",money(d.discount)));
 parts.push(total("Total PKR",money(d.total),true),total("Received",money(d.received)));
 if(Number(d.due||0)>0)parts.push(total("Due",money(d.due),true),total("Status",d.status));
 parts.push({text:bar},{text:"Thank you.",align:"center",bold:true});
 if(parts.length>450||parts.some(x=>x.text.length>WIDTH))throw Error("Thermal receipt safety limit");
 return parts;
}
export function receiptLines(data){return receiptParts(data).map(p=>p.text);}
export function rawReceipt(data,{cut=false}={}){
 const parts=receiptParts(data);
 const chunks=[Buffer.from([27,64,27,77,0,27,51,28])];
 let prevAlign="left",prevBold=false,prevLarge=false;
 for(const part of parts){
  const align=part.align||"left",bold=!!part.bold,large=!!part.large;
  if(align!==prevAlign){chunks.push(Buffer.from([27,97,align==="center"?1:0]));prevAlign=align;}
  if(bold!==prevBold){chunks.push(Buffer.from([27,69,bold?1:0]));prevBold=bold;}
  if(large!==prevLarge){chunks.push(Buffer.from([29,33,large?0x11:0]));prevLarge=large;}
  chunks.push(Buffer.from(part.text+"\n","ascii"));
 }
 chunks.push(Buffer.from([27,69,0,29,33,0,27,97,0,27,50]));
 if(cut) {
  chunks.push(Buffer.from("\n\n\n","ascii"));
  chunks.push(Buffer.from([29,86,0])); // GS V 0 full-cut command: hardware dependent
 } else chunks.push(Buffer.from("\n","ascii"));
 return Buffer.concat(chunks);
}
