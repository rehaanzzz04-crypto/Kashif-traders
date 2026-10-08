(() => {
  const $ = id => document.getElementById(id);
  const money = v => "PKR " + Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
  const thermalMoney = v => Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
  const qtyText = v => Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 3 });
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeArray = v => {
    if (Array.isArray(v)) return v;
    try { const x = JSON.parse(v || "[]"); return Array.isArray(x) ? x : []; } catch { return []; }
  };
  const stamp = x => x ? new Date(x).toLocaleString("en-PK", {day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}) : "";
  const receiptStamp = x => x ? new Date(x).toLocaleString("en-GB", {timeZone:"Asia/Karachi",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).replace(",", "") : "";
  const itemArray = x => safeArray(x?.items);
  const paymentArray = x => safeArray(x?.payments);
  const receivedOf = x => Math.max(0, Number(x?.amount_received) || 0);
  // Legacy paid invoices may lack amount_received; do not infer payments on credit bills.
  const receiptReceivedOf = x => {
    const total = Math.max(0, Number(x?.total) || 0);
    const stored = receivedOf(x);
    const payments = paymentArray(x).reduce((n,p) => n + Math.max(0, Number(p?.amount) || 0), 0);
    return Math.min(total, stored > 0 ? stored : payments > 0 ? payments : x?.status === "paid" ? total : 0);
  };
  const balanceOf = x => Math.max(0, Number(x?.total || 0) - receivedOf(x));
  const hasCustomerAccount = x => Number(x?.customer_id || 0) > 0;

  let bills = [], active = null, editing = false, status = "pending", busy = false, settlement = "full", isAdmin = false, inlinePaymentMethod = "Cash";
  let receiptReadyId = null;
  $("cashierBack").onclick = () => location.href = "/";

  function visibleBills() {
    const q = $("billSearch").value.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(x => [x.invoice_number,x.created_by_name,x.customer_name,x.sale_date,x.status].some(v => String(v || "").toLowerCase().includes(q)));
  }

  function statusLabel(value) {
    if (value === "partial") return "PARTIALLY PAID";
    if (value === "credit") return "CREDIT";
    return String(value || "").toUpperCase();
  }

  function renderList() {
    const rows = visibleBills(), list = $("cashierList");
    document.querySelector(".cs-sale-no b").textContent = bills.length;
    if ($("pendingCount")) $("pendingCount").textContent = status === "pending" ? bills.length : "";
    if (!rows.length) {
      list.innerHTML = '<div class="cs-empty"><b>No bills</b>Is tab mein koi record nahi.</div>';
      return;
    }
    list.innerHTML = rows.map(x => {
      const due = balanceOf(x);
      const amount = status === "credit_open" ? "Due " + money(due) : money(x.total);
      const badge = status === "credit_open" ? '<em class="cashier-credit-badge ' + esc(x.status) + '">' + esc(statusLabel(x.status)) + '</em>' : "";
      return '<button data-id="' + x.id + '" type="button" class="' + (active?.id === x.id ? "active" : "") + '"><span><b>' + esc(x.invoice_number) + '</b><small>' + esc(x.customer_name || "Walk-in Customer") + ' · Created by ' + esc(x.created_by_name || "") + '<br>' + esc(stamp(x.created_at)) + '</small>' + badge + '</span><strong>' + amount + '</strong></button>';
    }).join("");
    list.querySelectorAll("[data-id]").forEach(b => b.onclick = () => selectBill(rows.find(x => String(x.id) === b.dataset.id)));
  }

  function clearDetail() {
    receiptReadyId = null;
    active = null;
    editing = false;
    $("cashierBillNo").textContent = "Select a bill";
    $("cashierBillCustomer").textContent = "";
    $("cashierBillBy").textContent = "";
    $("cashierBillAt").textContent = "";
    $("cashierItems").innerHTML = '<div class="cs-empty">Bill select karein.</div>';
    $("cashierDiscount").value = 0;
    $("cashierDue").textContent = money(0);
    $("cashierReceivedTotal").textContent = money(0);
    $("cashierBalance").textContent = money(0);
    $("cashierPaymentHistory").innerHTML = '<div class="cashier-history-empty">No payment history</div>';
    chooseInlinePayment("Cash");
    setActions();
  }

  function renderPaymentHistory() {
    const box = $("cashierPaymentHistory");
    if (!active) {
      box.innerHTML = '<div class="cashier-history-empty">No payment history</div>';
      return;
    }
    const rows = paymentArray(active);
    if (!rows.length) {
      box.innerHTML = balanceOf(active) > 0 ? '<div class="cashier-history-empty">Abhi koi payment receive nahi hui.</div>' : '<div class="cashier-history-empty">Payment history unavailable for older bill.</div>';
      return;
    }
    box.innerHTML = '<div class="cashier-history-title">Payment History</div>' + rows.map(p => '<div class="cashier-history-row"><span><b>' + esc(p.payment_method || "") + '</b><small>' + esc(p.received_by_name || "") + ' · ' + esc(stamp(p.received_at)) + '</small></span><strong>' + money(p.amount) + '</strong></div>').join("");
  }

  function selectBill(x) {
    if (!x) return clearDetail();
    active = x;
    receiptReadyId = null;
    editing = false;
    renderList();
    $("cashierBillNo").textContent = x.invoice_number;
    $("cashierBillCustomer").textContent = "Customer: " + (x.customer_name || "Walk-in Customer");
    $("cashierBillBy").textContent = "Created by " + (x.created_by_name || "");
    $("cashierBillAt").textContent = stamp(x.created_at);
    $("cashierItems").innerHTML = itemArray(x).map((p,i) =>
      '<div data-price="' + (Number(p.rate) * Number(p.qty)) + '" data-qty="' + Number(p.qty) + '"><span>' + esc(p.name) + ' — ' + esc(p.qty) + ' ' + esc(p.unit || "pcs") + '</span><b>' + money(Number(p.rate) * Number(p.qty)) + '</b><input class="cashier-rate" data-i="' + i + '" type="number" min="0" step="0.01" value="' + Number(p.rate) + '" readonly></div>'
    ).join("") || '<div class="cs-empty">No items</div>';
    $("cashierDiscount").value = Number(x.discount || 0);
    bindRates();
    renderFinancials();
    renderPaymentHistory();
    chooseInlinePayment(x.payment_method && x.payment_method !== "Credit" ? x.payment_method : "Cash");
    setActions();
  }

  function bindRates() {
    document.querySelectorAll(".cashier-rate").forEach(input => input.oninput = () => {
      const row = input.closest("[data-price]"), q = Number(row.dataset.qty || 1);
      row.dataset.price = String((Number(input.value) || 0) * q);
      row.querySelector("b").textContent = money(row.dataset.price);
      renderFinancials();
    });
  }

  function totals() {
    const subtotal = [...document.querySelectorAll("#cashierItems [data-price]")].reduce((n,row) => n + Number(row.dataset.price || 0), 0);
    const discount = Math.min(subtotal, Math.max(0, Number($("cashierDiscount").value) || 0));
    return { subtotal, discount, total: Math.max(0, subtotal - discount) };
  }

  function renderFinancials() {
    const t = totals();
    const received = active && active.status !== "pending" ? Math.min(t.total, receivedOf(active)) : 0;
    $("cashierDue").textContent = money(t.total);
    $("cashierReceivedTotal").textContent = money(received);
    $("cashierBalance").textContent = money(Math.max(0, t.total - received));
  }

  function currentItems() {
    const original = itemArray(active);
    return original.map((p,i) => ({...p, rate:Number(document.querySelector('.cashier-rate[data-i="' + i + '"]')?.value) || 0}));
  }

  function setActions() {
    const has = Boolean(active), pending = has && active.status === "pending", openCredit = has && ["credit","partial"].includes(active.status), printable = has && ["paid","credit","partial"].includes(active.status);
    $("cashierEdit").disabled = !pending || busy;
    $("cashierCorrect").disabled = !has || pending || active.status === "cancelled" || busy;
    $("cashierDiscount").readOnly = !pending || !editing;
    document.querySelectorAll(".cashier-rate").forEach(x => x.readOnly = !pending || !editing);
    $("cashierPaid").disabled = !(pending || openCredit) || busy;
    $("cashierCancelBill").disabled = !pending || busy;
    const deleteButton = $("cashierDeleteBill");
    if (deleteButton) {
      const canDelete = has && active.status === "cancelled" && isAdmin;
      deleteButton.classList.toggle("cs-hidden", !canDelete);
      deleteButton.disabled = !canDelete || busy;
    }
    $("cashierPrint").disabled = !printable;
    $("cashierShare").disabled = !printable;
    if (pending) $("cashierPaid").textContent = "Receive Payment / Credit";
    else if (openCredit) $("cashierPaid").textContent = "Receive Credit Payment";
    else if (has && active.status === "paid") $("cashierPaid").textContent = "Invoice Paid";
    else $("cashierPaid").textContent = "Receive Payment / Credit";
    document.querySelector(".cs-live").textContent = has ? statusLabel(active.status) : statusLabel(status);
  }

  $("cashierEdit").onclick = () => {
    if (!active || active.status !== "pending") return;
    editing = !editing;
    document.querySelectorAll(".cashier-rate").forEach(x => x.readOnly = !editing);
    $("cashierDiscount").readOnly = !editing;
    $("cashierEdit").textContent = editing ? "✓ Finish Price Edit" : "✎ Edit Invoice";
    $("cashierStatus").textContent = editing ? "Cashier rate aur discount change kar sakta hai." : "Changes payment confirm karte waqt save hongi.";
  };
  $("cashierDiscount").oninput = renderFinancials;

  const correctionModal = $("cashierCorrectionModal");
  $("cashierCorrect").onclick = async () => {
    if (!active || active.status === "pending" || active.status === "cancelled" || busy) return;
    $("cashierCorrectStatus").textContent = "Customers loading...";
    correctionModal.classList.remove("cs-hidden");
    try {
      const r=await fetch("/api/data?resource=cash_sale_customers"),j=await r.json().catch(()=>({}));
      if(!r.ok) throw Error(j.error||"Customers load nahi huay");
      const rows=Array.isArray(j.records)?j.records:[];
      $("cashierCorrectCustomer").innerHTML=rows.map(v=>'<option value="'+v.id+'">'+esc(v.customer_code+" · "+v.name)+'</option>').join("");
      if(active.customer_id) $("cashierCorrectCustomer").value=String(active.customer_id);
      $("cashierCorrectStatus").textContent="Correct customer select karein. Save par purani payment reverse ho kar invoice Credit ban jayegi.";
    } catch(e){ $("cashierCorrectStatus").textContent=e.message; }
  };
  $("cashierCorrectClose").onclick=()=>correctionModal.classList.add("cs-hidden");
  correctionModal.onclick=e=>{if(e.target===correctionModal)correctionModal.classList.add("cs-hidden")};
  $("cashierCorrectSave").onclick=async()=>{
    if(!active||busy)return;
    const customer_id=Number($("cashierCorrectCustomer").value||0);
    if(!customer_id){$("cashierCorrectStatus").textContent="Customer select karein.";return}
    if(!confirm("Purani payment reverse karke is invoice ko selected customer ke CREDIT account mein shift karna hai?"))return;
    $("cashierCorrectStatus").textContent="Correction save ho rahi hai...";
    try {
      const response=await fetch("/api/data?resource=cash_sales&id="+active.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"correct_invoice",customer_id,corrected_status:"credit"})});
      const j=await response.json().catch(()=>({}));
      if(!response.ok) throw Error(j.error||"Invoice correction failed");
      $("cashierCorrectStatus").textContent="Done: payment reversed aur invoice Credit mein shift ho gayi.";
      correctionModal.classList.add("cs-hidden");
      active=null;
      await load();
    } catch(e) {
      $("cashierCorrectStatus").textContent="Error: "+e.message;
    }
  };

  const paymentModal = $("cashierPaymentModal");

  function choosePayment(method) {
    $("cashierPaymentMethod").value = method;
    document.querySelectorAll("#cashierPaymentOptions [data-method]").forEach(button => button.classList.toggle("active", button.dataset.method === method));
  }

  function chooseInlinePayment(method) {
    inlinePaymentMethod = method;
    document.querySelectorAll("#cashierInlinePaymentOptions [data-inline-method]").forEach(button => button.classList.toggle("active", button.dataset.inlineMethod === method));
  }


  function chooseSettlement(mode) {
    settlement = mode;
    document.querySelectorAll("#cashierSettlementOptions [data-settlement]").forEach(button => button.classList.toggle("active", button.dataset.settlement === mode));
    const t = totals(), input = $("cashierReceived"), methods = $("cashierPaymentMethodsWrap");
    if (mode === "credit") {
      input.value = "0";
      input.readOnly = true;
      methods.classList.add("cs-hidden");
      $("cashierPaymentMethod").value = "Credit";
    } else {
      input.readOnly = false;
      methods.classList.remove("cs-hidden");
      if ($("cashierPaymentMethod").value === "Credit") choosePayment("Cash");
      if (mode === "full") input.value = String(t.total);
      if (mode === "partial") input.value = "0";
    }
    paymentPreview();
  }

  function closePayment() {
    paymentModal.classList.add("cs-hidden");
  }

  function openPayment() {
    if (!active || busy) return;
    const openCredit = ["credit","partial"].includes(active.status);
    if (active.status !== "pending" && !openCredit) return;
    if (openCredit) {
      settlement = "balance";
      $("cashierPaymentTitle").textContent = "Receive Credit Payment";
      $("cashierPaymentNote").textContent = (active.customer_name || "Customer") + " ka remaining balance receive karein.";
      $("cashierSettlementOptions").classList.add("cs-hidden");
      $("cashierPaymentMethodsWrap").classList.remove("cs-hidden");
      $("cashierReceived").readOnly = false;
      $("cashierReceived").value = String(balanceOf(active));
      choosePayment(inlinePaymentMethod || (active.payment_method && active.payment_method !== "Credit" ? active.payment_method : "Cash"));
    } else {
      $("cashierPaymentTitle").textContent = "Receive Payment / Credit";
      $("cashierPaymentNote").textContent = "Full Paid, Partial Paid ya Credit select karein.";
      $("cashierSettlementOptions").classList.remove("cs-hidden");
      choosePayment("Cash");
      chooseSettlement("full");
    }
    paymentPreview();
    paymentModal.classList.remove("cs-hidden");
  }

  function paymentPreview() {
    if (!active) return;
    const raw = Math.max(0, Number($("cashierReceived").value) || 0), t = totals();
    let label = "Return to Customer", value = 0;
    if (settlement === "full") {
      label = "Return to Customer";
      value = Math.max(0, raw - t.total);
    } else if (settlement === "partial") {
      label = "Remaining Credit";
      value = Math.max(0, t.total - Math.min(raw, t.total));
    } else if (settlement === "credit") {
      label = "Credit Balance";
      value = t.total;
    } else {
      const due = balanceOf(active);
      if (raw > due) {
        label = "Return to Customer";
        value = raw - due;
      } else {
        label = "Remaining after Payment";
        value = Math.max(0, due - raw);
      }
    }
    $("cashierPaymentBalanceLabel").textContent = label;
    $("cashierChange").textContent = money(value);
  }

  document.querySelectorAll("#cashierInlinePaymentOptions [data-inline-method]").forEach(button => button.onclick = () => chooseInlinePayment(button.dataset.inlineMethod));
  document.querySelectorAll("#cashierSettlementOptions [data-settlement]").forEach(button => button.onclick = () => chooseSettlement(button.dataset.settlement));
  document.querySelectorAll("#cashierPaymentOptions [data-method]").forEach(button => button.onclick = () => choosePayment(button.dataset.method));
  $("cashierReceived").oninput = paymentPreview;
  $("cashierPaymentClose").onclick = closePayment;
  paymentModal.onclick = e => { if (e.target === paymentModal) closePayment(); };

  async function patchBill(payload, successMessage) {
    if (!active || busy) return;
    busy = true;
    setActions();
    $("cashierStatus").textContent = "Saving...";
    try {
      const response = await fetch("/api/data?resource=cash_sales&id=" + active.id, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const j = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(j.error || "Invoice update failed");
      $("cashierStatus").textContent = j.pending_sync ? "Entry phone par save hai. Payment ki server tasdeeq sync ke baad hogi." : successMessage || "Invoice updated.";
      closePayment();
      const saved = !j.pending_sync && j.record && ["paid","partial","credit"].includes(j.record.status) ? j.record : null;
      if (saved) {
        selectBill(saved);
        receiptReadyId = saved.id;
      } else {
        active = null;
        receiptReadyId = null;
      }
      await load(true);
      if (saved) {
        $("cashierStatus").textContent = (successMessage || "Payment save ho gayi.") + " Ab isi bill ki receipt print karein.";
        $("cashierPrint").scrollIntoView({behavior:"smooth",block:"nearest"});
        $("cashierPrint").focus({preventScroll:true});
      }
    } catch (e) {
      $("cashierStatus").textContent = e.message;
    } finally {
      busy = false;
      setActions();
    }
  }

  async function confirmPayment() {
    if (!active || busy) return;
    const raw = Math.max(0, Number($("cashierReceived").value) || 0);
    const method = ["credit","partial"].includes(active.status) ? (inlinePaymentMethod || $("cashierPaymentMethod").value) : $("cashierPaymentMethod").value;
    if (["credit","partial"].includes(active.status)) {
      const due = balanceOf(active);
      if (raw <= 0) {
        $("cashierStatus").textContent = "Valid received amount required hai.";
        return;
      }
      if (!method || method === "Credit") {
        $("cashierStatus").textContent = "Payment method select karein.";
        return;
      }
      await patchBill({
        action:"receive_payment",
        payment_method:method,
        amount_received:Math.min(raw,due)
      }, "Credit payment save ho gayi.");
      return;
    }

    const t = totals();
    if (settlement === "partial" && !hasCustomerAccount(active)) {
      $("cashierStatus").textContent = "Partial payment ke liye Cash Sale customer account required hai.";
      return;
    }
    if (settlement === "credit" && !hasCustomerAccount(active)) {
      $("cashierStatus").textContent = "Credit bill ke liye Cash Sale customer account required hai.";
      return;
    }
    if (settlement === "full" && raw + 0.005 < t.total) {
      $("cashierStatus").textContent = "Full Paid ke liye complete amount receive karein.";
      return;
    }
    if (settlement === "partial" && (raw <= 0 || raw + 0.005 >= t.total)) {
      $("cashierStatus").textContent = "Partial amount zero se zyada aur total se kam hona chahiye.";
      return;
    }
    if (settlement !== "credit" && (!method || method === "Credit")) {
      $("cashierStatus").textContent = "Payment method select karein.";
      return;
    }
    const nextStatus = settlement === "full" ? "paid" : settlement === "partial" ? "partial" : "credit";
    await patchBill({
      status:nextStatus,
      items:currentItems(),
      discount:t.discount,
      payment_method:settlement === "credit" ? "Credit" : method,
      amount_received:settlement === "credit" ? 0 : Math.min(raw,t.total)
    }, nextStatus === "paid" ? "Invoice paid ho gaya." : nextStatus === "partial" ? "Partial payment save ho gayi; balance credit mein chala gaya." : "Invoice credit par save ho gaya.");
  }

  async function deleteCancelledBill() {
    if (!active || active.status !== "cancelled" || !isAdmin || busy) return;
    const invoice = active.invoice_number || "this invoice";
    if (!confirm("Permanently delete cancelled invoice " + invoice + "?\n\nThis only deletes the Cashier invoice and its related Cashier payment rows.")) return;
    busy = true;
    setActions();
    $("cashierStatus").textContent = "Deleting cancelled invoice...";
    try {
      const response = await fetch("/api/data?resource=cash_sales&id=" + active.id, { method:"DELETE" });
      const j = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(j.error || "Invoice delete failed");
      if (!j.deleted) throw Error("Invoice delete nahi hui");
      active = null;
      await load();
      $("cashierStatus").textContent = "Cancelled invoice permanently delete ho gayi.";
    } catch (e) {
      $("cashierStatus").textContent = e.message;
    } finally {
      busy = false;
      setActions();
    }
  }

  $("cashierPaid").onclick = openPayment;
  $("cashierConfirmPaid").onclick = confirmPayment;
  if ($("cashierDeleteBill")) $("cashierDeleteBill").onclick = deleteCancelledBill;
  $("cashierCancelBill").onclick = () => {
    if (!active || active.status !== "pending" || !confirm("Cancel this invoice?")) return;
    patchBill({status:"cancelled"}, "Invoice cancelled.");
  };

  document.querySelectorAll(".cashier-tabs [data-status]").forEach(button => button.onclick = () => {
    receiptReadyId = null;
    status = button.dataset.status;
    document.querySelectorAll(".cashier-tabs button").forEach(x => x.classList.toggle("active", x === button));
    active = null;
    editing = false;
    load();
  });
  $("billSearchBtn").onclick = renderList;
  $("billSearch").oninput = renderList;

  function receiptData() {
    if (!active) return null;
    const items = itemArray(active).map(p => ({
      name:String(p.name || "Item"),
      qty:Number(p.qty || 0),
      unit:String(p.unit || "pcs"),
      rate:Number(p.rate || 0),
      amount:Number(p.qty || 0) * Number(p.rate || 0)
    }));
    const itemSubtotal = items.reduce((n,p) => n + p.amount, 0);
    const subtotal = Number(active.subtotal ?? itemSubtotal);
    const discount = Math.max(0, Number(active.discount || 0));
    const total = Number(active.total ?? Math.max(0, subtotal - discount));
    const received = Math.min(total, receiptReceivedOf(active));
    const due = Math.max(0, total - received);
    const payment = due > 0 ? (received > 0 ? "Partial / " + (active.payment_method || "") : "Credit") : (active.payment_method || "");
    return {
      invoice:String(active.invoice_number || ""),
      date:receiptStamp(active.paid_at || active.updated_at || active.created_at),
      customer:String(active.customer_name || "Walk-in Customer"),
      createdBy:String(active.created_by_name || ""),
      paidBy:String(active.paid_by_name || ""),
      payment,
      items,subtotal,discount,total,received,due,
      status:due <= 0 ? "Paid" : received > 0 ? "Partially Paid" : "Credit"
    };
  }


  // Safety stop: BlackCopper 80mm driver uses a 3276mm form and
  // Chromium kiosk printing can feed an entire blank roll.
  // Never issue background window.print() on this printer.
  const printModeIndicator = $("cashierPrintMode");
  if (printModeIndicator) {
    printModeIndicator.textContent = "AUTO PRINT PAUSED - printer feeds blank paper. Use PDF Print until a safe printer bridge is configured.";
    printModeIndicator.className = "cashier-print-mode standard";
  }
  $("cashierPrint").textContent = "Print Receipt (PDF)";
  
  function printReceipt() {
    const data = receiptData();
    if (!data) return;
    // PDF opens for a deliberate user-confirmed print. Never start kiosk printing.
    const url = URL.createObjectURL(pdfBlob());
    const w = window.open(url, "_blank");
    if (!w) {
      URL.revokeObjectURL(url);
      $("cashierStatus").textContent = "Receipt kholne ke liye pop-ups allow karein.";
      return;
    }
    $("cashierStatus").textContent = "Receipt PDF ready. BlackCopper printer mein 72.1 x 210mm aur Actual size 100% rakhein. Lambi receipts 210mm pages mein hain.";
    // Keep the PDF alive while its viewer is open, including later printing/download.
    const timer = setInterval(() => {
      if (w.closed) { clearInterval(timer); URL.revokeObjectURL(url); }
    }, 1000);
  }

  function wrapThermal(text,max) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean), out = []; let line = "";
    for (const word of words) {
      if (word.length > max) {
        if (line) { out.push(line); line = ""; }
        for (let i = 0; i < word.length; i += max) out.push(word.slice(i,i+max));
      } else if (!line) line = word;
      else if ((line + " " + word).length <= max) line += " " + word;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  }

  function pdfBlob() {
    const d = receiptData(); if (!d) return new Blob([],{type:"application/pdf"});
    const safe = s => String(s).replace(/([\\()])/g,"\\$1").replace(/[^\x20-\x7E]/g,"?");
    const W = 204.09, margin = 8, printableRight = 174, items = d.items; // Keep text inside the printer's narrower safe area
    const pages = [[]]; // No page can exceed the BlackCopper 210mm safe form.
    let page = 0, y = 16;
    // Courier has fixed character widths, so alignment and wrapping are exact.
    const text = (value,x,size=10,bold=false,align="left") => {
      const valueText = safe(value), width = String(value).replace(/[^\x20-\x7E]/g,"?").length * size * .6;
      let px = align === "center" ? (margin+printableRight-width)/2 : align === "right" ? x-width : x;
      pages[page].push({kind:"text",value:valueText,x:px,y,size,bold});
    };
    const rule = () => pages[page].push({kind:"rule",y});
    const nextPage = () => {
      page += 1; pages.push([]); y = 16;
      text("KASHIF TRADERS",0,12,true,"center");y += 16;
      text("Receipt "+d.invoice+" (cont.)",0,8,true,"center");y += 13;
      rule();y += 13;
    };
    const ensureRoom = needed => { if (y + needed > 564) nextPage(); };
    const pair = (label,value) => {
      const lines = wrapThermal(value,18);
      text(label,margin,8.5,true);
      for (const line of lines) { text(line,80,8.5,true); y += 11; }
    };
    text("KASHIF TRADERS",0,15,true,"center"); y += 15;
    text("Cash Sale Receipt",0,9,true,"center"); y += 10; rule(); y += 12;
    [["Receipt No",d.invoice],["Date",d.date],["Customer",d.customer],["Created by",d.createdBy],["Paid by",d.paidBy],["Payment",d.payment]].forEach(([label,value])=>pair(label,value));
    y += 2; rule(); y += 12;
    text("Qty",margin,9.5,true); text("Rate",108,9.5,true,"right"); text("Amount",printableRight,9.5,true,"right"); y += 8; rule(); y += 12;
    items.forEach(p => {
      const lines = wrapThermal(p.name,26);
      if (lines.length * 12 + 22 < 520) ensureRoom(lines.length * 12 + 22);
      for (const line of lines) {
        if (y + 34 > 564) nextPage();
        text(line,margin,10,true); y += 12;
      }
      ensureRoom(22);
      // Numeric values have their own row and columns, away from product names.
      const values=[qtyText(p.qty)+" "+p.unit,thermalMoney(p.rate),thermalMoney(p.amount)];
      const size=Math.min(9.8,49/(values[0].length*.6),45/(values[1].length*.6),58/(values[2].length*.6));
      text(values[0],margin,size,true);text(values[1],108,size,true,"right");text(values[2],printableRight,size,true,"right");
      y += 10; rule(); y += 12;
    });
    const sum = (label,value,bold=true) => {
      const size=Math.min(9.8,80/(value.length*.6));
      text(label,margin,9,bold); text(value,printableRight,size,bold,"right"); y += 14;
    };
    ensureRoom(14 * (5 + (d.discount ? 1 : 0) + (d.due > 0 ? 2 : 0)) + 40);
    sum("Total Items",String(items.length));
    sum("Subtotal",thermalMoney(d.subtotal));
    if(d.discount) sum("Discount",thermalMoney(d.discount));
    sum("Total PKR",thermalMoney(d.total));sum("Received",thermalMoney(d.received));
    if (d.due > 0) {sum("Due",thermalMoney(d.due));sum("Status",d.status);}
    rule();y+=14;text("Thank you.",0,9,true,"center");
    // Each PDF page is at most 72.1 x 210mm, even for very long bills.
    const pageHeights = pages.map((_,i) => i === page ? Math.ceil(y+8) : 595.28);
    const kids = pages.map((_,i) => (5+2*i)+" 0 R").join(" ");
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids ["+kids+"] /Count "+pages.length+" >> endobj",
      "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >> endobj"
    ];
    for (let i=0;i<pages.length;i++) {
      const H=pageHeights[i], pageObj=5+2*i, streamObj=6+2*i;
      const stream=pages[i].map(c=>c.kind==="rule"
        ?"0.5 w "+margin+" "+(H-c.y)+" m "+printableRight+" "+(H-c.y)+" l S"
        :"BT /"+(c.bold?"F2":"F1")+" "+c.size.toFixed(2)+" Tf "+c.x.toFixed(2)+" "+(H-c.y).toFixed(2)+" Td ("+c.value+") Tj ET").join("\n");
      objects.push(pageObj+" 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 "+W.toFixed(2)+" "+H.toFixed(2)+"] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+streamObj+" 0 R >> endobj");
      objects.push(streamObj+" 0 obj << /Length "+stream.length+" >> stream\n"+stream+"\nendstream endobj");
    }
    let pdf="%PDF-1.4\n", offsets=[0];
    objects.forEach(o=>{offsets.push(pdf.length);pdf+=o+"\n";});
    const xref=pdf.length;
    pdf+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n"+
      offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+
      "trailer << /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
    return new Blob([pdf],{type:"application/pdf"});
  }

  async function shareReceipt() {
    const blob = pdfBlob(), file = new File([blob],(active.invoice_reference || active.invoice_number) + ".pdf",{type:"application/pdf"});
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) await navigator.share({files:[file],title:"Kashif Traders Receipt"});
      else {
        const u = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = u; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(u),1000);
      }
    } catch (e) {
      if (e.name !== "AbortError") $("cashierStatus").textContent = e.message;
    }
  }

  $("cashierPrint").onclick = printReceipt;
  $("cashierShare").onclick = shareReceipt;

  async function load(force = false) {
    if (editing || (busy && !force)) return;
    try {
      const response = await fetch("/api/data?resource=cash_sales&status=" + encodeURIComponent(status),{cache:"no-store"});
      if (response.status === 401) { location.replace("/login.html"); return; }
      const j = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(j.error || "Bills load nahi ho sakay");
      bills = j.records || [];
      renderList();
      if (!active && bills[0]) selectBill(bills[0]);
      else if (!bills.length && active?.id !== receiptReadyId) clearDetail();
      $("cashierStatus").textContent = active && active.id === receiptReadyId ? "Payment save ho gayi. Isi bill ki receipt print karein, ya agla bill select karein." : bills.length ? "Bills updated." : "Is tab mein koi bill nahi.";
    } catch (e) {
      $("cashierStatus").textContent = e.message;
    }
  }

  fetch("/api/auth?action=me",{cache:"no-store"}).then(r => r.json()).then(j => {
    const u = j?.user;
    if (u) {
      isAdmin = String(u.designation || "").toLowerCase() === "admin";
      $("cashierUser").textContent = (u.full_name || u.employee_code) + " · " + String(u.designation || "").toUpperCase();
      setActions();
    }
  }).catch(() => {});
  load();
  setInterval(load,10000);
})();