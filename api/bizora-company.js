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
      suppliers:'supplier_management',supplier_invoices:'supplier_management',supplier_payments:'supplier_management',
      create_supplier:'supplier_management',create_supplier_invoice:'supplier_management',create_supplier_payment:'supplier_management',
      clients:'customer_management',client_invoices:'customer_management',client_receipts:'customer_management',
      create_client:'customer_management',create_client_invoice:'customer_management',create_client_receipt:'customer_management',
      products:'products',create_product:'products',
      warehouses:'warehouses',create_warehouse:'warehouses'
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
      const rows=await sql`SELECT i.id,i.supplier_id,s.business_name,i.invoice_number,i.invoice_date,i.due_date,i.amount,i.status,i.notes,i.created_at
        FROM erp_supplier_invoices i JOIN erp_suppliers s ON s.id=i.supplier_id AND s.company_id=i.company_id
        WHERE i.company_id=${u.company_id} ORDER BY i.invoice_date DESC,i.id DESC LIMIT 1000`;
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
      const supplierId=positiveInt(b.supplier_id,0),invoiceNumber=clean(b.invoice_number),amount=number(b.amount),invoiceDate=clean(b.invoice_date)||new Date().toISOString().slice(0,10),dueDate=clean(b.due_date)||null;
      if(!supplierId||!invoiceNumber||amount<0)return res.status(400).json({error:'Supplier, invoice number and valid amount required'});
      const rows=await sql`INSERT INTO erp_supplier_invoices(company_id,supplier_id,invoice_number,invoice_date,due_date,amount,notes,created_by_user_id)
        SELECT ${u.company_id},s.id,${invoiceNumber},${invoiceDate}::date,${dueDate}::date,${amount},${clean(b.notes)||null},${u.id}
        FROM erp_suppliers s WHERE s.id=${supplierId} AND s.company_id=${u.company_id}
        RETURNING id,supplier_id,invoice_number,invoice_date,due_date,amount,status,notes,created_at`;
      if(!rows[0])return res.status(404).json({error:'Supplier not found'});
      await companyAudit(sql,u,'SUPPLIER_INVOICE_CREATED',{entityType:'supplier_invoice',entityId:String(rows[0].id),metadata:{amount}});
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

    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('Bizora company API error',e);
    const msg=String(e.message||'Company workspace failed'),status=/unique|duplicate/i.test(msg)?409:(e.statusCode||500);
    return res.status(status).json({error:status===409?'Code, invoice number, email or barcode already exists in this company':msg});
  }
}
