import { neon } from '@neondatabase/serverless';

function db(){
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return neon(url);
}
const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const text=v=>v===undefined||v===null||String(v).trim()===''?null:String(v).trim();
const body=req=>typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});

async function list(sql,resource,q){
  if(resource==='warehouses') return sql`SELECT * FROM warehouses ORDER BY is_default DESC,name`;
  if(resource==='products') return sql`SELECT * FROM products ORDER BY name,id`;
  if(resource==='stock') return sql`SELECT * FROM warehouse_stock ORDER BY warehouse_name,product_name`;
  if(resource==='movements') return sql`SELECT m.*,w.name warehouse_name,p.name product_name,p.sku FROM inventory_movements m JOIN warehouses w ON w.id=m.warehouse_id JOIN products p ON p.id=m.product_id ORDER BY m.movement_date DESC,m.id DESC LIMIT 500`;
  if(resource==='invoice_items'){
    const invoiceId=id(q.invoice_id); if(!invoiceId) return [];
    return sql`SELECT i.*,p.name product_name,p.sku,p.unit FROM supplier_invoice_items i JOIN products p ON p.id=i.product_id WHERE i.supplier_invoice_id=${invoiceId} ORDER BY i.id`;
  }
  if(resource==='grns') return sql`SELECT g.*,s.business_name,w.name warehouse_name,i.invoice_number FROM goods_receipts g JOIN suppliers s ON s.id=g.supplier_id JOIN warehouses w ON w.id=g.warehouse_id JOIN supplier_invoices i ON i.id=g.supplier_invoice_id ORDER BY g.receipt_date DESC,g.id DESC`;
  if(resource==='grn_items'){
    const grnId=id(q.grn_id); if(!grnId) return [];
    return sql`SELECT gi.*,p.name product_name,p.sku,p.unit FROM goods_receipt_items gi JOIN products p ON p.id=gi.product_id WHERE gi.goods_receipt_id=${grnId} ORDER BY gi.id`;
  }
  if(resource==='transfers') return sql`SELECT t.*,fw.name from_warehouse,tw.name to_warehouse FROM stock_transfers t JOIN warehouses fw ON fw.id=t.from_warehouse_id JOIN warehouses tw ON tw.id=t.to_warehouse_id ORDER BY t.transfer_date DESC,t.id DESC`;
  if(resource==='transfer_items'){
    const transferId=id(q.transfer_id); if(!transferId) return [];
    return sql`SELECT ti.*,p.name product_name,p.sku,p.unit FROM stock_transfer_items ti JOIN products p ON p.id=ti.product_id WHERE ti.stock_transfer_id=${transferId} ORDER BY ti.id`;
  }
  return [];
}

async function createBasic(sql,resource,b){
  if(resource==='warehouses') return sql`INSERT INTO warehouses(code,name,address,contact_person,phone,is_default,status) VALUES(${text(b.code)},${text(b.name)},${text(b.address)},${text(b.contact_person)},${text(b.phone)},${Boolean(b.is_default)},${text(b.status)||'active'}) RETURNING *`;
  if(resource==='products') return sql`INSERT INTO products(sku,name,category,unit,purchase_price,sale_price,reorder_level,barcode,status) VALUES(${text(b.sku)},${text(b.name)},${text(b.category)},${text(b.unit)||'pcs'},${num(b.purchase_price)},${num(b.sale_price)},${num(b.reorder_level)},${text(b.barcode)},${text(b.status)||'active'}) RETURNING *`;
  if(resource==='invoice_items') return sql`INSERT INTO supplier_invoice_items(supplier_invoice_id,product_id,description,quantity,unit_price) VALUES(${id(b.supplier_invoice_id)},${id(b.product_id)},${text(b.description)},${num(b.quantity)},${num(b.unit_price)}) RETURNING *`;
  if(resource==='adjustments'){
    const qty=num(b.quantity); const type=qty>=0?'ADJUSTMENT_IN':'ADJUSTMENT_OUT';
    const rows=await sql`INSERT INTO stock_adjustments(adjustment_number,warehouse_id,product_id,adjustment_date,quantity,reason,unit_cost,notes) VALUES(${text(b.adjustment_number)},${id(b.warehouse_id)},${id(b.product_id)},${text(b.adjustment_date)||new Date().toISOString().slice(0,10)},${qty},${text(b.reason)},${num(b.unit_cost)},${text(b.notes)}) RETURNING *`;
    const r=rows[0];
    await sql`INSERT INTO inventory_movements(warehouse_id,product_id,movement_type,quantity,unit_cost,reference_type,reference_id,reference_no,notes) VALUES(${r.warehouse_id},${r.product_id},${type},${qty},${r.unit_cost},'STOCK_ADJUSTMENT',${r.id},${r.adjustment_number},${r.notes})`;
    return rows;
  }
  return [];
}

async function patchBasic(sql,resource,rowId,b){
  if(resource==='warehouses') return sql`UPDATE warehouses SET code=COALESCE(${text(b.code)},code),name=COALESCE(${text(b.name)},name),address=COALESCE(${text(b.address)},address),contact_person=COALESCE(${text(b.contact_person)},contact_person),phone=COALESCE(${text(b.phone)},phone),status=COALESCE(${text(b.status)},status),updated_at=now() WHERE id=${rowId} RETURNING *`;
  if(resource==='products') return sql`UPDATE products SET sku=COALESCE(${text(b.sku)},sku),name=COALESCE(${text(b.name)},name),category=COALESCE(${text(b.category)},category),unit=COALESCE(${text(b.unit)},unit),purchase_price=COALESCE(${b.purchase_price===''?null:num(b.purchase_price)},purchase_price),sale_price=COALESCE(${b.sale_price===''?null:num(b.sale_price)},sale_price),reorder_level=COALESCE(${b.reorder_level===''?null:num(b.reorder_level)},reorder_level),barcode=COALESCE(${text(b.barcode)},barcode),status=COALESCE(${text(b.status)},status),updated_at=now() WHERE id=${rowId} RETURNING *`;
  return [];
}

