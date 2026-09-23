import { bizoraSql,ensureBizoraSchema,requireCompanyUser,body,clean,positiveInt,companyAudit } from './_bizora-core.js';

const code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,30);
const number=v=>Number.isFinite(Number(v))?Number(v):0;

async function overview(sql,u){
  const [stats]=await Promise.all([
    sql`SELECT
      (SELECT COUNT(*) FROM erp_suppliers WHERE company_id=${u.company_id} AND status='active')::int suppliers,
      (SELECT COUNT(*) FROM erp_clients WHERE company_id=${u.company_id} AND status='active')::int clients,
      (SELECT COUNT(*) FROM erp_products WHERE company_id=${u.company_id} AND active=true)::int products,
      (SELECT COUNT(*) FROM erp_warehouses WHERE company_id=${u.company_id} AND active=true)::int warehouses`
  ]);
  return {company:{id:u.company_id,code:u.company_code,name:u.company_name,logo_url:u.logo_url,status:u.company_status},user:{id:u.id,user_code:u.user_code,full_name:u.full_name,email:u.email,role:u.role},subscription:{status:u.subscription_status,expires_on:u.expires_on,plan_code:u.plan_code,plan_name:u.plan_name,features:u.features,access_mode:u.access_mode},limits:{user_limit:u.user_limit,warehouse_limit:u.warehouse_limit},stats:stats[0]||{}};
}

export default async function handler(req,res){
  try{
    const sql=bizoraSql();await ensureBizoraSchema(sql);
    const b=body(req),action=clean(req.query?.action||b.action||'overview');
    const write=req.method!=='GET';
    const u=await requireCompanyUser(sql,req,res,{write});if(!u)return;

    if(req.method==='GET'&&action==='overview')return res.status(200).json(await overview(sql,u));

    if(req.method==='GET'&&action==='suppliers'){
      const rows=await sql`SELECT id,supplier_code,business_name,contact_person,mobile_number,opening_balance,status,created_at FROM erp_suppliers WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 500`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='clients'){
      const rows=await sql`SELECT id,client_code,business_name,contact_person,mobile_number,credit_limit,opening_balance,status,created_at FROM erp_clients WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 500`;
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

    if(req.method==='POST'&&action==='create_supplier'){
      const supplierCode=code(b.supplier_code),name=clean(b.business_name);
      if(!supplierCode||!name)return res.status(400).json({error:'Supplier code and business name required'});
      const rows=await sql`INSERT INTO erp_suppliers(company_id,supplier_code,business_name,contact_person,mobile_number,opening_balance,created_by_user_id)
        VALUES(${u.company_id},${supplierCode},${name},${clean(b.contact_person)||null},${clean(b.mobile_number)||null},${number(b.opening_balance)},${u.id})
        RETURNING id,supplier_code,business_name,contact_person,mobile_number,opening_balance,status,created_at`;
      await companyAudit(sql,u,'SUPPLIER_CREATED',{entityType:'supplier',entityId:String(rows[0].id)});
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
    return res.status(status).json({error:status===409?'Code or barcode already exists in this company':msg});
  }
}
