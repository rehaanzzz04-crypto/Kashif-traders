import { saveSupplierBillItems } from './_supplier-bill-items.js';
import { neon } from "@neondatabase/serverless";
import { getSessionUser, canAccess } from "./_auth.js";
import { queueApproval } from "./approvals.js";
import { ensureEntryNumbers, attachEntryNumbers } from "./_entry-number.js";
import { ensurePaymentAllocationTables, allocateSupplierPayment, allocateClientReceipt } from "./_payment-allocation.js";
import ecommerceHandler from "../ecommerce-core.js";
import gulshanEcommerceHandler from "../gulshan-ecommerce-core.js";

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
    const rows = await sql`DELETE FROM cash_sale_queue WHERE id=${id} RETURNING id`;
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
    const code="CSC-"+Date.now()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
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
  if(req.method==="POST"&&action==="login"){
    const code=cleanText(b.customer_code),pin=cleanText(b.pin);
    const c=(await sql`SELECT * FROM cash_sale_customers WHERE upper(customer_code)=upper(${code}) AND status='active' LIMIT 1`)[0];
    if(!c||!c.portal_pin_hash||crypto.scryptSync(String(pin||""),c.portal_pin_salt,64).toString("hex")!==c.portal_pin_hash)return res.status(401).json({error:"Customer code ya PIN ghalat hai"});
    const t=crypto.randomBytes(32).toString("hex");await sql`INSERT INTO cash_customer_sessions(customer_id,token_hash,expires_at) VALUES(${c.id},${digest(t)},now()+interval '30 days')`;
    res.setHeader("Set-Cookie",`kt_customer=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`);return res.status(200).json({ok:true,name:c.name});
  }
  if(req.method==="POST"&&action==="logout"){if(sessionToken)await sql`DELETE FROM cash_customer_sessions WHERE token_hash=${digest(sessionToken)}`;res.setHeader("Set-Cookie","kt_customer=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0");return res.status(200).json({ok:true})}
  if(staffUser&&req.method==="GET"&&action==="admin_orders"){
    const rows=await sql`SELECT o.*,c.customer_code,c.name customer_name,c.mobile FROM cash_customer_orders o JOIN cash_sale_customers c ON c.id=o.customer_id ORDER BY CASE WHEN o.status='pending' THEN 0 ELSE 1 END,o.created_at DESC LIMIT 200`;
    return res.status(200).json({records:rows});
  }
  if(staffUser&&req.method==="POST"&&action==="approve_order"){
    const orderId=asId(b.order_id),priced=Array.isArray(b.items)?b.items:[];if(!orderId)return res.status(400).json({error:"Valid order required"});
    const o=(await sql`SELECT o.*,c.name customer_name FROM cash_customer_orders o JOIN cash_sale_customers c ON c.id=o.customer_id WHERE o.id=${orderId}`)[0];
    if(!o)return res.status(404).json({error:"Order not found"});if(o.status!=="pending"||o.cash_sale_id)return res.status(409).json({error:"Order already converted"});
    const base=Array.isArray(o.items)?o.items:[],pmap=new Map(priced.map(x=>[Number(x.product_id),Math.max(0,Number(x.price)||0)]));
    const items=base.map(x=>({...x,rate:pmap.get(Number(x.product_id))||0,total:(Number(x.qty)||0)*(pmap.get(Number(x.product_id))||0)}));
    if(items.some(x=>!(Number(x.rate)>0)))return res.status(400).json({error:"Har product ka rate enter karein"});
    const subtotal=items.reduce((n,x)=>n+Number(x.total||0),0),discount=Math.min(subtotal,Math.max(0,Number(b.discount)||0)),total=subtotal-discount,inv="CS-"+Date.now();
    const q=await sql`INSERT INTO cash_sale_queue(invoice_number,created_by_id,created_by_name,customer_name,customer_id,items,subtotal,discount,total,status,amount_received,sale_date,created_at,updated_at) VALUES(${inv},${staffUser.id},${staffUser.full_name||staffUser.employee_code},${o.customer_name},${o.customer_id},${JSON.stringify(items)},${subtotal},${discount},${total},'pending',0,CURRENT_DATE,now(),now()) RETURNING *`;
    await sql`UPDATE cash_customer_orders SET status='converted',cash_sale_id=${q[0].id},updated_at=now() WHERE id=${orderId} AND status='pending'`;
    return res.status(201).json({record:q[0]});
  }
  const customer=sessionToken?(await sql`SELECT c.* FROM cash_customer_sessions s JOIN cash_sale_customers c ON c.id=s.customer_id WHERE s.token_hash=${digest(sessionToken)} AND s.expires_at>now() AND c.status='active' LIMIT 1`)[0]:null;
  if(!customer)return res.status(401).json({error:"Customer login required"});
  if(req.method==="GET"&&action==="products"){const rows=await sql`SELECT id,name,category,unit FROM cash_sale_products WHERE status='active' ORDER BY name,id LIMIT 500`;return res.status(200).json({records:rows})}
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

export default async function handler(req, res) {
  const resource = String(req.query?.resource || "").trim();
  if (!allowed.has(resource))
    return res.status(400).json({ error: "Unknown resource" });
  try {
    if(resource==="ecommerce")return ecommerceHandler(req,res);
    if(resource==="customer_portal"){
      const sql=db(), action=cleanText(req.query?.action);
      if(action==="admin_orders"||action==="approve_order"){
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

