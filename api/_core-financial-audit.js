const CORE_FINANCIAL_RESOURCES = new Set([
  "supplier_invoices",
  "supplier_payments",
  "client_invoices",
  "client_receipts",
]);

export function isCoreFinancialResource(resource) {
  return CORE_FINANCIAL_RESOURCES.has(String(resource || ""));
}

export async function ensureCoreFinancialAuditColumns(sql) {
  await sql`ALTER TABLE supplier_invoices
    ADD COLUMN IF NOT EXISTS created_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_designation TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_designation TEXT`;
  await sql`ALTER TABLE supplier_payments
    ADD COLUMN IF NOT EXISTS created_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_designation TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_designation TEXT`;
  await sql`ALTER TABLE client_invoices
    ADD COLUMN IF NOT EXISTS created_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_designation TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_designation TEXT`;
  await sql`ALTER TABLE client_receipts
    ADD COLUMN IF NOT EXISTS created_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_designation TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_designation TEXT`;
}

function actorValues(actor) {
  const rawId = actor?.id ?? actor?.employee_id ?? actor?.requested_by_employee_id;
  const n = Number(rawId);
  const id = Number.isInteger(n) && n > 0 ? n : null;
  const name = String(
    actor?.full_name ??
    actor?.requested_by_name ??
    actor?.employee_code ??
    actor?.requested_by_code ??
    ""
  ).trim() || null;
  const designation = String(
    actor?.designation ??
    actor?.requested_by_designation ??
    ""
  ).trim() || null;
  return { id, name, designation };
}

export async function stampCoreFinancialAudit(sql, resource, recordId, actor, mode) {
  const id = Number(recordId);
  if (!Number.isInteger(id) || id <= 0 || !isCoreFinancialResource(resource)) return;
  const a = actorValues(actor);
  const create = mode === "create";

  if (resource === "supplier_invoices") {
    return create
      ? sql`UPDATE supplier_invoices SET created_by_id=${a.id},created_by_name=${a.name},created_by_designation=${a.designation} WHERE id=${id}`
      : sql`UPDATE supplier_invoices SET updated_by_id=${a.id},updated_by_name=${a.name},updated_by_designation=${a.designation} WHERE id=${id}`;
  }
  if (resource === "supplier_payments") {
    return create
      ? sql`UPDATE supplier_payments SET created_by_id=${a.id},created_by_name=${a.name},created_by_designation=${a.designation} WHERE id=${id}`
      : sql`UPDATE supplier_payments SET updated_by_id=${a.id},updated_by_name=${a.name},updated_by_designation=${a.designation} WHERE id=${id}`;
  }
  if (resource === "client_invoices") {
    return create
      ? sql`UPDATE client_invoices SET created_by_id=${a.id},created_by_name=${a.name},created_by_designation=${a.designation} WHERE id=${id}`
      : sql`UPDATE client_invoices SET updated_by_id=${a.id},updated_by_name=${a.name},updated_by_designation=${a.designation} WHERE id=${id}`;
  }
  if (resource === "client_receipts") {
    return create
      ? sql`UPDATE client_receipts SET created_by_id=${a.id},created_by_name=${a.name},created_by_designation=${a.designation} WHERE id=${id}`
      : sql`UPDATE client_receipts SET updated_by_id=${a.id},updated_by_name=${a.name},updated_by_designation=${a.designation} WHERE id=${id}`;
  }
}
