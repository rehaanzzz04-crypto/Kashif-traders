// Save header and product rows in one statement. Keep existing item IDs for GRNs.
export async function saveSupplierBillItems(sql, invoiceId, body) {
  const fail=message=>{throw Object.assign(new Error(message),{statusCode:400});};
  if(!Array.isArray(body.items))fail('Invalid invoice products');
  const items=body.items.map(i=>({id:i.id==null?null:Number(i.id),product_id:Number(i.product_id),description:String(i.description||i.product_name||''),quantity:Number(i.quantity),unit_price:Number(i.unit_price||0)}));
  if(items.some(i=>(i.id!==null&&(!Number.isInteger(i.id)||i.id<=0))||!Number.isInteger(i.product_id)||i.product_id<=0||!Number.isFinite(i.quantity)||i.quantity<=0||!Number.isFinite(i.unit_price)||i.unit_price<0))fail('Valid product, quantity and purchase price required');
  const ids=items.filter(i=>i.id!==null).map(i=>i.id);if(new Set(ids).size!==ids.length)fail('Duplicate invoice item');
  if(!invoiceId&&ids.length)fail('New invoice cannot contain existing item IDs');
  const total=items.reduce((n,i)=>n+i.quantity*i.unit_price,0),amount=total>0?Number(total.toFixed(2)):Number(body.amount);
  if(!Number.isFinite(amount)||amount<=0)fail('Valid bill amount is required');
  const supplier=Number(body.supplier_id),date=String(body.invoice_date||'').slice(0,10);
  if(!Number.isInteger(supplier)||supplier<=0)fail('Supplier is required');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('Invoice date is required');
  const payload=JSON.stringify(items),due=body.due_date||date;
  if(!invoiceId){
    return sql`WITH bill AS (
      INSERT INTO supplier_invoices(supplier_id,invoice_number,invoice_date,due_date,amount,notes,attachment_url,status)
      VALUES(${supplier},${body.invoice_number||'SB-'+Date.now()},${date},${due},${amount},${body.notes||null},${body.attachment_url||null},${body.status||'unpaid'}) RETURNING *
    ), added AS (
      INSERT INTO supplier_invoice_items(supplier_invoice_id,product_id,description,quantity,unit_price)
      SELECT bill.id,j.product_id,j.description,j.quantity,j.unit_price FROM bill CROSS JOIN jsonb_to_recordset(${payload}::jsonb) AS j(product_id bigint,description text,quantity numeric,unit_price numeric) RETURNING id
    ) SELECT * FROM bill`;
  }
  const rows=await sql`WITH input AS (
    SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS j(id bigint,product_id bigint,description text,quantity numeric,unit_price numeric)
  ), valid AS (
    SELECT i.id FROM supplier_invoices i WHERE i.id=${invoiceId}
    AND NOT EXISTS(SELECT 1 FROM input j WHERE j.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM supplier_invoice_items x WHERE x.id=j.id AND x.supplier_invoice_id=i.id))
    AND NOT EXISTS(SELECT 1 FROM supplier_invoice_items x LEFT JOIN input j ON j.id=x.id WHERE x.supplier_invoice_id=i.id AND EXISTS(SELECT 1 FROM goods_receipt_items g WHERE g.supplier_invoice_item_id=x.id) AND (j.id IS NULL OR j.product_id<>x.product_id OR j.quantity<(SELECT COALESCE(SUM(g.received_qty),0) FROM goods_receipt_items g WHERE g.supplier_invoice_item_id=x.id)))
    AND (i.supplier_id=${supplier} OR NOT EXISTS(SELECT 1 FROM goods_receipts g WHERE g.supplier_invoice_id=i.id))
  ), bill AS (
    UPDATE supplier_invoices i SET supplier_id=${supplier},invoice_number=COALESCE(${body.invoice_number||null},i.invoice_number),invoice_date=${date},due_date=${due},amount=${amount},notes=${body.notes||null},attachment_url=COALESCE(${body.attachment_url||null},i.attachment_url),status=COALESCE(${body.status||null},i.status),updated_at=now()
    WHERE i.id IN(SELECT id FROM valid) RETURNING i.*
  ), edited AS (
    UPDATE supplier_invoice_items x SET product_id=j.product_id,description=j.description,quantity=j.quantity,unit_price=j.unit_price FROM input j,bill WHERE x.id=j.id AND x.supplier_invoice_id=bill.id RETURNING x.id
  ), removed AS (
    DELETE FROM supplier_invoice_items x USING bill WHERE x.supplier_invoice_id=bill.id AND NOT EXISTS(SELECT 1 FROM input j WHERE j.id=x.id) RETURNING x.id
  ), added AS (
    INSERT INTO supplier_invoice_items(supplier_invoice_id,product_id,description,quantity,unit_price) SELECT bill.id,j.product_id,j.description,j.quantity,j.unit_price FROM input j CROSS JOIN bill WHERE j.id IS NULL RETURNING id
  ) SELECT * FROM bill`;
  if(!rows.length)fail('Bill products changed or linked to GRN. Reopen the bill; received products cannot be removed or reduced below received quantity.');
  return rows;
}
