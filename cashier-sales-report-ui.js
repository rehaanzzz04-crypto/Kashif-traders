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
  function render(){
    const start=startOf(period);shown=all.filter(x=>new Date(x.paid_at||x.updated_at||x.created_at)>=start);
    const total=shown.reduce((n,x)=>n+Number(x.total||0),0),discount=shown.reduce((n,x)=>n+Number(x.discount||0),0);
    const cash=shown.filter(x=>String(x.payment_method).toLowerCase()==="cash"),bank=shown.filter(x=>String(x.payment_method).toLowerCase()!=="cash");
    $("reportRange").textContent={daily:"Daily",weekly:"Weekly",monthly:"Monthly",yearly:"Yearly"}[period]+" Statement · "+rangeText();
    $("reportPeriodTitle").textContent={daily:"Daily",weekly:"Weekly",monthly:"Monthly",yearly:"Yearly"}[period]+" Paid Sales";
    $("reportSales").textContent=money(total);$("reportCash").textContent=money(cash.reduce((n,x)=>n+Number(x.total||0),0));$("reportBank").textContent=money(bank.reduce((n,x)=>n+Number(x.total||0),0));$("reportDiscount").textContent=money(discount);
    $("reportInvoiceCount").textContent=shown.length+" paid invoices";$("reportCashCount").textContent=cash.length+" cash invoices";$("reportBankCount").textContent=bank.length+" bank invoices";
    $("reportRows").innerHTML=shown.length?shown.map(x=>'<tr><td><b>'+esc(x.invoice_number)+'</b></td><td>'+stamp(x.paid_at||x.updated_at)+'</td><td>'+esc(x.created_by_name)+'</td><td>'+esc(x.paid_by_name||"—")+'</td><td><span>'+esc(x.payment_method||"—")+'</span></td><td>'+money(x.discount)+'</td><td><b>'+money(x.total)+'</b></td></tr>').join(""):'<tr><td colspan="7">No paid sales in this period</td></tr>';
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
