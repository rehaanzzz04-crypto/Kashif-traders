const validId=value=>{const number=Number(value);return Number.isInteger(number)&&number>0?number:null};
const validAmount=value=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:null};

export function buildAllocationPlan(paymentAmount,invoices=[]){
  let remaining=validAmount(paymentAmount)||0;const allocations=[];
  for(const invoice of invoices){const outstanding=Math.max(0,Number(invoice?.outstanding||0));if(outstanding<=0.005||remaining<=0.005)continue;const amount=Math.min(remaining,outstanding);allocations.push({invoiceId:Number(invoice.id),amount:Number(amount.toFixed(2))});remaining-=amount}
  return {allocations,allocated:Number((Number(paymentAmount||0)-Math.max(0,remaining)).toFixed(2)),unallocated:Number(Math.max(0,remaining).toFixed(2))};
}

export async function ensurePaymentAllocationTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS supplier_payment_invoice_allocations (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
    supplier_invoice_id BIGINT NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(payment_id,supplier_invoice_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS supplier_payment_invoice_allocations_invoice_idx ON supplier_payment_invoice_allocations(supplier_invoice_id)`;
  await sql`CREATE TABLE IF NOT EXISTS client_receipt_allocations (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES client_receipts(id) ON DELETE CASCADE,
    client_invoice_id BIGINT NOT NULL REFERENCES client_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(receipt_id,client_invoice_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS client_receipt_allocations_invoice_idx ON client_receipt_allocations(client_invoice_id)`;
}

export async function allocateSupplierPayment(sql,payment,{preferredInvoiceId=null}={}){
  const supplierId=validId(payment?.supplier_id),paymentId=validId(payment?.id),total=validAmount(payment?.amount);
  if(!supplierId||!paymentId||!total)throw Error('Supplier and valid payment amount are required');
  await ensurePaymentAllocationTables(sql);
  const preferred=validId(preferredInvoiceId);
  if(preferred){
    const selected=await sql`SELECT id FROM supplier_invoices WHERE id=${preferred} AND supplier_id=${supplierId}`;
    if(!selected[0])throw Error('Selected invoice does not belong to this supplier');
  }
  const invoices=await sql`
    SELECT i.id,i.amount,
      GREATEST(i.amount-COALESCE((SELECT SUM(a.amount) FROM supplier_payment_invoice_allocations a WHERE a.supplier_invoice_id=i.id),0),0)::numeric AS outstanding
    FROM supplier_invoices i
    WHERE i.supplier_id=${supplierId}
    ORDER BY CASE WHEN i.id=${preferred} THEN 0 ELSE 1 END,i.invoice_date NULLS FIRST,i.id
  `;
  const plan=buildAllocationPlan(total,invoices);
  for(const allocation of plan.allocations){
    await sql`INSERT INTO supplier_payment_invoice_allocations(payment_id,supplier_invoice_id,amount) VALUES(${paymentId},${allocation.invoiceId},${allocation.amount}) ON CONFLICT(payment_id,supplier_invoice_id) DO UPDATE SET amount=EXCLUDED.amount`;
  }
  await sql`
    UPDATE supplier_invoices i SET status=CASE
      WHEN i.amount-COALESCE((SELECT SUM(a.amount) FROM supplier_payment_invoice_allocations a WHERE a.supplier_invoice_id=i.id),0)<=0.005 THEN 'paid'
      WHEN COALESCE((SELECT SUM(a.amount) FROM supplier_payment_invoice_allocations a WHERE a.supplier_invoice_id=i.id),0)>0 THEN 'partial'
      ELSE 'unpaid' END,updated_at=now()
    WHERE i.supplier_id=${supplierId}
  `;
  return {allocated:plan.allocated,unallocated:plan.unallocated};
}

export async function allocateClientReceipt(sql,receipt,{preferredInvoiceId=null}={}){
  const clientId=validId(receipt?.client_id),receiptId=validId(receipt?.id),total=validAmount(receipt?.amount);
  if(!clientId||!receiptId||!total)throw Error('Client and valid payment amount are required');
  await ensurePaymentAllocationTables(sql);
  const preferred=validId(preferredInvoiceId);
  if(preferred){
    const selected=await sql`SELECT id FROM client_invoices WHERE id=${preferred} AND client_id=${clientId}`;
    if(!selected[0])throw Error('Selected invoice does not belong to this client');
  }
  const invoices=await sql`
    SELECT i.id,i.amount,GREATEST(i.amount-COALESCE((SELECT SUM(a.amount) FROM client_receipt_allocations a WHERE a.client_invoice_id=i.id),0),0)::numeric AS outstanding
    FROM client_invoices i WHERE i.client_id=${clientId}
    ORDER BY CASE WHEN i.id=${preferred} THEN 0 ELSE 1 END,i.invoice_date NULLS FIRST,i.id
  `;
  const plan=buildAllocationPlan(total,invoices);
  for(const allocation of plan.allocations){
    await sql`INSERT INTO client_receipt_allocations(receipt_id,client_invoice_id,amount) VALUES(${receiptId},${allocation.invoiceId},${allocation.amount}) ON CONFLICT(receipt_id,client_invoice_id) DO UPDATE SET amount=EXCLUDED.amount`;
  }
  await sql`
    UPDATE client_invoices i SET status=CASE
      WHEN i.amount-COALESCE((SELECT SUM(a.amount) FROM client_receipt_allocations a WHERE a.client_invoice_id=i.id),0)<=0.005 THEN 'paid'
      WHEN COALESCE((SELECT SUM(a.amount) FROM client_receipt_allocations a WHERE a.client_invoice_id=i.id),0)>0 THEN 'partial'
      ELSE 'unpaid' END,updated_at=now()
    WHERE i.client_id=${clientId}
  `;
  return {allocated:plan.allocated,unallocated:plan.unallocated};
}
