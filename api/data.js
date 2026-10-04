import { withOfflineReplay } from './_offline-replay.js';
import { saveSupplierBillItems } from './_supplier-bill-items.js';
import { neon } from "@neondatabase/serverless";
import { getSessionUser, canAccess } from "./_auth.js";
import { queueApproval } from "./approvals.js";
import { ensureEntryNumbers, attachEntryNumbers } from "./_entry-number.js";
import { ensurePaymentAllocationTables, allocateSupplierPayment, allocateClientReceipt } from "./_payment-allocation.js";
import ecommerceHandler from "../ecommerce-core.js";
import gulshanEcommerceHandler from "../gulshan-ecommerce-core.js";
import { ensureCoreFinancialAuditColumns, isCoreFinancialResource, stampCoreFinancialAudit } from "./_core-financial-audit.js";

const allowed = new Set([
  "suppliers",
  "supplier_invoices",
  "supplier_payments",
  "clients",
  "client_invoices",
  "client_receipts",
  "documents",
  "cash_sales",
  "cash_sale_customers",
  "sale_products",
  "customer_portal",
  "ecommerce",
  "gulshan_ecommerce",
  "gelato_settings",
  "gelato_recipes",
  "gelato_qc",
  "gelato_bio",
  "gelato_sensory",
  "gelato_release",
]);
const resourceView = {
  suppliers: "suppliers",
  supplier_invoices: "supplier-bills",
  supplier_payments: "supplier-payments",
  clients: "clients",
  client_invoices: "client-sales",
  client_receipts: "client-receipts",
  documents: "documents",
};
function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_NOT_CONFIGURED");
  return neon(url);
}
const asId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const bodyOf = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
};
const cleanText = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const cleanAmount = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const cleanOcrItems = (v) => {
  try {
    const a = Array.isArray(v) ? v : JSON.parse(String(v || "[]"));
    return a.slice(0, 50).map((x, i) => ({
      description: cleanText(x?.description || x?.name) || `Item ${i + 1}`,
      amount: cleanAmount(x?.amount) ?? 0,
    }));
  } catch {
    return [];
  }
};
const autoClientInvoiceSeed = () =>
  `AUTO-CINV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const autoSupplierInvoiceSeed = () =>
  `AUTO-SINV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
