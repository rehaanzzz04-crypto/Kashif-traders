import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// The Customer Credit statement uses only customer_credit_accounts and customer_credit_entries.
const DARK=rgb(.08,.24,.19), GOLD=rgb(.76,.60,.30), SOFT=rgb(.94,.96,.94), INK=rgb(.12,.18,.15);
const replace = value => String(value??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7e]/g,'?');
const amount = value => Number(value||0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
const when = value => {const s=String(value??'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'-'+s.slice(5,7)+'-'+s.slice(2):replace(s)};
const ellipsis=(s,font,size,max)=>{let out=replace(s);while(out.length&&font.widthOfTextAtSize(out,size)>max)out=out.slice(0,-1);return out};
const printDate=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}).format(new Date());
const write=(p,s,x,y,font,size=9,max=900,color=INK)=>p.drawText(ellipsis(s,font,size,max),{x,y,font,size,color});
const right=(p,s,x,y,font,size=9,color=INK)=>{const value=replace(s);write(p,value,x-font.widthOfTextAtSize(value,size),y,font,size,900,color)};
export function creditStatementData(entries,from='',to=''){
  let running=0,opening=0,bills=0,payments=0;
  const rows=[];
  for(const row of entries){
    const date=String(row.entry_date).slice(0,10);
    const value=Number(row.amount||0), delta=row.entry_type==='bill'?value:-value;
    if(from && date<from){running+=delta;opening+=delta;continue;}
    if(to && date>to)break;
    running+=delta;
    if(row.entry_type==='bill')bills+=value;else payments+=value;
    rows.push({...row,entry_date:date,amount:value,balance:running});
  }
  return {rows,opening,bills,payments,balance:opening+bills-payments};
}
export async function createCustomerCreditPdf(customer,data,{from='',to=''}={}){
  const pdf=await PDFDocument.create(),plain=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const width=595,height=842,left=37,rightEdge=width-left;
  let page,y,number=0;
  const head=()=>{
    page=pdf.addPage([width,height]);number++;
    page.drawRectangle({x:0,y:height-100,width,height:100,color:DARK});
    page.drawRectangle({x:0,y:height-104,width,height:4,color:GOLD});
    write(page,'KASHIF TRADERS',left,height-48,bold,23,430,rgb(1,1,1));
    write(page,'CUSTOMER CREDIT STATEMENT',left,height-72,plain,11,440,rgb(1,1,1));
    write(page,'CUSTOMER',left,height-135,bold,8,200,DARK);
    write(page,customer.name,left,height-156,bold,15,315,DARK);
    write(page,'Mobile: '+(customer.mobile||'-'),left,height-172,plain,9,370);
    right(page,'Period: '+(from||'Beginning')+' to '+(to||'Latest'),rightEdge,height-133,plain,9);
    right(page,'Printed: '+printDate(),rightEdge,height-150,plain,9);
    y=height-205;
    if(number===1){
      const labels=[['OPENING',data.opening],['CREDIT BILLS',data.bills],['PAYMENTS',data.payments],['BALANCE DUE',data.balance]];
      labels.forEach(([label,num],i)=>{
        const x=left+i*132;
        page.drawRectangle({x,y:y-61,width:124,height:61,color:i===3?rgb(.97,.91,.76):SOFT,borderColor:GOLD,borderWidth:.65});
        write(page,label,x+8,y-18,bold,8,110,DARK);
        write(page,'Rs '+amount(num),x+8,y-42,bold,11,113,INK);
      });
      y-=84;
    }
    page.drawRectangle({x:left,y:y-28,width:width-2*left,height:28,color:DARK});
    write(page,'DATE',left+7,y-18,bold,8,65,rgb(1,1,1));
    write(page,'REFERENCE / DETAILS',left+77,y-18,bold,8,194,rgb(1,1,1));
    write(page,'BILL',left+293,y-18,bold,8,49,rgb(1,1,1));
    write(page,'PAYMENT',left+358,y-18,bold,8,62,rgb(1,1,1));
    write(page,'BALANCE',left+445,y-18,bold,8,63,rgb(1,1,1));
    y-=30;
  };
  head();
  for(let i=0;i<data.rows.length;i++){
    if(y<95)head();
    const e=data.rows[i],isBill=e.entry_type==='bill';
    const reference=e.bill_no||(isBill?'BILL-':'PAY-')+e.id;
    if(i%2===0)page.drawRectangle({x:left,y:y-36,width:width-2*left,height:36,color:SOFT});
    write(page,when(e.entry_date),left+7,y-15,plain,8,64);
    write(page,reference,left+77,y-13,bold,8,192);
    write(page,(isBill?'Credit Bill':'Payment')+(e.notes?' - '+e.notes:e.payment_method?' - '+e.payment_method:''),left+77,y-27,plain,7.2,197);
    right(page,isBill?amount(e.amount):'-',left+344,y-20,plain,8);
    right(page,isBill?'-':amount(e.amount),left+423,y-20,plain,8);
    right(page,amount(e.balance),rightEdge-8,y-20,bold,8);
    y-=36;
  }
  if(y<145)head();
  page.drawRectangle({x:left,y:y-58,width:width-2*left,height:58,color:rgb(.97,.91,.76),borderColor:GOLD,borderWidth:1});
  write(page,data.balance<0?'CUSTOMER ADVANCE':'OUTSTANDING BALANCE',left+13,y-35,bold,12,287,DARK);
  right(page,'Rs '+amount(Math.abs(data.balance)),rightEdge-14,y-35,bold,16,DARK);
  for(const p of pdf.getPages()){
    p.drawLine({start:{x:left,y:50},end:{x:rightEdge,y:50},thickness:1,color:GOLD});
    write(p,'Kashif Traders | Independent Customer Credit records',left,34,plain,8,455);
  }
  return {buffer:Buffer.from(await pdf.save()),filename:'Customer-Credit-'+customer.id+'-Statement.pdf'};
}


export async function createCustomerCreditThermalPdf(customer,data,{from='',to=''}={}){
  const pdf=await PDFDocument.create(),plain=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const width=80*72/25.4,margin=10,perPage=18,pages=Math.max(1,Math.ceil(data.rows.length/perPage));
  for(let pageNo=0;pageNo<pages;pageNo++){
    const chunk=data.rows.slice(pageNo*perPage,(pageNo+1)*perPage);
    const height=234+chunk.length*33,p=pdf.addPage([width,height]),R=width-margin;
    let y=height-23;
    const center=(s,size,font)=>{const label=ellipsis(s,font,size,width-2*margin);write(p,label,(width-font.widthOfTextAtSize(label,size))/2,y,font,size);};
    const line=()=>p.drawLine({start:{x:margin,y},end:{x:R,y},thickness:.7,color:INK});
    center('KASHIF TRADERS',13,bold);y-=17;
    center('CUSTOMER CREDIT STATEMENT',8.4,bold);y-=12;line();y-=15;
    write(p,'CUSTOMER: '+customer.name,margin,y,bold,8.5,width-2*margin);y-=13;
    write(p,'MOBILE: '+(customer.mobile||'-'),margin,y,plain,7.8,width-2*margin);y-=13;
    write(p,'PERIOD: '+(from?when(from):'START')+' TO '+(to?when(to):'LATEST'),margin,y,plain,7.6,width-2*margin);y-=13;
    write(p,'PRINTED: '+printDate(),margin,y,plain,7.1,width-2*margin);y-=12;
    write(p,'PAGE '+(pageNo+1)+' / '+pages,margin,y,plain,7.5,width-2*margin);y-=9;line();y-=15;
    const total=(label,value,size=8)=>{
      write(p,label,margin,y,bold,size,112);
      right(p,'Rs '+amount(value),R,y,bold,size);y-=14;
    };
    total('OPENING',data.opening);total('CREDIT BILLS',data.bills);
    total('PAYMENTS',data.payments);y-=2;
    total(data.balance<0?'ADVANCE':'BALANCE DUE',Math.abs(data.balance),9);
    line();y-=14;
    for(const e of chunk){
      const bill=e.entry_type==='bill',ref=e.bill_no||(bill?'BILL-':'PAY-')+e.id;
      write(p,when(e.entry_date)+' '+(bill?'BILL':'PAY')+' '+ref,margin,y,bold,7.5,width-2*margin);y-=11;
      write(p,(bill?'DR ':'CR ')+amount(e.amount),margin,y,plain,7.9,102);
      right(p,'BAL '+amount(e.balance),R,y,bold,7.9);y-=12;
      write(p,e.notes||e.payment_method||' ',margin,y,plain,7,width-2*margin);y-=8;line();y-=5;
    }
    if(!chunk.length){write(p,'No transactions in selected period',margin,y,plain,8,width-2*margin);}
    write(p,pageNo+1===pages?'THANK YOU':'CONTINUED ON NEXT PAGE',margin,13,bold,8,width-2*margin);
  }
  return {buffer:Buffer.from(await pdf.save()),filename:'Customer-Credit-'+customer.id+'-80mm.pdf'};
}
