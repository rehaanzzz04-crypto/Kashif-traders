'use strict';
/* Invoice-only 80mm PDF; never captures the webpage. */
(function(){
const L=12,R=213,W=226.77;
const ascii=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\r\n\t]+/g,' ').replace(/[^\x20-\x7e]/g,'?');
const safe=x=>ascii(x).replace(/([\\()])/g,'\\$1');
const fmt=(v,n=2)=>Number(v||0).toLocaleString('en-PK',{minimumFractionDigits:n,maximumFractionDigits:n});
function wrap(v,max){
 const words=ascii(v).trim().split(/\s+/).filter(Boolean),out=[];let current='';
 for(let word of words){while(word.length>max){if(current){out.push(current);current='';}out.push(word.slice(0,max));word=word.slice(max);}if(!current)current=word;else if((current+' '+word).length<=max)current+=' '+word;else{out.push(current);current=word;}}
 if(current)out.push(current);return out.length?out:[''];
}
function invoiceNumber(b){
 const s=String(b?.invoice_number||b?.invoice_reference||'');
 const m=/^CS-\d{8}-(\d+)$/.exec(s);return m?'CS-'+Number(m[1]):s;
}
function billItems(b){if(Array.isArray(b?.items))return b.items;try{const a=JSON.parse(b?.items||'[]');return Array.isArray(a)?a:[]}catch{return []}}
function data(b){
 if(!b||!b.id||!b.invoice_number)throw Error('Saved invoice select karein.');
 const items=billItems(b).map(p=>({name:p.name||'Product',unit:p.unit||'pcs',qty:Math.max(0,Number(p.qty)||0),rate:Math.max(0,Number(p.rate)||0)}));
 if(!items.length)throw Error('Invoice mein koi item nahi.');
 const sub=Number(b.subtotal??items.reduce((s,p)=>s+p.qty*p.rate,0)),disc=Math.max(0,Number(b.discount)||0),total=Math.max(0,Number(b.total??sub-disc));
 let received=Math.max(0,Number(b.amount_received)||0);
 if(b.status==='paid'&&b.amount_received===null)received=total;
 received=Math.min(total,received);
 return {number:invoiceNumber(b),date:String(b.sale_date||'').slice(0,10),customer:b.customer_name||'Walk-in Customer',creator:b.created_by_name||'',method:b.payment_method||'Not received',status:String(b.status||'pending').toUpperCase(),sub,disc,total,received,due:Math.max(0,total-received),items};
}
function buildPdf(b){
 const d=data(b),cmd=[];let y=20;
 const text=(value,x=L,size=9,bold=false,align='left')=>{
   const v=ascii(value),width=v.length*size*.6;
   const pos=align==='right'?x-width:align==='center'?(L+R-width)/2:x;
   cmd.push({kind:'text',value:safe(v),x:Math.max(L,pos),size,bold,y});
 };
 const rule=()=>cmd.push({kind:'rule',y});
 const pair=(k,v)=>{text(k,L,8,true);for(const line of wrap(v,19)){text(line,108,8,true);y+=11;}};
 text('KASHIF TRADERS',0,15,true,'center');y+=16;
 text('CASH SALE INVOICE',0,9,true,'center');y+=10;rule();y+=13;
 pair('Invoice No',d.number);pair('Sale Date',d.date);pair('Customer',d.customer);
 pair('Created by',d.creator);pair('Payment',d.method);pair('Status',d.status);
 y+=3;rule();y+=12;
 text('QTY',L,9,true);text('RATE',142,9,true,'right');text('AMOUNT',R,9,true,'right');y+=9;rule();y+=13;
 for(const item of d.items){
   for(const line of wrap(item.name,33)){text(line,L,9.5,true);y+=12;}
   const q=fmt(item.qty,Number.isInteger(item.qty)?0:3)+' '+ascii(item.unit).slice(0,4),r=fmt(item.rate),a=fmt(item.qty*item.rate);
   const size=Math.min(8.8,62/(q.length*.6),57/(r.length*.6),67/(a.length*.6));
   text(q,L,size,true);text(r,142,size,true,'right');text(a,R,size,true,'right');y+=12;rule();y+=12;
 }
 const sum=(k,v,big=false)=>{text(k,L,big?10:9,true);text(v,R,Math.min(big?10.5:9,110/(ascii(v).length*.6)),true,'right');y+=15;};
 sum('Total Items',String(d.items.length));sum('Subtotal',fmt(d.sub));if(d.disc)sum('Discount',fmt(d.disc));y+=3;rule();y+=17;
 sum('TOTAL PKR',fmt(d.total),true);sum('RECEIVED',fmt(d.received));sum('BALANCE',fmt(d.due));sum('STATUS',d.status);
 y+=2;rule();y+=18;text('Thank you for your business',0,8,false,'center');
 const H=Math.max(135,Math.ceil(y+15));if(H>14000)throw Error('Invoice PDF bohat lamba hai.');
 const stream=cmd.map(c=>c.kind==='rule'
 ?'0.6 w '+L+' '+(H-c.y).toFixed(2)+' m '+R+' '+(H-c.y).toFixed(2)+' l S'
 :'BT /'+(c.bold?'F2':'F1')+' '+c.size.toFixed(2)+' Tf '+c.x.toFixed(2)+' '+(H-c.y).toFixed(2)+' Td ('+c.value+') Tj ET').join('\n');
 const obj=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'
 ];
 let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
 obj.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
 const start=pdf.length;
 pdf+='xref\n0 '+(obj.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(obj.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;
 return new Blob([bytes],{type:'application/pdf'});
}
function filename(b){const d=data(b);return 'Kashif-Traders-'+(d.date.replace(/[^0-9-]/g,'')||'Invoice')+'-'+d.number.replace(/[^a-zA-Z0-9-]/g,'')+'.pdf';}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
async function share(b){
 const blob=buildPdf(b),name=filename(b);
 if(typeof File!=='undefined'&&navigator.share){
  const f=new File([blob],name,{type:'application/pdf'});
  if(!navigator.canShare||navigator.canShare({files:[f]})){
   try{await navigator.share({files:[f],title:'Kashif Traders '+invoiceNumber(b)});return 'shared';}
   catch(e){if(e?.name==='AbortError')return 'cancelled';}
  }
 }
 download(blob,name);return 'downloaded';
}
window.KT_SMART_BILLING_PDF=Object.freeze({buildPdf,share,filename,invoiceNumber});
})();