// OCR review schema is migrated lazily on first client bill request.
async function ensureClientOcrAudit(sql) {
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS ocr_status TEXT`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS ocr_written_total NUMERIC(14,2)`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS ocr_calculated_total NUMERIC(14,2)`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS ocr_original_amount NUMERIC(14,2)`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS ocr_corrected_by TEXT`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS ocr_corrected_at TIMESTAMPTZ`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS ocr_line_items JSONB NOT NULL DEFAULT \'[]\'::jsonb`;
}
async function ensureCashSaleSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS cash_sale_queue (id BIGSERIAL PRIMARY KEY, invoice_number TEXT UNIQUE NOT NULL, created_by_id BIGINT, created_by_name TEXT NOT NULL, customer_name TEXT, sale_date DATE NOT NULL DEFAULT CURRENT_DATE, items JSONB NOT NULL DEFAULT '[]'::jsonb, subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, discount NUMERIC(14,2) NOT NULL DEFAULT 0, total NUMERIC(14,2) NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS cash_sale_customers (id BIGSERIAL PRIMARY KEY, customer_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, mobile TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS customer_id BIGINT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS payment_method TEXT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS amount_received NUMERIC(14,2)`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS paid_by_id BIGINT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS paid_by_name TEXT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`;
  await sql`CREATE TABLE IF NOT EXISTS cash_sale_payments (id BIGSERIAL PRIMARY KEY, cash_sale_id BIGINT NOT NULL REFERENCES cash_sale_queue(id) ON DELETE CASCADE, amount NUMERIC(14,2) NOT NULL, payment_method TEXT NOT NULL, received_by_id BIGINT, received_by_name TEXT, received_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS cash_sale_payments_sale_idx ON cash_sale_payments(cash_sale_id,received_at,id)`;
  await sql`CREATE INDEX IF NOT EXISTS cash_sale_queue_customer_idx ON cash_sale_queue(customer_id,created_at,id)`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_pin_salt TEXT`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_pin_hash TEXT`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_username TEXT`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_password_salt TEXT`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_password_hash TEXT`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_username_reset_used BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_username_set_at TIMESTAMPTZ`;
  await sql`ALTER TABLE cash_sale_customers ADD COLUMN IF NOT EXISTS portal_password_set_at TIMESTAMPTZ`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS cash_sale_customers_portal_username_lower_uq ON cash_sale_customers(lower(portal_username)) WHERE portal_username IS NOT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS cash_customer_orders(id BIGSERIAL PRIMARY KEY,order_number TEXT UNIQUE NOT NULL,customer_id BIGINT NOT NULL REFERENCES cash_sale_customers(id),items JSONB NOT NULL DEFAULT '[]'::jsonb,status TEXT NOT NULL DEFAULT 'pending',cash_sale_id BIGINT REFERENCES cash_sale_queue(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`INSERT INTO cash_sale_customers(customer_code,name)
    SELECT 'CSC-LEG-'||x.id::text, trim(x.customer_name)
    FROM (SELECT DISTINCT ON (lower(trim(customer_name))) id,customer_name FROM cash_sale_queue WHERE customer_id IS NULL AND customer_name IS NOT NULL AND lower(trim(customer_name))<>'walk-in customer' ORDER BY lower(trim(customer_name)),id) x
    WHERE NOT EXISTS (SELECT 1 FROM cash_sale_customers c WHERE lower(trim(c.name))=lower(trim(x.customer_name)))`;
  await sql`UPDATE cash_sale_queue q SET customer_id=c.id FROM cash_sale_customers c WHERE q.customer_id IS NULL AND q.customer_name IS NOT NULL AND lower(trim(q.customer_name))=lower(trim(c.name)) AND lower(trim(q.customer_name))<>'walk-in customer'`;
}
async function cashSales(sql, req, user) {
  await ensureCashSaleSchema(sql);
  if (req.method === "GET") {
    const status = cleanText(req.query?.status) || "pending",
      limit = Math.min(1000, Math.max(1, Number(req.query?.limit) || 200));
    const selectOpen = status === "credit_open";
    const rows = status === "all"
      ? await sql`SELECT q.*,
          GREATEST(q.total-COALESCE(q.amount_received,0),0) balance_due,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id',p.id,'amount',p.amount,'payment_method',p.payment_method,
            'received_by_name',p.received_by_name,'received_at',p.received_at
          ) ORDER BY p.received_at,p.id) FROM cash_sale_payments p WHERE p.cash_sale_id=q.id),'[]'::jsonb) payments
        FROM cash_sale_queue q ORDER BY q.created_at DESC LIMIT ${limit}`
      : selectOpen
        ? await sql`SELECT q.*,
            GREATEST(q.total-COALESCE(q.amount_received,0),0) balance_due,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id',p.id,'amount',p.amount,'payment_method',p.payment_method,
              'received_by_name',p.received_by_name,'received_at',p.received_at
            ) ORDER BY p.received_at,p.id) FROM cash_sale_payments p WHERE p.cash_sale_id=q.id),'[]'::jsonb) payments
          FROM cash_sale_queue q WHERE q.status IN ('credit','partial') ORDER BY q.updated_at DESC,q.id DESC LIMIT ${limit}`
        : await sql`SELECT q.*,
            GREATEST(q.total-COALESCE(q.amount_received,0),0) balance_due,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id',p.id,'amount',p.amount,'payment_method',p.payment_method,
              'received_by_name',p.received_by_name,'received_at',p.received_at
            ) ORDER BY p.received_at,p.id) FROM cash_sale_payments p WHERE p.cash_sale_id=q.id),'[]'::jsonb) payments
          FROM cash_sale_queue q WHERE q.status=${status} ORDER BY q.created_at DESC LIMIT ${limit}`;
    return { status: 200, data: { records: rows } };
  }
  if (req.method === "POST") {
    const b = bodyOf(req), items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) return { status: 400, data: { error: "Kam az kam aik product add karein" } };
    const customerId=asId(b.customer_id);
    let customer=null;
    if(customerId){
      customer=(await sql`SELECT id,name,status FROM cash_sale_customers WHERE id=${customerId}`)[0];
      if(!customer||customer.status!=="active") return {status:400,data:{error:"Valid Cash Sale customer select karein"}};
    }
    const subtotal=items.reduce((sum,x)=>sum+Math.max(0,Number(x.qty)||0)*Math.max(0,Number(x.rate)||0),0),
      discount=Math.min(subtotal,Math.max(0,Number(b.discount)||0)), total=subtotal-discount, no="CS-"+Date.now();
    const rows=await sql`INSERT INTO cash_sale_queue(invoice_number,created_by_id,created_by_name,customer_id,customer_name,sale_date,items,subtotal,discount,total)
      VALUES(${no},${user.id},${user.full_name||user.employee_code},${customer?.id||null},${customer?.name||"Walk-in Customer"},${cleanText(b.sale_date)||new Date().toISOString().slice(0,10)},${JSON.stringify(items)},${subtotal},${discount},${total}) RETURNING *`;
    return {status:201,data:{record:rows[0]}};
  }
  if (req.method === "PATCH") {
    const id = asId(req.query?.id), b = bodyOf(req);
    if (!id) return { status: 400, data: { error: "Valid bill id required" } };
    const current = (await sql`SELECT * FROM cash_sale_queue WHERE id=${id}`)[0];
    if (!current) return { status: 404, data: { error: "Cash sale bill not found" } };

    const action = cleanText(b.action);
    if (action === "correct_invoice") {
      if (!["paid","partial","credit"].includes(current.status))
        return { status: 409, data: { error: "Sirf finalized invoice correct ki ja sakti hai" } };
      const customerId=asId(b.customer_id);
      if(!customerId) return {status:400,data:{error:"Correct Cash Sale customer select karein"}};
      const customer=(await sql`SELECT id,name,status FROM cash_sale_customers WHERE id=${customerId}`)[0];
      if(!customer||customer.status!=="active") return {status:400,data:{error:"Valid active customer select karein"}};
      const correctionStatus=cleanText(b.corrected_status)||"credit";
      if(!["credit","partial"].includes(correctionStatus)) return {status:400,data:{error:"Correction status Credit ya Partial hona chahiye"}};
      const correctedReceived=correctionStatus==="partial"?Math.max(0,Math.min(Number(current.total),cleanAmount(b.amount_received)??0)):0;
      if(correctionStatus==="partial"&&(correctedReceived<=0||correctedReceived>=Number(current.total)))
        return {status:400,data:{error:"Partial correction amount valid hona chahiye"}};
      const processor=user.full_name||user.employee_code;
      const rows=await sql`WITH reversed AS (
          DELETE FROM cash_sale_payments WHERE cash_sale_id=${id} RETURNING id
        )
        UPDATE cash_sale_queue SET
          customer_id=${customer.id},
          customer_name=${customer.name},
          status=${correctionStatus},
          amount_received=${correctedReceived},
          payment_method=${correctionStatus==="credit"?"Credit":cleanText(b.payment_method)||"Cash"},
          paid_by_id=${correctedReceived>0?asId(user.id):null},
          paid_by_name=${correctedReceived>0?processor:null},
          paid_at=${correctedReceived>0?new Date().toISOString():null},
          updated_at=now()
        WHERE id=${id} RETURNING *`;
      if(correctedReceived>0) await sql`INSERT INTO cash_sale_payments(cash_sale_id,amount,payment_method,received_by_id,received_by_name) VALUES(${id},${correctedReceived},${cleanText(b.payment_method)||"Cash"},${user.id},${processor})`;
      return {status:200,data:{record:rows[0]}};
    }
    if (action === "receive_payment") {
      if (!["credit","partial"].includes(current.status))
        return { status: 409, data: { error: "Sirf Credit / Partial bill par further payment receive ho sakti hai" } };
      const method = cleanText(b.payment_method),
        requested = cleanAmount(b.amount_received),
        already = Math.max(0, Number(current.amount_received) || 0),
        due = Math.max(0, Number(current.total) - already);
      if (!method || method === "Credit")
        return { status: 400, data: { error: "Payment method select karein" } };
      if (requested === null || requested <= 0)
        return { status: 400, data: { error: "Valid received amount required hai" } };
      if (due <= 0)
        return { status: 409, data: { error: "Is bill ka koi balance due nahi hai" } };
      const applied = Math.min(requested, due),
        nextReceived = Math.min(Number(current.total), already + applied),
        nextStatus = nextReceived + 0.005 >= Number(current.total) ? "paid" : "partial",
        processor = user.full_name || user.employee_code;
      const rows = await sql`WITH updated AS (
          UPDATE cash_sale_queue SET
            amount_received=${nextReceived},
            payment_method=${method},
            status=${nextStatus},
            paid_by_id=${user.id},
            paid_by_name=${processor},
            paid_at=CASE WHEN ${nextStatus}='paid' THEN now() ELSE paid_at END,
            updated_at=now()
          WHERE id=${id}
          RETURNING *
        ), logged AS (
          INSERT INTO cash_sale_payments(cash_sale_id,amount,payment_method,received_by_id,received_by_name)
          SELECT id,${applied},${method},${user.id},${processor} FROM updated
          RETURNING id
        )
        SELECT * FROM updated`;
      return { status: 200, data: { record: rows[0] } };
    }

    const nextStatus = cleanText(b.status) || current.status;
    if (!["pending","paid","partial","credit","cancelled"].includes(nextStatus))
      return { status: 400, data: { error: "Invalid bill status" } };
    if (current.status !== "pending" && nextStatus !== current.status)
      return { status: 409, data: { error: "Finalized bill ko sirf Credit Payment flow se update karein" } };

    const items = Array.isArray(b.items) ? b.items : (Array.isArray(current.items) ? current.items : []),
      subtotal = items.reduce((sum, x) => sum + Math.max(0, Number(x.qty) || 0) * Math.max(0, Number(x.rate) || 0), 0),
      discount = Math.min(subtotal, Math.max(0, b.discount === undefined ? Number(current.discount) : Number(b.discount) || 0)),
      total = subtotal - discount,
      requested = Math.max(0, cleanAmount(b.amount_received) ?? 0),
      customerId = asId(current.customer_id),
      processor = user.full_name || user.employee_code;

    let applied = 0, method = cleanText(b.payment_method);
    if (nextStatus === "paid") {
      if (!method || method === "Credit" || requested + 0.005 < total)
        return { status: 400, data: { error: "Full payment ke liye payment method aur complete amount required hai" } };
      applied = total;
    }
    if (nextStatus === "partial") {
      if (!customerId)
        return { status: 400, data: { error: "Partial payment ke liye Cash Sale customer account required hai" } };
      if (!method || method === "Credit" || requested <= 0 || requested + 0.005 >= total)
        return { status: 400, data: { error: "Partial payment amount total se kam aur zero se zyada hona chahiye" } };
      applied = requested;
    }
    if (nextStatus === "credit") {
      if (!customerId)
        return { status: 400, data: { error: "Credit bill ke liye Cash Sale customer account required hai" } };
      applied = 0;
      method = "Credit";
    }

    const finalized = ["paid","partial","credit"].includes(nextStatus);
    const rows = await sql`WITH updated AS (
        UPDATE cash_sale_queue SET
          items=${JSON.stringify(items)},
          subtotal=${subtotal},
          discount=${discount},
          total=${total},
          status=${nextStatus},
          payment_method=CASE WHEN ${finalized} THEN ${method} ELSE payment_method END,
          amount_received=CASE WHEN ${finalized} THEN ${applied} ELSE COALESCE(amount_received,0) END,
          paid_by_id=CASE WHEN ${finalized} THEN ${user.id} ELSE paid_by_id END,
          paid_by_name=CASE WHEN ${finalized} THEN ${processor} ELSE paid_by_name END,
          paid_at=CASE WHEN ${finalized} THEN now() ELSE paid_at END,
          cancelled_by_name=CASE WHEN ${nextStatus}='cancelled' THEN ${processor} ELSE cancelled_by_name END,
          cancelled_at=CASE WHEN ${nextStatus}='cancelled' THEN now() ELSE cancelled_at END,
          updated_at=now()
        WHERE id=${id}
        RETURNING *
      ), logged AS (
        INSERT INTO cash_sale_payments(cash_sale_id,amount,payment_method,received_by_id,received_by_name)
        SELECT id,${applied},${method},${user.id},${processor}
        FROM updated
        WHERE ${applied}>0 AND ${nextStatus} IN ('paid','partial')
        RETURNING id
      )
      SELECT * FROM updated`;
    return { status: 200, data: { record: rows[0] } };
  }
  if (req.method === "DELETE") {
    const id = asId(req.query?.id);
    if (!id) return { status: 400, data: { error: "Valid bill id required" } };
    if (String(user.designation || "").toLowerCase() !== "admin")
      return { status: 403, data: { error: "Sirf Admin cancelled invoice delete kar sakta hai" } };
    const current = (await sql`SELECT id,status FROM cash_sale_queue WHERE id=${id}`)[0];
    if (!current) return { status: 404, data: { error: "Cash sale bill not found" } };
    if (current.status !== "cancelled")
      return { status: 409, data: { error: "Sirf cancelled invoice delete ki ja sakti hai" } };
    const rows = await sql`DELETE FROM cash_sale_queue WHERE id=${id} AND status='cancelled' RETURNING id`;
    return { status: 200, data: { deleted: Boolean(rows[0]) } };
  }
  return { status: 405, data: { error: "Method not allowed" } };
}

async function cashSaleCustomers(sql, req, user) {
  await ensureCashSaleSchema(sql);
  const id=asId(req.query?.id), b=bodyOf(req);
  const summary=async customerId=>(await sql`SELECT c.*,COUNT(q.id) FILTER (WHERE q.status IN ('paid','partial','credit'))::int bill_count,
    COALESCE(SUM(q.total) FILTER (WHERE q.status IN ('paid','partial','credit')),0) total_sales,
    COALESCE(SUM(COALESCE(q.amount_received,0)) FILTER (WHERE q.status IN ('paid','partial','credit')),0) total_received,
    COALESCE(SUM(GREATEST(q.total-COALESCE(q.amount_received,0),0)) FILTER (WHERE q.status IN ('partial','credit')),0) outstanding
    FROM cash_sale_customers c LEFT JOIN cash_sale_queue q ON q.customer_id=c.id WHERE c.id=${customerId} GROUP BY c.id`)[0]||null;
  if(req.method==="GET"){
    if(id){
      const record=await summary(id); if(!record)return {status:404,data:{error:"Cash Sale customer not found"}};
      const bills=await sql`SELECT q.*,GREATEST(q.total-COALESCE(q.amount_received,0),0) balance_due,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'payment_method',p.payment_method,'received_by_name',p.received_by_name,'received_at',p.received_at) ORDER BY p.received_at,p.id) FROM cash_sale_payments p WHERE p.cash_sale_id=q.id),'[]'::jsonb) payments
        FROM cash_sale_queue q WHERE q.customer_id=${id} ORDER BY q.created_at DESC,q.id DESC`;
      return {status:200,data:{record,bills}};
    }
    const search=cleanText(req.query?.search)||"", like="%"+search+"%";
    const records=await sql`SELECT c.*,COUNT(q.id) FILTER (WHERE q.status IN ('paid','partial','credit'))::int bill_count,
      COALESCE(SUM(q.total) FILTER (WHERE q.status IN ('paid','partial','credit')),0) total_sales,
      COALESCE(SUM(COALESCE(q.amount_received,0)) FILTER (WHERE q.status IN ('paid','partial','credit')),0) total_received,
      COALESCE(SUM(GREATEST(q.total-COALESCE(q.amount_received,0),0)) FILTER (WHERE q.status IN ('partial','credit')),0) outstanding
      FROM cash_sale_customers c LEFT JOIN cash_sale_queue q ON q.customer_id=c.id
      WHERE (${search}='' OR c.name ILIKE ${like} OR COALESCE(c.mobile,'') ILIKE ${like} OR c.customer_code ILIKE ${like}) AND c.status='active'
      GROUP BY c.id ORDER BY outstanding DESC,c.name,c.id LIMIT 300`;
    return {status:200,data:{records}};
  }
  if(req.method==="POST"){
    if(cleanText(b.action)==="receive_payment"){
      const customerId=asId(b.customer_id),amount=cleanAmount(b.amount),method=cleanText(b.payment_method),processor=user.full_name||user.employee_code;
      if(!customerId)return {status:400,data:{error:"Customer required hai"}};
      if(amount===null||amount<=0)return {status:400,data:{error:"Valid payment amount required hai"}};
      if(!method||method==="Credit")return {status:400,data:{error:"Payment method select karein"}};
      const c=await summary(customerId); if(!c)return {status:404,data:{error:"Cash Sale customer not found"}};
      const outstanding=Number(c.outstanding||0); if(outstanding<=0)return {status:409,data:{error:"Customer ka koi outstanding balance nahi hai"}};
      if(amount>outstanding+0.005)return {status:400,data:{error:"Payment outstanding balance se zyada nahi ho sakti"}};
      const applied=await sql`WITH open_bills AS (
        SELECT q.id,q.total,COALESCE(q.amount_received,0) received,GREATEST(q.total-COALESCE(q.amount_received,0),0) due,
        COALESCE(SUM(GREATEST(q.total-COALESCE(q.amount_received,0),0)) OVER (ORDER BY q.created_at,q.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior_due
        FROM cash_sale_queue q WHERE q.customer_id=${customerId} AND q.status IN ('credit','partial') AND GREATEST(q.total-COALESCE(q.amount_received,0),0)>0
      ), alloc AS (SELECT id,due,LEAST(due,GREATEST(0,${amount}-prior_due)) applied FROM open_bills),
      updated AS (UPDATE cash_sale_queue q SET amount_received=LEAST(q.total,COALESCE(q.amount_received,0)+a.applied),
        status=CASE WHEN COALESCE(q.amount_received,0)+a.applied+0.005>=q.total THEN 'paid' ELSE 'partial' END,payment_method=${method},
        paid_by_id=${user.id},paid_by_name=${processor},paid_at=CASE WHEN COALESCE(q.amount_received,0)+a.applied+0.005>=q.total THEN now() ELSE q.paid_at END,updated_at=now()
        FROM alloc a WHERE q.id=a.id AND a.applied>0 RETURNING q.id),
      logged AS (INSERT INTO cash_sale_payments(cash_sale_id,amount,payment_method,received_by_id,received_by_name)
        SELECT u.id,a.applied,${method},${user.id},${processor} FROM updated u JOIN alloc a ON a.id=u.id RETURNING amount)
      SELECT COALESCE(SUM(amount),0) applied FROM logged`;
      return {status:200,data:{applied:Number(applied[0]?.applied||0),record:await summary(customerId)}};
    }
    const name=cleanText(b.name),mobile=cleanText(b.mobile),notes=cleanText(b.notes);
    if(!name)return {status:400,data:{error:"Customer name required hai"}};
    const duplicate=(await sql`SELECT id,customer_code,name,mobile FROM cash_sale_customers WHERE lower(trim(name))=lower(trim(${name})) AND COALESCE(trim(mobile),'')=COALESCE(trim(${mobile}),'') AND status='active' LIMIT 1`)[0];
    if(duplicate)return {status:409,data:{error:"Ye Cash Sale customer pehle se mojood hai",record:duplicate}};
    const code="KT-"+String(Date.now()).slice(-6);
    const rows=await sql`INSERT INTO cash_sale_customers(customer_code,name,mobile,notes) VALUES(${code},${name},${mobile},${notes}) RETURNING *`;
    return {status:201,data:{record:rows[0]}};
  }
  if(req.method==="PATCH"&&cleanText(b.action)==="set_portal_pin"){
    if(!id)return {status:400,data:{error:"Valid customer id required"}};
    const pin=cleanText(b.pin);
    if(!pin||pin.length<4||pin.length>12)return {status:400,data:{error:"Portal PIN 4 se 12 characters ka hona chahiye"}};
    const crypto=(await import("node:crypto")).default;
    const salt=crypto.randomBytes(16).toString("hex"),pinHash=crypto.scryptSync(String(pin),salt,64).toString("hex");
    const rows=await sql`UPDATE cash_sale_customers SET portal_pin_salt=${salt},portal_pin_hash=${pinHash},updated_at=now() WHERE id=${id} RETURNING id,customer_code,name`;
    return rows[0]?{status:200,data:{record:rows[0]}}:{status:404,data:{error:"Cash Sale customer not found"}};
  }
  if(req.method==="PATCH"){
    if(!id)return {status:400,data:{error:"Valid customer id required"}};
    const rows=await sql`UPDATE cash_sale_customers SET name=COALESCE(${cleanText(b.name)},name),mobile=CASE WHEN ${b.mobile!==undefined} THEN ${cleanText(b.mobile)} ELSE mobile END,notes=CASE WHEN ${b.notes!==undefined} THEN ${cleanText(b.notes)} ELSE notes END,status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
    if(!rows[0])return {status:404,data:{error:"Cash Sale customer not found"}};
    await sql`UPDATE cash_sale_queue SET customer_name=${rows[0].name},updated_at=now() WHERE customer_id=${id}`;
    return {status:200,data:{record:rows[0]}};
  }
  return {status:405,data:{error:"Method not allowed"}};
}

async function saleProducts(sql, req) {
  await sql`CREATE TABLE IF NOT EXISTS cash_sale_products (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL DEFAULT 'pcs',
    purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0,
    barcode TEXT,
    product_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS cash_sale_products_search_idx ON cash_sale_products (name, sku, barcode)`;
  const id = asId(req.query?.id), b = bodyOf(req);
  if (req.method === "GET") {
    const search = cleanText(req.query?.search) || "", like = `%${search}%`, status = cleanText(req.query?.status);
    const rows = await sql`SELECT id,sku,name,category,unit,purchase_price,sale_price,reorder_level,barcode,status,created_at,updated_at,(product_image_url IS NOT NULL) has_image,product_image_url
      FROM cash_sale_products
      WHERE (${id}::bigint IS NULL OR id=${id})
        AND (${search}='' OR COALESCE(sku,'') ILIKE ${like} OR name ILIKE ${like} OR COALESCE(category,'') ILIKE ${like} OR COALESCE(barcode,'') ILIKE ${like})
        AND (${status}::text IS NULL OR status=${status})
      ORDER BY name,id LIMIT 200`;
    return { status: 200, data: { records: rows } };
  }
  if (req.method === "POST") {
    const name = cleanText(b.name);
    if (!name) return { status: 400, data: { error: "Product name required" } };
    const sku = cleanText(b.sku) || `SP-${Date.now()}`;
    const rows = await sql`INSERT INTO cash_sale_products(sku,name,category,unit,purchase_price,sale_price,reorder_level,barcode,product_image_url,status)
      VALUES(${sku},${name},${cleanText(b.category)},${cleanText(b.unit)||"pcs"},${cleanAmount(b.purchase_price)||0},${cleanAmount(b.sale_price)||0},${cleanAmount(b.reorder_level)||0},${cleanText(b.barcode)},${cleanText(b.product_image_url)},${cleanText(b.status)||"active"}) RETURNING *`;
    return { status: 201, data: { record: rows[0] } };
  }
  if (req.method === "PATCH") {
    if (!id) return { status: 400, data: { error: "Valid product id required" } };
    const rows = await sql`UPDATE cash_sale_products SET
      sku=COALESCE(${cleanText(b.sku)},sku), name=COALESCE(${cleanText(b.name)},name), category=COALESCE(${cleanText(b.category)},category),
      unit=COALESCE(${cleanText(b.unit)},unit), purchase_price=COALESCE(${cleanAmount(b.purchase_price)},purchase_price),
      sale_price=COALESCE(${cleanAmount(b.sale_price)},sale_price), reorder_level=COALESCE(${cleanAmount(b.reorder_level)},reorder_level),
      barcode=COALESCE(${cleanText(b.barcode)},barcode), product_image_url=COALESCE(${cleanText(b.product_image_url)},product_image_url),
      status=COALESCE(${cleanText(b.status)},status), updated_at=now() WHERE id=${id} RETURNING *`;
    return rows[0] ? { status: 200, data: { record: rows[0] } } : { status: 404, data: { error: "Sale product not found" } };
  }
  if (req.method === "DELETE") {
    if (!id) return { status: 400, data: { error: "Valid product id required" } };
    const rows = await sql`DELETE FROM cash_sale_products WHERE id=${id} RETURNING id`;
    return { status: 200, data: { deleted: Boolean(rows[0]) } };
  }
  return { status: 405, data: { error: "Method not allowed" } };
}
async function list(sql, r, id) {
  if (["supplier_invoices", "supplier_payments", "client_invoices", "client_receipts"].includes(r))
    await ensurePaymentAllocationTables(sql);
  if (r === "suppliers")
    return id
      ? sql`SELECT * FROM suppliers WHERE id=${id}`
      : sql`SELECT * FROM suppliers ORDER BY business_name,id`;
  if (r === "clients")
    return id
      ? sql`SELECT * FROM clients WHERE id=${id}`
      : sql`SELECT * FROM clients ORDER BY business_name,id`;
  if (r === "supplier_invoices")
    return sql`SELECT i.*,s.business_name,COALESCE((SELECT SUM(a.amount) FROM supplier_payment_invoice_allocations a WHERE a.supplier_invoice_id=i.id),0) allocated_amount,GREATEST(i.amount-COALESCE((SELECT SUM(a.amount) FROM supplier_payment_invoice_allocations a WHERE a.supplier_invoice_id=i.id),0),0) outstanding FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id WHERE (${id}::bigint IS NULL OR i.id=${id}) ORDER BY i.invoice_date DESC,i.id DESC`;
  if (r === "supplier_payments")
    return id
      ? sql`SELECT p.*,s.business_name FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=${id}`
      : sql`SELECT p.*,s.business_name FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.payment_date DESC,p.id DESC`;
  if (r === "client_invoices")
    return sql`SELECT i.*,c.business_name,COALESCE((SELECT SUM(a.amount) FROM client_receipt_invoice_allocations a WHERE a.client_invoice_id=i.id),0) allocated_amount,GREATEST(i.amount-COALESCE((SELECT SUM(a.amount) FROM client_receipt_invoice_allocations a WHERE a.client_invoice_id=i.id),0),0) outstanding FROM client_invoices i JOIN clients c ON c.id=i.client_id WHERE (${id}::bigint IS NULL OR i.id=${id}) ORDER BY i.invoice_date DESC,i.id DESC`;
  if (r === "client_receipts")
    return id
      ? sql`SELECT x.*,c.business_name FROM client_receipts x JOIN clients c ON c.id=x.client_id WHERE x.id=${id}`
      : sql`SELECT x.*,c.business_name FROM client_receipts x JOIN clients c ON c.id=x.client_id ORDER BY x.receipt_date DESC,x.id DESC`;
  if (r === "documents")
    return id
      ? sql`SELECT * FROM documents WHERE id=${id}`
      : sql`SELECT * FROM documents ORDER BY created_at DESC,id DESC`;
  return [];
}
async function create(sql, r, b) {
  if (r === "suppliers")
    return sql`INSERT INTO suppliers(business_name,contact_person,mobile_number,whatsapp_number,address,opening_balance,notes,status) VALUES(${cleanText(b.business_name)},${cleanText(b.contact_person)},${cleanText(b.mobile_number)},${cleanText(b.whatsapp_number)},${cleanText(b.address)},${cleanAmount(b.opening_balance) ?? 0},${cleanText(b.notes)},${cleanText(b.status) ?? "active"}) RETURNING *`;
  if (r === "clients")
    return sql`INSERT INTO clients(business_name,contact_person,mobile_number,whatsapp_number,address,credit_limit,opening_balance,notes,status) VALUES(${cleanText(b.business_name)},${cleanText(b.contact_person)},${cleanText(b.mobile_number)},${cleanText(b.whatsapp_number)},${cleanText(b.address)},${cleanAmount(b.credit_limit)},${cleanAmount(b.opening_balance) ?? 0},${cleanText(b.notes)},${cleanText(b.status) ?? "active"}) RETURNING *`;
  if (r === "supplier_invoices") {
    const supplierId = asId(b.supplier_id), invoiceDate = cleanText(b.invoice_date), amount = cleanAmount(b.amount);
    if (!supplierId) throw Error("Supplier is required");
    if (!invoiceDate) throw Error("Invoice date is required");
    if (amount === null || amount <= 0) throw Error("Valid bill amount is required");
    const dueDate = cleanText(b.due_date) || invoiceDate;
    return sql`INSERT INTO supplier_invoices(supplier_id,invoice_number,invoice_date,due_date,amount,notes,attachment_url,status) VALUES(${supplierId},${cleanText(b.invoice_number) || autoSupplierInvoiceSeed()},${invoiceDate},${dueDate},${amount},${cleanText(b.notes)},${cleanText(b.attachment_url)},${cleanText(b.status) ?? "unpaid"}) RETURNING *`;
  }
  if (r === "supplier_payments") {
    const supplierId = asId(b.supplier_id),
      amount = cleanAmount(b.amount);
    if (!supplierId || !amount || amount <= 0)
      throw Error("Supplier and valid amount are required");
    const rows = await sql`INSERT INTO supplier_payments(supplier_id,payment_date,amount,payment_method,bank,reference_number,notes,attachment_url) VALUES(${supplierId},${cleanText(b.payment_date)},${amount},${cleanText(b.payment_method)},${cleanText(b.bank)},${cleanText(b.reference_number)},${cleanText(b.notes)},${cleanText(b.attachment_url)}) RETURNING *`;
    await allocateSupplierPayment(sql, rows[0], { preferredInvoiceId: asId(b.supplier_invoice_id) });
    return rows;
  }
  if (r === "client_invoices")
    return sql`INSERT INTO client_invoices(client_id,invoice_number,invoice_date,due_date,amount,notes,attachment_url,status,ocr_status,ocr_written_total,ocr_calculated_total,ocr_original_amount,ocr_line_items) VALUES(${asId(b.client_id)},${cleanText(b.invoice_number) || autoClientInvoiceSeed()},${cleanText(b.invoice_date)},${cleanText(b.due_date)},${cleanAmount(b.amount)},${cleanText(b.notes)},${cleanText(b.attachment_url)},${cleanText(b.ocr_status)==="review_required" ? "draft_review" : (cleanText(b.status) ?? "unpaid")},${cleanText(b.ocr_status)},${cleanAmount(b.ocr_written_total)},${cleanAmount(b.ocr_calculated_total)},${cleanAmount(b.amount)},${JSON.stringify(cleanOcrItems(b.ocr_line_items))}::jsonb) RETURNING *`;
  if (r === "client_receipts") {
    const clientId = asId(b.client_id), amount = cleanAmount(b.amount);
    if (!clientId || !amount || amount <= 0) throw Error("Client and valid amount are required");
    const rows = await sql`INSERT INTO client_receipts(client_id,receipt_date,amount,payment_method,bank,reference_number,notes,attachment_url) VALUES(${clientId},${cleanText(b.receipt_date)},${amount},${cleanText(b.payment_method)},${cleanText(b.bank)},${cleanText(b.reference_number)},${cleanText(b.notes)},${cleanText(b.attachment_url)}) RETURNING *`;
    await allocateClientReceipt(sql, rows[0], { preferredInvoiceId: asId(b.client_invoice_id) });
    return rows;
  }
  if (r === "documents")
    return sql`INSERT INTO documents(entity_type,entity_id,document_type,file_url,file_name,mime_type) VALUES(${cleanText(b.entity_type)},${asId(b.entity_id)},${cleanText(b.document_type)},${cleanText(b.file_url)},${cleanText(b.file_name)},${cleanText(b.mime_type)}) RETURNING *`;
  return [];
}
async function patch(sql, r, id, b) {
  if (r === "suppliers")
    return sql`UPDATE suppliers SET business_name=COALESCE(${cleanText(b.business_name)},business_name),contact_person=COALESCE(${cleanText(b.contact_person)},contact_person),mobile_number=COALESCE(${cleanText(b.mobile_number)},mobile_number),whatsapp_number=COALESCE(${cleanText(b.whatsapp_number)},whatsapp_number),address=COALESCE(${cleanText(b.address)},address),opening_balance=COALESCE(${cleanAmount(b.opening_balance)},opening_balance),notes=COALESCE(${cleanText(b.notes)},notes),status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
  if (r === "clients")
    return sql`UPDATE clients SET business_name=COALESCE(${cleanText(b.business_name)},business_name),contact_person=COALESCE(${cleanText(b.contact_person)},contact_person),mobile_number=COALESCE(${cleanText(b.mobile_number)},mobile_number),whatsapp_number=COALESCE(${cleanText(b.whatsapp_number)},whatsapp_number),address=COALESCE(${cleanText(b.address)},address),credit_limit=COALESCE(${cleanAmount(b.credit_limit)},credit_limit),opening_balance=COALESCE(${cleanAmount(b.opening_balance)},opening_balance),notes=COALESCE(${cleanText(b.notes)},notes),status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
  if (r === "supplier_invoices")
    return sql`UPDATE supplier_invoices SET supplier_id=COALESCE(${asId(b.supplier_id)},supplier_id),invoice_number=COALESCE(${cleanText(b.invoice_number)},invoice_number),invoice_date=COALESCE(${cleanText(b.invoice_date)},invoice_date),due_date=COALESCE(${cleanText(b.due_date)},due_date),amount=COALESCE(${cleanAmount(b.amount)},amount),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
  if (r === "supplier_payments")
    return sql`UPDATE supplier_payments SET supplier_id=COALESCE(${asId(b.supplier_id)},supplier_id),payment_date=COALESCE(${cleanText(b.payment_date)},payment_date),amount=COALESCE(${cleanAmount(b.amount)},amount),payment_method=COALESCE(${cleanText(b.payment_method)},payment_method),bank=COALESCE(${cleanText(b.bank)},bank),reference_number=COALESCE(${cleanText(b.reference_number)},reference_number),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),updated_at=now() WHERE id=${id} RETURNING *`;
  if (r === "client_invoices") {
    const old=(await sql`SELECT amount,ocr_status,ocr_written_total,ocr_line_items FROM client_invoices WHERE id=${id}`)[0];
    const submittedItems=b.ocr_line_items!==undefined?cleanOcrItems(b.ocr_line_items):null;
    const itemTotal=submittedItems?submittedItems.reduce((s,x)=>s+Number(x.amount||0),0):null;
    const written=Number(old?.ocr_written_total||0);
    const reviewSubmit=old?.ocr_status==="review_required"&&submittedItems!==null;
    if(reviewSubmit&&(!submittedItems.length||!Number.isFinite(itemTotal)||itemTotal<=0))
      throw Error("Correct at least one valid OCR item amount");
    const corrected=reviewSubmit&&submittedItems.length>0&&itemTotal>0;
    const nextAmount=corrected?itemTotal:cleanAmount(b.amount);
    const correctedBy=corrected?(cleanText(b.ocr_corrected_by)||"Admin"):null;
    return sql`UPDATE client_invoices SET client_id=COALESCE(${asId(b.client_id)},client_id),invoice_number=COALESCE(${cleanText(b.invoice_number)},invoice_number),invoice_date=COALESCE(${cleanText(b.invoice_date)},invoice_date),due_date=COALESCE(${cleanText(b.due_date)},due_date),amount=COALESCE(${nextAmount},amount),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),status=CASE WHEN ${corrected} THEN 'unpaid' ELSE COALESCE(${cleanText(b.status)},status) END,ocr_status=CASE WHEN ${corrected} THEN 'verified_corrected' ELSE ocr_status END,ocr_line_items=CASE WHEN ${submittedItems!==null} THEN ${JSON.stringify(submittedItems||[])}::jsonb ELSE ocr_line_items END,ocr_corrected_by=CASE WHEN ${corrected} THEN ${correctedBy} ELSE ocr_corrected_by END,ocr_corrected_at=CASE WHEN ${corrected} THEN now() ELSE ocr_corrected_at END,updated_at=now() WHERE id=${id} RETURNING *`;
  }
  if (r === "client_receipts")
    return sql`UPDATE client_receipts SET client_id=COALESCE(${asId(b.client_id)},client_id),receipt_date=COALESCE(${cleanText(b.receipt_date)},receipt_date),amount=COALESCE(${cleanAmount(b.amount)},amount),payment_method=COALESCE(${cleanText(b.payment_method)},payment_method),bank=COALESCE(${cleanText(b.bank)},bank),reference_number=COALESCE(${cleanText(b.reference_number)},reference_number),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),updated_at=now() WHERE id=${id} RETURNING *`;
  if (r === "documents")
    return sql`UPDATE documents SET entity_type=COALESCE(${cleanText(b.entity_type)},entity_type),entity_id=COALESCE(${asId(b.entity_id)},entity_id),document_type=COALESCE(${cleanText(b.document_type)},document_type),file_url=COALESCE(${cleanText(b.file_url)},file_url),file_name=COALESCE(${cleanText(b.file_name)},file_name),mime_type=COALESCE(${cleanText(b.mime_type)},mime_type) WHERE id=${id} RETURNING *`;
  return [];
}
async function remove(sql, r, id) {
  if (r === "suppliers")
    return sql`DELETE FROM suppliers WHERE id=${id} RETURNING id`;
  if (r === "supplier_invoices")
    return sql`DELETE FROM supplier_invoices WHERE id=${id} RETURNING id`;
  if (r === "supplier_payments")
    return sql`DELETE FROM supplier_payments WHERE id=${id} RETURNING id`;
  if (r === "clients")
    return sql`DELETE FROM clients WHERE id=${id} RETURNING id`;
  if (r === "client_invoices")
    return sql`DELETE FROM client_invoices WHERE id=${id} RETURNING id`;
  if (r === "client_receipts")
    return sql`DELETE FROM client_receipts WHERE id=${id} RETURNING id`;
  if (r === "documents")
    return sql`DELETE FROM documents WHERE id=${id} RETURNING id`;
  return [];
}

function customerCookie(req,name){const raw=String(req.headers?.cookie||"");const hit=raw.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));return hit?decodeURIComponent(hit.slice(name.length+1)):null}
async function customerPortal(sql,req,res,staffUser=null){
  const crypto=(await import("node:crypto")).default;
  await ensureCashSaleSchema(sql);
  await sql`CREATE TABLE IF NOT EXISTS cash_customer_sessions(id BIGSERIAL PRIMARY KEY,customer_id BIGINT NOT NULL REFERENCES cash_sale_customers(id) ON DELETE CASCADE,token_hash TEXT UNIQUE NOT NULL,expires_at TIMESTAMPTZ NOT NULL,last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  const action=cleanText(req.query?.action)||"dashboard",b=bodyOf(req),digest=v=>crypto.createHash("sha256").update(String(v)).digest("hex");
  const sessionToken=customerCookie(req,"kt_customer");
  const verifyRecovery=async(code,pin)=>{
    const c=(await sql`SELECT * FROM cash_sale_customers WHERE upper(customer_code)=upper(${code}) AND status='active' LIMIT 1`)[0];
    if(!c||!c.portal_pin_hash||!c.portal_pin_salt)return null;
    const ok=crypto.scryptSync(String(pin||""),c.portal_pin_salt,64).toString("hex")===c.portal_pin_hash;
    return ok?c:null;
  };
  const validUsername=v=>/^[A-Za-z0-9._-]{4,30}$/.test(String(v||""));
  const validPassword=v=>String(v||"").length>=6&&String(v||"").length<=64;

  if(req.method==="POST"&&action==="login"){
    const username=cleanText(b.username),password=String(b.password||"");
    if(!username||!password)return res.status(400).json({error:"Username aur password required hain"});
    const c=(await sql`SELECT * FROM cash_sale_customers WHERE lower(portal_username)=lower(${username}) AND status='active' LIMIT 1`)[0];
    if(!c||!c.portal_password_hash||!c.portal_password_salt||crypto.scryptSync(password,c.portal_password_salt,64).toString("hex")!==c.portal_password_hash)
      return res.status(401).json({error:"Username ya password ghalat hai"});
    const t=crypto.randomBytes(32).toString("hex");
    await sql`INSERT INTO cash_customer_sessions(customer_id,token_hash,expires_at) VALUES(${c.id},${digest(t)},now()+interval '30 days')`;
    res.setHeader("Set-Cookie",`kt_customer=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`);
    return res.status(200).json({ok:true,name:c.name});
  }

  if(req.method==="POST"&&action==="credential_status"){
    const code=cleanText(b.customer_code),pin=cleanText(b.pin),c=await verifyRecovery(code,pin);
    if(!c)return res.status(401).json({error:"Customer code ya PIN ghalat hai"});
    return res.status(200).json({
      verified:true,
      has_credentials:Boolean(c.portal_username&&c.portal_password_hash),
      username:c.portal_username||"",
      username_reset_available:Boolean(c.portal_username&&!c.portal_username_reset_used)
    });
  }

  if(req.method==="POST"&&action==="setup_credentials"){
    const code=cleanText(b.customer_code),pin=cleanText(b.pin),username=cleanText(b.username),password=String(b.password||"");
    const c=await verifyRecovery(code,pin);
    if(!c)return res.status(401).json({error:"Customer code ya PIN ghalat hai"});
    if(c.portal_username||c.portal_password_hash)return res.status(409).json({error:"Portal account pehle setup ho chuka hai"});
    if(!validUsername(username))return res.status(400).json({error:"Username 4-30 characters ka ho aur sirf letters, numbers, dot, dash ya underscore use karein"});
    if(!validPassword(password))return res.status(400).json({error:"Password 6 se 64 characters ka hona chahiye"});
    const taken=(await sql`SELECT id FROM cash_sale_customers WHERE lower(portal_username)=lower(${username}) AND id<>${c.id} LIMIT 1`)[0];
    if(taken)return res.status(409).json({error:"Ye username already use ho raha hai"});
    const salt=crypto.randomBytes(16).toString("hex"),hash=crypto.scryptSync(password,salt,64).toString("hex");
    await sql`UPDATE cash_sale_customers SET portal_username=${username},portal_password_salt=${salt},portal_password_hash=${hash},portal_username_set_at=now(),portal_password_set_at=now(),updated_at=now() WHERE id=${c.id}`;
    await sql`DELETE FROM cash_customer_sessions WHERE customer_id=${c.id}`;
    return res.status(200).json({ok:true,username});
  }

  if(req.method==="POST"&&action==="reset_password"){
    const code=cleanText(b.customer_code),pin=cleanText(b.pin),password=String(b.password||"");
    const c=await verifyRecovery(code,pin);
    if(!c)return res.status(401).json({error:"Customer code ya PIN ghalat hai"});
    if(!c.portal_username)return res.status(409).json({error:"Pehle portal username setup karein"});
    if(!validPassword(password))return res.status(400).json({error:"Password 6 se 64 characters ka hona chahiye"});
    const salt=crypto.randomBytes(16).toString("hex"),hash=crypto.scryptSync(password,salt,64).toString("hex");
    await sql`UPDATE cash_sale_customers SET portal_password_salt=${salt},portal_password_hash=${hash},portal_password_set_at=now(),updated_at=now() WHERE id=${c.id}`;
    await sql`DELETE FROM cash_customer_sessions WHERE customer_id=${c.id}`;
    return res.status(200).json({ok:true});
  }

  if(req.method==="POST"&&action==="reset_username"){
    const code=cleanText(b.customer_code),pin=cleanText(b.pin),username=cleanText(b.username);
    const c=await verifyRecovery(code,pin);
    if(!c)return res.status(401).json({error:"Customer code ya PIN ghalat hai"});
    if(!c.portal_username)return res.status(409).json({error:"Pehle portal account setup karein"});
    if(c.portal_username_reset_used)return res.status(409).json({error:"Username reset pehle hi use ho chuka hai; username dobara change nahi ho sakta"});
    if(!validUsername(username))return res.status(400).json({error:"Username 4-30 characters ka ho aur sirf letters, numbers, dot, dash ya underscore use karein"});
    const taken=(await sql`SELECT id FROM cash_sale_customers WHERE lower(portal_username)=lower(${username}) AND id<>${c.id} LIMIT 1`)[0];
    if(taken)return res.status(409).json({error:"Ye username already use ho raha hai"});
    await sql`UPDATE cash_sale_customers SET portal_username=${username},portal_username_reset_used=true,updated_at=now() WHERE id=${c.id}`;
    await sql`DELETE FROM cash_customer_sessions WHERE customer_id=${c.id}`;
    return res.status(200).json({ok:true,username});
  }
  if(req.method==="POST"&&action==="logout"){if(sessionToken)await sql`DELETE FROM cash_customer_sessions WHERE token_hash=${digest(sessionToken)}`;res.setHeader("Set-Cookie","kt_customer=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0");return res.status(200).json({ok:true})}
  if(staffUser&&req.method==="GET"&&action==="admin_orders"){
    const rows=await sql`SELECT o.*,c.customer_code,c.name customer_name,c.mobile FROM cash_customer_orders o JOIN cash_sale_customers c ON c.id=o.customer_id ORDER BY CASE WHEN o.status='pending' THEN 0 ELSE 1 END,o.created_at DESC LIMIT 200`;
    return res.status(200).json({records:rows});
  }
  if(staffUser&&req.method==="POST"&&action==="reject_order"){
    const orderId=asId(b.order_id);if(!orderId)return res.status(400).json({error:"Valid order required"});
    const rows=await sql`UPDATE cash_customer_orders SET status='rejected',updated_at=now() WHERE id=${orderId} AND status='pending' AND cash_sale_id IS NULL RETURNING *`;
    if(!rows.length)return res.status(409).json({error:"Order pending nahi hai ya pehle process ho chuka hai"});
    return res.status(200).json({record:rows[0]});
  }
  if(staffUser&&req.method==="POST"&&action==="approve_order"){
    const orderId=asId(b.order_id),requested=Array.isArray(b.items)?b.items:[];if(!orderId)return res.status(400).json({error:"Valid order required"});
    const o=(await sql`SELECT o.*,c.name customer_name FROM cash_customer_orders o JOIN cash_sale_customers c ON c.id=o.customer_id WHERE o.id=${orderId}`)[0];
    if(!o)return res.status(404).json({error:"Order not found"});if(o.status!=="pending"||o.cash_sale_id)return res.status(409).json({error:"Order already converted"});
    const base=Array.isArray(o.items)?o.items:[],baseMap=new Map(base.map(x=>[Number(x.product_id),x]));
    const normalized=requested.map(x=>({product_id:asId(x.product_id),qty:Math.max(0,Number(x.qty)||0),price:Math.max(0,Number(x.price)||0)})).filter(x=>x.product_id&&x.qty>0);
    if(!normalized.length)return res.status(400).json({error:"Invoice mein kam az kam aik product required hai"});
    if(normalized.some(x=>!(x.price>0)))return res.status(400).json({error:"Har product ka rate enter karein"});
    const addedIds=[...new Set(normalized.filter(x=>!baseMap.has(Number(x.product_id))).map(x=>Number(x.product_id)))];
    const addedProducts=addedIds.length?await sql`SELECT id,name,unit FROM cash_sale_products WHERE id=ANY(${addedIds}) AND status='active'`:[];
    const addedMap=new Map(addedProducts.map(x=>[Number(x.id),x]));
    if(addedIds.some(id=>!addedMap.has(id)))return res.status(400).json({error:"Added product active Sale Products catalog mein nahi mila"});
    const items=normalized.map(x=>{
      const original=baseMap.get(Number(x.product_id)),product=original||addedMap.get(Number(x.product_id));
      const originalQty=original?Math.max(0,Number(original.qty)||0):0;
      return {
        product_id:Number(x.product_id),
        name:product?.name||"Product",
        unit:product?.unit||"pcs",
        qty:x.qty,
        rate:x.price,
        total:x.qty*x.price,
        source:original?"customer_order":"cashier_added",
        added_by_cashier:!original,
        customer_requested_qty:originalQty,
        quantity_changed_by_cashier:Boolean(original&&Math.abs(originalQty-x.qty)>0.000001)
      };
    });
    const subtotal=items.reduce((n,x)=>n+Number(x.total||0),0),discount=Math.min(subtotal,Math.max(0,Number(b.discount)||0)),total=subtotal-discount,inv="CS-"+Date.now();
    const q=await sql`INSERT INTO cash_sale_queue(invoice_number,created_by_id,created_by_name,customer_name,customer_id,items,subtotal,discount,total,status,amount_received,sale_date,created_at,updated_at) VALUES(${inv},${staffUser.id},${staffUser.full_name||staffUser.employee_code},${o.customer_name},${o.customer_id},${JSON.stringify(items)},${subtotal},${discount},${total},'pending',0,CURRENT_DATE,now(),now()) RETURNING *`;
    await sql`UPDATE cash_customer_orders SET status='converted',cash_sale_id=${q[0].id},updated_at=now() WHERE id=${orderId} AND status='pending'`;
    return res.status(201).json({record:q[0]});
  }
  const customer=sessionToken?(await sql`SELECT c.* FROM cash_customer_sessions s JOIN cash_sale_customers c ON c.id=s.customer_id WHERE s.token_hash=${digest(sessionToken)} AND s.expires_at>now() AND c.status='active' LIMIT 1`)[0]:null;
  if(!customer)return res.status(401).json({error:"Customer login required"});
  if(req.method==="GET"&&action==="products"){const rows=await sql`SELECT id,sku,name,category,unit,barcode,product_image_url FROM cash_sale_products WHERE status='active' ORDER BY name,id LIMIT 500`;return res.status(200).json({records:rows})}
  if(req.method==="POST"&&action==="order"){
    const raw=Array.isArray(b.items)?b.items:[],ids=raw.map(x=>asId(x.product_id)).filter(Boolean);if(!ids.length)return res.status(400).json({error:"Kam az kam aik product add karein"});
    const valid=await sql`SELECT id,name,unit,sale_price FROM cash_sale_products WHERE id=ANY(${ids}) AND status='active'`,map=new Map(valid.map(x=>[Number(x.id),x]));
    const items=raw.map(x=>({product_id:asId(x.product_id),qty:Math.max(0,Number(x.qty)||0)})).filter(x=>x.qty>0&&map.has(x.product_id)).map(x=>({...x,name:map.get(x.product_id).name,unit:map.get(x.product_id).unit,price:Number(map.get(x.product_id).sale_price)||0}));
    if(!items.length)return res.status(400).json({error:"Valid products required"});const no="CO-"+Date.now();
    const r=await sql`INSERT INTO cash_customer_orders(order_number,customer_id,items) VALUES(${no},${customer.id},${JSON.stringify(items)}) RETURNING id,order_number,status,created_at`;return res.status(201).json({record:r[0]});
  }
  if(req.method==="GET"&&action==="materials"){const from=cleanText(req.query?.from),to=cleanText(req.query?.to);let rows;if(from&&to){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return res.status(400).json({error:"Valid From / To dates required"});rows=await sql`SELECT x->>'name' product,COALESCE(x->>'unit','pcs') unit,SUM(COALESCE((x->>'qty')::numeric,0)) quantity FROM cash_sale_queue q CROSS JOIN LATERAL jsonb_array_elements(q.items) x WHERE q.customer_id=${customer.id} AND q.status IN ('paid','partial','credit') AND q.sale_date BETWEEN ${from}::date AND ${to}::date GROUP BY x->>'name',COALESCE(x->>'unit','pcs') ORDER BY product`;return res.status(200).json({from,to,records:rows})}const days=Math.min(365,Math.max(1,Number(req.query?.days)||30));rows=await sql`SELECT x->>'name' product,COALESCE(x->>'unit','pcs') unit,SUM(COALESCE((x->>'qty')::numeric,0)) quantity FROM cash_sale_queue q CROSS JOIN LATERAL jsonb_array_elements(q.items) x WHERE q.customer_id=${customer.id} AND q.status IN ('paid','partial','credit') AND q.sale_date>=CURRENT_DATE-${days}::int GROUP BY x->>'name',COALESCE(x->>'unit','pcs') ORDER BY product`;return res.status(200).json({days,records:rows})}
  if(req.method==="GET"&&action==="dashboard"){const bills=await sql`SELECT id,invoice_number,sale_date,items,total,COALESCE(amount_received,0) amount_received,GREATEST(total-COALESCE(amount_received,0),0) balance_due,status,created_at FROM cash_sale_queue WHERE customer_id=${customer.id} AND status IN ('paid','partial','credit') ORDER BY created_at DESC,id DESC LIMIT 200`;const orders=await sql`SELECT id,order_number,items,status,cash_sale_id,created_at FROM cash_customer_orders WHERE customer_id=${customer.id} ORDER BY created_at DESC,id DESC LIMIT 100`;return res.status(200).json({customer:{customer_code:customer.customer_code,name:customer.name,mobile:customer.mobile},summary:{sales:bills.reduce((n,x)=>n+Number(x.total||0),0),received:bills.reduce((n,x)=>n+Number(x.amount_received||0),0),outstanding:bills.reduce((n,x)=>n+Number(x.balance_due||0),0)},bills,orders})}
  return res.status(405).json({error:"Method not allowed"});
}


async function ensureGelatoSettings(sql){
  await sql`CREATE TABLE IF NOT EXISTS gelato_ingredient_settings(
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),
    settings JSONB NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  const rows=await sql`SELECT id FROM gelato_ingredient_settings WHERE id=1`;
  if(!rows[0]){
    const defaults={
      whole_milk:{name:"Whole Milk",fat_pct:3.5,msnf_pct:8.5,protein_pct:3.2,lactose_pct:4.8,ash_pct:0.7,moisture_pct:87.8},
      cream:{name:"Cream",fat_pct:35,msnf_pct:5.5,protein_pct:2.1,lactose_pct:3.0,ash_pct:0.5,moisture_pct:59.4},
      dry_milk_profiles:[{id:"melco-26",name:"Melco Vegetable Fat Filled Powder",fat_pct:26,protein_pct:16,carbs_pct:50,lactose_pct:null,true_msnf_pct:null,moisture_pct:4,ash_pct:null,other_pct:4,added_sugar_pct:null,total_solids_pct:96,note:"Bag label profile; lactose/added sugar split requires current COA."}],
      cremodan_profiles:[],
      machine_profiles:[],
      flavor_profiles:[],
      cost_settings:{currency:"PKR",whole_milk_per_kg:0,cream_per_kg:0,sucrose_per_kg:0,glucose_per_kg:0,water_per_kg:0,stabilizer_per_kg:0,emulsifier_per_kg:0},
      quality_lock:{fat_tolerance_pct:0.35,msnf_tolerance_pct:0.50,total_solids_tolerance_pct:1.0,sweetness_index_tolerance:1.5,freezing_index_tolerance:2.0},
      default_dry_milk_id:"melco-26",
      default_cremodan_id:null,
      default_machine_id:null,
      default_flavor_id:null
    };
    await sql`INSERT INTO gelato_ingredient_settings(id,settings) VALUES(1,${JSON.stringify(defaults)}::jsonb)`;
  }
}
function gelatoPct(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0}
function normalizeGelatoSettings(b={}){
  const dry=(Array.isArray(b.dry_milk_profiles)?b.dry_milk_profiles:[]).slice(0,20).map((p,i)=>({
    id:cleanText(p?.id)||("powder-"+i+"-"+Date.now()),
    name:cleanText(p?.name)||("Dry Milk Profile "+(i+1)),
    fat_pct:gelatoPct(p?.fat_pct),
    protein_pct:gelatoPct(p?.protein_pct),
    carbs_pct:gelatoPct(p?.carbs_pct),
    lactose_pct:p?.lactose_pct===null||p?.lactose_pct===""?null:gelatoPct(p?.lactose_pct),
    true_msnf_pct:p?.true_msnf_pct===null||p?.true_msnf_pct===""?null:gelatoPct(p?.true_msnf_pct),
    moisture_pct:gelatoPct(p?.moisture_pct),
    ash_pct:p?.ash_pct===null||p?.ash_pct===""?null:gelatoPct(p?.ash_pct),
    other_pct:gelatoPct(p?.other_pct),
    added_sugar_pct:p?.added_sugar_pct===null||p?.added_sugar_pct===""?null:gelatoPct(p?.added_sugar_pct),
    total_solids_pct:p?.total_solids_pct===null||p?.total_solids_pct===""?null:gelatoPct(p?.total_solids_pct),
    price_per_kg:Math.max(0,Number(p?.price_per_kg)||0),
    note:cleanText(p?.note)
  }));
  const cremodan=(Array.isArray(b.cremodan_profiles)?b.cremodan_profiles:[]).slice(0,20).map((p,i)=>({
    id:cleanText(p?.id)||("cremodan-"+i+"-"+Date.now()),
    grade:cleanText(p?.grade)||("CREMODAN "+(i+1)),
    dosage_g_per_kg:Math.max(0,Math.min(30,Number(p?.dosage_g_per_kg)||0)),
    includes_emulsifier:p?.includes_emulsifier!==false,
    product_type:cleanText(p?.product_type)||"General",
    price_per_kg:Math.max(0,Number(p?.price_per_kg)||0),
    note:cleanText(p?.note)
  }));
  const machines=(Array.isArray(b.machine_profiles)?b.machine_profiles:[]).slice(0,20).map((p,i)=>({
    id:cleanText(p?.id)||("machine-"+i+"-"+Date.now()),
    name:cleanText(p?.name)||("Batch Freezer "+(i+1)),
    type:cleanText(p?.type)||"Batch Freezer",
    min_batch_kg:Math.max(0,Number(p?.min_batch_kg)||0),
    max_batch_kg:Math.max(0,Number(p?.max_batch_kg)||0),
    overrun_min_pct:Math.max(0,Math.min(200,Number(p?.overrun_min_pct)||0)),
    overrun_max_pct:Math.max(0,Math.min(200,Number(p?.overrun_max_pct)||0)),
    draw_temp_c:p?.draw_temp_c===null||p?.draw_temp_c===""?null:Number(p?.draw_temp_c),
    ageing_min_hours:Math.max(0,Number(p?.ageing_min_hours)||0),
    hardening_temp_c:p?.hardening_temp_c===null||p?.hardening_temp_c===""?null:Number(p?.hardening_temp_c),
    notes:cleanText(p?.notes)
  }));
  const flavors=(Array.isArray(b.flavor_profiles)?b.flavor_profiles:[]).slice(0,40).map((p,i)=>({
    id:cleanText(p?.id)||("flavor-"+i+"-"+Date.now()),
    name:cleanText(p?.name)||("Flavor Profile "+(i+1)),
    category:cleanText(p?.category)||"Flavor / Inclusion",
    recommended_min_pct:Math.max(0,Math.min(100,Number(p?.recommended_min_pct)||0)),
    recommended_max_pct:Math.max(0,Math.min(100,Number(p?.recommended_max_pct)||0)),
    fat_pct:gelatoPct(p?.fat_pct),
    protein_pct:gelatoPct(p?.protein_pct),
    dairy_msnf_pct:p?.dairy_msnf_pct===null||p?.dairy_msnf_pct===""?null:gelatoPct(p?.dairy_msnf_pct),
    sucrose_pct:gelatoPct(p?.sucrose_pct),
    dextrose_pct:gelatoPct(p?.dextrose_pct),
    glucose_pct:gelatoPct(p?.glucose_pct),
    fructose_pct:gelatoPct(p?.fructose_pct),
    moisture_pct:gelatoPct(p?.moisture_pct),
    ash_pct:gelatoPct(p?.ash_pct),
    brix_pct:p?.brix_pct===null||p?.brix_pct===""?null:gelatoPct(p?.brix_pct),
    acidity_pct:p?.acidity_pct===null||p?.acidity_pct===""?null:gelatoPct(p?.acidity_pct),
    composition_verified:p?.composition_verified===true,
    price_per_kg:Math.max(0,Number(p?.price_per_kg)||0),
    source_note:cleanText(p?.source_note),
    note:cleanText(p?.note)
  }));
  const costSettings={
    currency:cleanText(b?.cost_settings?.currency)||"PKR",
    whole_milk_per_kg:Math.max(0,Number(b?.cost_settings?.whole_milk_per_kg)||0),
    cream_per_kg:Math.max(0,Number(b?.cost_settings?.cream_per_kg)||0),
    sucrose_per_kg:Math.max(0,Number(b?.cost_settings?.sucrose_per_kg)||0),
    glucose_per_kg:Math.max(0,Number(b?.cost_settings?.glucose_per_kg)||0),
    water_per_kg:Math.max(0,Number(b?.cost_settings?.water_per_kg)||0),
    stabilizer_per_kg:Math.max(0,Number(b?.cost_settings?.stabilizer_per_kg)||0),
    emulsifier_per_kg:Math.max(0,Number(b?.cost_settings?.emulsifier_per_kg)||0)
  };
  const qualityLock={
    fat_tolerance_pct:Math.max(0,Math.min(5,Number(b?.quality_lock?.fat_tolerance_pct)||0.35)),
    msnf_tolerance_pct:Math.max(0,Math.min(5,Number(b?.quality_lock?.msnf_tolerance_pct)||0.50)),
    total_solids_tolerance_pct:Math.max(0,Math.min(10,Number(b?.quality_lock?.total_solids_tolerance_pct)||1.0)),
    sweetness_index_tolerance:Math.max(0,Math.min(10,Number(b?.quality_lock?.sweetness_index_tolerance)||1.5)),
    freezing_index_tolerance:Math.max(0,Math.min(15,Number(b?.quality_lock?.freezing_index_tolerance)||2.0))
  };
  return {
    whole_milk:{name:"Whole Milk",fat_pct:gelatoPct(b?.whole_milk?.fat_pct||3.5),msnf_pct:gelatoPct(b?.whole_milk?.msnf_pct||8.5),protein_pct:gelatoPct(b?.whole_milk?.protein_pct||3.2),lactose_pct:gelatoPct(b?.whole_milk?.lactose_pct||4.8),ash_pct:gelatoPct(b?.whole_milk?.ash_pct||0.7),moisture_pct:gelatoPct(b?.whole_milk?.moisture_pct||87.8)},
    cream:{name:"Cream",fat_pct:gelatoPct(b?.cream?.fat_pct||35),msnf_pct:gelatoPct(b?.cream?.msnf_pct||5.5),protein_pct:gelatoPct(b?.cream?.protein_pct||2.1),lactose_pct:gelatoPct(b?.cream?.lactose_pct||3.0),ash_pct:gelatoPct(b?.cream?.ash_pct||0.5),moisture_pct:gelatoPct(b?.cream?.moisture_pct||59.4)},
    dry_milk_profiles:dry.length?dry:[{id:"melco-26",name:"Melco Vegetable Fat Filled Powder",fat_pct:26,protein_pct:16,carbs_pct:50,lactose_pct:null,true_msnf_pct:null,moisture_pct:4,ash_pct:null,other_pct:4,added_sugar_pct:null,total_solids_pct:96,note:"Bag label profile; lactose/added sugar split requires current COA."}],
    cremodan_profiles:cremodan,
    machine_profiles:machines,
    flavor_profiles:flavors,
    cost_settings:costSettings,
    quality_lock:qualityLock,
    default_dry_milk_id:cleanText(b.default_dry_milk_id)||(dry[0]?.id||"melco-26"),
    default_cremodan_id:cleanText(b.default_cremodan_id),
    default_machine_id:cleanText(b.default_machine_id),
    default_flavor_id:cleanText(b.default_flavor_id)
  };
}
async function gelatoSettings(sql,req,user){
  await ensureGelatoSettings(sql);
  if(req.method==="GET"){
    const row=(await sql`SELECT settings,updated_by,updated_at FROM gelato_ingredient_settings WHERE id=1`)[0];
    return {status:200,data:{settings:row?.settings||{},updated_by:row?.updated_by||null,updated_at:row?.updated_at||null}};
  }
  if(req.method==="PUT"||req.method==="PATCH"){
    if(String(user.designation||"").toLowerCase()!=="admin")return {status:403,data:{error:"Sirf Admin ingredient profiles update kar sakta hai"}};
    const settings=normalizeGelatoSettings(bodyOf(req)),by=user.full_name||user.employee_code||"Admin";
    const row=(await sql`UPDATE gelato_ingredient_settings SET settings=${JSON.stringify(settings)}::jsonb,updated_by=${by},updated_at=now() WHERE id=1 RETURNING settings,updated_by,updated_at`)[0];
    return {status:200,data:row};
  }
  return {status:405,data:{error:"Method not allowed"}};
}


async function ensureGelatoBusinessRecipes(sql){
  await sql`CREATE TABLE IF NOT EXISTS gelato_business_recipes(
    id BIGSERIAL PRIMARY KEY,
    business_name TEXT NOT NULL,
    recipe_name TEXT NOT NULL,
    department TEXT NOT NULL,
    system TEXT,
    base_mode TEXT,
    source_recipe_id TEXT,
    source_name TEXT,
    source_url TEXT,
    source_type TEXT,
    status TEXT NOT NULL DEFAULT 'trial',
    version INTEGER NOT NULL DEFAULT 1,
    formula JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_formula JSONB NOT NULL DEFAULT '[]'::jsonb,
    ingredient_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    research_target JSONB NOT NULL DEFAULT '{}'::jsonb,
    research_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    research_comments JSONB NOT NULL DEFAULT '[]'::jsonb,
    perfection_score NUMERIC(5,2),
    validated_shelf_life TEXT,
    storage_conditions TEXT,
    shelf_life_guidance TEXT,
    trial_notes TEXT,
    production_tested_at DATE,
    passed_at TIMESTAMPTZ,
    created_by_id BIGINT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE gelato_business_recipes ADD COLUMN IF NOT EXISTS production_confidence NUMERIC(5,2)`;
  await sql`ALTER TABLE gelato_business_recipes ADD COLUMN IF NOT EXISTS process_profile JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE gelato_business_recipes ADD COLUMN IF NOT EXISTS golden_at TIMESTAMPTZ`;
  await sql`CREATE INDEX IF NOT EXISTS gelato_business_recipes_business_idx ON gelato_business_recipes(business_name,status,updated_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS gelato_business_recipe_versions(
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES gelato_business_recipes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    changed_by TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS gelato_recipe_qc(
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES gelato_business_recipes(id) ON DELETE CASCADE,
    batch_code TEXT,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    machine TEXT,
    operator_name TEXT,
    mix_temp_c NUMERIC(7,2),
    pasteurization_peak_c NUMERIC(7,2),
    ageing_hours NUMERIC(8,2),
    ph NUMERIC(6,3),
    brix NUMERIC(7,2),
    overrun_pct NUMERIC(8,2),
    draw_temp_c NUMERIC(7,2),
    melt_30min_pct NUMERIC(8,2),
    hardness_score INTEGER,
    sweetness_score INTEGER,
    iciness_score INTEGER,
    body_score INTEGER,
    aftertaste_score INTEGER,
    day1_notes TEXT,
    day7_notes TEXT,
    result TEXT NOT NULL DEFAULT 'trial',
    created_by_id BIGINT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS mix_sample_g NUMERIC(10,3)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS frozen_sample_g NUMERIC(10,3)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS sample_volume_ml NUMERIC(10,3)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS calculated_overrun_pct NUMERIC(10,3)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS finished_yield_l NUMERIC(12,3)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS batch_output_kg NUMERIC(12,3)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS pasteurization_hold_sec NUMERIC(10,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS cooling_end_temp_c NUMERIC(7,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS cooling_time_min NUMERIC(10,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS homogenization_pressure_bar NUMERIC(10,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS ageing_temp_c NUMERIC(7,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS hardening_temp_c NUMERIC(7,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS hardening_time_min NUMERIC(10,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS storage_temp_c NUMERIC(7,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS process_compliance_pct NUMERIC(5,2)`;
  await sql`ALTER TABLE gelato_recipe_qc ADD COLUMN IF NOT EXISTS process_deviations JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`CREATE INDEX IF NOT EXISTS gelato_recipe_qc_recipe_idx ON gelato_recipe_qc(recipe_id,test_date DESC,id DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS gelato_recipe_bio(
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES gelato_business_recipes(id) ON DELETE CASCADE,
    sample_code TEXT,
    lab_name TEXT,
    report_reference TEXT,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    storage_day INTEGER,
    storage_temp_c NUMERIC(7,2),
    packaging TEXT,
    ph NUMERIC(6,3),
    water_activity NUMERIC(6,4),
    total_plate_count NUMERIC,
    coliform_count NUMERIC,
    yeast_mold_count NUMERIC,
    listeria_status TEXT,
    salmonella_status TEXT,
    staph_status TEXT,
    probiotic_cfu NUMERIC,
    culture_strain TEXT,
    notes TEXT,
    created_by_id BIGINT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS gelato_recipe_bio_recipe_idx ON gelato_recipe_bio(recipe_id,test_date DESC,id DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS gelato_recipe_sensory(
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES gelato_business_recipes(id) ON DELETE CASCADE,
    qc_id BIGINT REFERENCES gelato_recipe_qc(id) ON DELETE SET NULL,
    tester_name TEXT,
    panel_date DATE NOT NULL DEFAULT CURRENT_DATE,
    creaminess_score INTEGER,
    smoothness_score INTEGER,
    sweetness_score INTEGER,
    flavor_score INTEGER,
    body_score INTEGER,
    melt_score INTEGER,
    aftertaste_score INTEGER,
    overall_score INTEGER,
    comments TEXT,
    created_by_id BIGINT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS gelato_recipe_sensory_recipe_idx ON gelato_recipe_sensory(recipe_id,panel_date DESC,id DESC)`;
}
function cleanFormula(v){
  const arr=Array.isArray(v)?v:[];
  return arr.slice(0,100).map((x,i)=>({
    name:cleanText(x?.name)||("Ingredient "+(i+1)),
    g:Math.max(0,Number(x?.g)||0)
  })).filter(x=>x.g>0);
}
function gelatoShelfGuidance(department){
  if(department==="icecream")return "Frozen dessert: rapid hardening and a stable frozen cold chain are essential. Exact commercial shelf life is not auto-certified; validate the finished product under your actual storage/distribution conditions.";
  if(department==="sauces")return "Sauce shelf life is not predictable from ingredient ratios alone. Validate pH, water activity, heat process, packaging and storage conditions before making a commercial shelf-life claim.";
  if(department==="brownies")return "Brownie shelf life depends on water activity, bake endpoint, packaging, formulation and storage. Validate the finished product before assigning a commercial shelf life.";
  return "Commercial shelf life must be validated on the finished product and actual storage conditions.";
}
function evaluateResearchFit(formula,sourceFormula,context={}){
  const cur=cleanFormula(formula),src=cleanFormula(sourceFormula);
  const total=cur.reduce((s,x)=>s+x.g,0),srcTotal=src.reduce((s,x)=>s+x.g,0);
  if(!cur.length||!src.length||!total||!srcTotal)return {score:null,metrics:{},comments:["Research fit unavailable: complete current and source formulas are required."]};

  const normalizeName=s=>String(s||"").trim().toLowerCase();
  const curMap=new Map(cur.map(x=>[normalizeName(x.name),x.g/total]));
  const srcMap=new Map(src.map(x=>[normalizeName(x.name),x.g/srcTotal]));
  const names=new Set([...curMap.keys(),...srcMap.keys()]);
  let l1=0;
  const changes=[];
  for(const name of names){
    const a=curMap.get(name)||0,b=srcMap.get(name)||0,d=a-b;
    l1+=Math.abs(d);
    if(Math.abs(d)>=0.0025)changes.push({name,delta_pct:d*100});
  }
  const ratioFit=Math.max(0,1-(l1/2));
  const massFit=Math.max(0,1-Math.min(1,Math.abs(total-srcTotal)/srcTotal));

  const target=context?.research_target||{};
  const actual=target?.actual||{};
  const targetChecks=[];
  const addCheck=(key,label,tolerance,actualKey=key)=>{
    const targetVal=Number(target?.[key]),actualVal=Number(actual?.[actualKey]);
    if(Number.isFinite(targetVal)&&Number.isFinite(actualVal)){
      const delta=Math.abs(actualVal-targetVal);
      const fit=Math.max(0,1-(delta/Math.max(tolerance,Math.abs(targetVal)*.20,1)));
      targetChecks.push({key,label,target:targetVal,actual:actualVal,delta,fit});
    }
  };
  addCheck("fat","Fat",2);
  addCheck("msnf","MSNF",2.5);
  addCheck("total_solids","Total solids",4);
  addCheck("water","Water",4);
  addCheck("sucrose","Sucrose",3);
  addCheck("glucose","Glucose solids",3);
  const compositionFit=targetChecks.length?targetChecks.reduce((s,x)=>s+x.fit,0)/targetChecks.length:null;
  const coverage=Number(actual?.data_coverage);
  const coverageFactor=Number.isFinite(coverage)?Math.max(.55,Math.min(1,coverage/100)):1;

  let score;
  if(compositionFit!==null){
    score=((compositionFit*.70)+(ratioFit*.20)+(massFit*.10))*100*coverageFactor;
  }else{
    score=((ratioFit*.85)+(massFit*.15))*100;
  }
  score=Math.max(0,Math.min(100,score));

  changes.sort((a,b)=>Math.abs(b.delta_pct)-Math.abs(a.delta_pct));
  const comments=[];
  if(score>=98)comments.push("Formula research target ke bohat qareeb hai; measured/known composition deviation negligible hai.");
  else if(score>=93)comments.push("Minor research deviation hai. Production sensory aur storage trial continue rakhein.");
  else if(score>=85)comments.push("Meaningful research deviation hai; body, sweetness, freezing behaviour ya texture par effect aa sakta hai.");
  else comments.push("Major research deviation hai. Is version ko final karne se pehle re-balance aur production validation recommended hai.");

  targetChecks.filter(x=>x.delta>.25).sort((a,b)=>b.delta-a.delta).slice(0,4).forEach(x=>{
    comments.push(x.label+": target "+x.target.toFixed(2)+"%, calculated "+x.actual.toFixed(2)+"%.");
  });
  changes.slice(0,3).forEach(x=>comments.push((x.delta_pct>0?"Higher":"Lower")+" formula share vs saved research master: "+x.name+" ("+Math.abs(x.delta_pct).toFixed(2)+" percentage-points)."));

  const settings=context?.ingredient_settings||{};
  const powder=(settings?.dry_milk_profiles||[]).find(x=>x.id===settings?.default_dry_milk_id);
  if(powder&&(powder.added_sugar_pct===null||powder.lactose_pct===null))
    comments.push("Selected dry milk/fat-filled powder ka lactose/added-sugar split incomplete hai; sweetness/freezing analysis partial confidence par hai.");
  if(Number.isFinite(coverage)&&coverage<90)
    comments.push("Ingredient composition data coverage "+coverage.toFixed(1)+"% hai. Current COA values add karne se Research Fit zyada reliable hoga.");
  if(context?.department==="icecream")
    comments.push("Stabilizer/emulsifier ya CREMODAN dosage ko exact product grade ke manufacturer specification aur production trial ke against verify karein.");

  return {
    score:Number(score.toFixed(2)),
    metrics:{
      ratio_fit_pct:Number((ratioFit*100).toFixed(2)),
      batch_mass_fit_pct:Number((massFit*100).toFixed(2)),
      composition_fit_pct:compositionFit===null?null:Number((compositionFit*100).toFixed(2)),
      data_coverage_pct:Number.isFinite(coverage)?Number(coverage.toFixed(2)):null,
      current_total_g:Number(total.toFixed(2)),
      source_total_g:Number(srcTotal.toFixed(2)),
      target_checks:targetChecks,
      largest_deviations:changes.slice(0,6)
    },
    comments
  };
}

function normalizeProcessProfile(p={}){
  const n=v=>v===null||v===undefined||v===""?null:Number(v);
  return {
    pasteurization_min_c:n(p.pasteurization_min_c),
    pasteurization_max_c:n(p.pasteurization_max_c),
    pasteurization_hold_min_sec:n(p.pasteurization_hold_min_sec),
    cooling_target_max_c:n(p.cooling_target_max_c),
    cooling_max_minutes:n(p.cooling_max_minutes),
    homogenization_min_bar:n(p.homogenization_min_bar),
    homogenization_max_bar:n(p.homogenization_max_bar),
    ageing_temp_max_c:n(p.ageing_temp_max_c),
    ageing_min_hours:n(p.ageing_min_hours),
    ageing_max_hours:n(p.ageing_max_hours),
    draw_temp_target_c:n(p.draw_temp_target_c),
    draw_temp_tolerance_c:n(p.draw_temp_tolerance_c),
    hardening_target_max_c:n(p.hardening_target_max_c),
    hardening_max_minutes:n(p.hardening_max_minutes),
    storage_target_max_c:n(p.storage_target_max_c),
    source_note:cleanText(p.source_note),
    notes:cleanText(p.notes)
  };
}
function evaluateProcessCompliance(q={},profile={}){
  const p=normalizeProcessProfile(profile),checks=[];
  const n=v=>v===null||v===undefined||v===""?null:Number(v);
  const add=(label,actual,pass,required=true)=>{
    const a=n(actual);
    if(!required&&a===null)return;
    checks.push({label,actual:a,pass:a!==null&&Boolean(pass(a))});
  };
  if(p.pasteurization_min_c!==null||p.pasteurization_max_c!==null)
    add("Pasteurization temperature",q.pasteurization_peak_c,a=>(p.pasteurization_min_c===null||a>=p.pasteurization_min_c)&&(p.pasteurization_max_c===null||a<=p.pasteurization_max_c));
  if(p.pasteurization_hold_min_sec!==null)
    add("Pasteurization hold",q.pasteurization_hold_sec,a=>a>=p.pasteurization_hold_min_sec);
  if(p.cooling_target_max_c!==null)
    add("Rapid cooling endpoint",q.cooling_end_temp_c,a=>a<=p.cooling_target_max_c);
  if(p.cooling_max_minutes!==null)
    add("Cooling time",q.cooling_time_min,a=>a<=p.cooling_max_minutes);
  if(p.homogenization_min_bar!==null||p.homogenization_max_bar!==null)
    add("Homogenization pressure",q.homogenization_pressure_bar,a=>(p.homogenization_min_bar===null||a>=p.homogenization_min_bar)&&(p.homogenization_max_bar===null||a<=p.homogenization_max_bar));
  if(p.ageing_temp_max_c!==null)
    add("Ageing temperature",q.ageing_temp_c,a=>a<=p.ageing_temp_max_c);
  if(p.ageing_min_hours!==null||p.ageing_max_hours!==null)
    add("Ageing time",q.ageing_hours,a=>(p.ageing_min_hours===null||a>=p.ageing_min_hours)&&(p.ageing_max_hours===null||a<=p.ageing_max_hours));
  if(p.draw_temp_target_c!==null){
    const tol=p.draw_temp_tolerance_c===null?1.5:Math.max(.1,p.draw_temp_tolerance_c);
    add("Draw temperature",q.draw_temp_c,a=>Math.abs(a-p.draw_temp_target_c)<=tol);
  }
  if(p.hardening_target_max_c!==null)
    add("Hardening temperature",q.hardening_temp_c,a=>a<=p.hardening_target_max_c);
  if(p.hardening_max_minutes!==null)
    add("Hardening time",q.hardening_time_min,a=>a<=p.hardening_max_minutes);
  if(p.storage_target_max_c!==null)
    add("Storage temperature",q.storage_temp_c,a=>a<=p.storage_target_max_c);
  if(!checks.length)return {score:null,status:"not_configured",checks:[],deviations:["Process profile configured nahi hai."]};
  const passed=checks.filter(x=>x.pass).length;
  const score=Number(((passed/checks.length)*100).toFixed(1));
  const deviations=checks.filter(x=>!x.pass).map(x=>x.label+" target se bahar ya missing hai.");
  return {score,status:score>=90?"pass":score>=75?"review":"fail",checks,deviations};
}
async function recalcProductionConfidence(sql,recipeId){
  const rows=await sql`SELECT * FROM gelato_recipe_qc WHERE recipe_id=${recipeId} ORDER BY test_date DESC,id DESC`;
  if(!rows.length){
    await sql`UPDATE gelato_business_recipes SET production_confidence=0 WHERE id=${recipeId}`;
    return 0;
  }
  const passed=rows.filter(x=>x.result==="pass").length;
  const recent=rows[0];
  const fields=["ph","brix","overrun_pct","draw_temp_c","melt_30min_pct","hardness_score","sweetness_score","iciness_score","body_score","aftertaste_score","process_compliance_pct"];
  const filled=fields.filter(k=>recent[k]!==null&&recent[k]!==undefined&&recent[k]!=="").length;
  const passScore=passed>=3?50:passed===2?40:passed===1?25:0;
  const completeness=(filled/fields.length)*30;
  const storage=recent.day7_notes?20:(recent.day1_notes?10:0);
  const recentFails=rows.slice(0,3).filter(x=>x.result==="fail").length;
  const score=Math.max(0,Math.min(100,passScore+completeness+storage-(recentFails*10)));
  await sql`UPDATE gelato_business_recipes SET production_confidence=${score},updated_at=now() WHERE id=${recipeId}`;
  return Number(score.toFixed(2));
}

function bioStatusValue(v){
  const s=String(v||"").trim().toLowerCase();
  if(["not detected","negative","nd","absent"].includes(s))return "not_detected";
  if(["detected","positive","present"].includes(s))return "detected";
  return s||null;
}
function bioValidationSummary(rows){
  if(!rows.length)return {status:"incomplete",confidence:0,comments:["Biological validation data enter nahi ki gayi."]};
  const latest=rows[0];
  const pathogenFields=["listeria_status","salmonella_status","staph_status"];
  const pathogenDetected=pathogenFields.some(k=>bioStatusValue(latest[k])==="detected");
  const pathogenKnown=pathogenFields.filter(k=>bioStatusValue(latest[k])==="not_detected").length;
  const countFields=["total_plate_count","coliform_count","yeast_mold_count"];
  const countsFilled=countFields.filter(k=>latest[k]!==null&&latest[k]!==undefined).length;
  const physFilled=["ph","water_activity","storage_temp_c"].filter(k=>latest[k]!==null&&latest[k]!==undefined).length;
  const hasStorageSeries=new Set(rows.map(x=>Number(x.storage_day)).filter(Number.isFinite)).size>=2;
  const hasPackaging=Boolean(cleanText(latest.packaging));
  const completeness=((pathogenKnown/3)*35)+((countsFilled/3)*25)+((physFilled/3)*20)+(hasStorageSeries?15:0)+(hasPackaging?5:0);
  let status="incomplete";
  const comments=[];
  if(pathogenDetected){
    status="hold";
    comments.push("Pathogen result Detected/Positive hai — product HOLD par rahega; release nahi kiya ja sakta.");
  }else if(pathogenKnown===3&&countsFilled===3&&physFilled>=2&&hasStorageSeries){
    status="lab_validated";
    comments.push("Required biological validation fields complete hain aur pathogen results Not Detected hain.");
  }else{
    comments.push("Biological validation incomplete hai; missing lab/storage fields complete karein.");
  }
  if(!hasStorageSeries)comments.push("Shelf-life confidence ke liye kam az kam 2 storage checkpoints required hain.");
  if(pathogenKnown<3&&!pathogenDetected)comments.push("Listeria, Salmonella aur Staphylococcus status complete karein.");
  if(countsFilled<3)comments.push("TPC, Coliform aur Yeast/Mold counts complete karein.");
  return {status,confidence:Number(Math.max(0,Math.min(100,completeness)).toFixed(1)),comments};
}
async function gelatoBio(sql,req,user){
  await ensureGelatoBusinessRecipes(sql);
  const id=asId(req.query?.id),recipeId=asId(req.query?.recipe_id),b=bodyOf(req);
  if(req.method==="GET"){
    if(!recipeId)return {status:400,data:{error:"Business recipe id required hai"}};
    const rows=await sql`SELECT * FROM gelato_recipe_bio WHERE recipe_id=${recipeId} ORDER BY test_date DESC,id DESC LIMIT 200`;
    return {status:200,data:{records:rows,summary:bioValidationSummary(rows)}};
  }
  if(req.method==="POST"){
    if(!recipeId)return {status:400,data:{error:"Business recipe id required hai"}};
    const recipe=(await sql`SELECT id FROM gelato_business_recipes WHERE id=${recipeId}`)[0];
    if(!recipe)return {status:404,data:{error:"Business recipe not found"}};
    const n=v=>v===null||v===undefined||v===""?null:Number(v);
    const row=(await sql`INSERT INTO gelato_recipe_bio(
      recipe_id,sample_code,lab_name,report_reference,test_date,storage_day,storage_temp_c,packaging,ph,water_activity,
      total_plate_count,coliform_count,yeast_mold_count,listeria_status,salmonella_status,staph_status,probiotic_cfu,culture_strain,notes,
      created_by_id,created_by_name
    ) VALUES(
      ${recipeId},${cleanText(b.sample_code)},${cleanText(b.lab_name)},${cleanText(b.report_reference)},COALESCE(${cleanText(b.test_date)}::date,CURRENT_DATE),
      ${n(b.storage_day)},${n(b.storage_temp_c)},${cleanText(b.packaging)},${n(b.ph)},${n(b.water_activity)},
      ${n(b.total_plate_count)},${n(b.coliform_count)},${n(b.yeast_mold_count)},${cleanText(b.listeria_status)},${cleanText(b.salmonella_status)},${cleanText(b.staph_status)},
      ${n(b.probiotic_cfu)},${cleanText(b.culture_strain)},${cleanText(b.notes)},${user.id},${user.full_name||user.employee_code||"User"}
    ) RETURNING *`)[0];
    const rows=await sql`SELECT * FROM gelato_recipe_bio WHERE recipe_id=${recipeId} ORDER BY test_date DESC,id DESC`;
    return {status:201,data:{record:row,summary:bioValidationSummary(rows)}};
  }
  if(req.method==="DELETE"){
    if(String(user.designation||"").toLowerCase()!=="admin")return {status:403,data:{error:"Sirf Admin biological record delete kar sakta hai"}};
    if(!id)return {status:400,data:{error:"Valid biological record id required hai"}};
    const old=(await sql`SELECT recipe_id FROM gelato_recipe_bio WHERE id=${id}`)[0];
    if(!old)return {status:404,data:{error:"Biological record not found"}};
    await sql`DELETE FROM gelato_recipe_bio WHERE id=${id}`;
    const rows=await sql`SELECT * FROM gelato_recipe_bio WHERE recipe_id=${old.recipe_id} ORDER BY test_date DESC,id DESC`;
    return {status:200,data:{deleted:true,summary:bioValidationSummary(rows)}};
  }
  return {status:405,data:{error:"Method not allowed"}};
}
async function gelatoQc(sql,req,user){
  await ensureGelatoBusinessRecipes(sql);
  const id=asId(req.query?.id),recipeId=asId(req.query?.recipe_id),b=bodyOf(req);
  if(req.method==="GET"){
    if(!recipeId)return {status:400,data:{error:"Business recipe id required hai"}};
    const rows=await sql`SELECT * FROM gelato_recipe_qc WHERE recipe_id=${recipeId} ORDER BY test_date DESC,id DESC LIMIT 100`;
    const recipe=(await sql`SELECT id,recipe_name,status,production_confidence FROM gelato_business_recipes WHERE id=${recipeId}`)[0];
    return {status:200,data:{records:rows,recipe}};
  }
  if(req.method==="POST"){
    if(!recipeId)return {status:400,data:{error:"Business recipe id required hai"}};
    const recipe=(await sql`SELECT id,process_profile FROM gelato_business_recipes WHERE id=${recipeId}`)[0];
    if(!recipe)return {status:404,data:{error:"Business recipe not found"}};
    const processEval=evaluateProcessCompliance(b,recipe.process_profile||{});
    const result=cleanText(b.result)||"trial";
    if(!["trial","pass","fail"].includes(result))return {status:400,data:{error:"QC result Trial, Pass ya Fail hona chahiye"}};
    const score=v=>v===null||v===undefined||v===""?null:Math.max(1,Math.min(10,Math.round(Number(v)||0)));
    const n=v=>v===null||v===undefined||v===""?null:Number(v);
    const row=(await sql`INSERT INTO gelato_recipe_qc(
      recipe_id,batch_code,test_date,machine,operator_name,mix_temp_c,pasteurization_peak_c,ageing_hours,ph,brix,overrun_pct,draw_temp_c,melt_30min_pct,
      mix_sample_g,frozen_sample_g,sample_volume_ml,calculated_overrun_pct,finished_yield_l,batch_output_kg,
      pasteurization_hold_sec,cooling_end_temp_c,cooling_time_min,homogenization_pressure_bar,ageing_temp_c,hardening_temp_c,hardening_time_min,storage_temp_c,process_compliance_pct,process_deviations,
      hardness_score,sweetness_score,iciness_score,body_score,aftertaste_score,day1_notes,day7_notes,result,created_by_id,created_by_name
    ) VALUES(
      ${recipeId},${cleanText(b.batch_code)},COALESCE(${cleanText(b.test_date)}::date,CURRENT_DATE),${cleanText(b.machine)},${cleanText(b.operator_name)},
      ${n(b.mix_temp_c)},${n(b.pasteurization_peak_c)},${n(b.ageing_hours)},${n(b.ph)},${n(b.brix)},${n(b.overrun_pct)},${n(b.draw_temp_c)},${n(b.melt_30min_pct)},
      ${n(b.mix_sample_g)},${n(b.frozen_sample_g)},${n(b.sample_volume_ml)},
      ${(()=>{const m=Number(b.mix_sample_g),f=Number(b.frozen_sample_g);return Number.isFinite(m)&&Number.isFinite(f)&&f>0?((m-f)/f)*100:null})()},
      ${n(b.finished_yield_l)},${n(b.batch_output_kg)},
      ${n(b.pasteurization_hold_sec)},${n(b.cooling_end_temp_c)},${n(b.cooling_time_min)},${n(b.homogenization_pressure_bar)},${n(b.ageing_temp_c)},${n(b.hardening_temp_c)},${n(b.hardening_time_min)},${n(b.storage_temp_c)},${processEval.score},${JSON.stringify(processEval.deviations)}::jsonb,
      ${score(b.hardness_score)},${score(b.sweetness_score)},${score(b.iciness_score)},${score(b.body_score)},${score(b.aftertaste_score)},
      ${cleanText(b.day1_notes)},${cleanText(b.day7_notes)},${result},${user.id},${user.full_name||user.employee_code||"User"}
    ) RETURNING *`)[0];
    const confidence=await recalcProductionConfidence(sql,recipeId);
    return {status:201,data:{record:row,production_confidence:confidence}};
  }
  if(req.method==="DELETE"){
    if(String(user.designation||"").toLowerCase()!=="admin")return {status:403,data:{error:"Sirf Admin QC record delete kar sakta hai"}};
    if(!id)return {status:400,data:{error:"Valid QC id required hai"}};
    const old=(await sql`SELECT recipe_id FROM gelato_recipe_qc WHERE id=${id}`)[0];
    if(!old)return {status:404,data:{error:"QC record not found"}};
    await sql`DELETE FROM gelato_recipe_qc WHERE id=${id}`;
    const confidence=await recalcProductionConfidence(sql,Number(old.recipe_id));
    return {status:200,data:{deleted:true,production_confidence:confidence}};
  }
  return {status:405,data:{error:"Method not allowed"}};
}

function sensorySummary(rows){
  if(!rows.length)return {panel_count:0,overall_avg:null,attribute_avg:{},confidence:0,comments:["Sensory panel data abhi available nahi."]};
  const attrs=["creaminess_score","smoothness_score","sweetness_score","flavor_score","body_score","melt_score","aftertaste_score","overall_score"];
  const avg={};
  attrs.forEach(k=>{
    const vals=rows.map(r=>Number(r[k])).filter(Number.isFinite);
    avg[k]=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  });
  const confidence=Math.min(100,(Math.min(rows.length,5)/5)*70+(attrs.filter(k=>avg[k]!==null).length/attrs.length)*30);
  const comments=[];
  if(avg.creaminess_score!==null&&avg.creaminess_score<6)comments.push("Panel creaminess low report kar raha hai; fat/protein/emulsification aur freezing rate review karein.");
  if(avg.smoothness_score!==null&&avg.smoothness_score<6)comments.push("Smoothness low hai; ice-crystal control, hardening speed aur heat-shock history review karein.");
  if(avg.sweetness_score!==null&&avg.sweetness_score>8)comments.push("Panel sweetness high report kar raha hai; sugar profile ko freezing power ke saath rebalance karein.");
  if(avg.flavor_score!==null&&avg.flavor_score<6)comments.push("Flavor intensity/quality low hai; flavor dose aur base masking effect review karein.");
  if(avg.melt_score!==null&&avg.melt_score<6)comments.push("Melt performance weak hai; stabilizer/emulsifier, fat destabilization aur overrun review karein.");
  if(!comments.length)comments.push("Sensory panel mein koi major low-score trigger nahi hua; repeatability ke liye multiple batches continue karein.");
  return {panel_count:rows.length,overall_avg:avg.overall_score===null?null:Number(avg.overall_score.toFixed(2)),attribute_avg:avg,confidence:Number(confidence.toFixed(1)),comments};
}
async function gelatoSensory(sql,req,user){
  await ensureGelatoBusinessRecipes(sql);
  const id=asId(req.query?.id),recipeId=asId(req.query?.recipe_id),b=bodyOf(req);
  if(req.method==="GET"){
    if(!recipeId)return {status:400,data:{error:"Business recipe id required hai"}};
    const rows=await sql`SELECT * FROM gelato_recipe_sensory WHERE recipe_id=${recipeId} ORDER BY panel_date DESC,id DESC LIMIT 200`;
    return {status:200,data:{records:rows,summary:sensorySummary(rows)}};
  }
  if(req.method==="POST"){
    if(!recipeId)return {status:400,data:{error:"Business recipe id required hai"}};
    const recipe=(await sql`SELECT id FROM gelato_business_recipes WHERE id=${recipeId}`)[0];
    if(!recipe)return {status:404,data:{error:"Business recipe not found"}};
    const s=v=>v===null||v===undefined||v===""?null:Math.max(1,Math.min(10,Math.round(Number(v)||0)));
    const row=(await sql`INSERT INTO gelato_recipe_sensory(
      recipe_id,qc_id,tester_name,panel_date,creaminess_score,smoothness_score,sweetness_score,flavor_score,body_score,melt_score,aftertaste_score,overall_score,comments,created_by_id,created_by_name
    ) VALUES(
      ${recipeId},${asId(b.qc_id)},${cleanText(b.tester_name)},COALESCE(${cleanText(b.panel_date)}::date,CURRENT_DATE),
      ${s(b.creaminess_score)},${s(b.smoothness_score)},${s(b.sweetness_score)},${s(b.flavor_score)},${s(b.body_score)},${s(b.melt_score)},${s(b.aftertaste_score)},${s(b.overall_score)},
      ${cleanText(b.comments)},${user.id},${user.full_name||user.employee_code||"User"}
    ) RETURNING *`)[0];
    const rows=await sql`SELECT * FROM gelato_recipe_sensory WHERE recipe_id=${recipeId} ORDER BY panel_date DESC,id DESC`;
    return {status:201,data:{record:row,summary:sensorySummary(rows)}};
  }
  if(req.method==="DELETE"){
    if(String(user.designation||"").toLowerCase()!=="admin")return {status:403,data:{error:"Sirf Admin sensory record delete kar sakta hai"}};
    if(!id)return {status:400,data:{error:"Valid sensory id required hai"}};
    const old=(await sql`DELETE FROM gelato_recipe_sensory WHERE id=${id} RETURNING recipe_id`)[0];
    if(!old)return {status:404,data:{error:"Sensory record not found"}};
    const rows=await sql`SELECT * FROM gelato_recipe_sensory WHERE recipe_id=${old.recipe_id} ORDER BY panel_date DESC,id DESC`;
    return {status:200,data:{deleted:true,summary:sensorySummary(rows)}};
  }
  return {status:405,data:{error:"Method not allowed"}};
}

function machineCalibrationSummary(rows,recipe){
  const target=Number(recipe?.research_target?.premium_r_and_d?.target_overrun_pct);
  const usable=rows.filter(r=>r.result==="pass").map(r=>({
    overrun:Number(r.calculated_overrun_pct??r.overrun_pct),
    draw:Number(r.draw_temp_c),
    yieldL:Number(r.finished_yield_l),
    outputKg:Number(r.batch_output_kg),
    machine:r.machine||null,
    test_date:r.test_date
  })).filter(r=>Number.isFinite(r.overrun));
  const recent=usable.slice(0,5);
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const overAvg=avg(recent.map(x=>x.overrun));
  const variance=recent.length&&overAvg!==null?avg(recent.map(x=>(x.overrun-overAvg)**2)):null;
  const sd=variance===null?null:Math.sqrt(variance);
  const drawVals=recent.map(x=>x.draw).filter(Number.isFinite);
  const yieldVals=recent.map(x=>x.yieldL).filter(Number.isFinite);
  const outputVals=recent.map(x=>x.outputKg).filter(Number.isFinite);
  const bias=Number.isFinite(target)&&overAvg!==null?overAvg-target:null;
  let status=recent.length>=3?"calibrated":recent.length>=2?"emerging":"insufficient";
  const comments=[];
  if(!recent.length)comments.push("Measured overrun calibration ke liye passed QC data required hai.");
  else{
    if(bias!==null&&Math.abs(bias)>=8)comments.push("Machine overrun target se "+Math.abs(bias).toFixed(1)+" points "+(bias>0?"high":"low")+" chal rahi hai; air incorporation/load setting review karein.");
    else if(bias!==null)comments.push("Measured overrun target ke qareeb hai; current machine setup repeatability monitor karein.");
    if(sd!==null&&sd>8)comments.push("Overrun batch-to-batch variation high hai ("+sd.toFixed(1)+" points SD); machine load, mix temperature aur extraction endpoint standardize karein.");
    else if(sd!==null&&recent.length>=3)comments.push("Overrun repeatability stable range mein nazar aa rahi hai.");
  }
  return {
    status,sample_count:recent.length,target_overrun_pct:Number.isFinite(target)?target:null,
    measured_overrun_avg:overAvg===null?null:Number(overAvg.toFixed(2)),
    overrun_bias_pct_points:bias===null?null:Number(bias.toFixed(2)),
    overrun_sd_pct_points:sd===null?null:Number(sd.toFixed(2)),
    avg_draw_temp_c:drawVals.length?Number(avg(drawVals).toFixed(2)):null,
    avg_finished_yield_l:yieldVals.length?Number(avg(yieldVals).toFixed(2)):null,
    avg_output_kg:outputVals.length?Number(avg(outputVals).toFixed(2)):null,
    machine:recent.find(x=>x.machine)?.machine||recipe?.research_target?.premium_r_and_d?.machine_name||null,
    comments
  };
}
async function gelatoRelease(sql,req,user){
  await ensureGelatoBusinessRecipes(sql);
  const recipeId=asId(req.query?.recipe_id);
  if(req.method!=="GET")return {status:405,data:{error:"Method not allowed"}};
  if(!recipeId)return {status:400,data:{error:"Business recipe id required hai"}};
  const recipe=(await sql`SELECT * FROM gelato_business_recipes WHERE id=${recipeId}`)[0];
  if(!recipe)return {status:404,data:{error:"Business recipe not found"}};
  const qc=await sql`SELECT * FROM gelato_recipe_qc WHERE recipe_id=${recipeId} ORDER BY test_date DESC,id DESC`;
  const sensory=await sql`SELECT * FROM gelato_recipe_sensory WHERE recipe_id=${recipeId} ORDER BY panel_date DESC,id DESC`;
  const bio=await sql`SELECT * FROM gelato_recipe_bio WHERE recipe_id=${recipeId} ORDER BY test_date DESC,id DESC`;
  const sensorySum=sensorySummary(sensory),bioSum=bioValidationSummary(bio),machine=machineCalibrationSummary(qc,recipe);
  const passed=qc.filter(x=>x.result==="pass").length;
  const processRows=qc.filter(x=>x.result==="pass"&&x.process_compliance_pct!==null&&x.process_compliance_pct!==undefined).slice(0,3);
  const processAvg=processRows.length?processRows.reduce((s,x)=>s+Number(x.process_compliance_pct||0),0)/processRows.length:null;
  const coverage=Number(recipe?.research_metrics?.data_coverage_pct);
  const checks=[
    {key:"research",label:"Research Fit ≥ 90%",pass:Number(recipe.perfection_score)>=90,value:recipe.perfection_score==null?null:Number(recipe.perfection_score)},
    {key:"coa",label:"Ingredient COA Coverage ≥ 90%",pass:Number.isFinite(coverage)&&coverage>=90,value:Number.isFinite(coverage)?coverage:null},
    {key:"production",label:"Production Confidence ≥ 70%",pass:Number(recipe.production_confidence)>=70,value:Number(recipe.production_confidence||0)},
    {key:"qc",label:"Passed QC Batches ≥ 2",pass:passed>=2,value:passed},
    {key:"calibration",label:"Measured Overrun Calibration",pass:machine.sample_count>=2&&(machine.overrun_sd_pct_points===null||machine.overrun_sd_pct_points<=8),value:machine.sample_count},
    {key:"process",label:"Process Compliance ≥ 85%",pass:processRows.length>=2&&Number(processAvg)>=85,value:processAvg===null?null:Number(processAvg.toFixed(1))},
    {key:"sensory",label:"Sensory Panel ≥ 3 & Avg ≥ 7/10",pass:Number(sensorySum.panel_count)>=3&&Number(sensorySum.overall_avg)>=7,value:sensorySum.overall_avg},
    {key:"bio",label:"Biological Validation",pass:bioSum.status==="lab_validated",value:bioSum.status},
    {key:"shelf",label:"Validated Shelf Life Recorded",pass:Boolean(cleanText(recipe.validated_shelf_life)),value:recipe.validated_shelf_life||null}
  ];
  const passedChecks=checks.filter(x=>x.pass).length;
  const readiness=Number(((passedChecks/checks.length)*100).toFixed(1));
  let status=checks.every(x=>x.pass)?"ready":"not_ready";
  if(bioSum.status==="hold")status="hold";
  const blockers=checks.filter(x=>!x.pass).map(x=>x.label);
  if(status==="hold")blockers.unshift("Biological HOLD active");
  return {status:200,data:{
    release_status:status,
    readiness_pct:readiness,
    checks,
    blockers,
    machine_calibration:machine,
    sensory:sensorySum,
    biological:bioSum,
    passed_qc_batches:passed,
    note:"Release Readiness R&D/production checklist hai; regulatory or food-safety approval ka substitute nahi."
  }};
}
async function gelatoBusinessRecipes(sql,req,user){
  await ensureGelatoBusinessRecipes(sql);
  const id=asId(req.query?.id),b=bodyOf(req);
  if(req.method==="GET"){
    if(id){
      const row=(await sql`SELECT * FROM gelato_business_recipes WHERE id=${id}`)[0];
      if(!row)return {status:404,data:{error:"Business recipe not found"}};
      const versions=await sql`SELECT id,version,changed_by,changed_at FROM gelato_business_recipe_versions WHERE recipe_id=${id} ORDER BY version DESC,id DESC LIMIT 30`;
      return {status:200,data:{record:row,versions}};
    }
    const business=cleanText(req.query?.business),status=cleanText(req.query?.status),like="%"+(business||"")+"%";
    const rows=await sql`SELECT * FROM gelato_business_recipes
      WHERE (${business}::text IS NULL OR business_name ILIKE ${like})
        AND (${status}::text IS NULL OR status=${status})
      ORDER BY CASE WHEN status='golden' THEN 0 WHEN status='final' THEN 1 ELSE 2 END,updated_at DESC,id DESC LIMIT 300`;
    return {status:200,data:{records:rows}};
  }
  if(req.method==="POST"){
    const formula=cleanFormula(b.formula),sourceFormula=cleanFormula(b.source_formula?.length?b.source_formula:b.formula);
    if(!cleanText(b.business_name))return {status:400,data:{error:"Business name required hai"}};
    if(!cleanText(b.recipe_name))return {status:400,data:{error:"Recipe name required hai"}};
    if(!formula.length)return {status:400,data:{error:"Complete ingredient formula required hai"}};
    const context={department:cleanText(b.department)||"icecream",ingredient_settings:b.ingredient_settings||{},research_target:b.research_target||{}};
    const evaluation=evaluateResearchFit(formula,sourceFormula,context);
    const by=user.full_name||user.employee_code||"User";
    const rows=await sql`INSERT INTO gelato_business_recipes(
      business_name,recipe_name,department,system,base_mode,source_recipe_id,source_name,source_url,source_type,
      formula,source_formula,ingredient_settings,research_target,research_metrics,research_comments,perfection_score,process_profile,
      validated_shelf_life,storage_conditions,shelf_life_guidance,trial_notes,production_tested_at,created_by_id,created_by_name
    ) VALUES(
      ${cleanText(b.business_name)},${cleanText(b.recipe_name)},${context.department},${cleanText(b.system)},${cleanText(b.base_mode)},
      ${cleanText(b.source_recipe_id)},${cleanText(b.source_name)},${cleanText(b.source_url)},${cleanText(b.source_type)},
      ${JSON.stringify(formula)}::jsonb,${JSON.stringify(sourceFormula)}::jsonb,${JSON.stringify(b.ingredient_settings||{})}::jsonb,
      ${JSON.stringify(b.research_target||{})}::jsonb,${JSON.stringify(evaluation.metrics)}::jsonb,${JSON.stringify(evaluation.comments)}::jsonb,${evaluation.score},${JSON.stringify(normalizeProcessProfile(b.process_profile||{}))}::jsonb,
      ${cleanText(b.validated_shelf_life)},${cleanText(b.storage_conditions)},${gelatoShelfGuidance(context.department)},
      ${cleanText(b.trial_notes)},${cleanText(b.production_tested_at)},${user.id},${by}
    ) RETURNING *`;
    return {status:201,data:{record:rows[0]}};
  }
  if(req.method==="PATCH"){
    if(!id)return {status:400,data:{error:"Valid business recipe id required"}};
    if(String(user.designation||"").toLowerCase()!=="admin")return {status:403,data:{error:"Sirf Admin business recipe edit/final kar sakta hai"}};
    const old=(await sql`SELECT * FROM gelato_business_recipes WHERE id=${id}`)[0];
    if(!old)return {status:404,data:{error:"Business recipe not found"}};
    await sql`INSERT INTO gelato_business_recipe_versions(recipe_id,version,snapshot,changed_by)
      VALUES(${id},${old.version},${JSON.stringify(old)}::jsonb,${user.full_name||user.employee_code||"Admin"})`;
    const formula=b.formula!==undefined?cleanFormula(b.formula):cleanFormula(old.formula);
    const sourceFormula=cleanFormula(old.source_formula);
    const ingredientSettings=b.ingredient_settings!==undefined?b.ingredient_settings:old.ingredient_settings;
    const department=cleanText(b.department)||old.department;
    const nextResearchTarget=b.research_target!==undefined?b.research_target:old.research_target;
    const evaluation=evaluateResearchFit(formula,sourceFormula,{department,ingredient_settings:ingredientSettings||{},research_target:nextResearchTarget||{}});
    const action=cleanText(b.action);
    let nextStatus=action==="finalize"?"final":(cleanText(b.status)||old.status);
    if(action==="golden"){
      const qc=await sql`SELECT COUNT(*) FILTER (WHERE result='pass')::int pass_count FROM gelato_recipe_qc WHERE recipe_id=${id}`;
      const confidence=await recalcProductionConfidence(sql,id);
      if(Number(qc[0]?.pass_count||0)<2||confidence<70)return {status:409,data:{error:"Golden Recipe ke liye kam az kam 2 passed QC batches aur 70% Production Confidence required hai"}};
      nextStatus="golden";
    }
    if(!["trial","final","golden"].includes(nextStatus))return {status:400,data:{error:"Invalid recipe status"}};
    const tested=cleanText(b.production_tested_at)||old.production_tested_at;
    if(nextStatus==="final"&&!tested)return {status:400,data:{error:"Final recipe ke liye production test date required hai"}};
    const rows=await sql`UPDATE gelato_business_recipes SET
      business_name=COALESCE(${cleanText(b.business_name)},business_name),
      recipe_name=COALESCE(${cleanText(b.recipe_name)},recipe_name),
      department=${department},
      system=COALESCE(${cleanText(b.system)},system),
      base_mode=COALESCE(${cleanText(b.base_mode)},base_mode),
      formula=${JSON.stringify(formula)}::jsonb,
      ingredient_settings=${JSON.stringify(ingredientSettings||{})}::jsonb,
      research_target=CASE WHEN ${b.research_target!==undefined} THEN ${JSON.stringify(b.research_target||{})}::jsonb ELSE research_target END,
      research_metrics=${JSON.stringify(evaluation.metrics)}::jsonb,
      research_comments=${JSON.stringify(evaluation.comments)}::jsonb,
      perfection_score=${evaluation.score},
      process_profile=CASE WHEN ${b.process_profile!==undefined} THEN ${JSON.stringify(normalizeProcessProfile(b.process_profile||{}))}::jsonb ELSE process_profile END,
      validated_shelf_life=CASE WHEN ${b.validated_shelf_life!==undefined} THEN ${cleanText(b.validated_shelf_life)} ELSE validated_shelf_life END,
      storage_conditions=CASE WHEN ${b.storage_conditions!==undefined} THEN ${cleanText(b.storage_conditions)} ELSE storage_conditions END,
      shelf_life_guidance=${gelatoShelfGuidance(department)},
      trial_notes=CASE WHEN ${b.trial_notes!==undefined} THEN ${cleanText(b.trial_notes)} ELSE trial_notes END,
      production_tested_at=COALESCE(${tested}::date,production_tested_at),
      status=${nextStatus},
      passed_at=CASE WHEN ${nextStatus} IN ('final','golden') AND passed_at IS NULL THEN now() ELSE passed_at END,
      golden_at=CASE WHEN ${nextStatus}='golden' AND golden_at IS NULL THEN now() ELSE golden_at END,
      version=version+1,
      updated_at=now()
      WHERE id=${id} RETURNING *`;
    return {status:200,data:{record:rows[0]}};
  }
  return {status:405,data:{error:"Method not allowed"}};
}

async function handler(req, res) {
  const resource = String(req.query?.resource || "").trim();
  if (!allowed.has(resource))
    return res.status(400).json({ error: "Unknown resource" });
  try {
    if(resource==="ecommerce")return ecommerceHandler(req,res);
    if(resource==="customer_portal"){
      const sql=db(), action=cleanText(req.query?.action);
      if(action==="admin_orders"||action==="approve_order"||action==="reject_order"){
        const user=await getSessionUser(req,sql);
        if(!user)return res.status(401).json({error:"Authentication required"});
        return customerPortal(sql,req,res,user);
      }
      return customerPortal(sql,req,res);
    }
    if(resource==="gulshan_ecommerce")return gulshanEcommerceHandler(req,res);
    const sql = db(),
      user = await getSessionUser(req, sql);
    if (!user)
      return res.status(401).json({ error: "Authentication required" });
    if (isCoreFinancialResource(resource)) await ensureCoreFinancialAuditColumns(sql);
    if (resource === "client_invoices") await ensureClientOcrAudit(sql);
    if (resource === "cash_sales") {
      const out = await cashSales(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    if (resource === "cash_sale_customers") {
      const out = await cashSaleCustomers(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    if (resource === "sale_products") {
      const out = await saleProducts(sql, req);
      return res.status(out.status).json(out.data);
    }
    if (resource === "gelato_settings") {
      const out = await gelatoSettings(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    if (resource === "gelato_recipes") {
      const out = await gelatoBusinessRecipes(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    if (resource === "gelato_qc") {
      const out = await gelatoQc(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    if (resource === "gelato_bio") {
      const out = await gelatoBio(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    if (resource === "gelato_sensory") {
      const out = await gelatoSensory(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    if (resource === "gelato_release") {
      const out = await gelatoRelease(sql, req, user);
      return res.status(out.status).json(out.data);
    }
    await ensureEntryNumbers(sql);
    const view = resourceView[resource],
      direct = await canAccess(sql, user.designation, view),
      searchRead =
        req.method === "GET" &&
        (await canAccess(sql, user.designation, "search"));
    let statementRead = false;
    if (req.method === "GET") {
      if (
        (resource === "client_invoices" || resource === "client_receipts") &&
        (await canAccess(sql, user.designation, "clients"))
      )
        statementRead = true;
      if (
        (resource === "supplier_invoices" ||
          resource === "supplier_payments") &&
        (await canAccess(sql, user.designation, "suppliers"))
      )
        statementRead = true;
    }
    if (!direct && !searchRead && !statementRead)
      return res.status(403).json({ error: "Access denied" });
    const id = asId(req.query?.id);
    if (req.method === "GET") {
      if(resource==='supplier_invoices' && req.query?.bill_products==='1'){
        const [items,products]=await Promise.all([
          id?sql`SELECT i.*,p.name product_name,COALESCE((SELECT SUM(g.received_qty) FROM goods_receipt_items g WHERE g.supplier_invoice_item_id=i.id),0) received_qty FROM supplier_invoice_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.supplier_invoice_id=${id} ORDER BY i.id`:Promise.resolve([]),
          sql`SELECT id,name,sku,purchase_price FROM products ORDER BY name`
        ]);
        return res.status(200).json({items,products});
      }
      const rows = await list(sql, resource, id);
      return res
        .status(200)
        .json({ records: await attachEntryNumbers(sql, resource, rows) });
    }
    const b = bodyOf(req);
    if (user.designation !== "admin") {
      if (req.method === "PATCH" || req.method === "DELETE") {
        if (!id) return res.status(400).json({ error: "Valid id is required" });
      }
      const oldData = id ? (await list(sql, resource, id))[0] || null : null;
      const action =
        req.method === "POST"
          ? "CREATE"
          : req.method === "PATCH"
            ? "UPDATE"
            : req.method === "DELETE"
              ? "DELETE"
              : null;
      if (!action) return res.status(405).json({ error: "Method not allowed" });
      const approval = await queueApproval(sql, user, {
        moduleKey: view,
        resourceKey: resource,
        action,
        targetId: id,
        oldData,
        newData: req.method === "DELETE" ? null : b,
      });
      return res
        .status(202)
        .json({
          pending_approval: true,
          approval_id: approval.id,
          status: "pending",
          entry_number: null,
          message:
            "Submitted for Admin approval — final number will be assigned only after approval",
        });
    }
    if (req.method === "POST") {
      const x = resource==='supplier_invoices' && Object.hasOwn(b,'items') ? await saveSupplierBillItems(sql,null,b) : await create(sql, resource, b);
      let record = (await attachEntryNumbers(sql, resource, x))[0] || null;
      if (record?.id && isCoreFinancialResource(resource)) {
        await stampCoreFinancialAudit(sql, resource, record.id, user, "create");
        const refreshed = (await list(sql, resource, record.id))[0];
        if (refreshed) record = { ...refreshed, entry_number: record.entry_number };
      }
      if (
        ["supplier_invoices", "client_invoices"].includes(resource) &&
        record?.id &&
        record?.entry_number &&
        (resource === "client_invoices" || !cleanText(b.invoice_number)) &&
        record.invoice_number !== record.entry_number
      ) {
        const u = resource === "supplier_invoices"
          ? await sql`UPDATE supplier_invoices SET invoice_number=${record.entry_number},updated_at=now() WHERE id=${record.id} RETURNING *`
          : await sql`UPDATE client_invoices SET invoice_number=${record.entry_number},updated_at=now() WHERE id=${record.id} RETURNING *`;
        record = { ...(u[0] || record), entry_number: record.entry_number };
      }
      return res.status(201).json({ record });
    }
    if (req.method === "PATCH") {
      if (!id) return res.status(400).json({ error: "Valid id is required" });
      const x = resource==='supplier_invoices' && Object.hasOwn(b,'items') ? await saveSupplierBillItems(sql,id,b) : await patch(sql, resource, id, b),
        record = (await attachEntryNumbers(sql, resource, x))[0] || null;
      if (record?.id && isCoreFinancialResource(resource)) {
        await stampCoreFinancialAudit(sql, resource, record.id, user, "update");
        const refreshed = (await list(sql, resource, record.id))[0];
        if (refreshed) Object.assign(record, refreshed);
      }
      return res.status(200).json({ record });
    }
    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "Valid id is required" });
      const x = await remove(sql, resource, id);
      return res
        .status(200)
        .json({ deleted: Boolean(x[0]), number_status: x[0] ? "void" : null });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Kashif Traders API error", e);
    if(e.statusCode===400)return res.status(400).json({error:e.message});
    const knownMessage = [
      "Supplier is required",
      "Invoice date is required",
      "Valid bill amount is required",
    ].includes(e?.message);
    const msg =
      knownMessage
        ? e.message
        : e?.message === "DATABASE_URL_NOT_CONFIGURED"
        ? "DATABASE_URL is not configured"
        : e?.code === "23505"
          ? "Duplicate record"
          : e?.code === "23503"
            ? "This record is linked to other data"
            : "Database request failed";
    return res
      .status(e?.message === "DATABASE_URL_NOT_CONFIGURED" ? 503 : 500)
      .json({ error: msg });
  }
}


export default withOfflineReplay(handler);
