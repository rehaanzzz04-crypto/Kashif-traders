import { neon } from "@neondatabase/serverless";
import { getSessionUser, canAccess } from "./_auth.js";
import { queueApproval } from "./approvals.js";
import { ensureEntryNumbers, attachEntryNumbers } from "./_entry-number.js";
import { ensurePaymentAllocationTables, allocateSupplierPayment, allocateClientReceipt } from "./_payment-allocation.js";

const allowed = new Set([
  "suppliers",
  "supplier_invoices",
  "supplier_payments",
  "clients",
  "client_invoices",
  "client_receipts",
  "documents",
  "cash_sales",
  "sale_products",
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
async function cashSales(sql, req, user) {
  await sql`CREATE TABLE IF NOT EXISTS cash_sale_queue (id BIGSERIAL PRIMARY KEY, invoice_number TEXT UNIQUE NOT NULL, created_by_id BIGINT, created_by_name TEXT NOT NULL, customer_name TEXT, sale_date DATE NOT NULL DEFAULT CURRENT_DATE, items JSONB NOT NULL DEFAULT '[]'::jsonb, subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, discount NUMERIC(14,2) NOT NULL DEFAULT 0, total NUMERIC(14,2) NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS payment_method TEXT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS amount_received NUMERIC(14,2)`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS paid_by_id BIGINT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS paid_by_name TEXT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT`;
  await sql`ALTER TABLE cash_sale_queue ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`;
  if (req.method === "GET") {
    const status = cleanText(req.query?.status) || "pending", limit = Math.min(1000, Math.max(1, Number(req.query?.limit) || 200));
    const rows = status === "all"
      ? await sql`SELECT * FROM cash_sale_queue ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM cash_sale_queue WHERE status=${status} ORDER BY created_at DESC LIMIT ${limit}`;
    return { status: 200, data: { records: rows } };
  }
  if (req.method === "POST") {
    const b = bodyOf(req), items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) return { status: 400, data: { error: "Kam az kam aik product add karein" } };
    const subtotal = items.reduce((sum, x) => sum + Math.max(0, Number(x.qty) || 0) * Math.max(0, Number(x.rate) || 0), 0),
      discount = Math.min(subtotal, Math.max(0, Number(b.discount) || 0)), total = subtotal - discount, no = `CS-${Date.now()}`;
    const rows = await sql`INSERT INTO cash_sale_queue(invoice_number,created_by_id,created_by_name,customer_name,sale_date,items,subtotal,discount,total) VALUES(${no},${user.id},${user.full_name || user.employee_code},${cleanText(b.customer_name) || "Walk-in Customer"},${cleanText(b.sale_date) || new Date().toISOString().slice(0, 10)},${JSON.stringify(items)},${subtotal},${discount},${total}) RETURNING *`;
    return { status: 201, data: { record: rows[0] } };
  }
  if (req.method === "PATCH") {
    const id = asId(req.query?.id), b = bodyOf(req);
    if (!id) return { status: 400, data: { error: "Valid bill id required" } };
    const current = (await sql`SELECT * FROM cash_sale_queue WHERE id=${id}`)[0];
    if (!current) return { status: 404, data: { error: "Cash sale bill not found" } };
    const nextStatus = cleanText(b.status) || current.status;
    if (!["pending","paid","cancelled"].includes(nextStatus)) return { status: 400, data: { error: "Invalid bill status" } };
    if (current.status !== "pending" && nextStatus !== current.status) return { status: 409, data: { error: "Completed bill status cannot be changed" } };
    const items = Array.isArray(b.items) ? b.items : current.items,
      subtotal = items.reduce((sum, x) => sum + Math.max(0, Number(x.qty) || 0) * Math.max(0, Number(x.rate) || 0), 0),
      discount = Math.min(subtotal, Math.max(0, b.discount === undefined ? Number(current.discount) : Number(b.discount) || 0)),
      total = subtotal - discount, received = cleanAmount(b.amount_received), method = cleanText(b.payment_method);
    if (nextStatus === "paid" && (!method || received === null || received < total))
      return { status: 400, data: { error: "Payment method aur complete received amount required hai" } };
    const rows = await sql`UPDATE cash_sale_queue SET items=${JSON.stringify(items)},subtotal=${subtotal},discount=${discount},total=${total},status=${nextStatus},
      payment_method=CASE WHEN ${nextStatus}='paid' THEN ${method} ELSE payment_method END,
      amount_received=CASE WHEN ${nextStatus}='paid' THEN ${received} ELSE amount_received END,
      paid_by_id=CASE WHEN ${nextStatus}='paid' THEN ${user.id} ELSE paid_by_id END,
      paid_by_name=CASE WHEN ${nextStatus}='paid' THEN ${user.full_name || user.employee_code} ELSE paid_by_name END,
      paid_at=CASE WHEN ${nextStatus}='paid' THEN now() ELSE paid_at END,
      cancelled_by_name=CASE WHEN ${nextStatus}='cancelled' THEN ${user.full_name || user.employee_code} ELSE cancelled_by_name END,
      cancelled_at=CASE WHEN ${nextStatus}='cancelled' THEN now() ELSE cancelled_at END,updated_at=now()
      WHERE id=${id} RETURNING *`;
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
  if (r === "supplier_invoices")
    return sql`INSERT INTO supplier_invoices(supplier_id,invoice_number,invoice_date,due_date,amount,notes,attachment_url,status) VALUES(${asId(b.supplier_id)},${cleanText(b.invoice_number)},${cleanText(b.invoice_date)},${cleanText(b.due_date)},${cleanAmount(b.amount)},${cleanText(b.notes)},${cleanText(b.attachment_url)},${cleanText(b.status) ?? "unpaid"}) RETURNING *`;
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
    if(reviewSubmit&&(!submittedItems.length||!written||Math.abs(itemTotal-written)>.009))
      throw Error(`Corrected items total PKR ${Number(itemTotal||0).toLocaleString("en-PK")} must equal handwritten total PKR ${written.toLocaleString("en-PK")}`);
    const corrected=reviewSubmit&&Math.abs(itemTotal-written)<.01;
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
export default async function handler(req, res) {
  const resource = String(req.query?.resource || "").trim();
  if (!allowed.has(resource))
    return res.status(400).json({ error: "Unknown resource" });
  try {
    const sql = db(),
      user = await getSessionUser(req, sql);
    if (!user)
      return res.status(401).json({ error: "Authentication required" });
    if (resource === "client_invoices") await ensureClientOcrAudit(sql);
    if (resource === "cash_sales") {
      const out = await cashSales(sql, req, user);
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
      const x = await create(sql, resource, b);
      let record = (await attachEntryNumbers(sql, resource, x))[0] || null;
      if (
        resource === "client_invoices" &&
        record?.id &&
        record?.entry_number &&
        record.invoice_number !== record.entry_number
      ) {
        const u =
          await sql`UPDATE client_invoices SET invoice_number=${record.entry_number},updated_at=now() WHERE id=${record.id} RETURNING *`;
        record = { ...(u[0] || record), entry_number: record.entry_number };
      }
      return res.status(201).json({ record });
    }
    if (req.method === "PATCH") {
      if (!id) return res.status(400).json({ error: "Valid id is required" });
      const x = await patch(sql, resource, id, b),
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
    const msg =
      e?.message === "DATABASE_URL_NOT_CONFIGURED"
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
