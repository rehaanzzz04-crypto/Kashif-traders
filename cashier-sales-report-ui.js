'use strict';
(()=>{
  const $=id=>document.getElementById(id),money=v=>"PKR "+Number(v||0).toLocaleString("en-PK",{maximumFractionDigits:2}),esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let all=[],period="daily",shown=[];
  $("reportBack").onclick=()=>location.href="/cashier-sales.html";
  const startOf=(p)=>{
    const n=new Date(),d=new Date(n);
    if(p==="daily")d.setHours(0,0,0,0);
    if(p==="weekly"){const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0)}
    if(p==="monthly"){d.setDate(1);d.setHours(0,0,0,0)}
    if(p==="yearly"){d.setMonth(0,1);d.setHours(0,0,0,0)}
    return d;
  };
  function stamp(v){return new Date(v).toLocaleString("en-PK",{day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"})}
  function dateOnly(v){return new Date(v).toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"})}
  function rangeText(){const start=startOf(period),end=new Date(start);if(period==="daily")end.setHours(23,59,59,999);if(period==="weekly")end.setDate(end.getDate()+6);if(period==="monthly")end.setMonth(end.getMonth()+1,0);if(period==="yearly")end.setMonth(11,31);return (period==="daily"?dateOnly(start):dateOnly(start)+" — "+dateOnly(end))}

  const paymentPalette=["#31d18b","#d7ad4d","#6da8ff","#d86f6f","#a78bfa","#7dd3fc"];
  function paymentName(v){const s=String(v||"Unknown").trim();return s||"Unknown"}
  function salesMoment(x){return new Date(x.paid_at||x.updated_at||x.created_at)}
  function trendBuckets(){
    const start=startOf(period), buckets=[];
    if(period==="daily"){
      for(let h=8;h<=22;h++){const d=new Date(start);d.setHours(h,0,0,0);buckets.push({key:h,label:String(h%12||12).padStart(2,"0")+" "+(h<12?"AM":"PM"),start:d,end:new Date(d.getTime()+3600000),value:0})}
    }else if(period==="weekly"){
      for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const e=new Date(d);e.setDate(d.getDate()+1);buckets.push({label:d.toLocaleDateString("en-PK",{weekday:"short"}),start:d,end:e,value:0})}
    }else if(period==="monthly"){
      const y=start.getFullYear(),m=start.getMonth(),days=new Date(y,m+1,0).getDate();
      for(let day=1;day<=days;day++){const d=new Date(y,m,day);const e=new Date(y,m,day+1);buckets.push({label:String(day),start:d,end:e,value:0})}
    }else{
      const y=start.getFullYear();
      for(let m=0;m<12;m++){const d=new Date(y,m,1),e=new Date(y,m+1,1);buckets.push({label:d.toLocaleDateString("en-PK",{month:"short"}),start:d,end:e,value:0})}
    }
    shown.forEach(x=>{const t=salesMoment(x),b=buckets.find(z=>t>=z.start&&t<z.end);if(b)b.value+=Number(x.total||0)});
    return buckets;
  }
  function renderTrend(){
    const svg=$("trendChart"),empty=$("trendEmpty"),data=trendBuckets(),values=data.map(x=>x.value),max=Math.max(...values,0);
    $("trendRange").textContent={daily:"Today",weekly:"This Week",monthly:"This Month",yearly:"This Year"}[period];
    $("trendSub").textContent={daily:"Today's paid sales · real-time",weekly:"This week's paid sales",monthly:"This month's paid sales",yearly:"This year's paid sales"}[period];
    if(!max){svg.innerHTML="";empty.classList.remove("hidden");return}
    empty.classList.add("hidden");
    const W=1000,H=300,L=58,R=18,T=18,B=42,plotW=W-L-R,plotH=H-T-B;
    const pts=data.map((d,i)=>({x:L+(data.length===1?plotW/2:(i/(data.length-1))*plotW),y:T+plotH-(d.value/max)*plotH,...d}));
    const line=pts.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ");
    const area=line+" L "+pts[pts.length-1].x.toFixed(1)+" "+(T+plotH)+" L "+pts[0].x.toFixed(1)+" "+(T+plotH)+" Z";
    const grid=[0,.25,.5,.75,1].map(r=>{const y=T+plotH-r*plotH;return '<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="#ffffff18" stroke-width="1"/><text x="'+(L-10)+'" y="'+(y+4)+'" text-anchor="end" fill="#b9cec7" font-size="11">'+Math.round(max*r).toLocaleString("en-PK")+'</text>'}).join("");
    const step=Math.max(1,Math.ceil(data.length/10));
    const labels=pts.map((p,i)=>i%step===0?'<text x="'+p.x+'" y="'+(H-12)+'" text-anchor="middle" fill="#b9cec7" font-size="10">'+esc(p.label)+'</text>':"").join("");
    const dots=pts.filter(p=>p.value>0).map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#f5c65b" stroke="#fff7d6" stroke-width="2"><title>'+esc(p.label)+" · "+money(p.value)+'</title></circle>').join("");
    svg.innerHTML='<defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f3c45b" stop-opacity=".48"/><stop offset="100%" stop-color="#31d18b" stop-opacity=".04"/></linearGradient><filter id="salesGlow"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'+grid+'<path d="'+area+'" fill="url(#salesFill)"/><path d="'+line+'" fill="none" stroke="#f5c65b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#salesGlow)"/>'+dots+labels;
  }
  function renderPayments(){
    const groups=new Map();shown.forEach(x=>{const k=paymentName(x.payment_method);groups.set(k,(groups.get(k)||0)+Number(x.total||0))});
    const entries=[...groups.entries()].sort((a,b)=>b[1]-a[1]),total=entries.reduce((n,x)=>n+x[1],0),svg=$("paymentDonut");
    $("donutTotal").textContent=money(total);
    const r=82,cx=110,cy=110,circ=2*Math.PI*r;
    let offset=0;
    const segs=entries.length?entries.map(([name,value],i)=>{const frac=total?value/total:0,len=frac*circ,color=paymentPalette[i%paymentPalette.length],s='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="28" stroke-dasharray="'+len+' '+(circ-len)+'" stroke-dashoffset="'+(-offset)+'" stroke-linecap="butt"><title>'+esc(name)+" · "+money(value)+'</title></circle>';offset+=len;return s}).join(""):'<circle cx="110" cy="110" r="82" fill="none" stroke="#ffffff18" stroke-width="28"/>';
    svg.innerHTML=segs;
    $("paymentLegend").innerHTML=entries.length?entries.map(([name,value],i)=>{const pct=total?value/total*100:0;return '<div class="pay-row"><span class="pay-dot" style="background:'+paymentPalette[i%paymentPalette.length]+'"></span><span><b>'+esc(name)+'</b><small>'+money(value)+'</small></span><strong>'+pct.toFixed(1)+'%</strong></div>'}).join(""):'<div class="pay-row"><span class="pay-dot" style="background:#ffffff44"></span><span><b>No paid sales</b><small>Selected period</small></span><strong>0%</strong></div>';
  }
  function renderAnalytics(){renderTrend();renderPayments();const t=new Date();const label="Last update: "+t.toLocaleTimeString("en-PK",{hour:"numeric",minute:"2-digit"});$("reportLastUpdate").textContent=label;$("trendUpdated").textContent="Updated "+t.toLocaleTimeString("en-PK",{hour:"numeric",minute:"2-digit"})}
  function render(){
    const start=startOf(period);shown=all.filter(x=>new Date(x.paid_at||x.updated_at||x.created_at)>=start);
    const total=shown.reduce((n,x)=>n+Number(x.total||0),0),discount=shown.reduce((n,x)=>n+Number(x.discount||0),0);
    const cash=shown.filter(x=>String(x.payment_method).toLowerCase()==="cash"),bank=shown.filter(x=>String(x.payment_method).toLowerCase()!=="cash");
    $("reportRange").textContent={daily:"Daily",weekly:"Weekly",monthly:"Monthly",yearly:"Yearly"}[period]+" Statement · "+rangeText();
    $("reportPeriodTitle").textContent={daily:"Daily",weekly:"Weekly",monthly:"Monthly",yearly:"Yearly"}[period]+" Paid Sales";
    $("reportSales").textContent=money(total);$("reportCash").textContent=money(cash.reduce((n,x)=>n+Number(x.total||0),0));$("reportBank").textContent=money(bank.reduce((n,x)=>n+Number(x.total||0),0));$("reportDiscount").textContent=money(discount);
    $("reportInvoiceCount").textContent=shown.length+" paid invoices";$("reportCashCount").textContent=cash.length+" cash invoices";$("reportBankCount").textContent=bank.length+" bank invoices";
    $("reportRows").innerHTML=shown.length?shown.map(x=>'<tr><td><b>'+esc(x.invoice_number)+'</b></td><td>'+stamp(x.paid_at||x.updated_at)+'</td><td>'+esc(x.created_by_name)+'</td><td>'+esc(x.paid_by_name||"—")+'</td><td><span>'+esc(x.payment_method||"—")+'</span></td><td>'+money(x.discount)+'</td><td><b>'+money(x.total)+'</b></td></tr>').join(""):'<tr><td colspan="7">No paid sales in this period</td></tr>';
    renderAnalytics();
  }
  document.querySelectorAll("[data-period]").forEach(button=>button.onclick=()=>{period=button.dataset.period;document.querySelectorAll("[data-period]").forEach(x=>x.classList.toggle("active",x===button));render()});
  function lines(){return ["KASHIF TRADERS","Cash Sales Report",$("reportRange").textContent,"","Invoices: "+shown.length,"Total Sales: "+$("reportSales").textContent,"Cash: "+$("reportCash").textContent,"Bank: "+$("reportBank").textContent,"Discount: "+$("reportDiscount").textContent,""].concat(shown.map(x=>x.invoice_number+" | "+stamp(x.paid_at||x.updated_at)+" | "+(x.payment_method||"")+" | "+money(x.total)))}
  function pdfBlob(ls){const safe=s=>String(s).replace(/([\\()])/g,"\\$1").replace(/[^\x20-\x7E]/g,"?"),stream="BT /F1 10 Tf 40 800 Td "+ls.slice(0,44).map((l,i)=>(i?"0 -16 Td ":"")+"("+safe(l)+") Tj").join(" ")+" ET",objs=["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj","2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj","3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj","4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj","5 0 obj << /Length "+stream.length+" >> stream\n"+stream+"\nendstream endobj"];let pdf="%PDF-1.4\n",off=[0];objs.forEach(o=>{off.push(pdf.length);pdf+=o+"\n"});const x=pdf.length;pdf+="xref\n0 6\n0000000000 65535 f \n"+off.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n"+x+"\n%%EOF";return new Blob([pdf],{type:"application/pdf"})}
  function printStatement(){
    const total=shown.reduce((n,x)=>n+Number(x.total||0),0),discount=shown.reduce((n,x)=>n+Number(x.discount||0),0),cash=shown.filter(x=>String(x.payment_method).toLowerCase()==="cash").reduce((n,x)=>n+Number(x.total||0),0),other=total-cash;
    const rows=shown.length?shown.map(x=>'<tr><td>'+esc(x.invoice_number)+'</td><td>'+esc(stamp(x.paid_at||x.updated_at))+'</td><td>'+esc(x.created_by_name||"—")+'</td><td>'+esc(x.paid_by_name||"—")+'</td><td>'+esc(x.payment_method||"—")+'</td><td class="num">'+esc(money(x.discount))+'</td><td class="num"><b>'+esc(money(x.total))+'</b></td></tr>').join(''):'<tr><td colspan="7" class="empty">No paid sales in this period</td></tr>';
    const w=window.open("","_blank","width=1000,height=760");if(!w){alert("Pop-ups allow karein.");return}
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc($("reportRange").textContent)+'</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#18211d;font:12px Arial,sans-serif}header{text-align:center;border-bottom:3px solid #173f35;padding-bottom:10px}h1{margin:0;color:#173f35;font:700 25px Georgia,serif}header p{margin:5px 0 0}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:14px 0}.summary div{border:1px solid #d8d8d8;border-top:3px solid #b89246;border-radius:6px;padding:9px}.summary small,.summary b{display:block}.summary b{margin-top:5px;color:#173f35;font-size:14px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #d8d8d8;text-align:left}th{background:#173f35;color:#fff;font-size:10px}.num{text-align:right;white-space:nowrap}.empty{text-align:center;padding:24px}footer{margin-top:10px;text-align:right;color:#66736d;font-size:10px}</style></head><body><header><h1>KASHIF TRADERS</h1><b>Cash Sales Statement</b><p>'+esc($("reportRange").textContent)+'</p></header><section class="summary"><div><small>Paid Invoices</small><b>'+shown.length+'</b></div><div><small>Total Sales</small><b>'+esc(money(total))+'</b></div><div><small>Cash Received</small><b>'+esc(money(cash))+'</b></div><div><small>Other Payments</small><b>'+esc(money(other))+'</b></div><div><small>Discount Given</small><b>'+esc(money(discount))+'</b></div></section><table><thead><tr><th>Invoice</th><th>Date & Time</th><th>Created By</th><th>Paid By</th><th>Payment</th><th>Discount</th><th>Total</th></tr></thead><tbody>'+rows+'</tbody></table><footer>Printed: '+esc(stamp(new Date()))+'</footer><script>onload=()=>{print()}<\/script></body></html>');w.document.close();
  }
  $("reportPrint").onclick=printStatement;
  $("reportShare").onclick=async()=>{const blob=pdfBlob(lines()),file=new File([blob],"Kashif-Traders-"+period+"-sales.pdf",{type:"application/pdf"});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({files:[file],title:"Kashif Traders Sales Report"});else{const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}}catch(e){if(e.name!=="AbortError")alert(e.message)}};
  async function load(){const response=await fetch("/api/data?resource=cash_sales&status=paid&limit=1000",{cache:"no-store"});if(response.status===401){location.replace("/login.html");return}const j=await response.json().catch(()=>({}));if(!response.ok)throw Error(j.error||"Report load failed");all=j.records||[];render()}
  load().catch(e=>$("reportRows").innerHTML='<tr><td colspan="7">'+esc(e.message)+'</td></tr>');setInterval(()=>load().catch(()=>{}),15000);
})();
