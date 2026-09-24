import { bizoraSql,ensureBizoraSchema,requireCompanyUser,requireFeature,body,clean,positiveInt,companyAudit,hashPassword } from './_bizora-core.js';

const code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,30);
const number=v=>Number.isFinite(Number(v))?Number(v):0;
const paymentMethods=new Set(['CASH','BANK','ONLINE','CHEQUE','EASYPAISA','JAZZCASH']);
const userRoles=new Set(['company_admin','manager','accountant','salesman','cashier']);

async function overview(sql,u){
  const stats=await sql`SELECT
    (SELECT COUNT(*) FROM company_users WHERE company_id=${u.company_id} AND active=true)::int users,
    (SELECT COUNT(*) FROM erp_suppliers WHERE company_id=${u.company_id} AND status='active')::int suppliers,
    (SELECT COUNT(*) FROM erp_clients WHERE company_id=${u.company_id} AND status='active')::int clients,
    (SELECT COUNT(*) FROM erp_products WHERE company_id=${u.company_id} AND active=true)::int products,
    (SELECT COUNT(*) FROM erp_warehouses WHERE company_id=${u.company_id} AND active=true)::int warehouses,
    (
      COALESCE((SELECT SUM(opening_balance) FROM erp_suppliers WHERE company_id=${u.company_id}),0)
      + COALESCE((SELECT SUM(amount) FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND status<>'cancelled'),0)
      - COALESCE((SELECT SUM(amount) FROM erp_supplier_payments WHERE company_id=${u.company_id}),0)
    )::numeric supplier_payable,
    (
      COALESCE((SELECT SUM(opening_balance) FROM erp_clients WHERE company_id=${u.company_id}),0)
      + COALESCE((SELECT SUM(amount) FROM erp_client_invoices WHERE company_id=${u.company_id} AND status<>'cancelled'),0)
      - COALESCE((SELECT SUM(amount) FROM erp_client_receipts WHERE company_id=${u.company_id}),0)
    )::numeric client_receivable`;
  return {company:{id:u.company_id,code:u.company_code,name:u.company_name,logo_url:u.logo_url,status:u.company_status},user:{id:u.id,user_code:u.user_code,full_name:u.full_name,email:u.email,role:u.role},subscription:{status:u.subscription_status,expires_on:u.expires_on,plan_code:u.plan_code,plan_name:u.plan_name,features:u.features,access_mode:u.access_mode},limits:{user_limit:u.user_limit,warehouse_limit:u.warehouse_limit},stats:stats[0]||{}};
}

