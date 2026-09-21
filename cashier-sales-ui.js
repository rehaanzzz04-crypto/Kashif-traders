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
    style.textContent = ".cashier-report-link{border:0;border-radius:10px;background:var(--cs-green);color:#fff;padding:9px 12px;font-weight:800;cursor:pointer}.cashier-head>div:first-child+.cashier-report-link{margin-left:auto}@media(max-width:560px){.cashier-head{flex-wrap:wrap}.cashier-report-link{width:100%;margin-left:0!important;min-height:46px}}";
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
  const thermalMoney = v => Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
  const qtyText = v => Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 3 });
  function receiptData(){
    if(!active)return null;
    const items=itemArray(active).map(p=>({
      name:String(p.name||"Item"),
      qty:Number(p.qty||0),
      unit:String(p.unit||"pcs"),
      rate:Number(p.rate||0),
      amount:Number(p.qty||0)*Number(p.rate||0)
    }));
    const itemSubtotal=items.reduce((n,p)=>n+p.amount,0);
    const subtotal=Number(active.subtotal ?? itemSubtotal);
    const discount=Math.max(0,Number(active.discount||0));
    const total=Number(active.total ?? Math.max(0,subtotal-discount));
    const received=Math.max(0,Number(active.amount_received ?? total));
    const due=Math.max(0,total-received);
    return {
      invoice:String(active.invoice_number||""),
      date:stamp(active.paid_at||active.created_at),
      customer:String(active.customer_name||"Walk-in Customer"),
      createdBy:String(active.created_by_name||""),
      paidBy:String(active.paid_by_name||active.created_by_name||""),
      payment:String(active.payment_method||""),
      items,subtotal,discount,total,received,due,
      status:due<=0?"Paid":received>0?"Partially Paid":"Credit"
    };
  }
  function receiptMarkup(){
    const d=receiptData();if(!d)return"";
    const rows=d.items.map(p=>'<tr><td class="item-name">'+esc(p.name)+(p.unit?'<small>'+esc(qtyText(p.qty)+" "+p.unit)+'</small>':"")+'</td><td>'+esc(qtyText(p.qty))+'</td><td>'+esc(thermalMoney(p.rate))+'</td><td>'+esc(thermalMoney(p.amount))+'</td></tr>').join("");
    const credit=d.due>0?'<div class="sum"><span>Remaining / Due</span><b>PKR '+esc(thermalMoney(d.due))+'</b></div><div class="sum"><span>Status</span><b>'+esc(d.status)+'</b></div>':"";
    return '<main class="receipt"><header><h1>KASHIF TRADERS</h1><div>Cash Sale Receipt</div></header><div class="dash"></div>'+
      '<section class="info"><div><span>Receipt No</span><b>'+esc(d.invoice)+'</b></div><div><span>Date</span><b>'+esc(d.date)+'</b></div><div><span>Customer</span><b>'+esc(d.customer)+'</b></div><div><span>Created by</span><b>'+esc(d.createdBy)+'</b></div><div><span>Paid by</span><b>'+esc(d.paidBy)+'</b></div><div><span>Payment</span><b>'+esc(d.payment)+'</b></div></section>'+
      '<div class="dash"></div><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="dash"></div><section class="totals"><div class="sum"><span>Subtotal</span><b>PKR '+esc(thermalMoney(d.subtotal))+'</b></div><div class="sum"><span>Discount</span><b>PKR '+esc(thermalMoney(d.discount))+'</b></div><div class="sum grand"><span>Total</span><b>PKR '+esc(thermalMoney(d.total))+'</b></div><div class="sum"><span>Received</span><b>PKR '+esc(thermalMoney(d.received))+'</b></div>'+credit+'</section>'+
      '<div class="dash"></div><footer>Thank you.</footer></main>';
  }
  function receiptDocument(){
    return '<!doctype html><html><head><meta charset="utf-8"><title>Receipt '+esc(active?.invoice_number||"")+'</title><style>'+
      '@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}body{width:80mm;margin:0 auto;font-family:"Courier New",Courier,monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}.receipt{width:72mm;margin:0 auto;padding:5mm 1.5mm 7mm;font-size:10.5px;line-height:1.35}header{text-align:center}h1{margin:0;font-size:19px;line-height:1.1;font-weight:900;letter-spacing:.2px}header div{margin-top:3px;font-size:11px}.dash{border-top:1px dashed #000;margin:8px 0}.info{display:grid;gap:3px}.info div{display:grid;grid-template-columns:25mm 1fr;gap:2mm}.info span{white-space:nowrap}.info b{font-weight:600;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5px}th,td{padding:3px 1px;vertical-align:top;text-align:right}th{font-weight:900;border-bottom:1px dashed #000}th:first-child,td:first-child{text-align:left;width:46%}th:nth-child(2),td:nth-child(2){width:12%}th:nth-child(3),td:nth-child(3){width:19%}th:nth-child(4),td:nth-child(4){width:23%}.item-name{font-weight:700;overflow-wrap:anywhere}.item-name small{display:block;font-weight:400;font-size:8.5px;margin-top:1px}.totals{margin-left:auto;width:68%}.sum{display:flex;justify-content:space-between;gap:6px;padding:2px 0}.sum b{white-space:nowrap}.grand{font-size:12px;font-weight:900;border-top:1px solid #000;margin-top:2px;padding-top:4px}footer{text-align:center;font-size:11px;padding-top:4px}@media screen{body{padding:12px 0}.receipt{box-shadow:0 0 0 1px #eee}}'+
      '</style></head><body>'+receiptMarkup()+'<script>window.addEventListener("load",function(){window.print();});<\\/script></body></html>';
  }
  function printReceipt(){
    if(!receiptData())return;
    const w=window.open("","_blank","width=430,height=760");if(!w){$("cashierStatus").textContent="Pop-ups allow karein.";return}
    w.document.open();w.document.write(receiptDocument());w.document.close();
  }
  function wrapThermal(text,max){
    const words=String(text||"").trim().split(/\s+/).filter(Boolean),out=[];let line="";
    for(const word of words){
      if(word.length>max){
        if(line){out.push(line);line=""}
        for(let i=0;i<word.length;i+=max)out.push(word.slice(i,i+max));
      }else if(!line)line=word;
      else if((line+" "+word).length<=max)line+=" "+word;
      else{out.push(line);line=word}
    }
    if(line)out.push(line);return out.length?out:[""];
  }
  function pdfBlob(){
    const d=receiptData();if(!d)return new Blob([],{type:"application/pdf"});
    const safe=s=>String(s).replace(/([\\()])/g,"\\$1").replace(/[^\x20-\x7E]/g,"?");
    const W=226.77,margin=12,items=d.items;
    let estimated=205+items.reduce((n,p)=>n+Math.max(1,wrapThermal(p.name,24).length)*12+14,0)+(d.due>0?28:0);
    const H=Math.max(390,estimated),cmd=[];
    const text=(value,x,y,size=8,bold=false,align="left")=>{
      const s=safe(value),cw=size*.6;let px=x;if(align==="center")px=Math.max(margin,(W-s.length*cw)/2);if(align==="right")px=Math.max(margin,x-s.length*cw);
      cmd.push("BT /"+(bold?"F2":"F1")+" "+size+" Tf "+px.toFixed(2)+" "+y.toFixed(2)+" Td ("+s+") Tj ET");
    };
    const rule=y=>cmd.push("0.5 w [2 2] 0 d "+margin+" "+y.toFixed(2)+" m "+(W-margin)+" "+y.toFixed(2)+" l S [] 0 d");
    let y=H-24;
    text("KASHIF TRADERS",0,y,15,true,"center");y-=16;text("Cash Sale Receipt",0,y,9,false,"center");y-=12;rule(y);y-=14;
    const info=[["Receipt No",d.invoice],["Date",d.date],["Customer",d.customer],["Created by",d.createdBy],["Paid by",d.paidBy],["Payment",d.payment]];
    info.forEach(pair=>{text(pair[0],margin,y,7.5,false);text(": "+pair[1],70,y,7.5,false);y-=12});rule(y);y-=14;
    text("Item",margin,y,7.5,true);text("Qty",130,y,7.5,true,"right");text("Rate",165,y,7.5,true,"right");text("Amount",W-margin,y,7.5,true,"right");y-=9;rule(y);y-=13;
    items.forEach(p=>{
      const names=wrapThermal(p.name,24);
      names.forEach((line,i)=>{text(line,margin,y,7.5,i===0);if(i===0){text(qtyText(p.qty),130,y,7.5,false,"right");text(thermalMoney(p.rate),165,y,7.5,false,"right");text(thermalMoney(p.amount),W-margin,y,7.5,false,"right")}y-=11});
      text(qtyText(p.qty)+" "+p.unit,margin,y,6.7,false);y-=11;
    });
    rule(y);y-=15;
    const sum=(label,value,bold=false)=>{text(label,82,y,bold?8.5:7.5,bold);text(value,W-margin,y,bold?8.5:7.5,bold,"right");y-=12};
    sum("Subtotal","PKR "+thermalMoney(d.subtotal));sum("Discount","PKR "+thermalMoney(d.discount));sum("Total","PKR "+thermalMoney(d.total),true);sum("Received","PKR "+thermalMoney(d.received));
    if(d.due>0){sum("Remaining / Due","PKR "+thermalMoney(d.due),true);sum("Status",d.status,true)}
    y-=2;rule(y);y-=18;text("Thank you.",0,y,8.5,false,"center");
    const stream=cmd.join("\n");
    const objs=[
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 "+W.toFixed(2)+" "+H.toFixed(2)+"] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj",
      "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >> endobj",
      "6 0 obj << /Length "+stream.length+" >> stream\n"+stream+"\nendstream endobj"
    ];
    let pdf="%PDF-1.4\n",off=[0];objs.forEach(o=>{off.push(pdf.length);pdf+=o+"\n"});const x=pdf.length;
    pdf+="xref\n0 7\n0000000000 65535 f \n"+off.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer << /Size 7 /Root 1 0 R >>\nstartxref\n"+x+"\n%%EOF";
    return new Blob([pdf],{type:"application/pdf"});
  }
  async function shareReceipt(){
    const blob=pdfBlob(),file=new File([blob],active.invoice_number+".pdf",{type:"application/pdf"});
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
