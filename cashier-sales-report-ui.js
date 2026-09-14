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
  function render(){
    const start=startOf(period);shown=all.filter(x=>new Date(x.paid_at||x.updated_at||x.created_at)>=start);
    const total=shown.reduce((n,x)=>n+Number(x.total||0),0),discount=shown.reduce((n,x)=>n+Number(x.discount||0),0);
    const cash=shown.filter(x=>String(x.payment_method).toLowerCase()==="cash"),bank=shown.filter(x=>String(x.payment_method).toLowerCase()!=="cash");
    $("reportRange").textContent={daily:"Today",weekly:"This Week",monthly:"This Month",yearly:"This Year"}[period]+" · "+new Date().toLocaleDateString("en-PK");
    $("reportSales").textContent=money(total);$("reportCash").textContent=money(cash.reduce((n,x)=>n+Number(x.total||0),0));$("reportBank").textContent=money(bank.reduce((n,x)=>n+Number(x.total||0),0));$("reportDiscount").textContent=money(discount);
    $("reportInvoiceCount").textContent=shown.length+" paid invoices";$("reportCashCount").textContent=cash.length+" cash invoices";$("reportBankCount").textContent=bank.length+" bank invoices";
    $("reportRows").innerHTML=shown.length?shown.map(x=>'<tr><td><b>'+esc(x.invoice_number)+'</b></td><td>'+stamp(x.paid_at||x.updated_at)+'</td><td>'+esc(x.created_by_name)+'</td><td>'+esc(x.paid_by_name||"—")+'</td><td><span>'+esc(x.payment_method||"—")+'</span></td><td>'+money(x.discount)+'</td><td><b>'+money(x.total)+'</b></td></tr>').join(""):'<tr><td colspan="7">No paid sales in this period</td></tr>';
  }
  document.querySelectorAll("[data-period]").forEach(button=>button.onclick=()=>{period=button.dataset.period;document.querySelectorAll("[data-period]").forEach(x=>x.classList.toggle("active",x===button));render()});
  function lines(){return ["KASHIF TRADERS","Cash Sales Report",$("reportRange").textContent,"","Invoices: "+shown.length,"Total Sales: "+$("reportSales").textContent,"Cash: "+$("reportCash").textContent,"Bank: "+$("reportBank").textContent,"Discount: "+$("reportDiscount").textContent,""].concat(shown.map(x=>x.invoice_number+" | "+stamp(x.paid_at||x.updated_at)+" | "+(x.payment_method||"")+" | "+money(x.total)))}
  function pdfBlob(ls){const safe=s=>String(s).replace(/([\\()])/g,"\\$1").replace(/[^\x20-\x7E]/g,"?"),stream="BT /F1 10 Tf 40 800 Td "+ls.slice(0,44).map((l,i)=>(i?"0 -16 Td ":"")+"("+safe(l)+") Tj").join(" ")+" ET",objs=["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj","2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj","3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj","4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj","5 0 obj << /Length "+stream.length+" >> stream\n"+stream+"\nendstream endobj"];let pdf="%PDF-1.4\n",off=[0];objs.forEach(o=>{off.push(pdf.length);pdf+=o+"\n"});const x=pdf.length;pdf+="xref\n0 6\n0000000000 65535 f \n"+off.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n"+x+"\n%%EOF";return new Blob([pdf],{type:"application/pdf"})}
  $("reportPrint").onclick=()=>window.print();
  $("reportShare").onclick=async()=>{const blob=pdfBlob(lines()),file=new File([blob],"Kashif-Traders-"+period+"-sales.pdf",{type:"application/pdf"});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({files:[file],title:"Kashif Traders Sales Report"});else{const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}}catch(e){if(e.name!=="AbortError")alert(e.message)}};
  async function load(){const response=await fetch("/api/data?resource=cash_sales&status=paid&limit=1000",{cache:"no-store"});if(response.status===401){location.replace("/login.html");return}const j=await response.json().catch(()=>({}));if(!response.ok)throw Error(j.error||"Report load failed");all=j.records||[];render()}
  load().catch(e=>$("reportRows").innerHTML='<tr><td colspan="7">'+esc(e.message)+'</td></tr>');setInterval(()=>load().catch(()=>{}),15000);
})();