import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W=595.28,PAGE_H=841.89,M=36,CONTENT_W=PAGE_W-M*2;
const green=rgb(.03,.29,.23),gold=rgb(.78,.59,.18),ink=rgb(.08,.12,.11),muted=rgb(.38,.42,.40),line=rgb(.84,.84,.80),soft=rgb(.96,.94,.87),white=rgb(1,1,1),dangerSoft=rgb(.99,.94,.91);
const clean=v=>String(v??'').trim();
const num=v=>Number(v||0);
const dateOnly=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?clean(v).slice(0,10):new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d)};
const dateTime=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?clean(v):new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Karachi'}).format(d)+' PKT'};
const amount=v=>'PKR '+num(v).toLocaleString('en-PK',{maximumFractionDigits:2});
const auditLabel=t=>t==='180_day'?'180-Day':t==='daily'?'Daily':'Monthly';
const findingLabel=c=>({
  GRN_PENDING:'GRN Pending / Partial',
  ZERO_SUPPLIER_ITEM_COST:'Supplier Item Zero Cost',
  ZERO_LEDGER_COST:'Inventory Ledger Zero Cost',
  ZERO_ADJUSTMENT_COST:'Stock Adjustment Zero Cost'
}[c]||clean(c||'Finding').replaceAll('_',' '));

function wrap(text,font,size,maxWidth,maxLines=3){
  const source=clean(text)||'—',words=source.split(/\s+/),lines=[];let current='';
  const pushWord=w=>{if(font.widthOfTextAtSize(w,size)<=maxWidth)return w;let out='',rest=w;while(rest){let part='';for(const ch of rest){if(font.widthOfTextAtSize(part+ch,size)>maxWidth)break;part+=ch}if(!part)part=rest[0];if(out)lines.push(out);out=part;rest=rest.slice(part.length)}return out};
  for(const raw of words){
    let w=raw;if(font.widthOfTextAtSize(w,size)>maxWidth)w=pushWord(w);
    const next=current?current+' '+w:w;
    if(font.widthOfTextAtSize(next,size)<=maxWidth)current=next;
    else{if(current)lines.push(current);current=w}
    if(lines.length>=maxLines)break;
  }
  if(current&&lines.length<maxLines)lines.push(current);
  if(lines.length===maxLines){
    let last=lines[maxLines-1];
    while(last.length>1&&font.widthOfTextAtSize(last+'…',size)>maxWidth)last=last.slice(0,-1);
    if(source!==lines.join(' '))lines[maxLines-1]=last+'…';
  }
  return lines.length?lines:['—'];
}

function columnPlan(code,records){
  const plans={
    GRN_PENDING:[
      ['invoice_number','Invoice',78],['supplier','Supplier',128],['invoice_date','Date',66],
      ['ordered_qty','Ordered',62],['received_qty','Received',62],['grn_status','Status',70]
    ],
    ZERO_SUPPLIER_ITEM_COST:[
      ['supplier_invoice_id','Bill ID',58],['product_name','Product',175],['quantity','Qty',58],
      ['unit_price','Unit Cost',82],['line_total','Line Total',92]
    ],
    ZERO_LEDGER_COST:[
      ['reference_no','Reference',82],['product_name','Product',145],['movement_type','Movement',88],
      ['quantity','Qty',52],['unit_cost','Unit Cost',62],['movement_date','Date',72]
    ],
    ZERO_ADJUSTMENT_COST:[
      ['adjustment_number','Adjustment',86],['product_name','Product',142],['quantity','Qty',52],
      ['unit_cost','Unit Cost',62],['reason','Reason',112],['adjustment_date','Date',70]
    ]
  };
  if(plans[code])return plans[code];
  const keys=[...new Set((records||[]).flatMap(r=>Object.keys(r||{})))].slice(0,6);
  const w=Math.floor(CONTENT_W/Math.max(1,keys.length));
  return keys.map(k=>[k,k.replaceAll('_',' '),w]);
}

function displayValue(key,v){
  if(v===null||v===undefined||v==='')return'—';
  if(/date|_at$/.test(key))return dateOnly(v);
  if(['unit_price','line_total','unit_cost','amount','total'].includes(key))return num(v).toLocaleString('en-PK',{maximumFractionDigits:2});
  return clean(v);
}

