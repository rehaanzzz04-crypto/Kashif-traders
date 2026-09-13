import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const green=rgb(.03,.29,.23),gold=rgb(.78,.59,.18),ink=rgb(.08,.12,.11),muted=rgb(.38,.42,.40),soft=rgb(.96,.94,.87),white=rgb(1,1,1),line=rgb(.84,.84,.80),balanceFill=rgb(.95,.89,.70);
const clean=v=>String(v??'').trim();
const money=v=>`PKR ${Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
function dateLabel(v){if(!v)return'-';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,10):new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d)}
function fit(t,font,size,max){let s=clean(t);while(s.length>2&&font.widthOfTextAtSize(s,size)>max)s=s.slice(0,-2)+'…';return s}
function drawBrand(page,font,bold,title){page.drawRectangle({x:0,y:760,width:595,height:82,color:green});page.drawText('KT',{x:34,y:785,size:34,font:bold,color:gold});page.drawText('KASHIF TRADERS',{x:105,y:798,size:21,font:bold,color:white});page.drawText('TRADING & ACCOUNTS WORKSPACE',{x:105,y:778,size:9,font,color:white});page.drawText(title,{x:34,y:724,size:14,font:bold,color:green})}
function drawCell(page,text,x,y,w,font,size=7.2,color=ink,align='left'){const value=fit(text,font,size,w-8);const tw=font.widthOfTextAtSize(value,size);let tx=x+4;if(align==='right')tx=x+w-4-tw;page.drawText(value,{x:tx,y:y+7,size,font,color})}
function drawHeader(page,font,bold,party,summary,type){drawBrand(page,font,bold,`${type==='supplier'?'SUPPLIER':'CLIENT'} ACCOUNT STATEMENT`);page.drawText('ACCOUNT',{x:34,y:687,size:8,font:bold,color:muted});page.drawText(fit(party.business_name,bold,16,330),{x:34,y:662,size:16,font:bold,color:ink});page.drawRectangle({x:385,y:646,width:176,height:68,color:soft});[['Opening',summary.opening],['Bills',summary.billTotal],['Payments',summary.payTotal],['Balance',summary.balance]].forEach((a,i)=>{page.drawText(`${a[0]}: ${money(a[1])}`,{x:395,y:696-i*16,size:8,font:i===3?bold:font,color:i===3?green:ink})})}
function drawFooter(page,font,bold,pageNo,totalPages){page.drawLine({start:{x:34,y:70},end:{x:561,y:70},thickness:1,color:gold});page.drawText('Quality Products  |  Reliable Supply  |  Growing Together',{x:34,y:48,size:8,font:bold,color:green});page.drawText(`Page ${pageNo} of ${totalPages}`,{x:505,y:48,size:7,font,color:muted})}
function buildTransactions(data){const rows=[...data.bills.map(x=>({date:x.invoice_date,type:'Bill',ref:x.entry_number||x.invoice_number||'',debit:Number(x.amount||0),credit:0,id:Number(x.id||0)})),...data.pays.map(x=>({date:x.payment_date||x.receipt_date,type:'Payment',ref:x.reference_number||'',debit:0,credit:Number(x.amount||0),id:Number(x.id||0)}))];rows.sort((a,b)=>{const d=new Date(a.date||0)-new Date(b.date||0);return d||a.id-b.id});let running=Number(data.opening||0);return rows.map(r=>{running+=r.debit-r.credit;return{...r,balance:running}})}
export async function generateProfessionalPartyStatementPdf(sql,id,type='client'){
 const isSupplier=type==='supplier';
 const party=(await (isSupplier?sql`SELECT * FROM suppliers WHERE id=${id}`:sql`SELECT * FROM clients WHERE id=${id}`))[0];
 if(!party)throw Error('PARTY_NOT_FOUND');
 const bills=isSupplier?await sql`SELECT * FROM supplier_invoices WHERE supplier_id=${id} ORDER BY invoice_date,id`:await sql`SELECT * FROM client_invoices WHERE client_id=${id} ORDER BY invoice_date,id`;
 const pays=isSupplier?await sql`SELECT * FROM supplier_payments WHERE supplier_id=${id} ORDER BY payment_date,id`:await sql`SELECT * FROM client_receipts WHERE client_id=${id} ORDER BY receipt_date,id`;
 const opening=Number(party.opening_balance||0),billTotal=bills.reduce((s,x)=>s+Number(x.amount||0),0),payTotal=pays.reduce((s,x)=>s+Number(x.amount||0),0),balance=opening+billTotal-payTotal,tx=buildTransactions({bills,pays,opening});
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const perPage=18,totalPages=Math.max(1,Math.ceil(tx.length/perPage)),widths=[68,50,136,78,78,90],headers=['Date','Type','Reference','Debit','Credit','Balance'];
 for(let pageIndex=0;pageIndex<totalPages;pageIndex++){
  const page=pdf.addPage([595,842]);drawHeader(page,font,bold,party,{opening,billTotal,payTotal,balance},isSupplier?'supplier':'client');
  const slice=tx.slice(pageIndex*perPage,(pageIndex+1)*perPage),x0=34,tableW=500;let y=610;
  page.drawRectangle({x:x0,y,width:tableW,height:25,color:green});let xx=x0;headers.forEach((h,i)=>{drawCell(page,h,xx,y,widths[i],bold,7.5,white,i>=3?'right':'left');xx+=widths[i]});y-=23;
  if(!slice.length){page.drawRectangle({x:x0,y,width:tableW,height:32,borderColor:line,borderWidth:.6});page.drawText('No transactions yet',{x:44,y:y+11,size:8,font,color:muted});y-=32}
  for(const t of slice){page.drawRectangle({x:x0,y,width:tableW,height:23,borderColor:line,borderWidth:.6});xx=x0;drawCell(page,dateLabel(t.date),xx,y,widths[0],font);xx+=widths[0];drawCell(page,t.type,xx,y,widths[1],font);xx+=widths[1];drawCell(page,t.ref||'-',xx,y,widths[2],font);xx+=widths[2];drawCell(page,t.debit?money(t.debit):'-',xx,y,widths[3],font,7,ink,'right');xx+=widths[3];drawCell(page,t.credit?money(t.credit):'-',xx,y,widths[4],font,7,ink,'right');xx+=widths[4];drawCell(page,money(t.balance),xx,y,widths[5],bold,7.1,green,'right');y-=23}
  if(pageIndex===totalPages-1){const boxY=isSupplier?y-85:y-50;page.drawRectangle({x:34,y:boxY,width:500,height:40,color:balanceFill});page.drawText('CURRENT OUTSTANDING BALANCE',{x:48,y:boxY+14,size:10,font:bold,color:green});const bal=money(balance),bw=bold.widthOfTextAtSize(bal,12);page.drawText(bal,{x:520-bw,y:boxY+13,size:12,font:bold,color:green})}
  drawFooter(page,font,bold,pageIndex+1,totalPages);
 }
 const safe=clean(party.business_name).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||type;
 return{buffer:Buffer.from(await pdf.save()),filename:`Kashif-Traders-${safe}-Statement.pdf`,balance};
}
