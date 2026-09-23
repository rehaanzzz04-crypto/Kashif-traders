const auditDays = type => type === "180_day" ? 180 : type === "daily" ? 1 : 30;

export async function ensureErpAudit(sql) {
  await sql`CREATE TABLE IF NOT EXISTS erp_audit_reports(
    id BIGSERIAL PRIMARY KEY,
    audit_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by TEXT,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    findings JSONB NOT NULL DEFAULT '[]'::jsonb
  )`;
  await sql`CREATE INDEX IF NOT EXISTS erp_audit_reports_generated_idx ON erp_audit_reports(generated_at DESC)`;
}

const n = value => Number(value || 0);

export async function getErpAuditHistory(sql, limit = 24) {
  await ensureErpAudit(sql);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 24));
  return sql`SELECT id,audit_type,period_start,period_end,generated_at,generated_by,summary,findings
    FROM erp_audit_reports ORDER BY generated_at DESC,id DESC LIMIT ${safeLimit}`;
}

export async function runErpAudit(sql, auditType, generatedBy) {
  await ensureErpAudit(sql);
  const type = auditType === "180_day" ? "180_day" : auditType === "daily" ? "daily" : "monthly";
  const days = auditDays(type);

  const [supplierBills, supplierPayments, clientBills, clientPayments, grnSummary, zeroItems, zeroLedger, zeroAdjustments] = await Promise.all([
    sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM supplier_invoices`,
    sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM supplier_payments`,
    sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM client_invoices`,
    sql`SELECT COUNT(*)::int count,COALESCE(SUM(amount),0)::numeric total FROM client_receipts`,
    sql`WITH x AS (
      SELECT si.id,COUNT(ii.id)::int item_count,
        COALESCE(SUM(ii.quantity),0)::numeric ordered_qty,
        COALESCE(SUM(ri.received_qty),0)::numeric received_qty
      FROM supplier_invoices si
      LEFT JOIN supplier_invoice_items ii ON ii.supplier_invoice_id=si.id
      LEFT JOIN (
        SELECT supplier_invoice_item_id,SUM(received_qty)::numeric received_qty
        FROM goods_receipt_items GROUP BY supplier_invoice_item_id
      ) ri ON ri.supplier_invoice_item_id=ii.id
      GROUP BY si.id
    )
    SELECT COUNT(*)::int count,
      COUNT(*) FILTER (WHERE item_count=0 OR received_qty<ordered_qty)::int pending
    FROM x`,
    sql`SELECT COUNT(*)::int count FROM supplier_invoice_items WHERE COALESCE(unit_price,0)=0`,
    sql`SELECT COUNT(*)::int count FROM inventory_movements WHERE COALESCE(unit_cost,0)=0`,
    sql`SELECT COUNT(*)::int count FROM stock_adjustments WHERE COALESCE(unit_cost,0)=0`
  ]);

  const summary = {
    supplier_bills: supplierBills[0] || { count:0,total:0 },
    supplier_payments: supplierPayments[0] || { count:0,total:0 },
    client_bills: clientBills[0] || { count:0,total:0 },
    client_payments: clientPayments[0] || { count:0,total:0 },
    grn: grnSummary[0] || { count:0,pending:0 }
  };

  const details = await Promise.all([
    sql`WITH x AS (
      SELECT si.id,si.invoice_number,si.invoice_date,s.business_name supplier,
        COUNT(ii.id)::int item_count,
        COALESCE(SUM(ii.quantity),0)::numeric ordered_qty,
        COALESCE(SUM(ri.received_qty),0)::numeric received_qty
      FROM supplier_invoices si
      JOIN suppliers s ON s.id=si.supplier_id
      LEFT JOIN supplier_invoice_items ii ON ii.supplier_invoice_id=si.id
      LEFT JOIN (
        SELECT supplier_invoice_item_id,SUM(received_qty)::numeric received_qty
        FROM goods_receipt_items GROUP BY supplier_invoice_item_id
      ) ri ON ri.supplier_invoice_item_id=ii.id
      GROUP BY si.id,si.invoice_number,si.invoice_date,s.business_name
    )
    SELECT *,CASE
      WHEN item_count=0 OR received_qty<=0 THEN 'pending'
      WHEN received_qty<ordered_qty THEN 'partial'
      ELSE 'complete'
    END grn_status
    FROM x WHERE item_count=0 OR received_qty<ordered_qty
    ORDER BY invoice_date DESC,id DESC LIMIT 200`,
    sql`SELECT i.id,i.supplier_invoice_id,i.product_id,p.name product_name,
      i.quantity,i.unit_price,(i.quantity*i.unit_price)::numeric line_total
      FROM supplier_invoice_items i
      LEFT JOIN products p ON p.id=i.product_id
      WHERE COALESCE(i.unit_price,0)=0
      ORDER BY i.id DESC LIMIT 200`,
    sql`SELECT m.id,m.warehouse_id,m.product_id,p.name product_name,m.movement_type,
      m.quantity,m.unit_cost,m.reference_type,m.reference_id,m.reference_no,m.movement_date,m.created_at
      FROM inventory_movements m
      LEFT JOIN products p ON p.id=m.product_id
      WHERE COALESCE(m.unit_cost,0)=0
      ORDER BY m.id DESC LIMIT 200`,
    sql`SELECT a.id,a.adjustment_number,a.warehouse_id,a.product_id,p.name product_name,
      a.adjustment_date,a.quantity,a.unit_cost,a.reason,a.notes,a.created_at
      FROM stock_adjustments a
      LEFT JOIN products p ON p.id=a.product_id
      WHERE COALESCE(a.unit_cost,0)=0
      ORDER BY a.id DESC LIMIT 200`
  ]);

  const findings = [];
  const checks = [
    ["GRN_PENDING", n(grnSummary[0]?.pending), "Supplier invoices have GRN pending or partial", details[0]],
    ["ZERO_SUPPLIER_ITEM_COST", n(zeroItems[0]?.count), "Supplier bill items have zero purchase price", details[1]],
    ["ZERO_LEDGER_COST", n(zeroLedger[0]?.count), "Inventory ledger movements have zero unit cost", details[2]],
    ["ZERO_ADJUSTMENT_COST", n(zeroAdjustments[0]?.count), "Stock adjustments have zero unit cost", details[3]]
  ];
  for (const [code,count,message,records] of checks) {
    if (count > 0) findings.push({ code,count,message,records });
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const rows = await sql`INSERT INTO erp_audit_reports(
      audit_type,period_start,period_end,generated_by,summary,findings
    ) VALUES(
      ${type},${start.toISOString().slice(0,10)},${end.toISOString().slice(0,10)},
      ${String(generatedBy || "Admin")},${JSON.stringify(summary)}::jsonb,${JSON.stringify(findings)}::jsonb
    ) RETURNING *`;
  return rows[0];
}


export async function runDueErpAudits(sql, generatedBy = "ERP Automatic Audit") {
  await ensureErpAudit(sql);
  const now = Date.now();
  const due = async (auditType, days) => {
    const last = await sql`SELECT generated_at FROM erp_audit_reports WHERE audit_type=${auditType} ORDER BY generated_at DESC,id DESC LIMIT 1`;
    if (last[0] && now - new Date(last[0].generated_at).getTime() < days * 86400000) {
      return { skipped:true, reason:"not_due", last_generated_at:last[0].generated_at };
    }
    return { created:true, record:await runErpAudit(sql, auditType, generatedBy) };
  };
  return {
    checked_at:new Date(now).toISOString(),
    monthly:await due("monthly",30),
    day_180:await due("180_day",180)
  };
}