export async function generateErpAuditReportPdf(sql, reportId){
  const rows=await sql`SELECT id,audit_type,period_start,period_end,generated_at,generated_by,summary,findings FROM erp_audit_reports WHERE id=${reportId}`;
  const report=rows[0];if(!report)throw Object.assign(new Error('Audit report not found'),{statusCode:404});
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Kashif Traders ERP Audit - ${auditLabel(report.audit_type)}`);
  pdf.setAuthor('Kashif Traders ERP');
  pdf.setSubject('Read-only ERP Audit Center report');
  let page=null,y=0;

  const addPage=()=>{
    page=pdf.addPage([PAGE_W,PAGE_H]);
    page.drawRectangle({x:0,y:PAGE_H-92,width:PAGE_W,height:92,color:green});
    page.drawText('KT',{x:M,y:PAGE_H-55,size:30,font:bold,color:gold});
    page.drawText('KASHIF TRADERS',{x:M+68,y:PAGE_H-44,size:20,font:bold,color:white});
    page.drawText('ERP AUDIT CENTER',{x:M+68,y:PAGE_H-64,size:9,font:bold,color:white});
    page.drawText(auditLabel(report.audit_type)+' AUDIT REPORT',{x:M,y:PAGE_H-118,size:15,font:bold,color:green});
    page.drawLine({start:{x:M,y:PAGE_H-126},end:{x:PAGE_W-M,y:PAGE_H-126},thickness:1.2,color:gold});
    y=PAGE_H-146;
  };
  const need=h=>{if(!page||y-h<58)addPage()};
  const text=(t,x,size=9,f=font,color=ink)=>page.drawText(clean(t)||'—',{x,y,size,font:f,color});
  const smallLabel=(label,value,x,w)=>{
    page.drawRectangle({x,y:y-42,width:w,height:42,color:soft,borderColor:line,borderWidth:.6});
    page.drawText(label,{x:x+10,y:y-14,size:7.5,font:bold,color:muted});
    const vals=wrap(value,bold,10,w-20,2);vals.forEach((v,i)=>page.drawText(v,{x:x+10,y:y-29-i*11,size:10,font:bold,color:ink}));
  };

  addPage();
  page.drawText('Audit Snapshot',{x:M,y,size:11,font:bold,color:green});
  y-=16;
  const meta=[
    ['Report ID','#'+report.id],['Audit Type',auditLabel(report.audit_type)],
    ['Period',dateOnly(report.period_start)+' — '+dateOnly(report.period_end)],
    ['Generated',dateTime(report.generated_at)],['Generated By',report.generated_by||'—']
  ];
  const leftW=252,rightW=252,gap=19;
  for(let i=0;i<meta.length;i+=2){
    need(52);smallLabel(meta[i][0],meta[i][1],M,leftW);
    if(meta[i+1])smallLabel(meta[i+1][0],meta[i+1][1],M+leftW+gap,rightW);
    y-=50;
  }
  y-=6;

  const s=report.summary||{};
  need(48);page.drawText('Executive Summary',{x:M,y,size:11,font:bold,color:green});y-=18;
  const cards=[
    ['Supplier Bills',s.supplier_bills?.count??0,s.supplier_bills?.total],
    ['Supplier Payments',s.supplier_payments?.count??0,s.supplier_payments?.total],
    ['Client Bills',s.client_bills?.count??0,s.client_bills?.total],
    ['Client Payments',s.client_payments?.count??0,s.client_payments?.total],
    ['GRN Pending',s.grn?.pending??0,null]
  ];
  const cardW=(CONTENT_W-16)/3;
  cards.forEach((c,i)=>{
    if(i===3){y-=62}
    const row=i<3?0:1,col=i<3?i:i-3,x=M+col*(cardW+8),yy=y;
    page.drawRectangle({x,y:yy-54,width:cardW,height:54,color:white,borderColor:line,borderWidth:.8});
    page.drawText(c[0],{x:x+10,y:yy-16,size:7.5,font:bold,color:muted});
    page.drawText(String(c[1]),{x:x+10,y:yy-36,size:16,font:bold,color:green});
    if(c[2]!==null&&c[2]!==undefined){
      const a=amount(c[2]);page.drawText(a,{x:x+48,y:yy-34,size:7.5,font,color:ink});
    }
  });
  y-=62;

  const findings=Array.isArray(report.findings)?report.findings:[];
  need(70);page.drawText('Audit Findings',{x:M,y,size:11,font:bold,color:green});y-=18;
  if(!findings.length){
    page.drawRectangle({x:M,y:y-42,width:CONTENT_W,height:42,color:soft});
    page.drawText('No audit findings recorded in this snapshot.',{x:M+12,y:y-25,size:10,font:bold,color:green});y-=54;
  }else{
    for(const f of findings){
      need(42);
      page.drawRectangle({x:M,y:y-32,width:CONTENT_W,height:32,color:dangerSoft,borderColor:line,borderWidth:.5});
      page.drawText(findingLabel(f.code),{x:M+10,y:y-13,size:9,font:bold,color:ink});
      const count='Records: '+num(f.count);const cw=bold.widthOfTextAtSize(count,8.5);
      page.drawText(count,{x:PAGE_W-M-10-cw,y:y-13,size:8.5,font:bold,color:green});
      const msg=wrap(f.message,font,7.5,CONTENT_W-20,1)[0];page.drawText(msg,{x:M+10,y:y-26,size:7.5,font,color:muted});
      y-=38;
    }
  }
  y-=4;

  for(const f of findings){
    const records=Array.isArray(f.records)?f.records:[];
    need(86);
    page.drawText(findingLabel(f.code),{x:M,y,size:12,font:bold,color:green});y-=15;
    page.drawText('Finding code: '+clean(f.code)+'   •   Total affected: '+num(f.count),{x:M,y,size:8,font:bold,color:muted});y-=13;
    const msgLines=wrap(f.message,font,8.5,CONTENT_W,2);msgLines.forEach(l=>{page.drawText(l,{x:M,y,size:8.5,font,color:ink});y-=11});
    if(num(f.count)>records.length){page.drawText('Detail snapshot contains first '+records.length+' affected record(s).',{x:M,y,size:7.5,font,color:muted});y-=11}
    y-=5;
    if(!records.length){page.drawText('No affected record details stored in this audit snapshot.',{x:M,y,size:8.5,font,color:muted});y-=22;continue}

    const cols=columnPlan(f.code,records),headerH=22;
    const drawHeader=()=>{
      need(headerH+24);
      page.drawRectangle({x:M,y:y-headerH,width:CONTENT_W,height:headerH,color:green});
      let x=M;
      for(const [key,label,w] of cols){page.drawText(String(label).toUpperCase(),{x:x+5,y:y-14,size:6.4,font:bold,color:white});x+=w}
      y-=headerH;
    };
    drawHeader();
    for(let ri=0;ri<records.length;ri++){
      const r=records[ri],cellLines=cols.map(([key,label,w])=>wrap(displayValue(key,r?.[key]),font,7,w-10,2)),maxLines=Math.max(...cellLines.map(a=>a.length)),rowH=Math.max(20,8+maxLines*9);
      if(y-rowH<58){addPage();page.drawText(findingLabel(f.code)+' — continued',{x:M,y,size:10,font:bold,color:green});y-=18;drawHeader()}
      if(ri%2===1)page.drawRectangle({x:M,y:y-rowH,width:CONTENT_W,height:rowH,color:soft});
      let x=M;
      cols.forEach(([key,label,w],ci)=>{page.drawLine({start:{x,y},end:{x,y:y-rowH},thickness:.35,color:line});cellLines[ci].forEach((v,li)=>page.drawText(v,{x:x+5,y:y-12-li*9,size:7,font,color:ink}));x+=w});
      page.drawLine({start:{x:M+CONTENT_W,y},end:{x:M+CONTENT_W,y:y-rowH},thickness:.35,color:line});
      page.drawLine({start:{x:M,y:y-rowH},end:{x:M+CONTENT_W,y:y-rowH},thickness:.35,color:line});
      y-=rowH;
    }
    y-=18;
  }

  const pages=pdf.getPages();
  pages.forEach((p,i)=>{
    p.drawLine({start:{x:M,y:44},end:{x:PAGE_W-M,y:44},thickness:.8,color:gold});
    p.drawText('Kashif Traders ERP • Read-only audit snapshot',{x:M,y:28,size:7.3,font:bold,color:green});
    const pg=`Page ${i+1} of ${pages.length}  •  Report #${report.id}`,w=font.widthOfTextAtSize(pg,7.3);
    p.drawText(pg,{x:PAGE_W-M-w,y:28,size:7.3,font,color:muted});
  });

  const buffer=Buffer.from(await pdf.save());
  const filename=`Kashif-Traders-ERP-Audit-${auditLabel(report.audit_type).replace(/[^A-Za-z0-9]+/g,'-')}-${dateOnly(report.period_end).replace(/\s+/g,'-')}-Report-${report.id}.pdf`;
  return {buffer,filename,report};
}
