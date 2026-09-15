(() => {
  const $ = id => document.getElementById(id);
  const money = v => "PKR " + Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let bills = [], active = null, editing = false, status = "pending", busy = false;
  $("cashierBack").onclick = () => location.href = "/";
  const head = document.querySelector(".cashier-head");
  if (head) {
    const report = document.createElement("button");
    report.className = "cashier-report-link"; report.type = "button"; report.textContent = "▥ Sales Report";
    report.onclick = () => location.href = "/cashier-sales-report.html";
    head.appendChild(report);
    const style = document.createElement("style");
    style.textContent = ".cashier-report-link{margin-left:auto;border:0;border-radius:10px;background:var(--cs-green);color:#fff;padding:9px 12px;font-weight:800;cursor:pointer}@media(max-width:560px){.cashier-head{flex-wrap:wrap}.cashier-report-link{width:100%;margin-left:0;min-height:46px}}";
    document.head.appendChild(style);
  }
  const stamp = x => new Date(x).toLocaleString("en-PK", {day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"});
  const itemArray = x => Array.isArray(x?.items) ? x.items : JSON.parse(x?.items || "[]");
  function visibleBills() {
    const q = $("billSearch").value.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(x => [x.invoice_number,x.created_by_name,x.customer_name,x.sale_date].some(v => String(v||"").toLowerCase().includes(q)));
  }
  function renderList() {
    const rows = visibleBills(), list = $("cashierList");
    document.querySelector(".cs-sale-no b").textContent = bills.length;
    if ($("pendingCount")) $("pendingCount").textContent = status === "pending" ? bills.length : "";
    if (!rows.length) {
      list.innerHTML = '<div class="cs-empty"><b>No '+esc(status)+' bills</b>Is tab mein koi record nahi.</div>';
      return;
    }
    list.innerHTML = rows.map((x,i) => '<button data-id="'+x.id+'" type="button" class="'+(active?.id===x.id?"active":"")+'"><span><b>'+esc(x.invoice_number)+'</b><small>Created by '+esc(x.created_by_name)+' · '+stamp(x.created_at)+'</small></span><strong>'+money(x.total)+'</strong></button>').join("");
    list.querySelectorAll("[data-id]").forEach(b => b.onclick = () => selectBill(rows.find(x => String(x.id) === b.dataset.id)));
  }
  function clearDetail() {
    active = null; editing = false;
    $("cashierBillNo").textContent = "Select a bill"; $("cashierBillBy").textContent = ""; $("cashierBillAt").textContent = "";
    $("cashierItems").innerHTML = '<div class="cs-empty">Bill select karein.</div>';
    $("cashierDiscount").value = 0; $("cashierReceived").value = 0; $("cashierDue").textContent = money(0); $("cashierChange").textContent = money(0);
    setActions();
  }
  const paymentModal = $("cashierPaymentModal");
  function choosePayment(method) {
    $("cashierPaymentMethod").value = method;
    document.querySelectorAll("#cashierPaymentOptions [data-method]").forEach(button => button.classList.toggle("active", button.dataset.method === method));
  }
  function closePayment() { paymentModal.classList.add("cs-hidden"); }
  function openPayment() {
    if (!active || status !== "pending" || busy) return;
    const t = totals();
    $("cashierReceived").value = t.total;
    choosePayment(active.payment_method || "Cash");
    total();
    paymentModal.classList.remove("cs-hidden");
  }
  function selectBill(x) {
    if (!x) return clearDetail();
    active = x; editing = false; renderList();
    $("cashierBillNo").textContent = x.invoice_number;
    $("cashierBillBy").textContent = "Created by " + x.created_by_name;
    $("cashierBillAt").textContent = stamp(x.created_at);
    $("cashierItems").innerHTML = itemArray(x).map((p,i) => '<div data-price="'+Number(p.rate)*Number(p.qty)+'" data-qty="'+Number(p.qty)+'"><span>'+esc(p.name)+' — '+esc(p.qty)+' '+esc(p.unit||"pcs")+'</span><b>'+money(Number(p.rate)*Number(p.qty))+'</b><input class="cashier-rate" data-i="'+i+'" type="number" min="0" step="0.01" value="'+Number(p.rate)+'" readonly></div>').join("") || '<div class="cs-empty">No items</div>';
    $("cashierDiscount").value = Number(x.discount || 0);
    choosePayment(x.payment_method || "Cash");
    $("cashierReceived").value = Number(x.amount_received ?? x.total ?? 0);
    bindRates(); total(); setActions();
  }
  function bindRates() {
    document.querySelectorAll(".cashier-rate").forEach(input => input.oninput = () => {
      const row=input.closest("[data-price]"), q=Number(row.dataset.qty||1);
      row.dataset.price=String((Number(input.value)||0)*q); row.querySelector("b").textContent=money(row.dataset.price); total();
    });
  }
  function totals() {
    const subtotal=[...document.querySelectorAll("#cashierItems [data-price]")].reduce((n,row)=>n+Number(row.dataset.price||0),0);
    const discount=Math.min(subtotal,Math.max(0,Number($("cashierDiscount").value)||0));
    return {subtotal,discount,total:Math.max(0,subtotal-discount),received:Math.max(0,Number($("cashierReceived").value)||0)};
  }
  function total() {
    const t=totals(); $("cashierDue").textContent=money(t.total); $("cashierChange").textContent=money(Math.max(0,t.received-t.total));
    if(status==="pending") $("cashierPaid").disabled=!active||busy||t.received<t.total;
  }
  function currentItems() {
    const original=itemArray(active);
    return original.map((p,i)=>({...p,rate:Number(document.querySelector('.cashier-rate[data-i="'+i+'"]')?.value)||0}));
  }
  function setActions() {
    const pending=Boolean(active)&&status==="pending", paid=Boolean(active)&&status==="paid";
    $("cashierEdit").disabled=!pending||busy; $("cashierDiscount").readOnly=!pending||!editing;
    $("cashierReceived").readOnly=!pending;
    $("cashierPaid").disabled=!pending||busy; $("cashierCancelBill").disabled=!pending||busy;
    $("cashierPrint").disabled=!paid; $("cashierShare").disabled=!paid;
    document.querySelector(".cs-live").textContent=active?String(active.status||status).toUpperCase():status.toUpperCase();
  }
  $("cashierEdit").onclick=()=>{
    if(!active||status!=="pending")return; editing=!editing;
    document.querySelectorAll(".cashier-rate").forEach(x=>x.readOnly=!editing);
    $("cashierDiscount").readOnly=!editing;
    $("cashierEdit").textContent=editing?"✓ Finish Price Edit":"✎ Edit Invoice";
    $("cashierStatus").textContent=editing?"Cashier rate aur discount change kar sakta hai.":"Changes payment ke waqt save hongi.";
  };
  $("cashierDiscount").oninput=total; $("cashierReceived").oninput=total;
  async function updateBill(nextStatus) {
    if(!active||busy)return;
    const t=totals();
    if(nextStatus==="paid"&&t.received<t.total){$("cashierStatus").textContent="Complete received amount required hai.";return}
    if(nextStatus==="cancelled"&&!confirm("Cancel this invoice?"))return;
    busy=true;setActions();$("cashierStatus").textContent=nextStatus==="paid"?"Payment save ho rahi hai...":"Invoice cancel ho raha hai...";
    try{
      const response=await fetch("/api/data?resource=cash_sales&id="+active.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:nextStatus,items:currentItems(),discount:t.discount,payment_method:$("cashierPaymentMethod").value,amount_received:t.received})});
      const j=await response.json().catch(()=>({}));if(!response.ok)throw Error(j.error||"Invoice update failed");
      $("cashierStatus").textContent=nextStatus==="paid"?j.record.invoice_number+" paid ho gaya.":j.record.invoice_number+" cancelled.";
      closePayment();active=null;await load();
    }catch(e){$("cashierStatus").textContent=e.message}finally{busy=false;setActions()}
  }
  $("cashierPaid").onclick=openPayment;
  $("cashierPaymentClose").onclick=closePayment;
  $("cashierConfirmPaid").onclick=()=>updateBill("paid");
  document.querySelectorAll("#cashierPaymentOptions [data-method]").forEach(button=>button.onclick=()=>choosePayment(button.dataset.method));
  paymentModal.onclick=e=>{if(e.target===paymentModal)closePayment()};
  $("cashierCancelBill").onclick=()=>updateBill("cancelled");
  document.querySelectorAll(".cashier-tabs [data-status]").forEach(button=>button.onclick=()=>{
    status=button.dataset.status;document.querySelectorAll(".cashier-tabs button").forEach(x=>x.classList.toggle("active",x===button));active=null;load();
  });
  $("billSearchBtn").onclick=renderList; $("billSearch").oninput=renderList;
  function receiptLines(){
    if(!active)return[];const t=Number(active.total||0), lines=["KASHIF TRADERS","Cash Sale Receipt",active.invoice_number,"Date: "+stamp(active.paid_at||active.created_at),"Customer: "+(active.customer_name||"Walk-in Customer"),"Created by: "+active.created_by_name,"Paid by: "+(active.paid_by_name||""),"Payment: "+(active.payment_method||""),""];
    itemArray(active).forEach(p=>lines.push(p.name+" | "+p.qty+" "+(p.unit||"pcs")+" x "+Number(p.rate||0)+" = "+Number(p.qty||0)*Number(p.rate||0)));
    lines.push("","Subtotal: "+money(active.subtotal),"Discount: "+money(active.discount),"Total: "+money(t),"Received: "+money(active.amount_received),"Thank you");
    return lines;
  }
  function printReceipt(){
    const lines=receiptLines();if(!lines.length)return;const w=window.open("","_blank","width=500,height=720");if(!w){$("cashierStatus").textContent="Pop-ups allow karein.";return}
    w.document.write('<!doctype html><title>Receipt '+esc(active.invoice_number)+'</title><style>body{font:14px Arial;max-width:360px;margin:20px auto}.line{padding:5px 0;border-bottom:1px dashed #ccc}.line:first-child{font:bold 22px Georgia;text-align:center;border:0}</style>'+lines.map(x=>'<div class="line">'+esc(x||" ")+'</div>').join("")+'<script>onload=()=>print()<\/script>');w.document.close();
  }
  function pdfBlob(lines){
    const safe=s=>String(s).replace(/([\\()])/g,"\\$1").replace(/[^\x20-\x7E]/g,"?");
    const stream="BT /F1 11 Tf 45 800 Td "+lines.slice(0,42).map((l,i)=>(i?"0 -17 Td ":"")+"("+safe(l)+") Tj").join(" ")+" ET";
    const objs=["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj","2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj","3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj","4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj","5 0 obj << /Length "+stream.length+" >> stream\n"+stream+"\nendstream endobj"];
    let pdf="%PDF-1.4\n",off=[0];objs.forEach(o=>{off.push(pdf.length);pdf+=o+"\n"});const x=pdf.length;pdf+="xref\n0 6\n0000000000 65535 f \n"+off.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n"+x+"\n%%EOF";return new Blob([pdf],{type:"application/pdf"});
  }
  async function shareReceipt(){
    const blob=pdfBlob(receiptLines()),file=new File([blob],active.invoice_number+".pdf",{type:"application/pdf"});
    try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({files:[file],title:"Kashif Traders Receipt"});else{const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}}catch(e){if(e.name!=="AbortError")$("cashierStatus").textContent=e.message}
  }
  $("cashierPrint").onclick=printReceipt;$("cashierShare").onclick=shareReceipt;
  async function load(){
    if(editing)return;
    try{const response=await fetch("/api/data?resource=cash_sales&status="+status,{cache:"no-store"});if(response.status===401){location.replace("/login.html");return}const j=await response.json();if(!response.ok)throw Error(j.error||"Bills load nahi ho sakay");bills=j.records||[];renderList();if(!active&&bills[0])selectBill(bills[0]);else if(!bills.length)clearDetail();$("cashierStatus").textContent=bills.length?status+" bills updated.":"Is tab mein koi bill nahi."}catch(e){$("cashierStatus").textContent=e.message}
  }
  fetch("/api/auth?action=me",{cache:"no-store"}).then(r=>r.json()).then(j=>{const u=j?.user;if(u)$("cashierUser").textContent=(u.full_name||u.employee_code)+" · "+String(u.designation||"").toUpperCase()}).catch(()=>{});
  load();setInterval(load,10000);
})();