async function postGrn(sql,b){
  const invoiceId=id(b.supplier_invoice_id), warehouseId=id(b.warehouse_id);
  if(!invoiceId||!warehouseId) throw new Error('Invoice and warehouse required');
  const inv=await sql`SELECT * FROM supplier_invoices WHERE id=${invoiceId}`; if(!inv[0]) throw new Error('Supplier invoice not found');
  const grnNo=text(b.grn_number)||('GRN-'+Date.now());
  const grns=await sql`INSERT INTO goods_receipts(grn_number,supplier_invoice_id,supplier_id,warehouse_id,receipt_date,status,received_by,remarks) VALUES(${grnNo},${invoiceId},${inv[0].supplier_id},${warehouseId},${text(b.receipt_date)||new Date().toISOString().slice(0,10)},'posted',${text(b.received_by)},${text(b.remarks)}) RETURNING *`;
  const grn=grns[0];
  for(const item of (b.items||[])){
    const received=num(item.received_qty); if(received<=0) continue;
    const productId=id(item.product_id); if(!productId) continue;
    await sql`INSERT INTO goods_receipt_items(goods_receipt_id,supplier_invoice_item_id,product_id,ordered_qty,received_qty,rejected_qty,batch_no,expiry_date,notes) VALUES(${grn.id},${id(item.supplier_invoice_item_id)},${productId},${num(item.ordered_qty)},${received},${num(item.rejected_qty)},${text(item.batch_no)},${text(item.expiry_date)},${text(item.notes)})`;
    await sql`INSERT INTO inventory_movements(warehouse_id,product_id,movement_type,quantity,unit_cost,reference_type,reference_id,reference_no,notes) VALUES(${warehouseId},${productId},'PURCHASE_RECEIPT',${received},${num(item.unit_cost)},'GRN',${grn.id},${grnNo},${text(item.notes)})`;
  }
  return grn;
}

async function postTransfer(sql,b){
  const from=id(b.from_warehouse_id),to=id(b.to_warehouse_id); if(!from||!to||from===to) throw new Error('Valid different warehouses required');
  const transferNo=text(b.transfer_number)||('TRF-'+Date.now());
  const rows=await sql`INSERT INTO stock_transfers(transfer_number,from_warehouse_id,to_warehouse_id,transfer_date,status,requested_by,received_by,notes) VALUES(${transferNo},${from},${to},${text(b.transfer_date)||new Date().toISOString().slice(0,10)},'posted',${text(b.requested_by)},${text(b.received_by)},${text(b.notes)}) RETURNING *`;
  const tr=rows[0];
  for(const item of (b.items||[])){
    const productId=id(item.product_id),qty=num(item.quantity),cost=num(item.unit_cost); if(!productId||qty<=0) continue;
    const stock=await sql`SELECT quantity_on_hand FROM warehouse_stock WHERE warehouse_id=${from} AND product_id=${productId}`;
    if(Number(stock[0]?.quantity_on_hand||0)<qty) throw new Error('Insufficient stock for transfer');
    await sql`INSERT INTO stock_transfer_items(stock_transfer_id,product_id,quantity,unit_cost,notes) VALUES(${tr.id},${productId},${qty},${cost},${text(item.notes)})`;
    await sql`INSERT INTO inventory_movements(warehouse_id,product_id,movement_type,quantity,unit_cost,reference_type,reference_id,reference_no,notes) VALUES(${from},${productId},'TRANSFER_OUT',${-qty},${cost},'TRANSFER',${tr.id},${transferNo},${text(item.notes)})`;
    await sql`INSERT INTO inventory_movements(warehouse_id,product_id,movement_type,quantity,unit_cost,reference_type,reference_id,reference_no,notes) VALUES(${to},${productId},'TRANSFER_IN',${qty},${cost},'TRANSFER',${tr.id},${transferNo},${text(item.notes)})`;
  }
  return tr;
}

export default async function handler(req,res){
  try{
    const sql=db(), resource=String(req.query?.resource||'').trim();
    if(req.method==='GET') return res.status(200).json({records:await list(sql,resource,req.query||{})});
    const b=body(req);
    if(req.method==='POST'&&resource==='grn_post') return res.status(201).json({record:await postGrn(sql,b)});
    if(req.method==='POST'&&resource==='transfer_post') return res.status(201).json({record:await postTransfer(sql,b)});
    if(req.method==='POST') return res.status(201).json({record:(await createBasic(sql,resource,b))[0]||null});
    if(req.method==='PATCH'){
      const rowId=id(req.query?.id); if(!rowId) return res.status(400).json({error:'Valid id required'});
      return res.status(200).json({record:(await patchBasic(sql,resource,rowId,b))[0]||null});
    }
    if(req.method==='DELETE'){
      const rowId=id(req.query?.id); if(!rowId) return res.status(400).json({error:'Valid id required'});
      if(resource==='invoice_items'){const rows=await sql`DELETE FROM supplier_invoice_items WHERE id=${rowId} RETURNING id`;return res.status(200).json({deleted:Boolean(rows[0])});}
      return res.status(405).json({error:'Delete not supported for this resource'});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Inventory API error',e);return res.status(500).json({error:e?.message||'Inventory request failed'});}
}
