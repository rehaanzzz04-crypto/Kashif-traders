import { requireUser,bodyOf } from './_auth.js';
import { notifySupplierPayment } from './_whatsapp.js';
import { notifyClientBill,generateClientBillPdf,generateClientPaymentPdf } from '../client-bill-whatsapp-core.js';
import { generateProfessionalPartyStatementPdf } from '../party-statement-pdf.js';
import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';
import sharp from 'sharp';
const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const clean=v=>String(v??'').trim(),money=v=>`PKR ${Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
const green=rgb(.03,.29,.23),gold=rgb(.78,.59,.18),ink=rgb(.08,.12,.11),muted=rgb(.38,.42,.40),soft=rgb(.96,.94,.87),white=rgb(1,1,1);
function dateLabel(v){if(!v)return'-';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,10):new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d)}
function fit(t,font,size,max){let s=clean(t);while(s.length>2&&font.widthOfTextAtSize(s,size)>max)s=s.slice(0,-2)+'…';return s}
function brand(p,font,bold,title){p.drawRectangle({x:0,y:760,width:595,height:82,color:green});p.drawText('KT',{x:34,y:785,size:34,font:bold,color:gold});p.drawText('KASHIF TRADERS',{x:105,y:798,size:21,font:bold,color:white});p.drawText('TRADING & ACCOUNTS WORKSPACE',{x:105,y:778,size:9,font,color:white});p.drawText(title,{x:34,y:724,size:14,font:bold,color:green})}
async function sourceImage(url){if(!url)return null;try{const r=await fetch(url);if(!r.ok)return null;return{buf:Buffer.from(await r.arrayBuffer()),type:(r.headers.get('content-type')||'image/jpeg').toLowerCase()}}catch{return null}}
function longestRun(flags,minLen){let best=null,start=-1;for(let i=0;i<=flags.length;i++){if(i<flags.length&&flags[i]){if(start<0)start=i}else if(start>=0){const len=i-start;if(len>=minLen&&(!best||len>best.len))best={start,end:i-1,len};start=-1}}return best}
async function detectPaperBox(buf){
 const sample=sharp(buf,{failOn:'none'}).rotate().resize({width:240,height:360,fit:'inside'}).removeAlpha().raw();
 const {data,info}=await sample.toBuffer({resolveWithObject:true}),w=info.width,h=info.height,ch=info.channels;
 const bright=(x,y)=>{const i=(y*w+x)*ch,r=data[i],g=data[i+1]??r,b=data[i+2]??r;return (r+g+b)/3>132&&Math.max(r,g,b)-Math.min(r,g,b)<105};
 const rowFlags=[];for(let y=0;y<h;y++){let n=0;for(let x=0;x<w;x++)if(bright(x,y))n++;rowFlags[y]=n/w>.42}
 const yr=longestRun(rowFlags,Math.round(h*.28));if(!yr)return null;
 const colFlags=[];for(let x=0;x<w;x++){let n=0,total=0;for(let y=yr.start;y<=yr.end;y++){total++;if(bright(x,y))n++}colFlags[x]=n/Math.max(1,total)>.48}
 const xr=longestRun(colFlags,Math.round(w*.28));if(!xr)return null;
 const meta=await sharp(buf,{failOn:'none'}).rotate().metadata(),ow=Number(meta.width||0),oh=Number(meta.height||0);if(!ow||!oh)return null;
 const padX=Math.round((xr.len/w)*ow*.025),padY=Math.round((yr.len/h)*oh*.02);
 const left=Math.max(0,Math.floor(xr.start/w*ow)-padX),top=Math.max(0,Math.floor(yr.start/h*oh)-padY),right=Math.min(ow,Math.ceil((xr.end+1)/w*ow)+padX),bottom=Math.min(oh,Math.ceil((yr.end+1)/h*oh)+padY);
 const width=right-left,height=bottom-top;if(width<ow*.3||height<oh*.3||width*height>ow*oh*.92)return null;return{left,top,width,height};
}
async function optimizeBillImage(src){
 try{
  const box=await detectPaperBox(src.buf);
  let img=sharp(src.buf,{failOn:'none'}).rotate();
  if(box)img=img.extract(box);else img=img.trim({background:'#111111',threshold:14});
  const out=await img.resize({width:1500,height:1900,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:82,mozjpeg:true}).toBuffer();
  return{buf:out,type:'image/jpeg'};
 }catch(e){console.warn('Supplier bill smart crop skipped',e?.message||e);return src}
}
async function generateSupplierBillPdf(sql,recordId){
 const rows=await sql`SELECT i.*,s.business_name,s.opening_balance FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id WHERE i.id=${recordId}`;
 const r=rows[0];if(!r)throw Error('Supplier bill not found');
 const billTotal=Number((await sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_invoices WHERE supplier_id=${r.supplier_id}`)[0]?.total||0),payTotal=Number((await sql`SELECT COALESCE(SUM(amount),0) total FROM supplier_payments WHERE supplier_id=${r.supplier_id}`)[0]?.total||0),balance=Number(r.opening_balance||0)+billTotal-payTotal;
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),p=pdf.addPage([595,842]);brand(p,font,bold,'SUPPLIER BILL');
 p.drawText('SUPPLIER',{x:34,y:687,size:8,font:bold,color:muted});p.drawText(fit(r.business_name,bold,15,330),{x:34,y:663,size:15,font:bold,color:ink});p.drawRectangle({x:385,y:646,width:176,height:72,color:soft});
 const no=clean(r.entry_number)||clean(r.invoice_number)||`SB-${r.id}`;p.drawText(`ERP No: ${fit(no,font,8,120)}`,{x:395,y:697,size:8,font:bold,color:ink});p.drawText(`Supplier Invoice: ${fit(r.invoice_number,font,8,95)||'-'}`,{x:395,y:680,size:8,font,color:ink});p.drawText(`Invoice Date: ${dateLabel(r.invoice_date)}`,{x:395,y:663,size:8,font,color:ink});p.drawText(`Due Date: ${dateLabel(r.due_date)}`,{x:395,y:646,size:8,font,color:ink});
 p.drawRectangle({x:34,y:565,width:527,height:62,color:green});p.drawText('BILL AMOUNT',{x:50,y:604,size:9,font:bold,color:white});p.drawText(money(r.amount),{x:50,y:576,size:22,font:bold,color:white});p.drawText('ACCOUNT POSITION AFTER THIS BILL',{x:34,y:530,size:11,font:bold,color:green});
 let y=484;[['Opening Balance',Number(r.opening_balance||0)],['Total Supplier Bills',billTotal],['Total Supplier Payments',payTotal],['Current Outstanding',balance]].forEach((a,i)=>{p.drawRectangle({x:34,y,width:527,height:38,color:i===3?rgb(.95,.89,.70):white,borderColor:rgb(.84,.84,.80),borderWidth:.7});p.drawText(a[0],{x:50,y:y+14,size:9,font:i===3?bold:font,color:ink});const m=money(a[1]),f=i===3?bold:font,sz=i===3?11:9,w=f.widthOfTextAtSize(m,sz);p.drawText(m,{x:545-w,y:y+14,size:sz,font:f,color:i===3?green:ink});y-=44});
 if(clean(r.notes)){p.drawText('Notes',{x:34,y:286,size:9,font:bold,color:muted});p.drawText(fit(r.notes,font,9,510),{x:34,y:268,size:9,font,color:ink})}p.drawText(`Status: ${clean(r.status)||'unpaid'}`,{x:34,y:226,size:9,font:bold,color:green});p.drawLine({start:{x:34,y:70},end:{x:561,y:70},thickness:1,color:gold});p.drawText('Quality Products  |  Reliable Supply  |  Growing Together',{x:34,y:48,size:8,font:bold,color:green});
 const src=await sourceImage(r.attachment_url);p.drawText(src?'Page 1 of 2':'Page 1 of 1',{x:500,y:48,size:8,font:bold,color:green});if(src){const p2=pdf.addPage([595,842]);brand(p2,font,bold,'ORIGINAL SUPPLIER BILL IMAGE');p2.drawText(`${fit(r.business_name,font,8,280)}  •  ${clean(r.invoice_number)||no}  •  ${dateLabel(r.invoice_date)}`,{x:34,y:710,size:8,font,color:muted});const prepared=await optimizeBillImage(src);let img=null;try{img=prepared.type.includes('png')?await pdf.embedPng(prepared.buf):await pdf.embedJpg(prepared.buf)}catch{}if(img){const maxW=527,maxH=628,scale=Math.min(maxW/img.width,maxH/img.height),w=img.width*scale,h=img.height*scale,x=34+(maxW-w)/2,y2=68+(maxH-h)/2;p2.drawRectangle({x:33,y:67,width:529,height:630,color:white,borderColor:rgb(.84,.84,.80),borderWidth:1});p2.drawImage(img,{x,y:y2,width:w,height:h})}p2.drawText('Smart-cropped source image from Kashif Traders ERP',{x:34,y:45,size:8,font,color:muted});p2.drawText('Page 2 of 2',{x:500,y:45,size:8,font:bold,color:green})}
 const buffer=Buffer.from(await pdf.save()),filename=((clean(r.invoice_number)||`supplier-bill-${r.id}`).replace(/[^a-z0-9_-]+/gi,'-')||`supplier-bill-${r.id}`)+'.pdf';return{buffer,filename};
}
export default async function handler(req,res){
 if(req.method!=='POST'&&req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  const auth=await requireUser(req,res);if(!auth)return;const {sql,user}=auth,b=req.method==='POST'?bodyOf(req):{},recordId=id(b.id||b.record_id||req.query?.id);if(!recordId)return res.status(400).json({error:'Valid record id required'});
  const type=String(b.type||req.query?.type||'');
  if(type==='client_bill_pdf'){const doc=await generateClientBillPdf(sql,recordId);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${doc.filename}"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(doc.buffer);}
  if(type==='client_payment_pdf'){const doc=await generateClientPaymentPdf(sql,recordId);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${doc.filename}"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(doc.buffer);}
  if(type==='supplier_bill_pdf'){const doc=await generateSupplierBillPdf(sql,recordId);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${doc.filename}"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(doc.buffer);}
  if(type==='party_statement_pdf'){const partyType=String(req.query?.party||b.party||'client')==='supplier'?'supplier':'client',doc=await generateProfessionalPartyStatementPdf(sql,recordId,partyType);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${doc.filename}"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(doc.buffer);}
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(type==='client_bill'){const result=await notifyClientBill(sql,recordId);return res.status(200).json(result);}
  if(user.designation!=='admin')return res.status(403).json({error:'Admin access required'});
  const rows=await sql`SELECT * FROM supplier_payments WHERE id=${recordId}`;if(!rows[0])return res.status(404).json({error:'Supplier payment not found'});
  const result=await notifySupplierPayment(sql,rows[0]);if(!result.sent)return res.status(result.reason==='not_configured'?503:502).json({error:result.reason||'WhatsApp follow-up failed'});
  return res.status(200).json(result);
 }catch(e){console.error('WhatsApp follow-up API error',e);const code=e?.message==='CLIENT_WHATSAPP_NUMBER_MISSING'?422:e?.message==='WHATSAPP_SEND_NOT_CONFIGURED'?503:500;return res.status(code).json({error:e?.message||'WhatsApp follow-up failed'})}
}