export default async function handler(req,res){
  try{
    const sql=bizoraSql();await ensureBizoraSchema(sql);
    const b=body(req),action=clean(req.query?.action||b.action||'overview');
    const write=req.method!=='GET';
    const u=await requireCompanyUser(sql,req,res,{write});if(!u)return;

    const featureByAction={
      users:'core_erp',create_user:'core_erp',set_user_status:'core_erp',
      suppliers:'supplier_management',supplier_invoices:'supplier_management',supplier_invoice_items:'supplier_management',supplier_payments:'supplier_management',
      create_supplier:'supplier_management',create_supplier_invoice:'supplier_management',create_supplier_payment:'supplier_management',
      clients:'customer_management',client_invoices:'customer_management',client_receipts:'customer_management',
      create_client:'customer_management',create_client_invoice:'customer_management',create_client_receipt:'customer_management',
      products:'products',create_product:'products',
      warehouses:'warehouses',create_warehouse:'warehouses',
      grns:'grn',create_grn:'grn',
      inventory_stock:'inventory_ledger',inventory_ledger:'inventory_ledger',
      stock_transfers:'inventory_ledger',create_stock_transfer:'inventory_ledger',
      stock_adjustments:'inventory_ledger',create_stock_adjustment:'inventory_ledger'
    };
    const requiredFeature=featureByAction[action];
    if(requiredFeature&&!requireFeature(u,res,requiredFeature))return;

    if(req.method==='GET'&&action==='overview')return res.status(200).json(await overview(sql,u));

    if(req.method==='GET'&&action==='users'){
      if(u.role!=='company_admin')return res.status(403).json({error:'Company Admin only'});
      const rows=await sql`SELECT id,user_code,full_name,email,role,active,created_at,last_login_at FROM company_users WHERE company_id=${u.company_id} ORDER BY created_at,id`;
      return res.status(200).json({records:rows,limit:u.user_limit});
    }
    if(req.method==='GET'&&action==='suppliers'){
      const rows=await sql`SELECT id,supplier_code,business_name,contact_person,mobile_number,opening_balance,status,created_at FROM erp_suppliers WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 500`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='supplier_invoices'){
      const rows=await sql`SELECT i.id,i.supplier_id,s.business_name,i.invoice_number,i.invoice_date,i.due_date,i.amount,i.status,i.notes,i.created_at,
        COALESCE(q.ordered_quantity,0)::numeric ordered_quantity,
        COALESCE(r.received_quantity,0)::numeric received_quantity,
        CASE
          WHEN COALESCE(q.item_count,0)=0 THEN 'not_itemized'
          WHEN COALESCE(r.received_quantity,0)<=0 THEN 'pending'
          WHEN COALESCE(r.received_quantity,0)<COALESCE(q.ordered_quantity,0) THEN 'partial'
          ELSE 'complete'
        END grn_status
        FROM erp_supplier_invoices i
        JOIN erp_suppliers s ON s.id=i.supplier_id AND s.company_id=i.company_id
        LEFT JOIN LATERAL(
          SELECT COUNT(*)::int item_count,COALESCE(SUM(ii.quantity),0)::numeric ordered_quantity
          FROM erp_supplier_invoice_items ii
          WHERE ii.company_id=i.company_id AND ii.supplier_invoice_id=i.id
        ) q ON true
        LEFT JOIN LATERAL(
          SELECT COALESCE(SUM(gi.quantity),0)::numeric received_quantity
          FROM erp_grn_items gi
          JOIN erp_supplier_invoice_items ii ON ii.id=gi.supplier_invoice_item_id AND ii.company_id=gi.company_id
          WHERE gi.company_id=i.company_id AND ii.supplier_invoice_id=i.id
        ) r ON true
        WHERE i.company_id=${u.company_id}
        ORDER BY i.invoice_date DESC,i.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='supplier_invoice_items'){
      const invoiceId=positiveInt(req.query?.invoice_id,0);
      if(!invoiceId)return res.status(400).json({error:'Valid invoice required'});
      const rows=await sql`SELECT ii.id,ii.product_id,p.sku,p.product_name,p.unit,ii.description,ii.quantity,ii.unit_price,
        COALESCE(SUM(gi.quantity),0)::numeric received_quantity,
        GREATEST(ii.quantity-COALESCE(SUM(gi.quantity),0),0)::numeric remaining_quantity
        FROM erp_supplier_invoice_items ii
        JOIN erp_supplier_invoices i ON i.id=ii.supplier_invoice_id AND i.company_id=ii.company_id
        JOIN erp_products p ON p.id=ii.product_id AND p.company_id=ii.company_id
        LEFT JOIN erp_grn_items gi ON gi.supplier_invoice_item_id=ii.id AND gi.company_id=ii.company_id
        WHERE ii.company_id=${u.company_id} AND ii.supplier_invoice_id=${invoiceId}
        GROUP BY ii.id,p.sku,p.product_name,p.unit
        ORDER BY ii.id`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='supplier_payments'){
      const rows=await sql`SELECT p.id,p.supplier_id,s.business_name,p.payment_date,p.amount,p.payment_method,p.reference_number,p.notes,p.created_at
        FROM erp_supplier_payments p JOIN erp_suppliers s ON s.id=p.supplier_id AND s.company_id=p.company_id
        WHERE p.company_id=${u.company_id} ORDER BY p.payment_date DESC,p.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='clients'){
      const rows=await sql`SELECT id,client_code,business_name,contact_person,mobile_number,credit_limit,opening_balance,status,created_at FROM erp_clients WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 500`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_invoices'){
      const rows=await sql`SELECT i.id,i.client_id,c.business_name,i.invoice_number,i.invoice_date,i.due_date,i.amount,i.status,i.notes,i.created_at
        FROM erp_client_invoices i JOIN erp_clients c ON c.id=i.client_id AND c.company_id=i.company_id
        WHERE i.company_id=${u.company_id} ORDER BY i.invoice_date DESC,i.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_receipts'){
      const rows=await sql`SELECT r.id,r.client_id,c.business_name,r.receipt_date,r.amount,r.payment_method,r.reference_number,r.notes,r.created_at
        FROM erp_client_receipts r JOIN erp_clients c ON c.id=r.client_id AND c.company_id=r.company_id
        WHERE r.company_id=${u.company_id} ORDER BY r.receipt_date DESC,r.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='products'){
      const rows=await sql`SELECT id,sku,barcode,product_name,unit,purchase_price,sale_price,active,created_at FROM erp_products WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='warehouses'){
      const rows=await sql`SELECT id,warehouse_code,warehouse_name,address,active,created_at FROM erp_warehouses WHERE company_id=${u.company_id} ORDER BY created_at,id`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='grns'){
      const rows=await sql`SELECT g.id,g.grn_number,g.received_date,g.status,g.notes,
        s.business_name supplier_name,w.warehouse_name,
        i.invoice_number supplier_invoice_number,
        COALESCE(SUM(gi.quantity),0)::numeric total_quantity,
        COUNT(gi.id)::int item_count
        FROM erp_grns g
        LEFT JOIN erp_suppliers s ON s.id=g.supplier_id AND s.company_id=g.company_id
        JOIN erp_warehouses w ON w.id=g.warehouse_id AND w.company_id=g.company_id
        LEFT JOIN erp_supplier_invoices i ON i.id=g.supplier_invoice_id AND i.company_id=g.company_id
        LEFT JOIN erp_grn_items gi ON gi.grn_id=g.id AND gi.company_id=g.company_id
        WHERE g.company_id=${u.company_id}
        GROUP BY g.id,s.business_name,w.warehouse_name,i.invoice_number
        ORDER BY g.received_date DESC,g.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='inventory_stock'){
      const warehouseId=positiveInt(req.query?.warehouse_id,0);
      const rows=await sql`SELECT p.id product_id,p.sku,p.product_name,p.unit,w.id warehouse_id,w.warehouse_name,
        COALESCE(SUM(m.qty_in-m.qty_out),0)::numeric quantity,
        COALESCE(SUM((m.qty_in-m.qty_out)*m.unit_cost),0)::numeric stock_value
        FROM erp_inventory_movements m
        JOIN erp_products p ON p.id=m.product_id AND p.company_id=m.company_id
        JOIN erp_warehouses w ON w.id=m.warehouse_id AND w.company_id=m.company_id
        WHERE m.company_id=${u.company_id} AND (${warehouseId}=0 OR m.warehouse_id=${warehouseId})
        GROUP BY p.id,p.sku,p.product_name,p.unit,w.id,w.warehouse_name
        HAVING COALESCE(SUM(m.qty_in-m.qty_out),0)<>0
        ORDER BY w.warehouse_name,p.product_name`;
      return res.status(200).json({records:rows,warehouse_id:warehouseId||null});
    }
    if(req.method==='GET'&&action==='inventory_ledger'){
      const warehouseId=positiveInt(req.query?.warehouse_id,0);
      const rows=await sql`SELECT m.id,m.movement_date,m.movement_type,m.qty_in,m.qty_out,m.unit_cost,m.reference_number,m.notes,
        p.sku,p.product_name,p.unit,w.id warehouse_id,w.warehouse_name
        FROM erp_inventory_movements m
        JOIN erp_products p ON p.id=m.product_id AND p.company_id=m.company_id
        JOIN erp_warehouses w ON w.id=m.warehouse_id AND w.company_id=m.company_id
        WHERE m.company_id=${u.company_id} AND (${warehouseId}=0 OR m.warehouse_id=${warehouseId})
        ORDER BY m.movement_date DESC,m.id DESC LIMIT 2000`;
      return res.status(200).json({records:rows,warehouse_id:warehouseId||null});
    }
    if(req.method==='GET'&&action==='stock_transfers'){
      const rows=await sql`SELECT t.id,t.transfer_number,t.transfer_date,t.status,t.notes,
        fw.warehouse_name from_warehouse,tw.warehouse_name to_warehouse,
        COUNT(i.id)::int item_count,COALESCE(SUM(i.quantity),0)::numeric total_quantity
        FROM erp_stock_transfers t
        JOIN erp_warehouses fw ON fw.id=t.from_warehouse_id AND fw.company_id=t.company_id
        JOIN erp_warehouses tw ON tw.id=t.to_warehouse_id AND tw.company_id=t.company_id
        LEFT JOIN erp_stock_transfer_items i ON i.stock_transfer_id=t.id AND i.company_id=t.company_id
        WHERE t.company_id=${u.company_id}
        GROUP BY t.id,fw.warehouse_name,tw.warehouse_name
        ORDER BY t.transfer_date DESC,t.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='stock_adjustments'){
      const rows=await sql`SELECT a.id,a.adjustment_number,a.adjustment_date,a.adjustment_type,a.quantity,a.unit_cost,a.reason,a.notes,
        w.warehouse_name,p.sku,p.product_name,p.unit
        FROM erp_stock_adjustments a
        JOIN erp_warehouses w ON w.id=a.warehouse_id AND w.company_id=a.company_id
        JOIN erp_products p ON p.id=a.product_id AND p.company_id=a.company_id
        WHERE a.company_id=${u.company_id}
        ORDER BY a.adjustment_date DESC,a.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }

    if(req.method==='POST'&&action==='create_user'){
      if(u.role!=='company_admin')return res.status(403).json({error:'Company Admin only'});
      const userCode=code(b.user_code),fullName=clean(b.full_name),email=clean(b.email).toLowerCase()||null,role=clean(b.role||'salesman').toLowerCase(),password=String(b.password||'');
      if(!userCode||!fullName||password.length<8||!userRoles.has(role))return res.status(400).json({error:'Valid user code, name, role and 8+ character password required'});
      if(u.user_limit){
        const count=await sql`SELECT COUNT(*)::int count FROM company_users WHERE company_id=${u.company_id} AND active=true`;
        if(Number(count[0]?.count||0)>=Number(u.user_limit))return res.status(403).json({error:'Current subscription user limit reached'});
      }
      const rows=await sql`INSERT INTO company_users(company_id,user_code,full_name,email,password_hash,role)
        VALUES(${u.company_id},${userCode},${fullName},${email},${hashPassword(password)},${role})
        RETURNING id,user_code,full_name,email,role,active,created_at`;
      await companyAudit(sql,u,'COMPANY_USER_CREATED',{entityType:'company_user',entityId:String(rows[0].id),metadata:{role}});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_user_status'){
      if(u.role!=='company_admin')return res.status(403).json({error:'Company Admin only'});
      const userId=positiveInt(b.user_id,0),active=Boolean(b.active);
      if(!userId)return res.status(400).json({error:'Valid user required'});
      if(userId===Number(u.id)&&!active)return res.status(400).json({error:'You cannot deactivate your own login'});
      if(active&&u.user_limit){
        const count=await sql`SELECT COUNT(*)::int count FROM company_users WHERE company_id=${u.company_id} AND active=true`;
        if(Number(count[0]?.count||0)>=Number(u.user_limit))return res.status(403).json({error:'Current subscription user limit reached'});
      }
      const rows=await sql`UPDATE company_users SET active=${active} WHERE id=${userId} AND company_id=${u.company_id} RETURNING id,user_code,full_name,email,role,active`;
      if(!rows[0])return res.status(404).json({error:'User not found'});
      await companyAudit(sql,u,'COMPANY_USER_STATUS_CHANGED',{entityType:'company_user',entityId:String(userId),metadata:{active}});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_supplier'){
      const supplierCode=code(b.supplier_code),name=clean(b.business_name);
      if(!supplierCode||!name)return res.status(400).json({error:'Supplier code and business name required'});
      const rows=await sql`INSERT INTO erp_suppliers(company_id,supplier_code,business_name,contact_person,mobile_number,opening_balance,created_by_user_id)
        VALUES(${u.company_id},${supplierCode},${name},${clean(b.contact_person)||null},${clean(b.mobile_number)||null},${number(b.opening_balance)},${u.id})
        RETURNING id,supplier_code,business_name,contact_person,mobile_number,opening_balance,status,created_at`;
      await companyAudit(sql,u,'SUPPLIER_CREATED',{entityType:'supplier',entityId:String(rows[0].id)});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_supplier_invoice'){
      const supplierId=positiveInt(b.supplier_id,0),invoiceNumber=clean(b.invoice_number),invoiceDate=clean(b.invoice_date)||new Date().toISOString().slice(0,10),dueDate=clean(b.due_date)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({product_id:positiveInt(x.product_id,0),description:clean(x.description)||null,quantity:number(x.quantity),unit_price:number(x.unit_price)})):[];
      if(!supplierId||!invoiceNumber)return res.status(400).json({error:'Supplier and invoice number required'});
      if(items.length&&items.some(x=>!x.product_id||x.quantity<=0||x.unit_price<0))return res.status(400).json({error:'Valid product, quantity and purchase price required'});
      const itemTotal=items.reduce((n,x)=>n+x.quantity*x.unit_price,0),amount=items.length?Number(itemTotal.toFixed(2)):number(b.amount);
      if(amount<0)return res.status(400).json({error:'Valid invoice amount required'});
      const payload=JSON.stringify(items);
      const rows=await sql`WITH inv AS(
        INSERT INTO erp_supplier_invoices(company_id,supplier_id,invoice_number,invoice_date,due_date,amount,notes,created_by_user_id)
        SELECT ${u.company_id},s.id,${invoiceNumber},${invoiceDate}::date,${dueDate}::date,${amount},${clean(b.notes)||null},${u.id}
        FROM erp_suppliers s WHERE s.id=${supplierId} AND s.company_id=${u.company_id}
        RETURNING *
      ), added AS(
        INSERT INTO erp_supplier_invoice_items(company_id,supplier_invoice_id,product_id,description,quantity,unit_price)
        SELECT ${u.company_id},inv.id,j.product_id,j.description,j.quantity,j.unit_price
        FROM inv CROSS JOIN jsonb_to_recordset(${payload}::jsonb) AS j(product_id bigint,description text,quantity numeric,unit_price numeric)
        JOIN erp_products p ON p.id=j.product_id AND p.company_id=${u.company_id}
        RETURNING id
      )
      SELECT * FROM inv`;
      if(!rows[0])return res.status(404).json({error:'Supplier not found'});
      await companyAudit(sql,u,'SUPPLIER_INVOICE_CREATED',{entityType:'supplier_invoice',entityId:String(rows[0].id),metadata:{amount,item_count:items.length}});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_supplier_payment'){
      const supplierId=positiveInt(b.supplier_id,0),amount=number(b.amount),paymentDate=clean(b.payment_date)||new Date().toISOString().slice(0,10),method=clean(b.payment_method||'CASH').toUpperCase();
      if(!supplierId||amount<=0||!paymentMethods.has(method))return res.status(400).json({error:'Supplier, positive amount and valid payment method required'});
      const rows=await sql`INSERT INTO erp_supplier_payments(company_id,supplier_id,payment_date,amount,payment_method,reference_number,notes,created_by_user_id)
        SELECT ${u.company_id},s.id,${paymentDate}::date,${amount},${method},${clean(b.reference_number)||null},${clean(b.notes)||null},${u.id}
        FROM erp_suppliers s WHERE s.id=${supplierId} AND s.company_id=${u.company_id}
        RETURNING id,supplier_id,payment_date,amount,payment_method,reference_number,notes,created_at`;
      if(!rows[0])return res.status(404).json({error:'Supplier not found'});
      await companyAudit(sql,u,'SUPPLIER_PAYMENT_CREATED',{entityType:'supplier_payment',entityId:String(rows[0].id),metadata:{amount,method}});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_client'){
      const clientCode=code(b.client_code),name=clean(b.business_name);
      if(!clientCode||!name)return res.status(400).json({error:'Client code and business name required'});
      const rows=await sql`INSERT INTO erp_clients(company_id,client_code,business_name,contact_person,mobile_number,credit_limit,opening_balance,created_by_user_id)
        VALUES(${u.company_id},${clientCode},${name},${clean(b.contact_person)||null},${clean(b.mobile_number)||null},${number(b.credit_limit)},${number(b.opening_balance)},${u.id})
        RETURNING id,client_code,business_name,contact_person,mobile_number,credit_limit,opening_balance,status,created_at`;
      await companyAudit(sql,u,'CLIENT_CREATED',{entityType:'client',entityId:String(rows[0].id)});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_client_invoice'){
      const clientId=positiveInt(b.client_id,0),invoiceNumber=clean(b.invoice_number),amount=number(b.amount),invoiceDate=clean(b.invoice_date)||new Date().toISOString().slice(0,10),dueDate=clean(b.due_date)||null;
      if(!clientId||!invoiceNumber||amount<0)return res.status(400).json({error:'Client, invoice number and valid amount required'});
      const rows=await sql`INSERT INTO erp_client_invoices(company_id,client_id,invoice_number,invoice_date,due_date,amount,notes,created_by_user_id)
        SELECT ${u.company_id},c.id,${invoiceNumber},${invoiceDate}::date,${dueDate}::date,${amount},${clean(b.notes)||null},${u.id}
        FROM erp_clients c WHERE c.id=${clientId} AND c.company_id=${u.company_id}
        RETURNING id,client_id,invoice_number,invoice_date,due_date,amount,status,notes,created_at`;
      if(!rows[0])return res.status(404).json({error:'Client not found'});
      await companyAudit(sql,u,'CLIENT_INVOICE_CREATED',{entityType:'client_invoice',entityId:String(rows[0].id),metadata:{amount}});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_client_receipt'){
      const clientId=positiveInt(b.client_id,0),amount=number(b.amount),receiptDate=clean(b.receipt_date)||new Date().toISOString().slice(0,10),method=clean(b.payment_method||'CASH').toUpperCase();
      if(!clientId||amount<=0||!paymentMethods.has(method))return res.status(400).json({error:'Client, positive amount and valid payment method required'});
      const rows=await sql`INSERT INTO erp_client_receipts(company_id,client_id,receipt_date,amount,payment_method,reference_number,notes,created_by_user_id)
        SELECT ${u.company_id},c.id,${receiptDate}::date,${amount},${method},${clean(b.reference_number)||null},${clean(b.notes)||null},${u.id}
        FROM erp_clients c WHERE c.id=${clientId} AND c.company_id=${u.company_id}
        RETURNING id,client_id,receipt_date,amount,payment_method,reference_number,notes,created_at`;
      if(!rows[0])return res.status(404).json({error:'Client not found'});
      await companyAudit(sql,u,'CLIENT_RECEIPT_CREATED',{entityType:'client_receipt',entityId:String(rows[0].id),metadata:{amount,method}});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_product'){
      const sku=code(b.sku),name=clean(b.product_name),barcode=clean(b.barcode)||null;
      if(!sku||!name)return res.status(400).json({error:'SKU and product name required'});
      const rows=await sql`INSERT INTO erp_products(company_id,sku,barcode,product_name,unit,purchase_price,sale_price,created_by_user_id)
        VALUES(${u.company_id},${sku},${barcode},${name},${clean(b.unit)||'pcs'},${number(b.purchase_price)},${number(b.sale_price)},${u.id})
        RETURNING id,sku,barcode,product_name,unit,purchase_price,sale_price,active,created_at`;
      await companyAudit(sql,u,'PRODUCT_CREATED',{entityType:'product',entityId:String(rows[0].id)});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_warehouse'){
      const warehouseCode=code(b.warehouse_code),name=clean(b.warehouse_name);
      if(!warehouseCode||!name)return res.status(400).json({error:'Warehouse code and name required'});
      if(u.warehouse_limit){
        const count=await sql`SELECT COUNT(*)::int count FROM erp_warehouses WHERE company_id=${u.company_id} AND active=true`;
        if(Number(count[0]?.count||0)>=Number(u.warehouse_limit))return res.status(403).json({error:'Current subscription warehouse limit reached'});
      }
      const rows=await sql`INSERT INTO erp_warehouses(company_id,warehouse_code,warehouse_name,address,created_by_user_id)
        VALUES(${u.company_id},${warehouseCode},${name},${clean(b.address)||null},${u.id})
        RETURNING id,warehouse_code,warehouse_name,address,active,created_at`;
      await companyAudit(sql,u,'WAREHOUSE_CREATED',{entityType:'warehouse',entityId:String(rows[0].id)});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_grn'){
      const supplierInvoiceId=positiveInt(b.supplier_invoice_id,0),warehouseId=positiveInt(b.warehouse_id,0);
      const receivedDate=clean(b.received_date)||new Date().toISOString().slice(0,10),notes=clean(b.notes)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({
        supplier_invoice_item_id:positiveInt(x.supplier_invoice_item_id,0),
        product_id:positiveInt(x.product_id,0),
        ordered_qty:number(x.ordered_qty),
        quantity:number(x.received_qty??x.quantity),
        rejected_qty:number(x.rejected_qty),
        unit_cost:number(x.unit_cost),
        batch_no:clean(x.batch_no)||null,
        expiry_date:clean(x.expiry_date)||null,
        notes:clean(x.notes)||null
      })):[];
      if(!supplierInvoiceId||!warehouseId||!items.length)return res.status(400).json({error:'Supplier invoice, warehouse and products required'});
      if(items.some(x=>!x.supplier_invoice_item_id||!x.product_id||x.quantity<0||x.rejected_qty<0||x.unit_cost<0))return res.status(400).json({error:'Valid GRN product quantities required'});
      if(!items.some(x=>x.quantity>0))return res.status(400).json({error:'At least one product received quantity is required'});
      const inv=await sql`SELECT i.id,i.supplier_id,i.invoice_number FROM erp_supplier_invoices i WHERE i.id=${supplierInvoiceId} AND i.company_id=${u.company_id}`;
      if(!inv[0])return res.status(404).json({error:'Supplier invoice not found'});
      const wh=await sql`SELECT id FROM erp_warehouses WHERE id=${warehouseId} AND company_id=${u.company_id} AND active=true`;
      if(!wh[0])return res.status(400).json({error:'Warehouse not found'});
      for(const item of items){
        if(item.quantity<=0)continue;
        const check=await sql`SELECT ii.id,ii.product_id,ii.quantity,ii.unit_price,COALESCE(SUM(gi.quantity),0)::numeric already_received
          FROM erp_supplier_invoice_items ii
          LEFT JOIN erp_grn_items gi ON gi.supplier_invoice_item_id=ii.id AND gi.company_id=ii.company_id
          WHERE ii.id=${item.supplier_invoice_item_id} AND ii.supplier_invoice_id=${supplierInvoiceId} AND ii.company_id=${u.company_id}
          GROUP BY ii.id`;
        if(!check[0]||Number(check[0].product_id)!==item.product_id)return res.status(400).json({error:'Invoice product does not match'});
        const remaining=Number(check[0].quantity)-Number(check[0].already_received||0);
        if(item.quantity>remaining+0.000001)return res.status(400).json({error:'Received quantity exceeds invoice remaining quantity'});
        if(!item.unit_cost)item.unit_cost=number(check[0].unit_price);
        item.ordered_qty=number(check[0].quantity);
      }
      const seq=await sql`SELECT COALESCE(MAX(id),0)::bigint+1 next_id FROM erp_grns WHERE company_id=${u.company_id}`;
      const grnNumber='GRN-'+String(seq[0]?.next_id||1).padStart(6,'0');
      const g=await sql`INSERT INTO erp_grns(company_id,grn_number,supplier_id,supplier_invoice_id,warehouse_id,received_date,status,notes,created_by_user_id)
        VALUES(${u.company_id},${grnNumber},${inv[0].supplier_id},${supplierInvoiceId},${warehouseId},${receivedDate}::date,'posted',${notes},${u.id})
        RETURNING *`;
      for(const item of items){
        if(item.quantity<=0)continue;
        await sql`INSERT INTO erp_grn_items(company_id,grn_id,supplier_invoice_item_id,product_id,ordered_qty,quantity,rejected_qty,unit_cost,batch_no,expiry_date,notes)
          VALUES(${u.company_id},${g[0].id},${item.supplier_invoice_item_id},${item.product_id},${item.ordered_qty},${item.quantity},${item.rejected_qty},${item.unit_cost},${item.batch_no},${item.expiry_date}::date,${item.notes})`;
        await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${warehouseId},'GRN',${item.quantity},0,${item.unit_cost},'GRN',${g[0].id},${grnNumber},${item.notes},${u.id})`;
      }
      await companyAudit(sql,u,'GRN_POSTED',{entityType:'grn',entityId:String(g[0].id),metadata:{grn_number:grnNumber,invoice_id:supplierInvoiceId,item_count:items.filter(x=>x.quantity>0).length}});
      return res.status(201).json({record:g[0]});
    }
    if(req.method==='POST'&&action==='create_stock_transfer'){
      const fromWarehouseId=positiveInt(b.from_warehouse_id,0),toWarehouseId=positiveInt(b.to_warehouse_id,0);
      const transferDate=clean(b.transfer_date)||new Date().toISOString().slice(0,10),notes=clean(b.notes)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({product_id:positiveInt(x.product_id,0),quantity:number(x.quantity),unit_cost:number(x.unit_cost),notes:clean(x.notes)||null})):[];
      if(!fromWarehouseId||!toWarehouseId||fromWarehouseId===toWarehouseId||!items.length)return res.status(400).json({error:'Different source and destination warehouses with products required'});
      if(items.some(x=>!x.product_id||x.quantity<=0||x.unit_cost<0))return res.status(400).json({error:'Valid transfer products and quantities required'});
      const warehouses=await sql`SELECT id FROM erp_warehouses WHERE company_id=${u.company_id} AND active=true AND id IN (${fromWarehouseId},${toWarehouseId})`;
      if(warehouses.length!==2)return res.status(400).json({error:'Valid active warehouses required'});
      for(const item of items){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity
          FROM erp_inventory_movements WHERE company_id=${u.company_id} AND warehouse_id=${fromWarehouseId} AND product_id=${item.product_id}`;
        if(Number(stock[0]?.quantity||0)+1e-9<item.quantity)return res.status(400).json({error:'Insufficient stock for one or more transfer products'});
      }
      const seq=await sql`SELECT COALESCE(MAX(id),0)::bigint+1 next_id FROM erp_stock_transfers WHERE company_id=${u.company_id}`;
      const transferNumber='TRF-'+String(seq[0]?.next_id||1).padStart(6,'0');
      const tr=await sql`INSERT INTO erp_stock_transfers(company_id,transfer_number,from_warehouse_id,to_warehouse_id,transfer_date,status,notes,created_by_user_id)
        VALUES(${u.company_id},${transferNumber},${fromWarehouseId},${toWarehouseId},${transferDate}::date,'posted',${notes},${u.id}) RETURNING *`;
      for(const item of items){
        await sql`INSERT INTO erp_stock_transfer_items(company_id,stock_transfer_id,product_id,quantity,unit_cost,notes)
          VALUES(${u.company_id},${tr[0].id},${item.product_id},${item.quantity},${item.unit_cost},${item.notes})`;
        await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${fromWarehouseId},'TRANSFER_OUT',0,${item.quantity},${item.unit_cost},'TRANSFER',${tr[0].id},${transferNumber},${item.notes},${u.id})`;
        await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${toWarehouseId},'TRANSFER_IN',${item.quantity},0,${item.unit_cost},'TRANSFER',${tr[0].id},${transferNumber},${item.notes},${u.id})`;
      }
      await companyAudit(sql,u,'STOCK_TRANSFER_POSTED',{entityType:'stock_transfer',entityId:String(tr[0].id),metadata:{transfer_number:transferNumber,item_count:items.length}});
      return res.status(201).json({record:tr[0]});
    }
    if(req.method==='POST'&&action==='create_stock_adjustment'){
      const warehouseId=positiveInt(b.warehouse_id,0),productId=positiveInt(b.product_id,0),type=clean(b.adjustment_type).toLowerCase();
      const quantity=number(b.quantity),unitCost=number(b.unit_cost),adjustmentDate=clean(b.adjustment_date)||new Date().toISOString().slice(0,10);
      if(!warehouseId||!productId||!['in','out'].includes(type)||quantity<=0||unitCost<0)return res.status(400).json({error:'Warehouse, product, adjustment type and positive quantity required'});
      const valid=await sql`SELECT
        EXISTS(SELECT 1 FROM erp_warehouses WHERE id=${warehouseId} AND company_id=${u.company_id} AND active=true) warehouse_ok,
        EXISTS(SELECT 1 FROM erp_products WHERE id=${productId} AND company_id=${u.company_id} AND active=true) product_ok`;
      if(!valid[0]?.warehouse_ok||!valid[0]?.product_ok)return res.status(400).json({error:'Valid warehouse and product required'});
      if(type==='out'){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements WHERE company_id=${u.company_id} AND warehouse_id=${warehouseId} AND product_id=${productId}`;
        if(Number(stock[0]?.quantity||0)+1e-9<quantity)return res.status(400).json({error:'Adjustment quantity exceeds available stock'});
      }
      const seq=await sql`SELECT COALESCE(MAX(id),0)::bigint+1 next_id FROM erp_stock_adjustments WHERE company_id=${u.company_id}`;
      const adjustmentNumber='ADJ-'+String(seq[0]?.next_id||1).padStart(6,'0'),reason=clean(b.reason)||null,notes=clean(b.notes)||null;
      const a=await sql`INSERT INTO erp_stock_adjustments(company_id,adjustment_number,warehouse_id,product_id,adjustment_date,adjustment_type,quantity,unit_cost,reason,notes,created_by_user_id)
        VALUES(${u.company_id},${adjustmentNumber},${warehouseId},${productId},${adjustmentDate}::date,${type},${quantity},${unitCost},${reason},${notes},${u.id}) RETURNING *`;
      await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
        VALUES(${u.company_id},${productId},${warehouseId},${type==='in'?'ADJUSTMENT_IN':'ADJUSTMENT_OUT'},${type==='in'?quantity:0},${type==='out'?quantity:0},${unitCost},'ADJUSTMENT',${a[0].id},${adjustmentNumber},${notes},${u.id})`;
      await companyAudit(sql,u,'STOCK_ADJUSTMENT_POSTED',{entityType:'stock_adjustment',entityId:String(a[0].id),metadata:{adjustment_number:adjustmentNumber,type,quantity}});
      return res.status(201).json({record:a[0]});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('Bizora company API error',e);
    const msg=String(e.message||'Company workspace failed'),status=/unique|duplicate/i.test(msg)?409:(e.statusCode||500);
    return res.status(status).json({error:status===409?'Code, invoice number, email or barcode already exists in this company':msg});
  }
}
