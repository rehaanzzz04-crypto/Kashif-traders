(() => {
  const $ = (id) => document.getElementById(id),
    money = (v) =>
      "PKR " +
      Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
  let bills = [],
    active = null,
    editing = false;
  $("cashierBack").onclick = () => (location.href = "/");
  const head = document.querySelector(".cashier-head");
  if (head) {
    const report = document.createElement("button");
    report.className = "cashier-report-link";
    report.type = "button";
    report.textContent = "▥ Sales Report";
    report.onclick = () => (location.href = "/cashier-sales-report.html");
    head.appendChild(report);
    const style = document.createElement("style");
    style.textContent =
      ".cashier-report-link{margin-left:auto;border:0;border-radius:10px;background:var(--cs-green);color:#fff;padding:9px 12px;font-weight:800;cursor:pointer}@media(max-width:560px){.cashier-head{flex-wrap:wrap}.cashier-report-link{width:100%;margin-left:0}}";
    document.head.appendChild(style);
  }
  const stamp = (x) =>
    new Date(x).toLocaleString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  function renderList() {
    const list = $("cashierList");
    document.querySelector(".cs-sale-no b").textContent = bills.length;
    if (!bills.length) {
      list.innerHTML =
        '<div class="cs-empty"><b>No pending bills</b>Salesman ka bheja bill yahan live ayega.</div>';
      return;
    }
    list.innerHTML = bills
      .map(
        (x, i) =>
          '<button data-index="' +
          i +
          '" type="button" class="' +
          (active?.id === x.id ? "active" : "") +
          '"><span><b>' +
          x.invoice_number +
          "</b><small>Created by " +
          x.created_by_name +
          " · " +
          stamp(x.created_at) +
          "</small></span><strong>" +
          money(x.total) +
          "</strong></button>",
      )
      .join("");
    list
      .querySelectorAll("[data-index]")
      .forEach((b) => (b.onclick = () => selectBill(bills[+b.dataset.index])));
  }
  function selectBill(x) {
    active = x;
    editing = false;
    renderList();
    $("cashierBillNo").textContent = x.invoice_number;
    $("cashierBillBy").textContent = "Created by " + x.created_by_name;
    $("cashierBillAt").textContent = stamp(x.created_at);
    const items = Array.isArray(x.items)
      ? x.items
      : JSON.parse(x.items || "[]");
    $("cashierItems").innerHTML = items
      .map(
        (p, i) =>
          '<div data-price="' +
          Number(p.rate) * Number(p.qty) +
          '" data-qty="' +
          Number(p.qty) +
          '"><span>' +
          p.name +
          " — " +
          p.qty +
          " " +
          (p.unit || "pcs") +
          "</span><b>" +
          money(Number(p.rate) * Number(p.qty)) +
          '</b><input class="cashier-rate" data-i="' +
          i +
          '" type="number" value="' +
          Number(p.rate) +
          '" readonly></div>',
      )
      .join("");
    $("cashierDiscount").value = Number(x.discount || 0);
    $("cashierReceived").value = Number(x.total || 0);
    bindRates();
    total();
  }
  function bindRates() {
    document.querySelectorAll(".cashier-rate").forEach(
      (input) =>
        (input.oninput = () => {
          const row = input.closest("[data-price]"),
            q = Number(row.dataset.qty || 1);
          row.dataset.price = String((Number(input.value) || 0) * q);
          row.querySelector("b").textContent = money(row.dataset.price);
          total();
        }),
    );
  }
  function total() {
    const base = [
        ...document.querySelectorAll("#cashierItems [data-price]"),
      ].reduce((n, row) => n + Number(row.dataset.price || 0), 0),
      discount = Math.max(0, Number($("cashierDiscount").value) || 0),
      due = Math.max(0, base - discount),
      received = Math.max(0, Number($("cashierReceived").value) || 0);
    $("cashierDue").textContent = money(due);
    $("cashierChange").textContent = money(Math.max(0, received - due));
  }
  $("cashierEdit").onclick = () => {
    if (!active) return;
    editing = !editing;
    document
      .querySelectorAll(".cashier-rate")
      .forEach((x) => (x.readOnly = !editing));
    $("cashierDiscount").readOnly = !editing;
    $("cashierEdit").textContent = editing
      ? "✓ Finish Price Edit"
      : "✎ Edit Invoice";
    $("cashierStatus").textContent = editing
      ? "Cashier rate aur discount change kar sakta hai."
      : "Price changes current invoice tak limited rahengi.";
  };
  $("cashierDiscount").oninput = total;
  $("cashierReceived").oninput = total;
  async function load() {
    try {
      const r = await fetch("/api/data?resource=cash_sales", { cache: "no-store" });
      if (r.status === 401) {
        location.replace("/login.html");
        return;
      }
      const j = await r.json();
      if (!r.ok) throw Error(j.error || "Bills load nahi ho sakay");
      bills = j.records || [];
      renderList();
      if (!active && bills[0]) selectBill(bills[0]);
      $("cashierStatus").textContent = bills.length
        ? "Live cashier queue updated."
        : "Abhi koi pending bill nahi.";
    } catch (e) {
      $("cashierStatus").textContent = e.message;
    }
  }
  fetch("/api/auth?action=me", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => {
      const u = j?.user;
      if (!u) return;
      $("cashierUser").textContent =
        (u.full_name || u.employee_code) +
        " · " +
        String(u.designation || "").toUpperCase();
    })
    .catch(() => {});
  load();
  setInterval(load, 10000);
})();
