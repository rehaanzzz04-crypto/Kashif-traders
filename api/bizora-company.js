import { bizoraSql,ensureBizoraSchema,requireCompanyUser,requireFeature,body,clean,positiveInt,companyAudit,hashPassword } from './_bizora-core.js';

const code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,30);
const number=v=>Number.isFinite(Number(v))?Number(v):0;
const paymentMethods=new Set(['CASH','BANK','ONLINE','CHEQUE','EASYPAISA','JAZZCASH']);
const ecommercePaymentMethods=new Set(['COD','CASH','BANK','ONLINE','EASYPAISA','JAZZCASH']);
const ecommerceOrderStatuses=new Set(['pending','confirmed','packed','shipped','completed','cancelled']);
const ecommercePaymentStatuses=new Set(['unpaid','paid','refunded']);
const userRoles=new Set(['company_admin','manager','accountant','salesman','cashier']);

const allWorkspaceViews=['users','suppliers','supplier-bills','supplier-payments','supplier-statement','clients','client-bills','client-payments','client-statement','products','warehouses','grns','inventory-stock','inventory-ledger','stock-transfers','stock-adjustments','supplier-returns','client-returns','cashier','ecommerce','ocr-drafts','automation-center','communications','reports','advanced-reports','audit-center'];
const roleViews={
  company_admin:allWorkspaceViews,
  manager:allWorkspaceViews.filter(x=>x!=='users'),
  accountant:['suppliers','supplier-bills','supplier-payments','supplier-statement','clients','client-bills','client-payments','client-statement','products','warehouses','grns','inventory-stock','inventory-ledger','supplier-returns','client-returns','ocr-drafts','communications','reports','advanced-reports'],
  salesman:['clients','client-bills','client-payments','client-statement','products','warehouses','inventory-stock','client-returns','cashier','communications','reports'],
  cashier:['clients','products','warehouses','inventory-stock','cashier']
};
const roleWriteViews={
  company_admin:allWorkspaceViews,
  manager:allWorkspaceViews.filter(x=>x!=='users'),
  accountant:['suppliers','supplier-bills','supplier-payments','clients','client-bills','client-payments','supplier-returns','client-returns','ocr-drafts','communications'],
  salesman:['clients','client-bills','client-payments','client-returns','cashier','communications'],
  cashier:['cashier']
};
const roleActionSets={
  accountant:new Set([
    'overview','suppliers','supplier_invoices','supplier_invoice_items','supplier_payments','supplier_payment_detail','supplier_statement',
    'create_supplier','update_supplier','set_supplier_status','create_supplier_invoice','update_supplier_invoice','cancel_supplier_invoice','create_supplier_payment','cancel_supplier_payment',
    'clients','client_invoices','client_invoice_items','client_receipts','client_receipt_detail','client_statement',
    'create_client','update_client','set_client_status','create_client_invoice','update_client_invoice','cancel_client_invoice','create_client_receipt','cancel_client_receipt',
    'products','warehouses','grns','grn_detail','inventory_stock','inventory_ledger',
    'supplier_returns','supplier_return_items','supplier_return_detail','create_supplier_return','cancel_supplier_return',
    'client_returns','client_return_items','client_return_detail','create_client_return','cancel_client_return',
    'ocr_drafts','ocr_draft_detail','save_ocr_draft','post_ocr_draft','reject_ocr_draft',
    'communication_center','save_communication_settings','prepare_whatsapp_share',
    'reports_summary','advanced_reports'
  ]),
  salesman:new Set([
    'overview','clients','client_invoices','client_invoice_items','client_receipts','client_receipt_detail','client_statement',
    'create_client','update_client','set_client_status','create_client_invoice','update_client_invoice','cancel_client_invoice','create_client_receipt','cancel_client_receipt',
    'products','warehouses','inventory_stock','client_returns','client_return_items','client_return_detail','create_client_return','cancel_client_return',
    'communication_center','prepare_whatsapp_share','reports_summary'
  ]),
  cashier:new Set([
    'overview','clients','create_client','client_invoices','client_invoice_items','client_receipts','client_receipt_detail','create_client_invoice','create_client_receipt',
    'products','warehouses','inventory_stock'
  ])
};
function roleAllowsAction(role,action){
  if(role==='company_admin')return true;
  if(role==='manager')return !['users','create_user','update_user','set_user_status'].includes(action);
  return roleActionSets[role]?.has(action)===true;
}
function roleAccessFor(role){
  return {views:roleViews[role]||[],write_views:roleWriteViews[role]||[],can_manage_users:role==='company_admin'};
}

const automationRuleCodes=new Set(['LOW_STOCK','OVERDUE_CUSTOMER','OVERDUE_SUPPLIER','PENDING_GRN']);
async function ensureAutomationRules(sql,u){
  const defaults=[
    ['LOW_STOCK','Low Stock Alert',{threshold:5}],
    ['OVERDUE_CUSTOMER','Overdue Customer Invoices',{days:0}],
    ['OVERDUE_SUPPLIER','Overdue Supplier Invoices',{days:0}],
    ['PENDING_GRN','Pending Goods Receiving',{days:2}]
  ];
  for(const [ruleCode,ruleName,parameters] of defaults)await sql`INSERT INTO automation_rules(company_id,rule_code,rule_name,active,parameters,created_by_user_id)
    VALUES(${u.company_id},${ruleCode},${ruleName},true,${JSON.stringify(parameters)}::jsonb,${u.id})
    ON CONFLICT(company_id,rule_code) DO NOTHING`;
}
async function runAutomationRules(sql,u,{force=false}={}){
  await ensureAutomationRules(sql,u);
  const last=await sql`SELECT MAX(last_run_at) last_run_at FROM automation_rules WHERE company_id=${u.company_id} AND active=true`;
  if(!force&&last[0]?.last_run_at&&Date.now()-new Date(last[0].last_run_at).getTime()<6*60*60*1000){
    const count=await sql`SELECT COUNT(*)::int count FROM automation_alerts WHERE company_id=${u.company_id} AND status='open'`;
    return {ran:false,open_alerts:Number(count[0]?.count||0),last_run_at:last[0].last_run_at};
  }
  const rules=await sql`SELECT id,rule_code,rule_name,active,parameters FROM automation_rules WHERE company_id=${u.company_id} AND active=true ORDER BY id`;
  let detectedTotal=0;
  for(const rule of rules){
    const found=[];
    if(rule.rule_code==='LOW_STOCK'){
      const threshold=Math.max(0,number(rule.parameters?.threshold??5));
      const rows=await sql`SELECT p.id product_id,p.sku,p.product_name,w.id warehouse_id,w.warehouse_name,
          COALESCE(SUM(m.qty_in-m.qty_out),0)::numeric quantity
        FROM erp_inventory_movements m
        JOIN erp_products p ON p.id=m.product_id AND p.company_id=m.company_id AND p.active=true
        JOIN erp_warehouses w ON w.id=m.warehouse_id AND w.company_id=m.company_id AND w.active=true
        WHERE m.company_id=${u.company_id}
        GROUP BY p.id,p.sku,p.product_name,w.id,w.warehouse_name
        HAVING COALESCE(SUM(m.qty_in-m.qty_out),0)<=${threshold}
        ORDER BY quantity,p.product_name LIMIT 250`;
      for(const x of rows)found.push({key:`${x.warehouse_id}:${x.product_id}`,severity:number(x.quantity)<=0?'critical':'warning',title:'Low Stock · '+x.product_name,message:`${x.warehouse_name}: ${number(x.quantity)} ${x.sku||''} remaining (threshold ${threshold})`,entity_type:'product',entity_id:String(x.product_id)});
    }
    if(rule.rule_code==='OVERDUE_CUSTOMER'){
      const days=Math.max(0,Math.floor(number(rule.parameters?.days??0)));
      const rows=await sql`SELECT i.id,i.invoice_number,i.due_date,c.business_name,
          GREATEST(i.amount
            -COALESCE((SELECT SUM(r.amount) FROM erp_client_returns r WHERE r.company_id=i.company_id AND r.client_invoice_id=i.id AND r.status='posted'),0)
            -COALESCE((SELECT SUM(a.amount) FROM erp_client_receipt_allocations a WHERE a.company_id=i.company_id AND a.client_invoice_id=i.id),0),0)::numeric balance
        FROM erp_client_invoices i JOIN erp_clients c ON c.id=i.client_id AND c.company_id=i.company_id
        WHERE i.company_id=${u.company_id} AND i.status<>'cancelled' AND i.due_date IS NOT NULL
          AND i.due_date < CURRENT_DATE-${days}::int
          AND i.amount
            -COALESCE((SELECT SUM(r.amount) FROM erp_client_returns r WHERE r.company_id=i.company_id AND r.client_invoice_id=i.id AND r.status='posted'),0)
            -COALESCE((SELECT SUM(a.amount) FROM erp_client_receipt_allocations a WHERE a.company_id=i.company_id AND a.client_invoice_id=i.id),0) > 0.01
        ORDER BY i.due_date LIMIT 250`;
      for(const x of rows)found.push({key:String(x.id),severity:'warning',title:'Customer Payment Overdue · '+x.business_name,message:`${x.invoice_number} · due ${String(x.due_date).slice(0,10)} · balance PKR ${number(x.balance).toLocaleString('en-PK')}`,entity_type:'client_invoice',entity_id:String(x.id)});
    }
    if(rule.rule_code==='OVERDUE_SUPPLIER'){
      const days=Math.max(0,Math.floor(number(rule.parameters?.days??0)));
      const rows=await sql`SELECT i.id,i.invoice_number,i.due_date,s.business_name,
          GREATEST(i.amount
            -COALESCE((SELECT SUM(r.amount) FROM erp_supplier_returns r WHERE r.company_id=i.company_id AND r.supplier_invoice_id=i.id AND r.status='posted'),0)
            -COALESCE((SELECT SUM(a.amount) FROM erp_supplier_payment_allocations a WHERE a.company_id=i.company_id AND a.supplier_invoice_id=i.id),0),0)::numeric balance
        FROM erp_supplier_invoices i JOIN erp_suppliers s ON s.id=i.supplier_id AND s.company_id=i.company_id
        WHERE i.company_id=${u.company_id} AND i.status<>'cancelled' AND i.due_date IS NOT NULL
          AND i.due_date < CURRENT_DATE-${days}::int
          AND i.amount
            -COALESCE((SELECT SUM(r.amount) FROM erp_supplier_returns r WHERE r.company_id=i.company_id AND r.supplier_invoice_id=i.id AND r.status='posted'),0)
            -COALESCE((SELECT SUM(a.amount) FROM erp_supplier_payment_allocations a WHERE a.company_id=i.company_id AND a.supplier_invoice_id=i.id),0) > 0.01
        ORDER BY i.due_date LIMIT 250`;
      for(const x of rows)found.push({key:String(x.id),severity:'warning',title:'Supplier Payment Overdue · '+x.business_name,message:`${x.invoice_number} · due ${String(x.due_date).slice(0,10)} · balance PKR ${number(x.balance).toLocaleString('en-PK')}`,entity_type:'supplier_invoice',entity_id:String(x.id)});
    }
    if(rule.rule_code==='PENDING_GRN'){
      const days=Math.max(0,Math.floor(number(rule.parameters?.days??2)));
      const rows=await sql`SELECT i.id,i.invoice_number,i.invoice_date,s.business_name,
          COALESCE(q.ordered_qty,0)::numeric ordered_qty,COALESCE(g.received_qty,0)::numeric received_qty
        FROM erp_supplier_invoices i
        JOIN erp_suppliers s ON s.id=i.supplier_id AND s.company_id=i.company_id
        JOIN LATERAL(SELECT COALESCE(SUM(x.quantity),0)::numeric ordered_qty FROM erp_supplier_invoice_items x WHERE x.company_id=i.company_id AND x.supplier_invoice_id=i.id) q ON true
        LEFT JOIN LATERAL(SELECT COALESCE(SUM(gi.quantity),0)::numeric received_qty
          FROM erp_grn_items gi
          JOIN erp_grns gr ON gr.id=gi.grn_id AND gr.company_id=gi.company_id AND gr.status='posted'
          JOIN erp_supplier_invoice_items ii ON ii.id=gi.supplier_invoice_item_id AND ii.company_id=gi.company_id
          WHERE gi.company_id=i.company_id AND ii.supplier_invoice_id=i.id) g ON true
        WHERE i.company_id=${u.company_id} AND i.status<>'cancelled' AND q.ordered_qty>COALESCE(g.received_qty,0)
          AND i.invoice_date <= CURRENT_DATE-${days}::int
        ORDER BY i.invoice_date LIMIT 250`;
      for(const x of rows)found.push({key:String(x.id),severity:'info',title:'GRN Pending · '+x.business_name,message:`${x.invoice_number} · received ${number(x.received_qty)} of ${number(x.ordered_qty)}`,entity_type:'supplier_invoice',entity_id:String(x.id)});
    }
    await sql`UPDATE automation_alerts SET status='resolved',resolved_at=now(),updated_at=now()
      WHERE company_id=${u.company_id} AND rule_id=${rule.id} AND status='open'`;
    for(const a of found)await sql`INSERT INTO automation_alerts(company_id,rule_id,rule_code,alert_key,severity,title,message,entity_type,entity_id,status,last_detected_at,resolved_at)
      VALUES(${u.company_id},${rule.id},${rule.rule_code},${a.key},${a.severity},${a.title},${a.message},${a.entity_type},${a.entity_id},'open',now(),NULL)
      ON CONFLICT(company_id,rule_code,alert_key) DO UPDATE SET
        rule_id=EXCLUDED.rule_id,severity=EXCLUDED.severity,title=EXCLUDED.title,message=EXCLUDED.message,entity_type=EXCLUDED.entity_type,entity_id=EXCLUDED.entity_id,
        status=CASE WHEN automation_alerts.status='dismissed' THEN 'dismissed' ELSE 'open' END,last_detected_at=now(),resolved_at=NULL,updated_at=now()`;
    await sql`UPDATE automation_rules SET last_run_at=now(),updated_at=now() WHERE id=${rule.id} AND company_id=${u.company_id}`;
    detectedTotal+=found.length;
  }
  const count=await sql`SELECT COUNT(*)::int count FROM automation_alerts WHERE company_id=${u.company_id} AND status='open'`;
  await companyAudit(sql,u,'AUTOMATION_RULES_RUN',{entityType:'automation',entityId:String(u.company_id),metadata:{detected:detectedTotal,open_alerts:Number(count[0]?.count||0),force}});
  return {ran:true,detected:detectedTotal,open_alerts:Number(count[0]?.count||0),last_run_at:new Date().toISOString()};
}

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
      - COALESCE((SELECT SUM(amount) FROM erp_supplier_returns WHERE company_id=${u.company_id} AND status='posted'),0)
      - COALESCE((SELECT SUM(amount) FROM erp_supplier_payments WHERE company_id=${u.company_id} AND status='posted'),0)
    )::numeric supplier_payable,
    (
      COALESCE((SELECT SUM(opening_balance) FROM erp_clients WHERE company_id=${u.company_id}),0)
      + COALESCE((SELECT SUM(amount) FROM erp_client_invoices WHERE company_id=${u.company_id} AND status<>'cancelled'),0)
      - COALESCE((SELECT SUM(amount) FROM erp_client_returns WHERE company_id=${u.company_id} AND status='posted'),0)
      - COALESCE((SELECT SUM(amount) FROM erp_client_receipts WHERE company_id=${u.company_id} AND status='posted'),0)
    )::numeric client_receivable`;
  const auditPriceRows=await sql`SELECT asp.per_audit_price,asp.active FROM audit_service_prices asp WHERE asp.plan_id=${u.plan_id} LIMIT 1`;
  return {company:{id:u.company_id,code:u.company_code,name:u.company_name,logo_url:u.logo_url,status:u.company_status},user:{id:u.id,user_code:u.user_code,full_name:u.full_name,email:u.email,role:u.role},subscription:{status:u.subscription_status,expires_on:u.expires_on,plan_code:u.plan_code,plan_name:u.plan_name,features:u.features,access_mode:u.access_mode},limits:{user_limit:u.user_limit,warehouse_limit:u.warehouse_limit},stats:stats[0]||{},audit_service:{per_audit_price:auditPriceRows[0]?.per_audit_price||null,active:auditPriceRows[0]?.active===true},role_access:roleAccessFor(u.role)};
}

export default async function handler(req,res){
  try{
    const sql=bizoraSql();await ensureBizoraSchema(sql);
    const b=body(req),action=clean(req.query?.action||b.action||'overview');
    const write=req.method!=='GET';
    const u=await requireCompanyUser(sql,req,res,{write});if(!u)return;

    const featureByAction={
      users:'core_erp',create_user:'core_erp',update_user:'core_erp',set_user_status:'core_erp',
      suppliers:'supplier_management',supplier_invoices:'supplier_management',supplier_invoice_items:'supplier_management',supplier_payments:'supplier_management',supplier_payment_detail:'supplier_management',supplier_statement:'supplier_management',
      create_supplier:'supplier_management',update_supplier:'supplier_management',set_supplier_status:'supplier_management',create_supplier_invoice:'supplier_management',update_supplier_invoice:'supplier_management',cancel_supplier_invoice:'supplier_management',create_supplier_payment:'supplier_management',cancel_supplier_payment:'supplier_management',
      clients:'customer_management',client_invoices:'customer_management',client_invoice_items:'customer_management',client_receipts:'customer_management',client_receipt_detail:'customer_management',client_statement:'customer_management',
      create_client:'customer_management',update_client:'customer_management',set_client_status:'customer_management',create_client_invoice:'customer_management',update_client_invoice:'customer_management',cancel_client_invoice:'customer_management',create_client_receipt:'customer_management',cancel_client_receipt:'customer_management',
      products:'products',create_product:'products',update_product:'products',set_product_status:'products',
      warehouses:'warehouses',create_warehouse:'warehouses',update_warehouse:'warehouses',set_warehouse_status:'warehouses',
      grns:'grn',grn_detail:'grn',create_grn:'grn',cancel_grn:'grn',
      inventory_stock:'inventory_ledger',inventory_ledger:'inventory_ledger',
      stock_transfers:'inventory_ledger',stock_transfer_detail:'inventory_ledger',create_stock_transfer:'inventory_ledger',cancel_stock_transfer:'inventory_ledger',
      stock_adjustments:'inventory_ledger',create_stock_adjustment:'inventory_ledger',cancel_stock_adjustment:'inventory_ledger',supplier_returns:'inventory_ledger',supplier_return_items:'inventory_ledger',supplier_return_detail:'inventory_ledger',create_supplier_return:'inventory_ledger',cancel_supplier_return:'inventory_ledger',client_returns:'inventory_ledger',client_return_items:'inventory_ledger',client_return_detail:'inventory_ledger',create_client_return:'inventory_ledger',cancel_client_return:'inventory_ledger',
      ecommerce_dashboard:'ecommerce',ecommerce_products:'ecommerce',ecommerce_orders:'ecommerce',ecommerce_order_detail:'ecommerce',ecommerce_sales_report:'ecommerce',save_ecommerce_product:'ecommerce',set_ecommerce_product_status:'ecommerce',save_ecommerce_settings:'ecommerce',create_ecommerce_order:'ecommerce',set_ecommerce_order_status:'ecommerce',set_ecommerce_payment_status:'ecommerce',
      ocr_drafts:'ocr',ocr_draft_detail:'ocr',save_ocr_draft:'ocr',post_ocr_draft:'ocr',reject_ocr_draft:'ocr',
      automation_center:'automation',run_automations:'automation',update_automation_rule:'automation',dismiss_automation_alert:'automation',
      communication_center:'automation',save_communication_settings:'automation',prepare_whatsapp_share:'automation',
      reports_summary:'basic_reports',advanced_reports:'advanced_reports'
    };
    const requiredFeature=featureByAction[action];
    if(requiredFeature&&!requireFeature(u,res,requiredFeature))return;
    if(!roleAllowsAction(u.role,action))return res.status(403).json({error:'Your company role does not allow this action'});

    if(req.method==='GET'&&action==='overview')return res.status(200).json(await overview(sql,u));
    if(['audit_service','audit_events','request_audit'].includes(action)&&!['company_admin','manager'].includes(u.role))return res.status(403).json({error:'Company Admin or Manager role required for Audit Service'});

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
        COALESCE(SUM(gi.quantity) FILTER(WHERE g.id IS NOT NULL),0)::numeric received_quantity,
        GREATEST(ii.quantity-COALESCE(SUM(gi.quantity) FILTER(WHERE g.id IS NOT NULL),0),0)::numeric remaining_quantity
        FROM erp_supplier_invoice_items ii
        JOIN erp_supplier_invoices i ON i.id=ii.supplier_invoice_id AND i.company_id=ii.company_id
        JOIN erp_products p ON p.id=ii.product_id AND p.company_id=ii.company_id
        LEFT JOIN erp_grn_items gi ON gi.supplier_invoice_item_id=ii.id AND gi.company_id=ii.company_id
        LEFT JOIN erp_grns g ON g.id=gi.grn_id AND g.company_id=gi.company_id AND g.status='posted'
        WHERE ii.company_id=${u.company_id} AND ii.supplier_invoice_id=${invoiceId}
        GROUP BY ii.id,p.sku,p.product_name,p.unit
        ORDER BY ii.id`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='supplier_payments'){
      const rows=await sql`SELECT p.id,p.supplier_id,s.business_name,p.payment_date,p.amount,p.payment_method,p.reference_number,p.notes,p.status,p.cancelled_at,p.created_at,
        COALESCE(a.allocated_amount,0)::numeric allocated_amount
        FROM erp_supplier_payments p JOIN erp_suppliers s ON s.id=p.supplier_id AND s.company_id=p.company_id
        LEFT JOIN LATERAL(SELECT COALESCE(SUM(amount),0)::numeric allocated_amount FROM erp_supplier_payment_allocations x WHERE x.company_id=p.company_id AND x.supplier_payment_id=p.id) a ON true
        WHERE p.company_id=${u.company_id} ORDER BY p.payment_date DESC,p.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='supplier_payment_detail'){
      const paymentId=positiveInt(req.query?.payment_id,0);
      if(!paymentId)return res.status(400).json({error:'Valid supplier payment required'});
      const rows=await sql`SELECT p.id,p.supplier_id,s.business_name,s.supplier_code,p.payment_date,p.amount,p.payment_method,p.reference_number,p.notes,p.status,p.cancelled_at,p.created_at
        FROM erp_supplier_payments p JOIN erp_suppliers s ON s.id=p.supplier_id AND s.company_id=p.company_id
        WHERE p.id=${paymentId} AND p.company_id=${u.company_id} LIMIT 1`;
      if(!rows[0])return res.status(404).json({error:'Supplier payment not found'});
      const allocations=await sql`SELECT a.supplier_invoice_id invoice_id,i.invoice_number,a.amount
        FROM erp_supplier_payment_allocations a JOIN erp_supplier_invoices i ON i.id=a.supplier_invoice_id AND i.company_id=a.company_id
        WHERE a.company_id=${u.company_id} AND a.supplier_payment_id=${paymentId} ORDER BY a.id`;
      return res.status(200).json({record:rows[0],allocations});
    }
    if(req.method==='GET'&&action==='supplier_statement'){
      const supplierId=positiveInt(req.query?.supplier_id,0);
      if(!supplierId)return res.status(400).json({error:'Valid supplier required'});
      const supplier=await sql`SELECT id,supplier_code,business_name,opening_balance FROM erp_suppliers WHERE id=${supplierId} AND company_id=${u.company_id}`;
      if(!supplier[0])return res.status(404).json({error:'Supplier not found'});
      const rows=await sql`WITH entries AS(
        SELECT i.invoice_date::date entry_date,'INVOICE'::text entry_type,i.invoice_number reference,i.amount::numeric debit,0::numeric credit,i.notes,i.id sort_id
        FROM erp_supplier_invoices i WHERE i.company_id=${u.company_id} AND i.supplier_id=${supplierId} AND i.status<>'cancelled'
        UNION ALL
        SELECT r.return_date::date,'RETURN',r.return_number,0::numeric,r.amount::numeric,r.notes,500000000+r.id
        FROM erp_supplier_returns r WHERE r.company_id=${u.company_id} AND r.supplier_id=${supplierId} AND r.status='posted'
        UNION ALL
        SELECT p.payment_date::date,'PAYMENT',COALESCE(p.reference_number,''),0::numeric,p.amount::numeric,p.notes,1000000000+p.id
        FROM erp_supplier_payments p WHERE p.company_id=${u.company_id} AND p.supplier_id=${supplierId} AND p.status='posted'
      )
      SELECT entry_date,entry_type,reference,debit,credit,notes,
        ${number(supplier[0].opening_balance)} + SUM(debit-credit) OVER(ORDER BY entry_date,sort_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
      FROM entries ORDER BY entry_date,sort_id`;
      const balance=number(supplier[0].opening_balance)+rows.reduce((n,x)=>n+number(x.debit)-number(x.credit),0);
      return res.status(200).json({party:supplier[0],opening_balance:supplier[0].opening_balance,balance,records:rows});
    }
    if(req.method==='GET'&&action==='clients'){
      const rows=await sql`SELECT id,client_code,business_name,contact_person,mobile_number,credit_limit,opening_balance,status,created_at FROM erp_clients WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 500`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_invoices'){
      const rows=await sql`SELECT i.id,i.client_id,c.business_name,i.invoice_number,i.invoice_date,i.due_date,i.amount,i.status,i.notes,i.created_at,
        w.warehouse_name,
        COALESCE(q.item_count,0)::int item_count,
        COALESCE(q.total_quantity,0)::numeric total_quantity
        FROM erp_client_invoices i
        JOIN erp_clients c ON c.id=i.client_id AND c.company_id=i.company_id
        LEFT JOIN erp_warehouses w ON w.id=i.warehouse_id AND w.company_id=i.company_id
        LEFT JOIN LATERAL(
          SELECT COUNT(*)::int item_count,COALESCE(SUM(ii.quantity),0)::numeric total_quantity
          FROM erp_client_invoice_items ii
          WHERE ii.company_id=i.company_id AND ii.client_invoice_id=i.id
        ) q ON true
        WHERE i.company_id=${u.company_id}
        ORDER BY i.invoice_date DESC,i.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_invoice_items'){
      const invoiceId=positiveInt(req.query?.invoice_id,0);
      if(!invoiceId)return res.status(400).json({error:'Valid invoice required'});
      const rows=await sql`SELECT ii.id,ii.product_id,p.sku,p.product_name,p.unit,ii.description,ii.quantity,ii.unit_price,ii.unit_cost,
        w.warehouse_name
        FROM erp_client_invoice_items ii
        JOIN erp_client_invoices i ON i.id=ii.client_invoice_id AND i.company_id=ii.company_id
        JOIN erp_products p ON p.id=ii.product_id AND p.company_id=ii.company_id
        LEFT JOIN erp_warehouses w ON w.id=ii.warehouse_id AND w.company_id=ii.company_id
        WHERE ii.company_id=${u.company_id} AND ii.client_invoice_id=${invoiceId}
        ORDER BY ii.id`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_receipts'){
      const rows=await sql`SELECT r.id,r.client_id,c.business_name,r.receipt_date,r.amount,r.payment_method,r.reference_number,r.notes,r.status,r.cancelled_at,r.created_at,
        COALESCE(a.allocated_amount,0)::numeric allocated_amount
        FROM erp_client_receipts r JOIN erp_clients c ON c.id=r.client_id AND c.company_id=r.company_id
        LEFT JOIN LATERAL(SELECT COALESCE(SUM(amount),0)::numeric allocated_amount FROM erp_client_receipt_allocations x WHERE x.company_id=r.company_id AND x.client_receipt_id=r.id) a ON true
        WHERE r.company_id=${u.company_id} ORDER BY r.receipt_date DESC,r.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_receipt_detail'){
      const receiptId=positiveInt(req.query?.receipt_id,0);
      if(!receiptId)return res.status(400).json({error:'Valid customer payment required'});
      const rows=await sql`SELECT r.id,r.client_id,c.business_name,c.client_code,r.receipt_date,r.amount,r.payment_method,r.reference_number,r.notes,r.status,r.cancelled_at,r.created_at
        FROM erp_client_receipts r JOIN erp_clients c ON c.id=r.client_id AND c.company_id=r.company_id
        WHERE r.id=${receiptId} AND r.company_id=${u.company_id} LIMIT 1`;
      if(!rows[0])return res.status(404).json({error:'Customer payment not found'});
      const allocations=await sql`SELECT a.client_invoice_id invoice_id,i.invoice_number,a.amount
        FROM erp_client_receipt_allocations a JOIN erp_client_invoices i ON i.id=a.client_invoice_id AND i.company_id=a.company_id
        WHERE a.company_id=${u.company_id} AND a.client_receipt_id=${receiptId} ORDER BY a.id`;
      return res.status(200).json({record:rows[0],allocations});
    }
    if(req.method==='GET'&&action==='client_statement'){
      const clientId=positiveInt(req.query?.client_id,0);
      if(!clientId)return res.status(400).json({error:'Valid customer required'});
      const client=await sql`SELECT id,client_code,business_name,opening_balance FROM erp_clients WHERE id=${clientId} AND company_id=${u.company_id}`;
      if(!client[0])return res.status(404).json({error:'Customer not found'});
      const rows=await sql`WITH entries AS(
        SELECT i.invoice_date::date entry_date,'INVOICE'::text entry_type,i.invoice_number reference,i.amount::numeric debit,0::numeric credit,i.notes,i.id sort_id
        FROM erp_client_invoices i WHERE i.company_id=${u.company_id} AND i.client_id=${clientId} AND i.status<>'cancelled'
        UNION ALL
        SELECT cr.return_date::date,'RETURN',cr.return_number,0::numeric,cr.amount::numeric,cr.notes,500000000+cr.id
        FROM erp_client_returns cr WHERE cr.company_id=${u.company_id} AND cr.client_id=${clientId} AND cr.status='posted'
        UNION ALL
        SELECT r.receipt_date::date,'PAYMENT',COALESCE(r.reference_number,''),0::numeric,r.amount::numeric,r.notes,1000000000+r.id
        FROM erp_client_receipts r WHERE r.company_id=${u.company_id} AND r.client_id=${clientId} AND r.status='posted'
      )
      SELECT entry_date,entry_type,reference,debit,credit,notes,
        ${number(client[0].opening_balance)} + SUM(debit-credit) OVER(ORDER BY entry_date,sort_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
      FROM entries ORDER BY entry_date,sort_id`;
      const balance=number(client[0].opening_balance)+rows.reduce((n,x)=>n+number(x.debit)-number(x.credit),0);
      return res.status(200).json({party:client[0],opening_balance:client[0].opening_balance,balance,records:rows});
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
    if(req.method==='GET'&&action==='grn_detail'){
      const grnId=positiveInt(req.query?.grn_id,0);
      if(!grnId)return res.status(400).json({error:'Valid GRN required'});
      const grn=await sql`SELECT g.id,g.grn_number,g.received_date,g.status,g.notes,g.supplier_invoice_id,g.warehouse_id,
        s.business_name supplier_name,i.invoice_number supplier_invoice_number,w.warehouse_name
        FROM erp_grns g
        LEFT JOIN erp_suppliers s ON s.id=g.supplier_id AND s.company_id=g.company_id
        LEFT JOIN erp_supplier_invoices i ON i.id=g.supplier_invoice_id AND i.company_id=g.company_id
        JOIN erp_warehouses w ON w.id=g.warehouse_id AND w.company_id=g.company_id
        WHERE g.id=${grnId} AND g.company_id=${u.company_id} LIMIT 1`;
      if(!grn[0])return res.status(404).json({error:'GRN not found'});
      const items=await sql`SELECT gi.id,gi.supplier_invoice_item_id,gi.product_id,p.sku,p.product_name,p.unit,gi.ordered_qty,gi.quantity,gi.rejected_qty,gi.unit_cost,gi.batch_no,gi.expiry_date,gi.notes
        FROM erp_grn_items gi JOIN erp_products p ON p.id=gi.product_id AND p.company_id=gi.company_id
        WHERE gi.grn_id=${grnId} AND gi.company_id=${u.company_id} ORDER BY gi.id`;
      return res.status(200).json({record:grn[0],items});
    }
    if(req.method==='GET'&&action==='stock_transfer_detail'){
      const transferId=positiveInt(req.query?.transfer_id,0);
      if(!transferId)return res.status(400).json({error:'Valid stock transfer required'});
      const tr=await sql`SELECT t.id,t.transfer_number,t.transfer_date,t.status,t.notes,t.from_warehouse_id,t.to_warehouse_id,
        fw.warehouse_name from_warehouse,tw.warehouse_name to_warehouse
        FROM erp_stock_transfers t
        JOIN erp_warehouses fw ON fw.id=t.from_warehouse_id AND fw.company_id=t.company_id
        JOIN erp_warehouses tw ON tw.id=t.to_warehouse_id AND tw.company_id=t.company_id
        WHERE t.id=${transferId} AND t.company_id=${u.company_id} LIMIT 1`;
      if(!tr[0])return res.status(404).json({error:'Stock transfer not found'});
      const items=await sql`SELECT i.id,i.product_id,p.sku,p.product_name,p.unit,i.quantity,i.unit_cost,i.notes
        FROM erp_stock_transfer_items i JOIN erp_products p ON p.id=i.product_id AND p.company_id=i.company_id
        WHERE i.stock_transfer_id=${transferId} AND i.company_id=${u.company_id} ORDER BY i.id`;
      return res.status(200).json({record:tr[0],items});
    }
    if(req.method==='GET'&&action==='supplier_returns'){
      const rows=await sql`SELECT r.id,r.return_number,r.return_date,r.amount,r.status,r.notes,r.created_at,
        s.business_name,i.invoice_number,w.warehouse_name
        FROM erp_supplier_returns r
        JOIN erp_suppliers s ON s.id=r.supplier_id AND s.company_id=r.company_id
        JOIN erp_supplier_invoices i ON i.id=r.supplier_invoice_id AND i.company_id=r.company_id
        JOIN erp_warehouses w ON w.id=r.warehouse_id AND w.company_id=r.company_id
        WHERE r.company_id=${u.company_id}
        ORDER BY r.return_date DESC,r.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='supplier_return_items'){
      const invoiceId=positiveInt(req.query?.invoice_id,0);
      if(!invoiceId)return res.status(400).json({error:'Valid supplier invoice required'});
      const rows=await sql`SELECT ii.id supplier_invoice_item_id,ii.product_id,p.sku,p.product_name,p.unit,ii.unit_price,
        COALESCE(g.received_quantity,0)::numeric received_quantity,
        COALESCE(r.returned_quantity,0)::numeric returned_quantity,
        GREATEST(COALESCE(g.received_quantity,0)-COALESCE(r.returned_quantity,0),0)::numeric returnable_quantity
        FROM erp_supplier_invoice_items ii
        JOIN erp_products p ON p.id=ii.product_id AND p.company_id=ii.company_id
        LEFT JOIN LATERAL(
          SELECT COALESCE(SUM(gi.quantity),0)::numeric received_quantity
          FROM erp_grn_items gi JOIN erp_grns gr ON gr.id=gi.grn_id AND gr.company_id=gi.company_id
          WHERE gi.company_id=ii.company_id AND gi.supplier_invoice_item_id=ii.id AND gr.status='posted'
        ) g ON true
        LEFT JOIN LATERAL(
          SELECT COALESCE(SUM(ri.quantity),0)::numeric returned_quantity
          FROM erp_supplier_return_items ri JOIN erp_supplier_returns rr ON rr.id=ri.supplier_return_id AND rr.company_id=ri.company_id
          WHERE ri.company_id=ii.company_id AND ri.supplier_invoice_item_id=ii.id AND rr.status='posted'
        ) r ON true
        WHERE ii.company_id=${u.company_id} AND ii.supplier_invoice_id=${invoiceId}
        ORDER BY ii.id`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_returns'){
      const rows=await sql`SELECT r.id,r.return_number,r.return_date,r.amount,r.status,r.notes,r.created_at,
        c.business_name,i.invoice_number
        FROM erp_client_returns r
        JOIN erp_clients c ON c.id=r.client_id AND c.company_id=r.company_id
        JOIN erp_client_invoices i ON i.id=r.client_invoice_id AND i.company_id=r.company_id
        WHERE r.company_id=${u.company_id}
        ORDER BY r.return_date DESC,r.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='client_return_items'){
      const invoiceId=positiveInt(req.query?.invoice_id,0);
      if(!invoiceId)return res.status(400).json({error:'Valid customer invoice required'});
      const rows=await sql`SELECT ii.id client_invoice_item_id,ii.product_id,ii.warehouse_id,p.sku,p.product_name,p.unit,ii.quantity sold_quantity,ii.unit_price,ii.unit_cost,w.warehouse_name,
        COALESCE(r.returned_quantity,0)::numeric returned_quantity,
        GREATEST(ii.quantity-COALESCE(r.returned_quantity,0),0)::numeric returnable_quantity
        FROM erp_client_invoice_items ii
        JOIN erp_products p ON p.id=ii.product_id AND p.company_id=ii.company_id
        LEFT JOIN erp_warehouses w ON w.id=ii.warehouse_id AND w.company_id=ii.company_id
        LEFT JOIN LATERAL(
          SELECT COALESCE(SUM(ri.quantity),0)::numeric returned_quantity
          FROM erp_client_return_items ri JOIN erp_client_returns rr ON rr.id=ri.client_return_id AND rr.company_id=ri.company_id
          WHERE ri.company_id=ii.company_id AND ri.client_invoice_item_id=ii.id AND rr.status='posted'
        ) r ON true
        WHERE ii.company_id=${u.company_id} AND ii.client_invoice_id=${invoiceId}
        ORDER BY ii.id`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='supplier_return_detail'){
      const returnId=positiveInt(req.query?.return_id,0);
      if(!returnId)return res.status(400).json({error:'Valid supplier return required'});
      const rows=await sql`SELECT r.id,r.return_number,r.return_date,r.amount,r.status,r.notes,r.cancelled_at,r.created_at,r.supplier_invoice_id,r.warehouse_id,
        s.business_name,s.supplier_code,i.invoice_number,w.warehouse_name
        FROM erp_supplier_returns r
        JOIN erp_suppliers s ON s.id=r.supplier_id AND s.company_id=r.company_id
        JOIN erp_supplier_invoices i ON i.id=r.supplier_invoice_id AND i.company_id=r.company_id
        JOIN erp_warehouses w ON w.id=r.warehouse_id AND w.company_id=r.company_id
        WHERE r.id=${returnId} AND r.company_id=${u.company_id} LIMIT 1`;
      if(!rows[0])return res.status(404).json({error:'Supplier return not found'});
      const items=await sql`SELECT ri.id,ri.product_id,p.sku,p.product_name,p.unit,ri.quantity,ri.unit_price,ri.unit_cost,
        (ri.quantity*ri.unit_price)::numeric line_total
        FROM erp_supplier_return_items ri
        JOIN erp_products p ON p.id=ri.product_id AND p.company_id=ri.company_id
        WHERE ri.supplier_return_id=${returnId} AND ri.company_id=${u.company_id}
        ORDER BY ri.id`;
      return res.status(200).json({record:rows[0],items});
    }
    if(req.method==='GET'&&action==='client_return_detail'){
      const returnId=positiveInt(req.query?.return_id,0);
      if(!returnId)return res.status(400).json({error:'Valid customer return required'});
      const rows=await sql`SELECT r.id,r.return_number,r.return_date,r.amount,r.status,r.notes,r.cancelled_at,r.created_at,r.client_invoice_id,
        c.business_name,c.client_code,i.invoice_number
        FROM erp_client_returns r
        JOIN erp_clients c ON c.id=r.client_id AND c.company_id=r.company_id
        JOIN erp_client_invoices i ON i.id=r.client_invoice_id AND i.company_id=r.company_id
        WHERE r.id=${returnId} AND r.company_id=${u.company_id} LIMIT 1`;
      if(!rows[0])return res.status(404).json({error:'Customer return not found'});
      const items=await sql`SELECT ri.id,ri.product_id,ri.warehouse_id,p.sku,p.product_name,p.unit,w.warehouse_name,ri.quantity,ri.unit_price,ri.unit_cost,
        (ri.quantity*ri.unit_price)::numeric line_total
        FROM erp_client_return_items ri
        JOIN erp_products p ON p.id=ri.product_id AND p.company_id=ri.company_id
        JOIN erp_warehouses w ON w.id=ri.warehouse_id AND w.company_id=ri.company_id
        WHERE ri.client_return_id=${returnId} AND ri.company_id=${u.company_id}
        ORDER BY ri.id`;
      return res.status(200).json({record:rows[0],items});
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
      const rows=await sql`SELECT a.id,a.adjustment_number,a.adjustment_date,a.adjustment_type,a.quantity,a.unit_cost,a.reason,a.notes,a.status,a.cancelled_at,a.warehouse_id,a.product_id,
        w.warehouse_name,p.sku,p.product_name,p.unit
        FROM erp_stock_adjustments a
        JOIN erp_warehouses w ON w.id=a.warehouse_id AND w.company_id=a.company_id
        JOIN erp_products p ON p.id=a.product_id AND p.company_id=a.company_id
        WHERE a.company_id=${u.company_id}
        ORDER BY a.adjustment_date DESC,a.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='ecommerce_dashboard'){
      const settings=await sql`SELECT company_id,store_name,contact_phone,whatsapp_number,address,delivery_charge,active,updated_at
        FROM ecommerce_store_settings WHERE company_id=${u.company_id} LIMIT 1`;
      const stats=await sql`SELECT
        (SELECT COUNT(*) FROM ecommerce_products WHERE company_id=${u.company_id})::int products,
        (SELECT COUNT(*) FROM ecommerce_products WHERE company_id=${u.company_id} AND active=true)::int active_products,
        (SELECT COUNT(*) FROM ecommerce_orders WHERE company_id=${u.company_id} AND status='pending')::int pending_orders,
        (SELECT COUNT(*) FROM ecommerce_orders WHERE company_id=${u.company_id} AND status='completed')::int completed_orders,
        COALESCE((SELECT SUM(total) FROM ecommerce_orders WHERE company_id=${u.company_id} AND status='completed'),0)::numeric completed_sales`;
      const recent=await sql`SELECT id,order_number,customer_name,phone,payment_method,status,total,created_at
        FROM ecommerce_orders WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 8`;
      return res.status(200).json({settings:settings[0]||{store_name:u.company_name,delivery_charge:0,active:true},stats:stats[0]||{},recent_orders:recent});
    }
    if(req.method==='GET'&&action==='ecommerce_products'){
      const rows=await sql`SELECT id,sku,product_name,description,price,stock_qty,image_url,active,created_at,updated_at
        FROM ecommerce_products WHERE company_id=${u.company_id} ORDER BY created_at DESC,id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='ecommerce_orders'){
      const rows=await sql`SELECT o.id,o.order_number,o.customer_name,o.phone,o.address,o.payment_method,o.payment_status,o.payment_reference,o.paid_at,o.status,o.subtotal,o.delivery_charge,o.total,o.notes,o.created_at,o.updated_at,
        COALESCE(i.item_count,0)::int item_count,COALESCE(i.total_quantity,0)::numeric total_quantity
        FROM ecommerce_orders o
        LEFT JOIN LATERAL(
          SELECT COUNT(*)::int item_count,COALESCE(SUM(quantity),0)::numeric total_quantity
          FROM ecommerce_order_items x WHERE x.company_id=o.company_id AND x.ecommerce_order_id=o.id
        ) i ON true
        WHERE o.company_id=${u.company_id} ORDER BY o.created_at DESC,o.id DESC LIMIT 1000`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='ecommerce_order_detail'){
      const orderId=positiveInt(req.query?.order_id,0);
      if(!orderId)return res.status(400).json({error:'Valid order required'});
      const order=await sql`SELECT id,order_number,customer_name,phone,address,payment_method,payment_status,payment_reference,paid_at,status,subtotal,delivery_charge,total,notes,created_at,updated_at
        FROM ecommerce_orders WHERE id=${orderId} AND company_id=${u.company_id} LIMIT 1`;
      if(!order[0])return res.status(404).json({error:'E-commerce order not found'});
      const items=await sql`SELECT i.id,i.ecommerce_product_id,p.sku,i.product_name,i.quantity,i.unit_price,(i.quantity*i.unit_price)::numeric line_total
        FROM ecommerce_order_items i
        LEFT JOIN ecommerce_products p ON p.id=i.ecommerce_product_id AND p.company_id=i.company_id
        WHERE i.company_id=${u.company_id} AND i.ecommerce_order_id=${orderId}
        ORDER BY i.id`;
      const settings=await sql`SELECT store_name,contact_phone,whatsapp_number,address FROM ecommerce_store_settings WHERE company_id=${u.company_id} LIMIT 1`;
      return res.status(200).json({order:order[0],items,store:settings[0]||{store_name:u.company_name}});
    }
    if(req.method==='GET'&&action==='ecommerce_sales_report'){
      const today=new Date().toISOString().slice(0,10),monthStart=today.slice(0,8)+'01';
      const from=clean(req.query?.date_from)||monthStart,to=clean(req.query?.date_to)||today;
      const summary=await sql`SELECT
        COUNT(*) FILTER(WHERE status<>'cancelled')::int order_count,
        COUNT(*) FILTER(WHERE status='completed')::int completed_orders,
        COUNT(*) FILTER(WHERE status='cancelled')::int cancelled_orders,
        COALESCE(SUM(total) FILTER(WHERE status<>'cancelled'),0)::numeric gross_orders,
        COALESCE(SUM(total) FILTER(WHERE status='completed'),0)::numeric completed_sales,
        COALESCE(SUM(total) FILTER(WHERE payment_status='paid' AND status<>'cancelled'),0)::numeric paid_collections,
        COALESCE(SUM(total) FILTER(WHERE payment_status='unpaid' AND status<>'cancelled'),0)::numeric unpaid_amount,
        COALESCE(SUM(total) FILTER(WHERE payment_status='refunded'),0)::numeric refunded_amount
        FROM ecommerce_orders
        WHERE company_id=${u.company_id} AND created_at>=${from}::date AND created_at<(${to}::date+INTERVAL '1 day')`;
      const daily=await sql`SELECT created_at::date day,
        COUNT(*) FILTER(WHERE status<>'cancelled')::int orders,
        COALESCE(SUM(total) FILTER(WHERE status<>'cancelled'),0)::numeric order_value,
        COALESCE(SUM(total) FILTER(WHERE status='completed'),0)::numeric completed_sales,
        COALESCE(SUM(total) FILTER(WHERE payment_status='paid' AND status<>'cancelled'),0)::numeric paid_collections
        FROM ecommerce_orders
        WHERE company_id=${u.company_id} AND created_at>=${from}::date AND created_at<(${to}::date+INTERVAL '1 day')
        GROUP BY created_at::date ORDER BY day DESC`;
      const methods=await sql`SELECT payment_method,COUNT(*)::int orders,COALESCE(SUM(total),0)::numeric amount
        FROM ecommerce_orders
        WHERE company_id=${u.company_id} AND status<>'cancelled' AND created_at>=${from}::date AND created_at<(${to}::date+INTERVAL '1 day')
        GROUP BY payment_method ORDER BY amount DESC`;
      return res.status(200).json({date_from:from,date_to:to,summary:summary[0]||{},daily,payment_methods:methods});
    }
    if(req.method==='GET'&&action==='communication_center'){
      const settings=await sql`SELECT company_id,whatsapp_number,default_country_code,invoice_template,statement_template,active,updated_at
        FROM communication_settings WHERE company_id=${u.company_id} LIMIT 1`;
      const logs=await sql`SELECT id,channel,recipient,entity_type,entity_id,template_code,status,created_at
        FROM communication_logs WHERE company_id=${u.company_id}
        ORDER BY created_at DESC,id DESC LIMIT 100`;
      return res.status(200).json({
        settings:settings[0]||{
          whatsapp_number:null,default_country_code:'92',active:true,
          invoice_template:'Assalam-o-Alaikum {{customer}}, {{company}} ki invoice {{invoice}} amount {{amount}}. Due: {{due}}.',
          statement_template:'Assalam-o-Alaikum {{customer}}, {{company}} account balance {{balance}} hai.'
        },
        logs
      });
    }
    if(req.method==='GET'&&action==='automation_center'){
      const rules=await sql`SELECT id,rule_code,rule_name,active,parameters,last_run_at,updated_at
        FROM automation_rules WHERE company_id=${u.company_id} ORDER BY id`;
      const alerts=await sql`SELECT a.id,a.rule_id,a.rule_code,a.alert_key,a.severity,a.title,a.message,a.entity_type,a.entity_id,a.status,a.last_detected_at,a.resolved_at,a.created_at
        FROM automation_alerts a WHERE a.company_id=${u.company_id}
        ORDER BY CASE a.status WHEN 'open' THEN 0 WHEN 'dismissed' THEN 1 ELSE 2 END,a.last_detected_at DESC LIMIT 500`;
      const stats=await sql`SELECT
        COUNT(*) FILTER(WHERE status='open')::int open_alerts,
        COUNT(*) FILTER(WHERE status='open' AND severity='critical')::int critical_alerts,
        COUNT(*) FILTER(WHERE status='dismissed')::int dismissed_alerts,
        COUNT(*) FILTER(WHERE status='resolved')::int resolved_alerts
        FROM automation_alerts WHERE company_id=${u.company_id}`;
      return res.status(200).json({rules,alerts,stats:stats[0]||{}});
    }
    if(req.method==='GET'&&action==='ocr_drafts'){
      const rows=await sql`SELECT d.id,d.draft_number,d.source_file_name,d.ocr_confidence,d.invoice_number,d.invoice_date,d.detected_total,d.calculated_total,d.status,d.created_at,d.updated_at,
        s.business_name supplier_name,i.invoice_number posted_invoice_number
        FROM ocr_supplier_drafts d
        LEFT JOIN erp_suppliers s ON s.id=d.supplier_id AND s.company_id=d.company_id
        LEFT JOIN erp_supplier_invoices i ON i.id=d.posted_supplier_invoice_id AND i.company_id=d.company_id
        WHERE d.company_id=${u.company_id}
        ORDER BY d.created_at DESC,d.id DESC LIMIT 500`;
      return res.status(200).json({records:rows});
    }
    if(req.method==='GET'&&action==='ocr_draft_detail'){
      const draftId=positiveInt(req.query?.draft_id,0);
      if(!draftId)return res.status(400).json({error:'Valid OCR draft required'});
      const rows=await sql`SELECT d.*,s.business_name supplier_name,i.invoice_number posted_invoice_number
        FROM ocr_supplier_drafts d
        LEFT JOIN erp_suppliers s ON s.id=d.supplier_id AND s.company_id=d.company_id
        LEFT JOIN erp_supplier_invoices i ON i.id=d.posted_supplier_invoice_id AND i.company_id=d.company_id
        WHERE d.id=${draftId} AND d.company_id=${u.company_id} LIMIT 1`;
      if(!rows[0])return res.status(404).json({error:'OCR draft not found'});
      const items=await sql`SELECT x.id,x.product_id,p.sku,p.product_name,p.unit,x.description,x.quantity,x.unit_price,(x.quantity*x.unit_price)::numeric line_total,x.sort_order
        FROM ocr_supplier_draft_items x
        LEFT JOIN erp_products p ON p.id=x.product_id AND p.company_id=x.company_id
        WHERE x.draft_id=${draftId} AND x.company_id=${u.company_id}
        ORDER BY x.sort_order,x.id`;
      return res.status(200).json({record:rows[0],items});
    }
    if(req.method==='GET'&&action==='reports_summary'){
      const today=new Date().toISOString().slice(0,10),monthStart=today.slice(0,8)+'01';
      const from=clean(req.query?.date_from)||monthStart,to=clean(req.query?.date_to)||today;
      const rows=await sql`SELECT
        COALESCE((SELECT SUM(amount) FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND status<>'cancelled' AND invoice_date BETWEEN ${from}::date AND ${to}::date),0)::numeric supplier_purchases,
        COALESCE((SELECT SUM(amount) FROM erp_supplier_payments WHERE company_id=${u.company_id} AND status='posted' AND payment_date BETWEEN ${from}::date AND ${to}::date),0)::numeric supplier_payments,
        COALESCE((SELECT SUM(amount) FROM erp_supplier_returns WHERE company_id=${u.company_id} AND status='posted' AND return_date BETWEEN ${from}::date AND ${to}::date),0)::numeric supplier_returns,
        COALESCE((SELECT SUM(amount) FROM erp_client_invoices WHERE company_id=${u.company_id} AND status<>'cancelled' AND invoice_date BETWEEN ${from}::date AND ${to}::date),0)::numeric customer_sales,
        COALESCE((SELECT SUM(amount) FROM erp_client_receipts WHERE company_id=${u.company_id} AND status='posted' AND receipt_date BETWEEN ${from}::date AND ${to}::date),0)::numeric customer_receipts,
        COALESCE((SELECT SUM(amount) FROM erp_client_returns WHERE company_id=${u.company_id} AND status='posted' AND return_date BETWEEN ${from}::date AND ${to}::date),0)::numeric customer_returns,
        (COALESCE((SELECT SUM(opening_balance) FROM erp_suppliers WHERE company_id=${u.company_id}),0)
          +COALESCE((SELECT SUM(amount) FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND status<>'cancelled'),0)
          -COALESCE((SELECT SUM(amount) FROM erp_supplier_returns WHERE company_id=${u.company_id} AND status='posted'),0)
          -COALESCE((SELECT SUM(amount) FROM erp_supplier_payments WHERE company_id=${u.company_id} AND status='posted'),0))::numeric supplier_payable,
        (COALESCE((SELECT SUM(opening_balance) FROM erp_clients WHERE company_id=${u.company_id}),0)
          +COALESCE((SELECT SUM(amount) FROM erp_client_invoices WHERE company_id=${u.company_id} AND status<>'cancelled'),0)
          -COALESCE((SELECT SUM(amount) FROM erp_client_returns WHERE company_id=${u.company_id} AND status='posted'),0)
          -COALESCE((SELECT SUM(amount) FROM erp_client_receipts WHERE company_id=${u.company_id} AND status='posted'),0))::numeric customer_receivable,
        COALESCE((SELECT SUM((qty_in-qty_out)*unit_cost) FROM erp_inventory_movements WHERE company_id=${u.company_id}),0)::numeric stock_value`;
      const daily=await sql`WITH d AS(
        SELECT invoice_date::date day,SUM(amount)::numeric sales,0::numeric receipts,0::numeric purchases,0::numeric payments FROM erp_client_invoices WHERE company_id=${u.company_id} AND status<>'cancelled' AND invoice_date BETWEEN ${from}::date AND ${to}::date GROUP BY invoice_date
        UNION ALL SELECT receipt_date::date,0,SUM(amount),0,0 FROM erp_client_receipts WHERE company_id=${u.company_id} AND receipt_date BETWEEN ${from}::date AND ${to}::date GROUP BY receipt_date
        UNION ALL SELECT invoice_date::date,0,0,SUM(amount),0 FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND status<>'cancelled' AND invoice_date BETWEEN ${from}::date AND ${to}::date GROUP BY invoice_date
        UNION ALL SELECT payment_date::date,0,0,0,SUM(amount) FROM erp_supplier_payments WHERE company_id=${u.company_id} AND payment_date BETWEEN ${from}::date AND ${to}::date GROUP BY payment_date
      )
      SELECT day,SUM(sales)::numeric sales,SUM(receipts)::numeric receipts,SUM(purchases)::numeric purchases,SUM(payments)::numeric payments
      FROM d GROUP BY day ORDER BY day DESC`;
      return res.status(200).json({date_from:from,date_to:to,summary:rows[0]||{},daily});
    }
    if(req.method==='GET'&&action==='audit_service'){
      const price=await sql`SELECT asp.per_audit_price,asp.active,p.plan_code,p.plan_name
        FROM audit_service_prices asp JOIN plans p ON p.id=asp.plan_id
        WHERE asp.plan_id=${u.plan_id} LIMIT 1`;
      const requests=await sql`SELECT id,price,period_from,period_to,payment_method,payment_reference,payment_status,status,notes,requested_at,reviewed_at,completed_at
        FROM audit_requests WHERE company_id=${u.company_id} ORDER BY requested_at DESC,id DESC LIMIT 100`;
      return res.status(200).json({price:price[0]||null,requests});
    }
    if(req.method==='GET'&&action==='audit_events'){
      const requestId=positiveInt(req.query?.request_id,0);
      if(!requestId)return res.status(400).json({error:'Approved audit request required'});
      const request=await sql`SELECT r.*,p.plan_code,p.plan_name
        FROM audit_requests r JOIN plans p ON p.id=r.plan_id
        WHERE r.id=${requestId} AND r.company_id=${u.company_id} AND r.payment_status='verified' AND r.status IN('approved','completed') LIMIT 1`;
      if(!request[0])return res.status(403).json({error:'This audit has not been approved yet'});
      const from=request[0].period_from,to=request[0].period_to;
      const [summaryRows,controlRows,eventTypes,events]=await Promise.all([
        sql`SELECT
          COALESCE((SELECT SUM(amount) FROM erp_client_invoices WHERE company_id=${u.company_id} AND status<>'cancelled' AND invoice_date BETWEEN ${from}::date AND ${to}::date),0)::numeric customer_sales,
          COALESCE((SELECT SUM(amount) FROM erp_client_receipts WHERE company_id=${u.company_id} AND receipt_date BETWEEN ${from}::date AND ${to}::date),0)::numeric customer_receipts,
          COALESCE((SELECT SUM(amount) FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND status<>'cancelled' AND invoice_date BETWEEN ${from}::date AND ${to}::date),0)::numeric supplier_purchases,
          COALESCE((SELECT SUM(amount) FROM erp_supplier_payments WHERE company_id=${u.company_id} AND payment_date BETWEEN ${from}::date AND ${to}::date),0)::numeric supplier_payments,
          COALESCE((SELECT SUM(ii.quantity*(ii.unit_price-ii.unit_cost))
            FROM erp_client_invoice_items ii JOIN erp_client_invoices i ON i.id=ii.client_invoice_id AND i.company_id=ii.company_id
            WHERE ii.company_id=${u.company_id} AND i.status<>'cancelled' AND i.invoice_date BETWEEN ${from}::date AND ${to}::date),0)::numeric gross_profit,
          (SELECT COUNT(*) FROM erp_grns WHERE company_id=${u.company_id} AND status='posted' AND received_date BETWEEN ${from}::date AND ${to}::date)::int grn_count,
          (SELECT COUNT(*) FROM erp_stock_transfers WHERE company_id=${u.company_id} AND status='posted' AND transfer_date BETWEEN ${from}::date AND ${to}::date)::int transfer_count,
          (SELECT COUNT(*) FROM erp_stock_adjustments WHERE company_id=${u.company_id} AND adjustment_date BETWEEN ${from}::date AND ${to}::date)::int adjustment_count,
          (SELECT COUNT(*) FROM audit_events WHERE company_id=${u.company_id} AND created_at>=${from}::date AND created_at<(${to}::date+INTERVAL '1 day'))::int audit_event_count,
          (SELECT COUNT(DISTINCT COALESCE(actor_company_user_id,0)) FROM audit_events WHERE company_id=${u.company_id} AND actor_company_user_id IS NOT NULL AND created_at>=${from}::date AND created_at<(${to}::date+INTERVAL '1 day'))::int active_users`,
        sql`SELECT
          (SELECT COUNT(*) FROM (
            SELECT m.product_id,m.warehouse_id,SUM(m.qty_in-m.qty_out) qty
            FROM erp_inventory_movements m WHERE m.company_id=${u.company_id}
            GROUP BY m.product_id,m.warehouse_id HAVING SUM(m.qty_in-m.qty_out)<0
          ) x)::int negative_stock_items,
          (SELECT COUNT(*) FROM erp_client_invoices i
            WHERE i.company_id=${u.company_id} AND i.status<>'cancelled' AND i.due_date IS NOT NULL AND i.due_date<${to}::date
              AND i.amount>COALESCE((SELECT SUM(a.amount) FROM erp_client_receipt_allocations a
                JOIN erp_client_receipts r ON r.id=a.client_receipt_id AND r.company_id=a.company_id
                WHERE a.company_id=i.company_id AND a.client_invoice_id=i.id AND r.receipt_date<=${to}::date),0))::int overdue_customer_invoices,
          (SELECT COUNT(*) FROM erp_supplier_invoices i
            WHERE i.company_id=${u.company_id} AND i.status<>'cancelled' AND i.due_date IS NOT NULL AND i.due_date<${to}::date
              AND i.amount>COALESCE((SELECT SUM(a.amount) FROM erp_supplier_payment_allocations a
                JOIN erp_supplier_payments p ON p.id=a.supplier_payment_id AND p.company_id=a.company_id
                WHERE a.company_id=i.company_id AND a.supplier_invoice_id=i.id AND p.payment_date<=${to}::date),0))::int overdue_supplier_invoices,
          (SELECT COUNT(*) FROM erp_client_receipts r
            WHERE r.company_id=${u.company_id} AND r.receipt_date BETWEEN ${from}::date AND ${to}::date
              AND r.amount>COALESCE((SELECT SUM(a.amount) FROM erp_client_receipt_allocations a WHERE a.company_id=r.company_id AND a.client_receipt_id=r.id),0))::int unallocated_customer_receipts,
          (SELECT COUNT(*) FROM erp_supplier_payments p
            WHERE p.company_id=${u.company_id} AND p.payment_date BETWEEN ${from}::date AND ${to}::date
              AND p.amount>COALESCE((SELECT SUM(a.amount) FROM erp_supplier_payment_allocations a WHERE a.company_id=p.company_id AND a.supplier_payment_id=p.id),0))::int unallocated_supplier_payments`,
        sql`SELECT event_type,COUNT(*)::int event_count
          FROM audit_events WHERE company_id=${u.company_id} AND created_at>=${from}::date AND created_at<(${to}::date+INTERVAL '1 day')
          GROUP BY event_type ORDER BY event_count DESC,event_type LIMIT 50`,
        sql`SELECT e.id,e.created_at,e.event_type,e.entity_type,e.entity_id,e.metadata,
          COALESCE(cu.full_name,ba.full_name,'System') actor_name
          FROM audit_events e
          LEFT JOIN company_users cu ON cu.id=e.actor_company_user_id AND cu.company_id=e.company_id
          LEFT JOIN bizora_admins ba ON ba.id=e.actor_admin_id
          WHERE e.company_id=${u.company_id}
            AND e.created_at>=${from}::date
            AND e.created_at<(${to}::date+INTERVAL '1 day')
          ORDER BY e.created_at DESC,e.id DESC LIMIT 5000`
      ]);
      if(request[0].status==='approved'){
        await sql`UPDATE audit_requests SET status='completed',completed_at=now() WHERE id=${requestId} AND company_id=${u.company_id}`;
      }
      return res.status(200).json({
        request:{...request[0],status:'completed'},
        company:{id:u.company_id,code:u.company_code,name:u.company_name},
        summary:summaryRows[0]||{},
        controls:controlRows[0]||{},
        event_types:eventTypes,
        records:events
      });
    }
    if(req.method==='GET'&&action==='advanced_reports'){
      const today=new Date().toISOString().slice(0,10),monthStart=today.slice(0,8)+'01';
      const from=clean(req.query?.date_from)||monthStart,to=clean(req.query?.date_to)||today;
      const totals=await sql`SELECT
        COALESCE(SUM(ii.quantity*ii.unit_price),0)::numeric revenue,
        COALESCE(SUM(ii.quantity*ii.unit_cost),0)::numeric cogs,
        COALESCE(SUM(ii.quantity*(ii.unit_price-ii.unit_cost)),0)::numeric gross_profit
        FROM erp_client_invoice_items ii
        JOIN erp_client_invoices i ON i.id=ii.client_invoice_id AND i.company_id=ii.company_id
        WHERE ii.company_id=${u.company_id} AND i.status<>'cancelled' AND i.invoice_date BETWEEN ${from}::date AND ${to}::date`;
      const products=await sql`SELECT p.sku,p.product_name,p.unit,
        COALESCE(SUM(ii.quantity),0)::numeric sold_quantity,
        COALESCE(SUM(ii.quantity*ii.unit_price),0)::numeric sales_value,
        COALESCE(SUM(ii.quantity*(ii.unit_price-ii.unit_cost)),0)::numeric gross_profit
        FROM erp_client_invoice_items ii
        JOIN erp_client_invoices i ON i.id=ii.client_invoice_id AND i.company_id=ii.company_id
        JOIN erp_products p ON p.id=ii.product_id AND p.company_id=ii.company_id
        WHERE ii.company_id=${u.company_id} AND i.status<>'cancelled' AND i.invoice_date BETWEEN ${from}::date AND ${to}::date
        GROUP BY p.id,p.sku,p.product_name,p.unit
        ORDER BY sales_value DESC LIMIT 20`;
      return res.status(200).json({date_from:from,date_to:to,summary:totals[0]||{},top_products:products});
    }

    if(req.method==='POST'&&action==='save_ecommerce_product'){
      const productId=positiveInt(b.product_id,0)||null,sku=code(b.sku),name=clean(b.product_name),price=number(b.price),stockQty=number(b.stock_qty);
      if(!sku||!name||price<0||stockQty<0)return res.status(400).json({error:'SKU, product name, valid price and stock required'});
      let rows;
      if(productId){
        rows=await sql`UPDATE ecommerce_products SET sku=${sku},product_name=${name},description=${clean(b.description)||null},price=${price},stock_qty=${stockQty},image_url=${clean(b.image_url)||null},updated_at=now()
          WHERE id=${productId} AND company_id=${u.company_id}
          RETURNING id,sku,product_name,description,price,stock_qty,image_url,active,created_at,updated_at`;
      }else{
        rows=await sql`INSERT INTO ecommerce_products(company_id,sku,product_name,description,price,stock_qty,image_url,created_by_user_id)
          VALUES(${u.company_id},${sku},${name},${clean(b.description)||null},${price},${stockQty},${clean(b.image_url)||null},${u.id})
          RETURNING id,sku,product_name,description,price,stock_qty,image_url,active,created_at,updated_at`;
      }
      if(!rows[0])return res.status(404).json({error:'E-commerce product not found'});
      await companyAudit(sql,u,productId?'ECOM_PRODUCT_UPDATED':'ECOM_PRODUCT_CREATED',{entityType:'ecommerce_product',entityId:String(rows[0].id)});
      return res.status(productId?200:201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_ecommerce_product_status'){
      const productId=positiveInt(b.product_id,0),active=Boolean(b.active);
      if(!productId)return res.status(400).json({error:'Valid product required'});
      const rows=await sql`UPDATE ecommerce_products SET active=${active},updated_at=now() WHERE id=${productId} AND company_id=${u.company_id}
        RETURNING id,sku,product_name,price,stock_qty,active`;
      if(!rows[0])return res.status(404).json({error:'E-commerce product not found'});
      await companyAudit(sql,u,'ECOM_PRODUCT_STATUS_CHANGED',{entityType:'ecommerce_product',entityId:String(productId),metadata:{active}});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='save_ecommerce_settings'){
      const storeName=clean(b.store_name)||u.company_name,deliveryCharge=number(b.delivery_charge);
      if(deliveryCharge<0)return res.status(400).json({error:'Valid delivery charge required'});
      const rows=await sql`INSERT INTO ecommerce_store_settings(company_id,store_name,contact_phone,whatsapp_number,address,delivery_charge,active)
        VALUES(${u.company_id},${storeName},${clean(b.contact_phone)||null},${clean(b.whatsapp_number)||null},${clean(b.address)||null},${deliveryCharge},${b.active===false?false:true})
        ON CONFLICT(company_id) DO UPDATE SET store_name=EXCLUDED.store_name,contact_phone=EXCLUDED.contact_phone,whatsapp_number=EXCLUDED.whatsapp_number,address=EXCLUDED.address,delivery_charge=EXCLUDED.delivery_charge,active=EXCLUDED.active,updated_at=now()
        RETURNING *`;
      await companyAudit(sql,u,'ECOM_SETTINGS_UPDATED',{entityType:'ecommerce_store_settings',entityId:String(u.company_id)});
      return res.status(200).json({settings:rows[0]});
    }
    if(req.method==='POST'&&action==='create_ecommerce_order'){
      const customerName=clean(b.customer_name),phone=clean(b.phone),address=clean(b.address)||null,method=clean(b.payment_method||'COD').toUpperCase(),notes=clean(b.notes)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({product_id:positiveInt(x.product_id,0),quantity:number(x.quantity)})):[];
      if(!customerName||!phone||!items.length||!ecommercePaymentMethods.has(method))return res.status(400).json({error:'Customer, phone, products and valid payment method required'});
      if(items.some(x=>!x.product_id||x.quantity<=0))return res.status(400).json({error:'Valid order product quantities required'});
      const prepared=[];
      for(const item of items){
        const p=await sql`SELECT id,product_name,price,stock_qty,active FROM ecommerce_products WHERE id=${item.product_id} AND company_id=${u.company_id} LIMIT 1`;
        if(!p[0]?.active)return res.status(400).json({error:'One or more store products are unavailable'});
        if(number(p[0].stock_qty)+1e-9<item.quantity)return res.status(400).json({error:'Insufficient e-commerce stock for '+p[0].product_name});
        prepared.push({...item,product_name:p[0].product_name,unit_price:number(p[0].price)});
      }
      const settings=await sql`SELECT delivery_charge FROM ecommerce_store_settings WHERE company_id=${u.company_id} LIMIT 1`;
      const subtotal=prepared.reduce((n,x)=>n+x.quantity*x.unit_price,0),deliveryCharge=b.delivery_charge===undefined?number(settings[0]?.delivery_charge):number(b.delivery_charge),total=Number((subtotal+deliveryCharge).toFixed(2));
      if(deliveryCharge<0)return res.status(400).json({error:'Valid delivery charge required'});
      const seq=await sql`SELECT COALESCE(MAX(id),0)::bigint+1 next_id FROM ecommerce_orders WHERE company_id=${u.company_id}`;
      const orderNumber='EC-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+String(seq[0]?.next_id||1).padStart(5,'0');
      const rows=await sql`INSERT INTO ecommerce_orders(company_id,order_number,customer_name,phone,address,payment_method,status,subtotal,delivery_charge,total,notes,created_by_user_id)
        VALUES(${u.company_id},${orderNumber},${customerName},${phone},${address},${method},'pending',${subtotal},${deliveryCharge},${total},${notes},${u.id}) RETURNING *`;
      for(const item of prepared){
        await sql`INSERT INTO ecommerce_order_items(company_id,ecommerce_order_id,ecommerce_product_id,product_name,quantity,unit_price)
          VALUES(${u.company_id},${rows[0].id},${item.product_id},${item.product_name},${item.quantity},${item.unit_price})`;
        await sql`UPDATE ecommerce_products SET stock_qty=stock_qty-${item.quantity},updated_at=now() WHERE id=${item.product_id} AND company_id=${u.company_id}`;
      }
      await companyAudit(sql,u,'ECOM_ORDER_CREATED',{entityType:'ecommerce_order',entityId:String(rows[0].id),metadata:{order_number:orderNumber,total,item_count:prepared.length}});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_ecommerce_payment_status'){
      const orderId=positiveInt(b.order_id,0),paymentStatus=clean(b.payment_status).toLowerCase(),reference=clean(b.payment_reference)||null;
      if(!orderId||!ecommercePaymentStatuses.has(paymentStatus))return res.status(400).json({error:'Valid order and payment status required'});
      const current=await sql`SELECT id,status,payment_status FROM ecommerce_orders WHERE id=${orderId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'E-commerce order not found'});
      if(current[0].status==='cancelled'&&paymentStatus==='paid')return res.status(400).json({error:'Cancelled order cannot be marked paid'});
      const rows=await sql`UPDATE ecommerce_orders SET payment_status=${paymentStatus},payment_reference=${reference},
        paid_at=CASE WHEN ${paymentStatus}='paid' THEN COALESCE(paid_at,now()) ELSE NULL END,updated_at=now()
        WHERE id=${orderId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'ECOM_PAYMENT_STATUS_CHANGED',{entityType:'ecommerce_order',entityId:String(orderId),metadata:{from:current[0].payment_status,to:paymentStatus,reference}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='set_ecommerce_order_status'){
      const orderId=positiveInt(b.order_id,0),status=clean(b.status).toLowerCase();
      if(!orderId||!ecommerceOrderStatuses.has(status))return res.status(400).json({error:'Valid order and status required'});
      const current=await sql`SELECT id,status FROM ecommerce_orders WHERE id=${orderId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'E-commerce order not found'});
      if(current[0].status==='cancelled'&&status!=='cancelled')return res.status(400).json({error:'Cancelled order cannot be reopened'});
      if(status==='cancelled'&&current[0].status!=='cancelled'){
        const items=await sql`SELECT ecommerce_product_id,quantity FROM ecommerce_order_items WHERE ecommerce_order_id=${orderId} AND company_id=${u.company_id}`;
        for(const item of items)await sql`UPDATE ecommerce_products SET stock_qty=stock_qty+${item.quantity},updated_at=now() WHERE id=${item.ecommerce_product_id} AND company_id=${u.company_id}`;
      }
      const rows=await sql`UPDATE ecommerce_orders SET status=${status},updated_at=now() WHERE id=${orderId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'ECOM_ORDER_STATUS_CHANGED',{entityType:'ecommerce_order',entityId:String(orderId),metadata:{from:current[0].status,to:status}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='save_communication_settings'){
      if(!['company_admin','manager','accountant'].includes(u.role))return res.status(403).json({error:'Company Admin, Manager or Accountant role required'});
      const country=clean(b.default_country_code||'92').replace(/\D/g,'').slice(0,5)||'92',
        whatsapp=clean(b.whatsapp_number).replace(/\D/g,'').slice(0,20)||null,
        invoiceTemplate=String(b.invoice_template||'').slice(0,2000),
        statementTemplate=String(b.statement_template||'').slice(0,2000);
      const rows=await sql`INSERT INTO communication_settings(company_id,whatsapp_number,default_country_code,invoice_template,statement_template,active,updated_by_user_id)
        VALUES(${u.company_id},${whatsapp},${country},${invoiceTemplate||null},${statementTemplate||null},${b.active!==false},${u.id})
        ON CONFLICT(company_id) DO UPDATE SET whatsapp_number=EXCLUDED.whatsapp_number,default_country_code=EXCLUDED.default_country_code,
          invoice_template=EXCLUDED.invoice_template,statement_template=EXCLUDED.statement_template,active=EXCLUDED.active,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=now()
        RETURNING *`;
      await companyAudit(sql,u,'COMMUNICATION_SETTINGS_UPDATED',{entityType:'communication_settings',entityId:String(u.company_id)});
      return res.status(200).json({settings:rows[0]});
    }
    if(req.method==='POST'&&action==='prepare_whatsapp_share'){
      const entityType=clean(b.entity_type),entityId=positiveInt(b.entity_id,0);
      if(!['client_invoice','client_statement'].includes(entityType)||!entityId)return res.status(400).json({error:'Valid WhatsApp share target required'});
      const settings=await sql`SELECT * FROM communication_settings WHERE company_id=${u.company_id} LIMIT 1`;
      const country=clean(settings[0]?.default_country_code||'92').replace(/\D/g,'')||'92';
      let recipient='',message='',templateCode='';
      const fill=(tpl,vars)=>Object.entries(vars).reduce((x,[k,v])=>x.replaceAll('{{'+k+'}}',String(v??'')),tpl);
      if(entityType==='client_invoice'){
        const rows=await sql`SELECT i.id,i.invoice_number,i.invoice_date,i.due_date,i.amount,i.status,c.business_name,c.mobile_number
          FROM erp_client_invoices i JOIN erp_clients c ON c.id=i.client_id AND c.company_id=i.company_id
          WHERE i.id=${entityId} AND i.company_id=${u.company_id} LIMIT 1`;
        const x=rows[0];if(!x)return res.status(404).json({error:'Customer invoice not found'});
        recipient=clean(x.mobile_number).replace(/\D/g,'');
        const tpl=settings[0]?.invoice_template||'Assalam-o-Alaikum {{customer}}, {{company}} ki invoice {{invoice}} amount {{amount}}. Due: {{due}}.';
        message=fill(tpl,{customer:x.business_name,company:u.company_name,invoice:x.invoice_number,amount:'PKR '+number(x.amount).toLocaleString('en-PK'),due:x.due_date?String(x.due_date).slice(0,10):'—',status:x.status});
        templateCode='CLIENT_INVOICE';
      }else{
        const rows=await sql`SELECT c.id,c.business_name,c.mobile_number,
          (c.opening_balance
            +COALESCE((SELECT SUM(i.amount) FROM erp_client_invoices i WHERE i.company_id=c.company_id AND i.client_id=c.id AND i.status<>'cancelled'),0)
            -COALESCE((SELECT SUM(r.amount) FROM erp_client_returns r WHERE r.company_id=c.company_id AND r.client_id=c.id AND r.status='posted'),0)
            -COALESCE((SELECT SUM(p.amount) FROM erp_client_receipts p WHERE p.company_id=c.company_id AND p.client_id=c.id AND p.status='posted'),0))::numeric balance
          FROM erp_clients c WHERE c.id=${entityId} AND c.company_id=${u.company_id} LIMIT 1`;
        const x=rows[0];if(!x)return res.status(404).json({error:'Customer not found'});
        recipient=clean(x.mobile_number).replace(/\D/g,'');
        const tpl=settings[0]?.statement_template||'Assalam-o-Alaikum {{customer}}, {{company}} account balance {{balance}} hai.';
        message=fill(tpl,{customer:x.business_name,company:u.company_name,balance:'PKR '+number(x.balance).toLocaleString('en-PK')});
        templateCode='CLIENT_STATEMENT';
      }
      if(!recipient)return res.status(409).json({error:'Customer mobile number is missing'});
      if(recipient.startsWith('0'))recipient=country+recipient.slice(1);
      else if(!recipient.startsWith(country)&&recipient.length<=11)recipient=country+recipient;
      const log=await sql`INSERT INTO communication_logs(company_id,channel,recipient,entity_type,entity_id,template_code,message,status,created_by_user_id)
        VALUES(${u.company_id},'whatsapp',${recipient},${entityType},${String(entityId)},${templateCode},${message},'opened',${u.id})
        RETURNING id,recipient,message,status,created_at`;
      await companyAudit(sql,u,'WHATSAPP_SHARE_OPENED',{entityType,entityId:String(entityId),metadata:{recipient,template_code:templateCode}});
      return res.status(200).json({share:{phone:recipient,message,log_id:log[0].id}});
    }

    if(req.method==='POST'&&action==='run_automations'){
      if(!['company_admin','manager'].includes(u.role))return res.status(403).json({error:'Company Admin or Manager role required'});
      const result=await runAutomationRules(sql,u,{force:b.force===true});
      return res.status(200).json(result);
    }
    if(req.method==='POST'&&action==='update_automation_rule'){
      if(!['company_admin','manager'].includes(u.role))return res.status(403).json({error:'Company Admin or Manager role required'});
      const ruleCode=clean(b.rule_code).toUpperCase();
      if(!automationRuleCodes.has(ruleCode))return res.status(400).json({error:'Valid automation rule required'});
      await ensureAutomationRules(sql,u);
      let parameters={};
      if(ruleCode==='LOW_STOCK')parameters={threshold:Math.max(0,number(b.value))};
      else parameters={days:Math.max(0,Math.floor(number(b.value)))};
      const rows=await sql`UPDATE automation_rules SET active=${b.active!==false},parameters=${JSON.stringify(parameters)}::jsonb,updated_at=now()
        WHERE company_id=${u.company_id} AND rule_code=${ruleCode}
        RETURNING id,rule_code,rule_name,active,parameters,last_run_at,updated_at`;
      await companyAudit(sql,u,'AUTOMATION_RULE_UPDATED',{entityType:'automation_rule',entityId:String(rows[0]?.id||''),metadata:{rule_code:ruleCode,active:b.active!==false,parameters}});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='dismiss_automation_alert'){
      if(!['company_admin','manager'].includes(u.role))return res.status(403).json({error:'Company Admin or Manager role required'});
      const alertId=positiveInt(b.alert_id,0);
      if(!alertId)return res.status(400).json({error:'Valid automation alert required'});
      const rows=await sql`UPDATE automation_alerts SET status='dismissed',updated_at=now()
        WHERE id=${alertId} AND company_id=${u.company_id} AND status='open'
        RETURNING *`;
      if(!rows[0])return res.status(404).json({error:'Open automation alert not found'});
      await companyAudit(sql,u,'AUTOMATION_ALERT_DISMISSED',{entityType:'automation_alert',entityId:String(alertId),metadata:{rule_code:rows[0].rule_code}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='save_ocr_draft'){
      const draftId=positiveInt(b.draft_id,0)||null,supplierId=positiveInt(b.supplier_id,0)||null,invoiceNumber=clean(b.invoice_number)||null,
        invoiceDate=clean(b.invoice_date)||null,dueDate=clean(b.due_date)||null,detectedTotal=b.detected_total===''||b.detected_total===null||b.detected_total===undefined?null:number(b.detected_total),
        sourceText=String(b.source_text||'').slice(0,120000),sourceFileName=clean(b.source_file_name)||null,confidence=b.ocr_confidence===null||b.ocr_confidence===undefined||b.ocr_confidence===''?null:number(b.ocr_confidence);
      const items=Array.isArray(b.items)?b.items.slice(0,500).map((x,i)=>({product_id:positiveInt(x.product_id,0)||null,description:clean(x.description)||null,quantity:number(x.quantity),unit_price:number(x.unit_price),sort_order:i})):[];
      if(detectedTotal!==null&&detectedTotal<0)return res.status(400).json({error:'Detected total cannot be negative'});
      if(items.some(x=>x.quantity<=0||x.unit_price<0))return res.status(400).json({error:'Draft item quantities and prices must be valid'});
      if(supplierId){
        const supplier=await sql`SELECT id FROM erp_suppliers WHERE id=${supplierId} AND company_id=${u.company_id} LIMIT 1`;
        if(!supplier[0])return res.status(400).json({error:'Valid supplier required'});
      }
      for(const item of items){
        if(item.product_id){
          const p=await sql`SELECT id FROM erp_products WHERE id=${item.product_id} AND company_id=${u.company_id} LIMIT 1`;
          if(!p[0])return res.status(400).json({error:'One or more mapped products are invalid'});
        }
      }
      const calculatedTotal=Number(items.reduce((n,x)=>n+x.quantity*x.unit_price,0).toFixed(2));
      let rows;
      if(draftId){
        const current=await sql`SELECT id,status FROM ocr_supplier_drafts WHERE id=${draftId} AND company_id=${u.company_id} LIMIT 1`;
        if(!current[0])return res.status(404).json({error:'OCR draft not found'});
        if(current[0].status!=='draft')return res.status(409).json({error:'Posted or rejected OCR draft cannot be edited'});
        rows=await sql`UPDATE ocr_supplier_drafts SET source_file_name=${sourceFileName},source_text=${sourceText},ocr_confidence=${confidence},
          supplier_id=${supplierId},invoice_number=${invoiceNumber},invoice_date=${invoiceDate}::date,due_date=${dueDate}::date,
          detected_total=${detectedTotal},calculated_total=${calculatedTotal},notes=${clean(b.notes)||null},updated_at=now()
          WHERE id=${draftId} AND company_id=${u.company_id} RETURNING *`;
        await sql`DELETE FROM ocr_supplier_draft_items WHERE draft_id=${draftId} AND company_id=${u.company_id}`;
      }else{
        const draftNumber='OCR-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+String(Date.now()).slice(-7);
        rows=await sql`INSERT INTO ocr_supplier_drafts(company_id,draft_number,source_file_name,source_text,ocr_confidence,supplier_id,invoice_number,invoice_date,due_date,detected_total,calculated_total,status,notes,created_by_user_id)
          VALUES(${u.company_id},${draftNumber},${sourceFileName},${sourceText},${confidence},${supplierId},${invoiceNumber},${invoiceDate}::date,${dueDate}::date,${detectedTotal},${calculatedTotal},'draft',${clean(b.notes)||null},${u.id})
          RETURNING *`;
      }
      const id=rows[0].id;
      for(const item of items)await sql`INSERT INTO ocr_supplier_draft_items(company_id,draft_id,product_id,description,quantity,unit_price,sort_order)
        VALUES(${u.company_id},${id},${item.product_id},${item.description},${item.quantity},${item.unit_price},${item.sort_order})`;
      await companyAudit(sql,u,draftId?'OCR_DRAFT_UPDATED':'OCR_DRAFT_CREATED',{entityType:'ocr_supplier_draft',entityId:String(id),metadata:{item_count:items.length,calculated_total:calculatedTotal,detected_total:detectedTotal}});
      return res.status(draftId?200:201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='post_ocr_draft'){
      const draftId=positiveInt(b.draft_id,0);
      if(!draftId)return res.status(400).json({error:'Valid OCR draft required'});
      const d=await sql`SELECT * FROM ocr_supplier_drafts WHERE id=${draftId} AND company_id=${u.company_id} LIMIT 1`;
      if(!d[0])return res.status(404).json({error:'OCR draft not found'});
      if(d[0].status==='posted')return res.status(200).json({record:d[0]});
      if(d[0].status!=='draft')return res.status(409).json({error:'Rejected OCR draft cannot be posted'});
      if(!d[0].supplier_id||!d[0].invoice_number||!d[0].invoice_date)return res.status(400).json({error:'Supplier, invoice number and invoice date are required before posting'});
      const items=await sql`SELECT * FROM ocr_supplier_draft_items WHERE draft_id=${draftId} AND company_id=${u.company_id} ORDER BY sort_order,id`;
      if(!items.length||items.some(x=>!x.product_id||number(x.quantity)<=0||number(x.unit_price)<0))return res.status(400).json({error:'Every OCR line must be mapped to a valid product before posting'});
      const calculatedTotal=Number(items.reduce((n,x)=>n+number(x.quantity)*number(x.unit_price),0).toFixed(2));
      if(d[0].detected_total!==null&&Math.abs(number(d[0].detected_total)-calculatedTotal)>0.01)return res.status(409).json({error:'OCR total mismatch. Correct line items or detected total in Draft Review before posting'});
      const duplicate=await sql`SELECT id FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND supplier_id=${d[0].supplier_id} AND invoice_number=${d[0].invoice_number} LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'This supplier invoice number already exists'});
      const invoice=await sql`INSERT INTO erp_supplier_invoices(company_id,supplier_id,invoice_number,invoice_date,due_date,amount,status,notes,created_by_user_id)
        VALUES(${u.company_id},${d[0].supplier_id},${d[0].invoice_number},${d[0].invoice_date},${d[0].due_date},${calculatedTotal},'unpaid',${d[0].notes},${u.id})
        RETURNING *`;
      for(const item of items)await sql`INSERT INTO erp_supplier_invoice_items(company_id,supplier_invoice_id,product_id,description,quantity,unit_price)
        VALUES(${u.company_id},${invoice[0].id},${item.product_id},${item.description},${item.quantity},${item.unit_price})`;
      const rows=await sql`UPDATE ocr_supplier_drafts SET status='posted',calculated_total=${calculatedTotal},posted_supplier_invoice_id=${invoice[0].id},posted_at=now(),updated_at=now()
        WHERE id=${draftId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'OCR_DRAFT_POSTED',{entityType:'ocr_supplier_draft',entityId:String(draftId),metadata:{supplier_invoice_id:invoice[0].id,invoice_number:invoice[0].invoice_number,amount:calculatedTotal}});
      return res.status(201).json({record:rows[0],invoice:invoice[0]});
    }
    if(req.method==='POST'&&action==='reject_ocr_draft'){
      const draftId=positiveInt(b.draft_id,0);
      if(!draftId)return res.status(400).json({error:'Valid OCR draft required'});
      const rows=await sql`UPDATE ocr_supplier_drafts SET status='rejected',notes=COALESCE(${clean(b.notes)||null},notes),updated_at=now()
        WHERE id=${draftId} AND company_id=${u.company_id} AND status='draft' RETURNING *`;
      if(!rows[0])return res.status(409).json({error:'Only draft OCR entries can be rejected'});
      await companyAudit(sql,u,'OCR_DRAFT_REJECTED',{entityType:'ocr_supplier_draft',entityId:String(draftId)});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='request_audit'){
      const from=clean(b.period_from),to=clean(b.period_to),method=clean(b.payment_method).toUpperCase(),reference=clean(b.payment_reference);
      if(!from||!to||to<from)return res.status(400).json({error:'Valid audit period required'});
      if(!paymentMethods.has(method))return res.status(400).json({error:'Valid payment method required'});
      if(!reference)return res.status(400).json({error:'Payment reference required'});
      const price=await sql`SELECT asp.per_audit_price,asp.active FROM audit_service_prices asp WHERE asp.plan_id=${u.plan_id} LIMIT 1`;
      if(!price[0]?.active||Number(price[0]?.per_audit_price||0)<=0)return res.status(403).json({error:'Audit service is not available for this plan right now'});
      const duplicate=await sql`SELECT id FROM audit_requests WHERE company_id=${u.company_id} AND period_from=${from}::date AND period_to=${to}::date AND status IN('submitted','approved') LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'An audit request for this period is already pending or approved'});
      const rows=await sql`INSERT INTO audit_requests(company_id,subscription_id,plan_id,price,period_from,period_to,payment_method,payment_reference,payment_status,status,notes,created_by_user_id)
        VALUES(${u.company_id},${u.subscription_id},${u.plan_id},${price[0].per_audit_price},${from}::date,${to}::date,${method},${reference},'submitted','submitted',${clean(b.notes)||null},${u.id})
        RETURNING *`;
      await companyAudit(sql,u,'AUDIT_REQUEST_SUBMITTED',{entityType:'audit_request',entityId:String(rows[0].id),metadata:{price:rows[0].price,period_from:from,period_to:to,payment_method:method}});
      return res.status(201).json({audit_request:rows[0]});
    }

    if(req.method==='POST'&&action==='update_user'){
      if(u.role!=='company_admin')return res.status(403).json({error:'Company Admin only'});
      const userId=positiveInt(b.user_id,0),fullName=clean(b.full_name),email=clean(b.email).toLowerCase()||null,role=clean(b.role).toLowerCase(),password=String(b.password||'');
      if(!userId||!fullName||!userRoles.has(role))return res.status(400).json({error:'Valid user, name and role required'});
      if(password&&password.length<8)return res.status(400).json({error:'New password must be at least 8 characters'});
      const current=await sql`SELECT id,user_code,full_name,email,role,active FROM company_users WHERE id=${userId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'User not found'});
      if(userId===Number(u.id)&&role!=='company_admin')return res.status(400).json({error:'You cannot remove your own Company Admin role'});
      if(current[0].role==='company_admin'&&current[0].active&&role!=='company_admin'){
        const admins=await sql`SELECT COUNT(*)::int count FROM company_users WHERE company_id=${u.company_id} AND role='company_admin' AND active=true`;
        if(Number(admins[0]?.count||0)<=1)return res.status(409).json({error:'At least one active Company Admin must remain'});
      }
      let rows;
      if(password){
        rows=await sql`UPDATE company_users SET full_name=${fullName},email=${email},role=${role},password_hash=${hashPassword(password)}
          WHERE id=${userId} AND company_id=${u.company_id}
          RETURNING id,user_code,full_name,email,role,active,created_at,last_login_at`;
      }else{
        rows=await sql`UPDATE company_users SET full_name=${fullName},email=${email},role=${role}
          WHERE id=${userId} AND company_id=${u.company_id}
          RETURNING id,user_code,full_name,email,role,active,created_at,last_login_at`;
      }
      await companyAudit(sql,u,'COMPANY_USER_UPDATED',{entityType:'company_user',entityId:String(userId),metadata:{from_role:current[0].role,to_role:role,password_reset:Boolean(password)}});
      return res.status(200).json({record:rows[0]});
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
      if(!active){
        const target=await sql`SELECT role,active FROM company_users WHERE id=${userId} AND company_id=${u.company_id} LIMIT 1`;
        if(target[0]?.role==='company_admin'&&target[0]?.active){
          const admins=await sql`SELECT COUNT(*)::int count FROM company_users WHERE company_id=${u.company_id} AND role='company_admin' AND active=true`;
          if(Number(admins[0]?.count||0)<=1)return res.status(409).json({error:'At least one active Company Admin must remain'});
        }
      }
      if(active&&u.user_limit){
        const count=await sql`SELECT COUNT(*)::int count FROM company_users WHERE company_id=${u.company_id} AND active=true`;
        if(Number(count[0]?.count||0)>=Number(u.user_limit))return res.status(403).json({error:'Current subscription user limit reached'});
      }
      const rows=await sql`UPDATE company_users SET active=${active} WHERE id=${userId} AND company_id=${u.company_id} RETURNING id,user_code,full_name,email,role,active`;
      if(!rows[0])return res.status(404).json({error:'User not found'});
      await companyAudit(sql,u,'COMPANY_USER_STATUS_CHANGED',{entityType:'company_user',entityId:String(userId),metadata:{active}});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='update_supplier'){
      const supplierId=positiveInt(b.supplier_id,0),supplierCode=code(b.supplier_code),name=clean(b.business_name),openingBalance=number(b.opening_balance);
      if(!supplierId||!supplierCode||!name||openingBalance<0)return res.status(400).json({error:'Valid supplier code, business name and opening balance required'});
      const current=await sql`SELECT id,opening_balance FROM erp_suppliers WHERE id=${supplierId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'Supplier not found'});
      const duplicate=await sql`SELECT id FROM erp_suppliers WHERE company_id=${u.company_id} AND supplier_code=${supplierCode} AND id<>${supplierId} LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'Supplier code already exists'});
      if(Math.abs(number(current[0].opening_balance)-openingBalance)>0.000001){
        const used=await sql`SELECT
          EXISTS(SELECT 1 FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND supplier_id=${supplierId}) has_invoice,
          EXISTS(SELECT 1 FROM erp_supplier_payments WHERE company_id=${u.company_id} AND supplier_id=${supplierId}) has_payment,
          EXISTS(SELECT 1 FROM erp_supplier_returns WHERE company_id=${u.company_id} AND supplier_id=${supplierId}) has_return`;
        if(used[0]?.has_invoice||used[0]?.has_payment||used[0]?.has_return)return res.status(409).json({error:'Opening balance cannot be changed after supplier transactions exist'});
      }
      const rows=await sql`UPDATE erp_suppliers SET supplier_code=${supplierCode},business_name=${name},contact_person=${clean(b.contact_person)||null},mobile_number=${clean(b.mobile_number)||null},opening_balance=${openingBalance},updated_at=now()
        WHERE id=${supplierId} AND company_id=${u.company_id}
        RETURNING id,supplier_code,business_name,contact_person,mobile_number,opening_balance,status,created_at,updated_at`;
      await companyAudit(sql,u,'SUPPLIER_UPDATED',{entityType:'supplier',entityId:String(supplierId)});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_supplier_status'){
      const supplierId=positiveInt(b.supplier_id,0),status=clean(b.status).toLowerCase();
      if(!supplierId||!['active','inactive'].includes(status))return res.status(400).json({error:'Valid supplier and status required'});
      const rows=await sql`UPDATE erp_suppliers SET status=${status},updated_at=now() WHERE id=${supplierId} AND company_id=${u.company_id}
        RETURNING id,supplier_code,business_name,status`;
      if(!rows[0])return res.status(404).json({error:'Supplier not found'});
      await companyAudit(sql,u,'SUPPLIER_STATUS_CHANGED',{entityType:'supplier',entityId:String(supplierId),metadata:{status}});
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
    if(req.method==='POST'&&action==='cancel_supplier_invoice'){
      const invoiceId=positiveInt(b.invoice_id,0);
      if(!invoiceId)return res.status(400).json({error:'Valid supplier invoice required'});
      const inv=await sql`SELECT id,invoice_number,status FROM erp_supplier_invoices WHERE id=${invoiceId} AND company_id=${u.company_id} LIMIT 1`;
      if(!inv[0])return res.status(404).json({error:'Supplier invoice not found'});
      if(inv[0].status==='cancelled')return res.status(200).json({record:inv[0]});
      const deps=await sql`SELECT
        EXISTS(SELECT 1 FROM erp_grns WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId} AND status<>'cancelled') has_grn,
        EXISTS(SELECT 1 FROM erp_supplier_payment_allocations WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId}) has_payment`;
      if(deps[0]?.has_grn)return res.status(409).json({error:'Invoice cannot be cancelled because GRN/stock receiving is linked'});
      if(deps[0]?.has_payment)return res.status(409).json({error:'Invoice cannot be cancelled because supplier payment is allocated'});
      const rows=await sql`UPDATE erp_supplier_invoices SET status='cancelled',updated_at=now() WHERE id=${invoiceId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'SUPPLIER_INVOICE_CANCELLED',{entityType:'supplier_invoice',entityId:String(invoiceId),metadata:{invoice_number:inv[0].invoice_number}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='update_supplier_invoice'){
      const invoiceId=positiveInt(b.invoice_id,0),supplierId=positiveInt(b.supplier_id,0),invoiceNumber=clean(b.invoice_number),invoiceDate=clean(b.invoice_date)||new Date().toISOString().slice(0,10),dueDate=clean(b.due_date)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({product_id:positiveInt(x.product_id,0),description:clean(x.description)||null,quantity:number(x.quantity),unit_price:number(x.unit_price)})):[];
      if(!invoiceId||!supplierId||!invoiceNumber||!items.length)return res.status(400).json({error:'Supplier, invoice number and products required'});
      if(items.some(x=>!x.product_id||x.quantity<=0||x.unit_price<0))return res.status(400).json({error:'Valid product, quantity and purchase price required'});
      const inv=await sql`SELECT id,supplier_id,status FROM erp_supplier_invoices WHERE id=${invoiceId} AND company_id=${u.company_id} LIMIT 1`;
      if(!inv[0])return res.status(404).json({error:'Supplier invoice not found'});
      if(inv[0].status==='cancelled')return res.status(409).json({error:'Cancelled invoice cannot be edited'});
      const deps=await sql`SELECT
        EXISTS(SELECT 1 FROM erp_grns WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId} AND status='posted') has_grn,
        EXISTS(SELECT 1 FROM erp_supplier_payment_allocations WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId}) has_payment,
        EXISTS(SELECT 1 FROM erp_supplier_returns WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId} AND status='posted') has_return`;
      if(deps[0]?.has_grn)return res.status(409).json({error:'Invoice products cannot be edited after GRN/stock receiving'});
      if(deps[0]?.has_payment)return res.status(409).json({error:'Invoice cannot be edited after payment allocation'});
      if(deps[0]?.has_return)return res.status(409).json({error:'Invoice cannot be edited after supplier return'});
      const supplier=await sql`SELECT id FROM erp_suppliers WHERE id=${supplierId} AND company_id=${u.company_id} LIMIT 1`;
      if(!supplier[0])return res.status(400).json({error:'Valid supplier required'});
      for(const item of items){
        const p=await sql`SELECT id FROM erp_products WHERE id=${item.product_id} AND company_id=${u.company_id} LIMIT 1`;
        if(!p[0])return res.status(400).json({error:'One or more invoice products are invalid'});
      }
      const duplicate=await sql`SELECT id FROM erp_supplier_invoices WHERE company_id=${u.company_id} AND supplier_id=${supplierId} AND invoice_number=${invoiceNumber} AND id<>${invoiceId} LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'Supplier invoice number already exists'});
      const amount=Number(items.reduce((n,x)=>n+x.quantity*x.unit_price,0).toFixed(2));
      await sql`UPDATE erp_supplier_invoices SET supplier_id=${supplierId},invoice_number=${invoiceNumber},invoice_date=${invoiceDate}::date,due_date=${dueDate}::date,amount=${amount},status='unpaid',notes=${clean(b.notes)||null},updated_at=now()
        WHERE id=${invoiceId} AND company_id=${u.company_id}`;
      await sql`DELETE FROM erp_supplier_invoice_items WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId}`;
      for(const item of items)await sql`INSERT INTO erp_supplier_invoice_items(company_id,supplier_invoice_id,product_id,description,quantity,unit_price)
        VALUES(${u.company_id},${invoiceId},${item.product_id},${item.description},${item.quantity},${item.unit_price})`;
      await companyAudit(sql,u,'SUPPLIER_INVOICE_UPDATED',{entityType:'supplier_invoice',entityId:String(invoiceId),metadata:{amount,item_count:items.length}});
      const rows=await sql`SELECT * FROM erp_supplier_invoices WHERE id=${invoiceId} AND company_id=${u.company_id}`;
      return res.status(200).json({record:rows[0]});
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
      const selectedInvoiceId=positiveInt(b.invoice_id,0)||null;
      if(!supplierId||amount<=0||!paymentMethods.has(method))return res.status(400).json({error:'Supplier, positive amount and valid payment method required'});
      const rows=await sql`INSERT INTO erp_supplier_payments(company_id,supplier_id,payment_date,amount,payment_method,reference_number,notes,status,created_by_user_id)
        SELECT ${u.company_id},s.id,${paymentDate}::date,${amount},${method},${clean(b.reference_number)||null},${clean(b.notes)||null},'posted',${u.id}
        FROM erp_suppliers s WHERE s.id=${supplierId} AND s.company_id=${u.company_id}
        RETURNING id,supplier_id,payment_date,amount,payment_method,reference_number,notes,created_at`;
      if(!rows[0])return res.status(404).json({error:'Supplier not found'});
      let remaining=amount;
      const invoices=await sql`SELECT i.id,i.amount,
        COALESCE((SELECT SUM(a.amount) FROM erp_supplier_payment_allocations a WHERE a.supplier_invoice_id=i.id AND a.company_id=i.company_id),0)::numeric paid,
        COALESCE((SELECT SUM(r.amount) FROM erp_supplier_returns r WHERE r.supplier_invoice_id=i.id AND r.company_id=i.company_id AND r.status='posted'),0)::numeric returned
        FROM erp_supplier_invoices i
        WHERE i.company_id=${u.company_id} AND i.supplier_id=${supplierId} AND i.status<>'cancelled'
          AND (${selectedInvoiceId}::bigint IS NULL OR i.id=${selectedInvoiceId})
          AND i.amount-COALESCE((SELECT SUM(r.amount) FROM erp_supplier_returns r WHERE r.supplier_invoice_id=i.id AND r.company_id=i.company_id AND r.status='posted'),0)
            >COALESCE((SELECT SUM(a.amount) FROM erp_supplier_payment_allocations a WHERE a.supplier_invoice_id=i.id AND a.company_id=i.company_id),0)
        ORDER BY CASE WHEN i.id=${selectedInvoiceId} THEN 0 ELSE 1 END,i.invoice_date,i.id`;
      for(const inv of invoices){
        if(remaining<=0)break;
        const netAmount=Math.max(0,number(inv.amount)-number(inv.returned)),outstanding=netAmount-number(inv.paid),allocated=Math.min(remaining,outstanding);
        if(allocated<=0)continue;
        await sql`INSERT INTO erp_supplier_payment_allocations(company_id,supplier_payment_id,supplier_invoice_id,amount)
          VALUES(${u.company_id},${rows[0].id},${inv.id},${allocated})`;
        remaining-=allocated;
        const newPaid=number(inv.paid)+allocated,newStatus=newPaid+0.000001>=netAmount?'paid':'partial';
        await sql`UPDATE erp_supplier_invoices SET status=${newStatus},updated_at=now() WHERE id=${inv.id} AND company_id=${u.company_id}`;
      }
      await companyAudit(sql,u,'SUPPLIER_PAYMENT_CREATED',{entityType:'supplier_payment',entityId:String(rows[0].id),metadata:{amount,method,allocated:amount-remaining,unallocated:remaining}});
      return res.status(201).json({record:rows[0],allocated:amount-remaining,unallocated:remaining});
    }
    if(req.method==='POST'&&action==='cancel_supplier_payment'){
      const paymentId=positiveInt(b.payment_id,0);
      if(!paymentId)return res.status(400).json({error:'Valid supplier payment required'});
      const payment=await sql`SELECT id,supplier_id,amount,status,reference_number FROM erp_supplier_payments WHERE id=${paymentId} AND company_id=${u.company_id} LIMIT 1`;
      if(!payment[0])return res.status(404).json({error:'Supplier payment not found'});
      if(payment[0].status==='cancelled')return res.status(200).json({record:payment[0]});
      const allocations=await sql`SELECT supplier_invoice_id FROM erp_supplier_payment_allocations WHERE company_id=${u.company_id} AND supplier_payment_id=${paymentId}`;
      await sql`DELETE FROM erp_supplier_payment_allocations WHERE company_id=${u.company_id} AND supplier_payment_id=${paymentId}`;
      const rows=await sql`UPDATE erp_supplier_payments SET status='cancelled',cancelled_at=now() WHERE id=${paymentId} AND company_id=${u.company_id} RETURNING *`;
      for(const a of allocations){
        const inv=await sql`SELECT i.id,i.amount,i.status,
          COALESCE((SELECT SUM(r.amount) FROM erp_supplier_returns r WHERE r.company_id=i.company_id AND r.supplier_invoice_id=i.id AND r.status='posted'),0)::numeric returned,
          COALESCE((SELECT SUM(x.amount) FROM erp_supplier_payment_allocations x WHERE x.company_id=i.company_id AND x.supplier_invoice_id=i.id),0)::numeric paid
          FROM erp_supplier_invoices i WHERE i.id=${a.supplier_invoice_id} AND i.company_id=${u.company_id} LIMIT 1`;
        if(inv[0]&&inv[0].status!=='cancelled'){
          const net=Math.max(0,number(inv[0].amount)-number(inv[0].returned)),paid=number(inv[0].paid),status=paid+0.000001>=net?'paid':paid>0?'partial':'unpaid';
          await sql`UPDATE erp_supplier_invoices SET status=${status},updated_at=now() WHERE id=${inv[0].id} AND company_id=${u.company_id}`;
        }
      }
      await companyAudit(sql,u,'SUPPLIER_PAYMENT_CANCELLED',{entityType:'supplier_payment',entityId:String(paymentId),metadata:{amount:payment[0].amount,reference:payment[0].reference_number}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='update_client'){
      const clientId=positiveInt(b.client_id,0),clientCode=code(b.client_code),name=clean(b.business_name),creditLimit=number(b.credit_limit),openingBalance=number(b.opening_balance);
      if(!clientId||!clientCode||!name||creditLimit<0||openingBalance<0)return res.status(400).json({error:'Valid customer code, business name, credit limit and opening balance required'});
      const current=await sql`SELECT id,opening_balance FROM erp_clients WHERE id=${clientId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'Customer not found'});
      const duplicate=await sql`SELECT id FROM erp_clients WHERE company_id=${u.company_id} AND client_code=${clientCode} AND id<>${clientId} LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'Customer code already exists'});
      if(Math.abs(number(current[0].opening_balance)-openingBalance)>0.000001){
        const used=await sql`SELECT
          EXISTS(SELECT 1 FROM erp_client_invoices WHERE company_id=${u.company_id} AND client_id=${clientId}) has_invoice,
          EXISTS(SELECT 1 FROM erp_client_receipts WHERE company_id=${u.company_id} AND client_id=${clientId}) has_payment,
          EXISTS(SELECT 1 FROM erp_client_returns WHERE company_id=${u.company_id} AND client_id=${clientId}) has_return`;
        if(used[0]?.has_invoice||used[0]?.has_payment||used[0]?.has_return)return res.status(409).json({error:'Opening balance cannot be changed after customer transactions exist'});
      }
      const rows=await sql`UPDATE erp_clients SET client_code=${clientCode},business_name=${name},contact_person=${clean(b.contact_person)||null},mobile_number=${clean(b.mobile_number)||null},credit_limit=${creditLimit},opening_balance=${openingBalance},updated_at=now()
        WHERE id=${clientId} AND company_id=${u.company_id}
        RETURNING id,client_code,business_name,contact_person,mobile_number,credit_limit,opening_balance,status,created_at,updated_at`;
      await companyAudit(sql,u,'CLIENT_UPDATED',{entityType:'client',entityId:String(clientId)});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_client_status'){
      const clientId=positiveInt(b.client_id,0),status=clean(b.status).toLowerCase();
      if(!clientId||!['active','inactive'].includes(status))return res.status(400).json({error:'Valid customer and status required'});
      const rows=await sql`UPDATE erp_clients SET status=${status},updated_at=now() WHERE id=${clientId} AND company_id=${u.company_id}
        RETURNING id,client_code,business_name,status`;
      if(!rows[0])return res.status(404).json({error:'Customer not found'});
      await companyAudit(sql,u,'CLIENT_STATUS_CHANGED',{entityType:'client',entityId:String(clientId),metadata:{status}});
      return res.status(200).json({record:rows[0]});
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
    if(req.method==='POST'&&action==='cancel_client_invoice'){
      const invoiceId=positiveInt(b.invoice_id,0);
      if(!invoiceId)return res.status(400).json({error:'Valid customer invoice required'});
      const inv=await sql`SELECT id,invoice_number,status FROM erp_client_invoices WHERE id=${invoiceId} AND company_id=${u.company_id} LIMIT 1`;
      if(!inv[0])return res.status(404).json({error:'Customer invoice not found'});
      if(inv[0].status==='cancelled')return res.status(200).json({record:inv[0]});
      const paid=await sql`SELECT EXISTS(SELECT 1 FROM erp_client_receipt_allocations WHERE company_id=${u.company_id} AND client_invoice_id=${invoiceId}) has_payment`;
      if(paid[0]?.has_payment)return res.status(409).json({error:'Invoice cannot be cancelled because customer payment is allocated'});
      const sold=await sql`SELECT m.product_id,m.warehouse_id,COALESCE(SUM(m.qty_out),0)::numeric sold_qty,MAX(m.unit_cost)::numeric unit_cost
        FROM erp_inventory_movements m
        WHERE m.company_id=${u.company_id} AND m.reference_type='CUSTOMER_INVOICE' AND m.reference_id=${invoiceId} AND m.movement_type='SALE'
        GROUP BY m.product_id,m.warehouse_id`;
      for(const x of sold){
        const already=await sql`SELECT COALESCE(SUM(qty_in),0)::numeric returned_qty FROM erp_inventory_movements
          WHERE company_id=${u.company_id} AND reference_type='CUSTOMER_INVOICE_CANCEL' AND reference_id=${invoiceId}
            AND movement_type='RETURN_IN' AND product_id=${x.product_id} AND warehouse_id=${x.warehouse_id}`;
        const restore=Math.max(0,number(x.sold_qty)-number(already[0]?.returned_qty));
        if(restore>0)await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${x.product_id},${x.warehouse_id},'RETURN_IN',${restore},0,${number(x.unit_cost)},'CUSTOMER_INVOICE_CANCEL',${invoiceId},${inv[0].invoice_number},'Stock restored after invoice cancellation',${u.id})`;
      }
      const rows=await sql`UPDATE erp_client_invoices SET status='cancelled',updated_at=now() WHERE id=${invoiceId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'CLIENT_INVOICE_CANCELLED',{entityType:'client_invoice',entityId:String(invoiceId),metadata:{invoice_number:inv[0].invoice_number,stock_groups_restored:sold.length}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='update_client_invoice'){
      const invoiceId=positiveInt(b.invoice_id,0),clientId=positiveInt(b.client_id,0),warehouseId=positiveInt(b.warehouse_id,0),invoiceNumber=clean(b.invoice_number),invoiceDate=clean(b.invoice_date)||new Date().toISOString().slice(0,10),dueDate=clean(b.due_date)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({product_id:positiveInt(x.product_id,0),description:clean(x.description)||null,quantity:number(x.quantity),unit_price:number(x.unit_price)})):[];
      if(!invoiceId||!clientId||!warehouseId||!invoiceNumber||!items.length)return res.status(400).json({error:'Customer, warehouse, invoice number and products required'});
      if(items.some(x=>!x.product_id||x.quantity<=0||x.unit_price<0))return res.status(400).json({error:'Valid product, quantity and sale price required'});
      const inv=await sql`SELECT id,client_id,warehouse_id,invoice_number,status FROM erp_client_invoices WHERE id=${invoiceId} AND company_id=${u.company_id} LIMIT 1`;
      if(!inv[0])return res.status(404).json({error:'Customer invoice not found'});
      if(inv[0].status==='cancelled')return res.status(409).json({error:'Cancelled invoice cannot be edited'});
      const deps=await sql`SELECT
        EXISTS(SELECT 1 FROM erp_client_receipt_allocations WHERE company_id=${u.company_id} AND client_invoice_id=${invoiceId}) has_payment,
        EXISTS(SELECT 1 FROM erp_client_returns WHERE company_id=${u.company_id} AND client_invoice_id=${invoiceId} AND status='posted') has_return`;
      if(deps[0]?.has_payment)return res.status(409).json({error:'Invoice cannot be edited after payment allocation'});
      if(deps[0]?.has_return)return res.status(409).json({error:'Invoice cannot be edited after customer return'});
      const client=await sql`SELECT id FROM erp_clients WHERE id=${clientId} AND company_id=${u.company_id} LIMIT 1`;
      const wh=await sql`SELECT id FROM erp_warehouses WHERE id=${warehouseId} AND company_id=${u.company_id} AND active=true LIMIT 1`;
      if(!client[0]||!wh[0])return res.status(400).json({error:'Valid customer and active warehouse required'});
      const duplicate=await sql`SELECT id FROM erp_client_invoices WHERE company_id=${u.company_id} AND invoice_number=${invoiceNumber} AND id<>${invoiceId} LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'Customer invoice number already exists'});
      const oldItems=await sql`SELECT product_id,warehouse_id,quantity,unit_cost FROM erp_client_invoice_items WHERE company_id=${u.company_id} AND client_invoice_id=${invoiceId}`;
      const hadStock=await sql`SELECT EXISTS(SELECT 1 FROM erp_inventory_movements WHERE company_id=${u.company_id} AND reference_type='CUSTOMER_INVOICE' AND reference_id=${invoiceId} AND movement_type='SALE') has_stock`;
      const prepared=[];
      for(const item of items){
        const p=await sql`SELECT id,purchase_price FROM erp_products WHERE id=${item.product_id} AND company_id=${u.company_id} LIMIT 1`;
        if(!p[0])return res.status(400).json({error:'One or more invoice products are invalid'});
        prepared.push({...item,unit_cost:number(p[0].purchase_price)});
      }
      const oldMap=new Map(),newMap=new Map();
      for(const x of oldItems){
        const key=String(x.warehouse_id)+':'+String(x.product_id),v=oldMap.get(key)||{warehouse_id:positiveInt(x.warehouse_id,0),product_id:positiveInt(x.product_id,0),quantity:0,unit_cost:number(x.unit_cost)};
        v.quantity+=number(x.quantity);oldMap.set(key,v);
      }
      for(const x of prepared){
        const key=String(warehouseId)+':'+String(x.product_id),v=newMap.get(key)||{warehouse_id:warehouseId,product_id:x.product_id,quantity:0,unit_cost:x.unit_cost};
        v.quantity+=x.quantity;v.unit_cost=x.unit_cost;newMap.set(key,v);
      }
      if(hadStock[0]?.has_stock){
        for(const [key,nv] of newMap){
          const ov=oldMap.get(key),delta=nv.quantity-number(ov?.quantity||0);
          if(delta>0.000001){
            const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements WHERE company_id=${u.company_id} AND warehouse_id=${nv.warehouse_id} AND product_id=${nv.product_id}`;
            if(number(stock[0]?.quantity)+0.000001<delta)return res.status(409).json({error:'Insufficient warehouse stock for updated invoice quantities'});
          }
        }
      }
      const amount=Number(prepared.reduce((n,x)=>n+x.quantity*x.unit_price,0).toFixed(2));
      await sql`UPDATE erp_client_invoices SET client_id=${clientId},warehouse_id=${warehouseId},invoice_number=${invoiceNumber},invoice_date=${invoiceDate}::date,due_date=${dueDate}::date,amount=${amount},status='unpaid',notes=${clean(b.notes)||null},updated_at=now()
        WHERE id=${invoiceId} AND company_id=${u.company_id}`;
      await sql`DELETE FROM erp_client_invoice_items WHERE company_id=${u.company_id} AND client_invoice_id=${invoiceId}`;
      for(const item of prepared)await sql`INSERT INTO erp_client_invoice_items(company_id,client_invoice_id,product_id,warehouse_id,description,quantity,unit_price,unit_cost)
        VALUES(${u.company_id},${invoiceId},${item.product_id},${warehouseId},${item.description},${item.quantity},${item.unit_price},${item.unit_cost})`;
      if(hadStock[0]?.has_stock){
        const keys=new Set([...oldMap.keys(),...newMap.keys()]);
        for(const key of keys){
          const ov=oldMap.get(key),nv=newMap.get(key),delta=number(nv?.quantity||0)-number(ov?.quantity||0);
          if(Math.abs(delta)<=0.000001)continue;
          const refCost=delta>0?number(nv?.unit_cost):number(ov?.unit_cost),warehouse=positiveInt((nv||ov).warehouse_id,0),product=positiveInt((nv||ov).product_id,0);
          await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
            VALUES(${u.company_id},${product},${warehouse},${delta>0?'SALE':'RETURN_IN'},${delta<0?Math.abs(delta):0},${delta>0?delta:0},${refCost},'CUSTOMER_INVOICE_EDIT',${invoiceId},${invoiceNumber},'Stock correction after invoice edit',${u.id})`;
        }
        await sql`UPDATE erp_inventory_movements SET reference_number=${invoiceNumber} WHERE company_id=${u.company_id} AND reference_type='CUSTOMER_INVOICE' AND reference_id=${invoiceId}`;
      }
      await companyAudit(sql,u,'CLIENT_INVOICE_UPDATED',{entityType:'client_invoice',entityId:String(invoiceId),metadata:{amount,item_count:prepared.length,warehouse_id:warehouseId,stock_corrected:hadStock[0]?.has_stock===true}});
      const rows=await sql`SELECT * FROM erp_client_invoices WHERE id=${invoiceId} AND company_id=${u.company_id}`;
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='create_client_invoice'){
      const clientId=positiveInt(b.client_id,0),invoiceNumber=clean(b.invoice_number),invoiceDate=clean(b.invoice_date)||new Date().toISOString().slice(0,10),dueDate=clean(b.due_date)||null;
      const warehouseId=positiveInt(b.warehouse_id,0)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({product_id:positiveInt(x.product_id,0),description:clean(x.description)||null,quantity:number(x.quantity),unit_price:number(x.unit_price),unit_cost:number(x.unit_cost)})):[];
      if(!clientId||!invoiceNumber)return res.status(400).json({error:'Customer and invoice number required'});
      if(items.length&&items.some(x=>!x.product_id||x.quantity<=0||x.unit_price<0||x.unit_cost<0))return res.status(400).json({error:'Valid product, quantity and sale price required'});
      if(items.length&&!warehouseId)return res.status(400).json({error:'Warehouse required for product invoice'});
      if(warehouseId){
        const wh=await sql`SELECT id FROM erp_warehouses WHERE id=${warehouseId} AND company_id=${u.company_id} AND active=true`;
        if(!wh[0])return res.status(400).json({error:'Warehouse not found'});
      }
      for(const item of items){
        const product=await sql`SELECT id,purchase_price FROM erp_products WHERE id=${item.product_id} AND company_id=${u.company_id} AND active=true`;
        if(!product[0])return res.status(400).json({error:'Invalid product in customer invoice'});
        if(!item.unit_cost)item.unit_cost=number(product[0].purchase_price);
        if(u.features?.inventory_ledger===true){
          const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements WHERE company_id=${u.company_id} AND warehouse_id=${warehouseId} AND product_id=${item.product_id}`;
          if(Number(stock[0]?.quantity||0)+1e-9<item.quantity)return res.status(400).json({error:'Insufficient warehouse stock for one or more products'});
        }
      }
      const itemTotal=items.reduce((n,x)=>n+x.quantity*x.unit_price,0),amount=items.length?Number(itemTotal.toFixed(2)):number(b.amount);
      if(amount<0)return res.status(400).json({error:'Valid invoice amount required'});
      const rows=await sql`INSERT INTO erp_client_invoices(company_id,client_id,warehouse_id,invoice_number,invoice_date,due_date,amount,notes,created_by_user_id)
        SELECT ${u.company_id},c.id,${warehouseId},${invoiceNumber},${invoiceDate}::date,${dueDate}::date,${amount},${clean(b.notes)||null},${u.id}
        FROM erp_clients c WHERE c.id=${clientId} AND c.company_id=${u.company_id}
        RETURNING *`;
      if(!rows[0])return res.status(404).json({error:'Customer not found'});
      for(const item of items){
        await sql`INSERT INTO erp_client_invoice_items(company_id,client_invoice_id,product_id,warehouse_id,description,quantity,unit_price,unit_cost)
          VALUES(${u.company_id},${rows[0].id},${item.product_id},${warehouseId},${item.description},${item.quantity},${item.unit_price},${item.unit_cost})`;
        if(u.features?.inventory_ledger===true){
          await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
            VALUES(${u.company_id},${item.product_id},${warehouseId},'SALE',0,${item.quantity},${item.unit_cost},'CUSTOMER_INVOICE',${rows[0].id},${invoiceNumber},${item.description},${u.id})`;
        }
      }
      await companyAudit(sql,u,'CLIENT_INVOICE_CREATED',{entityType:'client_invoice',entityId:String(rows[0].id),metadata:{amount,item_count:items.length,warehouse_id:warehouseId}});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='create_client_receipt'){
      const clientId=positiveInt(b.client_id,0),amount=number(b.amount),receiptDate=clean(b.receipt_date)||new Date().toISOString().slice(0,10),method=clean(b.payment_method||'CASH').toUpperCase();
      const selectedInvoiceId=positiveInt(b.invoice_id,0)||null;
      if(!clientId||amount<=0||!paymentMethods.has(method))return res.status(400).json({error:'Customer, positive amount and valid payment method required'});
      const rows=await sql`INSERT INTO erp_client_receipts(company_id,client_id,receipt_date,amount,payment_method,reference_number,notes,status,created_by_user_id)
        SELECT ${u.company_id},c.id,${receiptDate}::date,${amount},${method},${clean(b.reference_number)||null},${clean(b.notes)||null},'posted',${u.id}
        FROM erp_clients c WHERE c.id=${clientId} AND c.company_id=${u.company_id}
        RETURNING id,client_id,receipt_date,amount,payment_method,reference_number,notes,created_at`;
      if(!rows[0])return res.status(404).json({error:'Customer not found'});
      let remaining=amount;
      const invoices=await sql`SELECT i.id,i.amount,
        COALESCE((SELECT SUM(a.amount) FROM erp_client_receipt_allocations a WHERE a.client_invoice_id=i.id AND a.company_id=i.company_id),0)::numeric paid,
        COALESCE((SELECT SUM(r.amount) FROM erp_client_returns r WHERE r.client_invoice_id=i.id AND r.company_id=i.company_id AND r.status='posted'),0)::numeric returned
        FROM erp_client_invoices i
        WHERE i.company_id=${u.company_id} AND i.client_id=${clientId} AND i.status<>'cancelled'
          AND (${selectedInvoiceId}::bigint IS NULL OR i.id=${selectedInvoiceId})
          AND i.amount-COALESCE((SELECT SUM(r.amount) FROM erp_client_returns r WHERE r.client_invoice_id=i.id AND r.company_id=i.company_id AND r.status='posted'),0)
            >COALESCE((SELECT SUM(a.amount) FROM erp_client_receipt_allocations a WHERE a.client_invoice_id=i.id AND a.company_id=i.company_id),0)
        ORDER BY CASE WHEN i.id=${selectedInvoiceId} THEN 0 ELSE 1 END,i.invoice_date,i.id`;
      for(const inv of invoices){
        if(remaining<=0)break;
        const netAmount=Math.max(0,number(inv.amount)-number(inv.returned)),outstanding=netAmount-number(inv.paid),allocated=Math.min(remaining,outstanding);
        if(allocated<=0)continue;
        await sql`INSERT INTO erp_client_receipt_allocations(company_id,client_receipt_id,client_invoice_id,amount)
          VALUES(${u.company_id},${rows[0].id},${inv.id},${allocated})`;
        remaining-=allocated;
        const newPaid=number(inv.paid)+allocated,newStatus=newPaid+0.000001>=netAmount?'paid':'partial';
        await sql`UPDATE erp_client_invoices SET status=${newStatus},updated_at=now() WHERE id=${inv.id} AND company_id=${u.company_id}`;
      }
      await companyAudit(sql,u,'CLIENT_RECEIPT_CREATED',{entityType:'client_receipt',entityId:String(rows[0].id),metadata:{amount,method,allocated:amount-remaining,unallocated:remaining}});
      return res.status(201).json({record:rows[0],allocated:amount-remaining,unallocated:remaining});
    }
    if(req.method==='POST'&&action==='cancel_client_receipt'){
      const receiptId=positiveInt(b.receipt_id,0);
      if(!receiptId)return res.status(400).json({error:'Valid customer payment required'});
      const receipt=await sql`SELECT id,client_id,amount,status,reference_number FROM erp_client_receipts WHERE id=${receiptId} AND company_id=${u.company_id} LIMIT 1`;
      if(!receipt[0])return res.status(404).json({error:'Customer payment not found'});
      if(receipt[0].status==='cancelled')return res.status(200).json({record:receipt[0]});
      const allocations=await sql`SELECT client_invoice_id FROM erp_client_receipt_allocations WHERE company_id=${u.company_id} AND client_receipt_id=${receiptId}`;
      await sql`DELETE FROM erp_client_receipt_allocations WHERE company_id=${u.company_id} AND client_receipt_id=${receiptId}`;
      const rows=await sql`UPDATE erp_client_receipts SET status='cancelled',cancelled_at=now() WHERE id=${receiptId} AND company_id=${u.company_id} RETURNING *`;
      for(const a of allocations){
        const inv=await sql`SELECT i.id,i.amount,i.status,
          COALESCE((SELECT SUM(r.amount) FROM erp_client_returns r WHERE r.company_id=i.company_id AND r.client_invoice_id=i.id AND r.status='posted'),0)::numeric returned,
          COALESCE((SELECT SUM(x.amount) FROM erp_client_receipt_allocations x WHERE x.company_id=i.company_id AND x.client_invoice_id=i.id),0)::numeric paid
          FROM erp_client_invoices i WHERE i.id=${a.client_invoice_id} AND i.company_id=${u.company_id} LIMIT 1`;
        if(inv[0]&&inv[0].status!=='cancelled'){
          const net=Math.max(0,number(inv[0].amount)-number(inv[0].returned)),paid=number(inv[0].paid),status=paid+0.000001>=net?'paid':paid>0?'partial':'unpaid';
          await sql`UPDATE erp_client_invoices SET status=${status},updated_at=now() WHERE id=${inv[0].id} AND company_id=${u.company_id}`;
        }
      }
      await companyAudit(sql,u,'CLIENT_PAYMENT_CANCELLED',{entityType:'client_receipt',entityId:String(receiptId),metadata:{amount:receipt[0].amount,reference:receipt[0].reference_number}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='update_product'){
      const productId=positiveInt(b.product_id,0),sku=code(b.sku),barcode=clean(b.barcode)||null,name=clean(b.product_name),unit=clean(b.unit)||'pcs',purchasePrice=number(b.purchase_price),salePrice=number(b.sale_price);
      if(!productId||!sku||!name||purchasePrice<0||salePrice<0)return res.status(400).json({error:'Valid SKU, product name and prices required'});
      const current=await sql`SELECT id FROM erp_products WHERE id=${productId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'Product not found'});
      const duplicate=await sql`SELECT id FROM erp_products WHERE company_id=${u.company_id} AND id<>${productId} AND (sku=${sku} OR (${barcode}::text IS NOT NULL AND barcode=${barcode})) LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'SKU or barcode already exists'});
      const rows=await sql`UPDATE erp_products SET sku=${sku},barcode=${barcode},product_name=${name},unit=${unit},purchase_price=${purchasePrice},sale_price=${salePrice},updated_at=now()
        WHERE id=${productId} AND company_id=${u.company_id}
        RETURNING id,sku,barcode,product_name,unit,purchase_price,sale_price,active,created_at,updated_at`;
      await companyAudit(sql,u,'PRODUCT_UPDATED',{entityType:'product',entityId:String(productId)});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_product_status'){
      const productId=positiveInt(b.product_id,0),active=Boolean(b.active);
      if(!productId)return res.status(400).json({error:'Valid product required'});
      const current=await sql`SELECT id,active FROM erp_products WHERE id=${productId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'Product not found'});
      if(!active){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements WHERE company_id=${u.company_id} AND product_id=${productId}`;
        if(Math.abs(number(stock[0]?.quantity))>0.000001)return res.status(409).json({error:'Product cannot be deactivated while warehouse stock is not zero'});
      }
      const rows=await sql`UPDATE erp_products SET active=${active},updated_at=now() WHERE id=${productId} AND company_id=${u.company_id}
        RETURNING id,sku,product_name,active`;
      await companyAudit(sql,u,'PRODUCT_STATUS_CHANGED',{entityType:'product',entityId:String(productId),metadata:{active}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='create_product'){
      const sku=code(b.sku),name=clean(b.product_name),barcode=clean(b.barcode)||null;
      if(!sku||!name)return res.status(400).json({error:'SKU and product name required'});
      const PRODUCT_DUPLICATE_CHECK_CREATE=await sql`SELECT id FROM erp_products WHERE company_id=${u.company_id} AND (sku=${sku} OR (${barcode}::text IS NOT NULL AND barcode=${barcode})) LIMIT 1`;
      if(PRODUCT_DUPLICATE_CHECK_CREATE[0])return res.status(409).json({error:'SKU or barcode already exists'});
      const rows=await sql`INSERT INTO erp_products(company_id,sku,barcode,product_name,unit,purchase_price,sale_price,created_by_user_id)
        VALUES(${u.company_id},${sku},${barcode},${name},${clean(b.unit)||'pcs'},${number(b.purchase_price)},${number(b.sale_price)},${u.id})
        RETURNING id,sku,barcode,product_name,unit,purchase_price,sale_price,active,created_at`;
      await companyAudit(sql,u,'PRODUCT_CREATED',{entityType:'product',entityId:String(rows[0].id)});
      return res.status(201).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='update_warehouse'){
      const warehouseId=positiveInt(b.warehouse_id,0),warehouseCode=code(b.warehouse_code),name=clean(b.warehouse_name);
      if(!warehouseId||!warehouseCode||!name)return res.status(400).json({error:'Valid warehouse code and name required'});
      const duplicate=await sql`SELECT id FROM erp_warehouses WHERE company_id=${u.company_id} AND warehouse_code=${warehouseCode} AND id<>${warehouseId} LIMIT 1`;
      if(duplicate[0])return res.status(409).json({error:'Warehouse code already exists'});
      const rows=await sql`UPDATE erp_warehouses SET warehouse_code=${warehouseCode},warehouse_name=${name},address=${clean(b.address)||null},updated_at=now()
        WHERE id=${warehouseId} AND company_id=${u.company_id}
        RETURNING id,warehouse_code,warehouse_name,address,active,created_at,updated_at`;
      if(!rows[0])return res.status(404).json({error:'Warehouse not found'});
      await companyAudit(sql,u,'WAREHOUSE_UPDATED',{entityType:'warehouse',entityId:String(warehouseId)});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_warehouse_status'){
      const warehouseId=positiveInt(b.warehouse_id,0),active=Boolean(b.active);
      if(!warehouseId)return res.status(400).json({error:'Valid warehouse required'});
      const current=await sql`SELECT id,active FROM erp_warehouses WHERE id=${warehouseId} AND company_id=${u.company_id} LIMIT 1`;
      if(!current[0])return res.status(404).json({error:'Warehouse not found'});
      if(!active){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements WHERE company_id=${u.company_id} AND warehouse_id=${warehouseId}`;
        if(Math.abs(number(stock[0]?.quantity))>0.000001)return res.status(409).json({error:'Warehouse cannot be deactivated while stock is not zero'});
      }
      const rows=await sql`UPDATE erp_warehouses SET active=${active},updated_at=now() WHERE id=${warehouseId} AND company_id=${u.company_id}
        RETURNING id,warehouse_code,warehouse_name,active`;
      await companyAudit(sql,u,'WAREHOUSE_STATUS_CHANGED',{entityType:'warehouse',entityId:String(warehouseId),metadata:{active}});
      return res.status(200).json({record:rows[0]});
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
        const check=await sql`SELECT ii.id,ii.product_id,ii.quantity,ii.unit_price,
          COALESCE(SUM(gi.quantity) FILTER(WHERE g.status='posted'),0)::numeric already_received
          FROM erp_supplier_invoice_items ii
          LEFT JOIN erp_grn_items gi ON gi.supplier_invoice_item_id=ii.id AND gi.company_id=ii.company_id
          LEFT JOIN erp_grns g ON g.id=gi.grn_id AND g.company_id=gi.company_id
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
    if(req.method==='POST'&&action==='cancel_grn'){
      const grnId=positiveInt(b.grn_id,0);
      if(!grnId)return res.status(400).json({error:'Valid GRN required'});
      const grn=await sql`SELECT id,grn_number,supplier_invoice_id,warehouse_id,status FROM erp_grns WHERE id=${grnId} AND company_id=${u.company_id} LIMIT 1`;
      if(!grn[0])return res.status(404).json({error:'GRN not found'});
      if(grn[0].status==='cancelled')return res.status(200).json({record:grn[0]});
      if(grn[0].status!=='posted')return res.status(409).json({error:'Only posted GRN can be cancelled'});
      const items=await sql`SELECT gi.supplier_invoice_item_id,gi.product_id,SUM(gi.quantity)::numeric quantity,MAX(gi.unit_cost)::numeric unit_cost
        FROM erp_grn_items gi WHERE gi.grn_id=${grnId} AND gi.company_id=${u.company_id}
        GROUP BY gi.supplier_invoice_item_id,gi.product_id`;
      for(const item of items){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements
          WHERE company_id=${u.company_id} AND warehouse_id=${grn[0].warehouse_id} AND product_id=${item.product_id}`;
        if(number(stock[0]?.quantity)+0.000001<number(item.quantity))return res.status(409).json({error:'GRN cannot be cancelled because received stock has already been consumed or moved'});
        const deps=await sql`SELECT
          COALESCE((SELECT SUM(gi.quantity) FROM erp_grn_items gi JOIN erp_grns g ON g.id=gi.grn_id AND g.company_id=gi.company_id
            WHERE gi.company_id=${u.company_id} AND gi.supplier_invoice_item_id=${item.supplier_invoice_item_id} AND g.status='posted' AND g.id<>${grnId}),0)::numeric other_received,
          COALESCE((SELECT SUM(ri.quantity) FROM erp_supplier_return_items ri JOIN erp_supplier_returns rr ON rr.id=ri.supplier_return_id AND rr.company_id=ri.company_id
            WHERE ri.company_id=${u.company_id} AND ri.supplier_invoice_item_id=${item.supplier_invoice_item_id} AND rr.status='posted'),0)::numeric returned`;
        if(number(deps[0]?.returned)>number(deps[0]?.other_received)+0.000001)return res.status(409).json({error:'GRN cannot be cancelled because supplier returns depend on this received quantity'});
      }
      const existing=await sql`SELECT id FROM erp_inventory_movements WHERE company_id=${u.company_id} AND reference_type='GRN_CANCEL' AND reference_id=${grnId} LIMIT 1`;
      if(!existing[0]){
        for(const item of items)await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${grn[0].warehouse_id},'ADJUSTMENT_OUT',0,${number(item.quantity)},${number(item.unit_cost)},'GRN_CANCEL',${grnId},${grn[0].grn_number},'GRN cancellation reversal',${u.id})`;
      }
      const rows=await sql`UPDATE erp_grns SET status='cancelled',updated_at=now() WHERE id=${grnId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'GRN_CANCELLED',{entityType:'grn',entityId:String(grnId),metadata:{grn_number:grn[0].grn_number}});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='cancel_stock_transfer'){
      const transferId=positiveInt(b.transfer_id,0);
      if(!transferId)return res.status(400).json({error:'Valid stock transfer required'});
      const tr=await sql`SELECT id,transfer_number,from_warehouse_id,to_warehouse_id,status FROM erp_stock_transfers WHERE id=${transferId} AND company_id=${u.company_id} LIMIT 1`;
      if(!tr[0])return res.status(404).json({error:'Stock transfer not found'});
      if(tr[0].status==='cancelled')return res.status(200).json({record:tr[0]});
      if(tr[0].status!=='posted')return res.status(409).json({error:'Only posted transfer can be cancelled'});
      const items=await sql`SELECT product_id,SUM(quantity)::numeric quantity,MAX(unit_cost)::numeric unit_cost FROM erp_stock_transfer_items
        WHERE stock_transfer_id=${transferId} AND company_id=${u.company_id} GROUP BY product_id`;
      for(const item of items){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements
          WHERE company_id=${u.company_id} AND warehouse_id=${tr[0].to_warehouse_id} AND product_id=${item.product_id}`;
        if(number(stock[0]?.quantity)+0.000001<number(item.quantity))return res.status(409).json({error:'Transfer cannot be cancelled because destination stock has already been consumed or moved'});
      }
      const existing=await sql`SELECT id FROM erp_inventory_movements WHERE company_id=${u.company_id} AND reference_type='TRANSFER_CANCEL' AND reference_id=${transferId} LIMIT 1`;
      if(!existing[0]){
        for(const item of items){
          await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
            VALUES(${u.company_id},${item.product_id},${tr[0].to_warehouse_id},'TRANSFER_OUT',0,${number(item.quantity)},${number(item.unit_cost)},'TRANSFER_CANCEL',${transferId},${tr[0].transfer_number},'Transfer cancellation reversal',${u.id})`;
          await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
            VALUES(${u.company_id},${item.product_id},${tr[0].from_warehouse_id},'TRANSFER_IN',${number(item.quantity)},0,${number(item.unit_cost)},'TRANSFER_CANCEL',${transferId},${tr[0].transfer_number},'Transfer cancellation reversal',${u.id})`;
        }
      }
      const rows=await sql`UPDATE erp_stock_transfers SET status='cancelled',updated_at=now() WHERE id=${transferId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'STOCK_TRANSFER_CANCELLED',{entityType:'stock_transfer',entityId:String(transferId),metadata:{transfer_number:tr[0].transfer_number}});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='cancel_stock_adjustment'){
      const adjustmentId=positiveInt(b.adjustment_id,0);
      if(!adjustmentId)return res.status(400).json({error:'Valid stock adjustment required'});
      const a=await sql`SELECT id,adjustment_number,warehouse_id,product_id,adjustment_type,quantity,unit_cost,status FROM erp_stock_adjustments
        WHERE id=${adjustmentId} AND company_id=${u.company_id} LIMIT 1`;
      if(!a[0])return res.status(404).json({error:'Stock adjustment not found'});
      if(a[0].status==='cancelled')return res.status(200).json({record:a[0]});
      if(a[0].adjustment_type==='in'){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements
          WHERE company_id=${u.company_id} AND warehouse_id=${a[0].warehouse_id} AND product_id=${a[0].product_id}`;
        if(number(stock[0]?.quantity)+0.000001<number(a[0].quantity))return res.status(409).json({error:'Adjustment cannot be cancelled because added stock has already been consumed or moved'});
      }
      const existing=await sql`SELECT id FROM erp_inventory_movements WHERE company_id=${u.company_id} AND reference_type='ADJUSTMENT_CANCEL' AND reference_id=${adjustmentId} LIMIT 1`;
      if(!existing[0])await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
        VALUES(${u.company_id},${a[0].product_id},${a[0].warehouse_id},${a[0].adjustment_type==='in'?'ADJUSTMENT_OUT':'ADJUSTMENT_IN'},${a[0].adjustment_type==='out'?number(a[0].quantity):0},${a[0].adjustment_type==='in'?number(a[0].quantity):0},${number(a[0].unit_cost)},'ADJUSTMENT_CANCEL',${adjustmentId},${a[0].adjustment_number},'Stock adjustment cancellation reversal',${u.id})`;
      const rows=await sql`UPDATE erp_stock_adjustments SET status='cancelled',cancelled_at=now() WHERE id=${adjustmentId} AND company_id=${u.company_id} RETURNING *`;
      await companyAudit(sql,u,'STOCK_ADJUSTMENT_CANCELLED',{entityType:'stock_adjustment',entityId:String(adjustmentId),metadata:{adjustment_number:a[0].adjustment_number}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='create_supplier_return'){
      const invoiceId=positiveInt(b.supplier_invoice_id,0),warehouseId=positiveInt(b.warehouse_id,0),returnDate=clean(b.return_date)||new Date().toISOString().slice(0,10),notes=clean(b.notes)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({invoice_item_id:positiveInt(x.supplier_invoice_item_id,0),product_id:positiveInt(x.product_id,0),quantity:number(x.quantity)})):[];
      if(!invoiceId||!warehouseId||!items.length||items.some(x=>!x.invoice_item_id||!x.product_id||x.quantity<=0))return res.status(400).json({error:'Supplier invoice, warehouse and valid return quantities required'});
      const inv=await sql`SELECT id,supplier_id,invoice_number,amount,status FROM erp_supplier_invoices WHERE id=${invoiceId} AND company_id=${u.company_id} LIMIT 1`;
      if(!inv[0]||inv[0].status==='cancelled')return res.status(400).json({error:'Valid active supplier invoice required'});
      const wh=await sql`SELECT id FROM erp_warehouses WHERE id=${warehouseId} AND company_id=${u.company_id} AND active=true`;
      if(!wh[0])return res.status(400).json({error:'Valid warehouse required'});
      let amount=0;const prepared=[];
      for(const item of items){
        const row=await sql`SELECT ii.id,ii.product_id,ii.unit_price,
          COALESCE((SELECT SUM(gi.quantity) FROM erp_grn_items gi JOIN erp_grns g ON g.id=gi.grn_id AND g.company_id=gi.company_id WHERE gi.company_id=ii.company_id AND gi.supplier_invoice_item_id=ii.id AND g.status='posted'),0)::numeric received,
          COALESCE((SELECT SUM(ri.quantity) FROM erp_supplier_return_items ri JOIN erp_supplier_returns rr ON rr.id=ri.supplier_return_id AND rr.company_id=ri.company_id WHERE ri.company_id=ii.company_id AND ri.supplier_invoice_item_id=ii.id AND rr.status='posted'),0)::numeric returned
          FROM erp_supplier_invoice_items ii
          WHERE ii.id=${item.invoice_item_id} AND ii.supplier_invoice_id=${invoiceId} AND ii.company_id=${u.company_id} LIMIT 1`;
        if(!row[0]||Number(row[0].product_id)!==item.product_id)return res.status(400).json({error:'Supplier return product does not match invoice'});
        const returnable=number(row[0].received)-number(row[0].returned);
        if(item.quantity>returnable+0.000001)return res.status(400).json({error:'Supplier return quantity exceeds received remaining quantity'});
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements WHERE company_id=${u.company_id} AND warehouse_id=${warehouseId} AND product_id=${item.product_id}`;
        if(number(stock[0]?.quantity)+0.000001<item.quantity)return res.status(400).json({error:'Selected warehouse does not have enough stock for return'});
        const unitPrice=number(row[0].unit_price);amount+=item.quantity*unitPrice;prepared.push({...item,unit_price:unitPrice});
      }
      amount=Number(amount.toFixed(2));
      const balance=await sql`SELECT
        COALESCE((SELECT SUM(amount) FROM erp_supplier_returns WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId} AND status='posted'),0)::numeric returned,
        COALESCE((SELECT SUM(amount) FROM erp_supplier_payment_allocations WHERE company_id=${u.company_id} AND supplier_invoice_id=${invoiceId}),0)::numeric paid`;
      const netAfter=number(inv[0].amount)-number(balance[0].returned)-amount;
      if(number(balance[0].paid)>netAfter+0.000001)return res.status(409).json({error:'Return cannot be posted because allocated supplier payment would exceed the remaining invoice balance'});
      const seq=await sql`SELECT COALESCE(MAX(id),0)::bigint+1 next_id FROM erp_supplier_returns WHERE company_id=${u.company_id}`;
      const returnNumber='SPR-'+String(seq[0]?.next_id||1).padStart(6,'0');
      const rr=await sql`INSERT INTO erp_supplier_returns(company_id,supplier_id,supplier_invoice_id,warehouse_id,return_number,return_date,amount,status,notes,created_by_user_id)
        VALUES(${u.company_id},${inv[0].supplier_id},${invoiceId},${warehouseId},${returnNumber},${returnDate}::date,${amount},'posted',${notes},${u.id}) RETURNING *`;
      for(const item of prepared){
        await sql`INSERT INTO erp_supplier_return_items(company_id,supplier_return_id,supplier_invoice_item_id,product_id,quantity,unit_price,unit_cost)
          VALUES(${u.company_id},${rr[0].id},${item.invoice_item_id},${item.product_id},${item.quantity},${item.unit_price},${item.unit_price})`;
        await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${warehouseId},'RETURN_OUT',0,${item.quantity},${item.unit_price},'SUPPLIER_RETURN',${rr[0].id},${returnNumber},${notes},${u.id})`;
      }
      const paid=number(balance[0].paid),newStatus=paid+0.000001>=Math.max(0,netAfter)?'paid':paid>0?'partial':'unpaid';
      await sql`UPDATE erp_supplier_invoices SET status=${newStatus},updated_at=now() WHERE id=${invoiceId} AND company_id=${u.company_id}`;
      await companyAudit(sql,u,'SUPPLIER_RETURN_POSTED',{entityType:'supplier_return',entityId:String(rr[0].id),metadata:{return_number:returnNumber,invoice_id:invoiceId,amount,item_count:prepared.length}});
      return res.status(201).json({record:rr[0]});
    }
    if(req.method==='POST'&&action==='create_client_return'){
      const invoiceId=positiveInt(b.client_invoice_id,0),returnDate=clean(b.return_date)||new Date().toISOString().slice(0,10),notes=clean(b.notes)||null;
      const items=Array.isArray(b.items)?b.items.map(x=>({invoice_item_id:positiveInt(x.client_invoice_item_id,0),product_id:positiveInt(x.product_id,0),quantity:number(x.quantity)})):[];
      if(!invoiceId||!items.length||items.some(x=>!x.invoice_item_id||!x.product_id||x.quantity<=0))return res.status(400).json({error:'Customer invoice and valid return quantities required'});
      const inv=await sql`SELECT id,client_id,invoice_number,amount,status FROM erp_client_invoices WHERE id=${invoiceId} AND company_id=${u.company_id} LIMIT 1`;
      if(!inv[0]||inv[0].status==='cancelled')return res.status(400).json({error:'Valid active customer invoice required'});
      let amount=0;const prepared=[];
      for(const item of items){
        const row=await sql`SELECT ii.id,ii.product_id,ii.warehouse_id,ii.quantity,ii.unit_price,ii.unit_cost,
          COALESCE((SELECT SUM(ri.quantity) FROM erp_client_return_items ri JOIN erp_client_returns rr ON rr.id=ri.client_return_id AND rr.company_id=ri.company_id WHERE ri.company_id=ii.company_id AND ri.client_invoice_item_id=ii.id AND rr.status='posted'),0)::numeric returned
          FROM erp_client_invoice_items ii WHERE ii.id=${item.invoice_item_id} AND ii.client_invoice_id=${invoiceId} AND ii.company_id=${u.company_id} LIMIT 1`;
        if(!row[0]||Number(row[0].product_id)!==item.product_id||!row[0].warehouse_id)return res.status(400).json({error:'Customer return product/warehouse does not match invoice'});
        const returnable=number(row[0].quantity)-number(row[0].returned);
        if(item.quantity>returnable+0.000001)return res.status(400).json({error:'Customer return quantity exceeds sold remaining quantity'});
        const unitPrice=number(row[0].unit_price);amount+=item.quantity*unitPrice;
        prepared.push({...item,warehouse_id:positiveInt(row[0].warehouse_id,0),unit_price:unitPrice,unit_cost:number(row[0].unit_cost)});
      }
      amount=Number(amount.toFixed(2));
      const balance=await sql`SELECT
        COALESCE((SELECT SUM(amount) FROM erp_client_returns WHERE company_id=${u.company_id} AND client_invoice_id=${invoiceId} AND status='posted'),0)::numeric returned,
        COALESCE((SELECT SUM(amount) FROM erp_client_receipt_allocations WHERE company_id=${u.company_id} AND client_invoice_id=${invoiceId}),0)::numeric paid`;
      const netAfter=number(inv[0].amount)-number(balance[0].returned)-amount;
      if(number(balance[0].paid)>netAfter+0.000001)return res.status(409).json({error:'Return cannot be posted because allocated customer payment would exceed the remaining invoice balance'});
      const seq=await sql`SELECT COALESCE(MAX(id),0)::bigint+1 next_id FROM erp_client_returns WHERE company_id=${u.company_id}`;
      const returnNumber='CTR-'+String(seq[0]?.next_id||1).padStart(6,'0');
      const rr=await sql`INSERT INTO erp_client_returns(company_id,client_id,client_invoice_id,return_number,return_date,amount,status,notes,created_by_user_id)
        VALUES(${u.company_id},${inv[0].client_id},${invoiceId},${returnNumber},${returnDate}::date,${amount},'posted',${notes},${u.id}) RETURNING *`;
      for(const item of prepared){
        await sql`INSERT INTO erp_client_return_items(company_id,client_return_id,client_invoice_item_id,product_id,warehouse_id,quantity,unit_price,unit_cost)
          VALUES(${u.company_id},${rr[0].id},${item.invoice_item_id},${item.product_id},${item.warehouse_id},${item.quantity},${item.unit_price},${item.unit_cost})`;
        await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${item.warehouse_id},'RETURN_IN',${item.quantity},0,${item.unit_cost},'CUSTOMER_RETURN',${rr[0].id},${returnNumber},${notes},${u.id})`;
      }
      const paid=number(balance[0].paid),newStatus=paid+0.000001>=Math.max(0,netAfter)?'paid':paid>0?'partial':'unpaid';
      await sql`UPDATE erp_client_invoices SET status=${newStatus},updated_at=now() WHERE id=${invoiceId} AND company_id=${u.company_id}`;
      await companyAudit(sql,u,'CLIENT_RETURN_POSTED',{entityType:'client_return',entityId:String(rr[0].id),metadata:{return_number:returnNumber,invoice_id:invoiceId,amount,item_count:prepared.length}});
      return res.status(201).json({record:rr[0]});
    }

    if(req.method==='POST'&&action==='cancel_supplier_return'){
      const returnId=positiveInt(b.return_id,0);
      if(!returnId)return res.status(400).json({error:'Valid supplier return required'});
      const rr=await sql`SELECT id,return_number,supplier_invoice_id,warehouse_id,status,amount FROM erp_supplier_returns
        WHERE id=${returnId} AND company_id=${u.company_id} LIMIT 1`;
      if(!rr[0])return res.status(404).json({error:'Supplier return not found'});
      if(rr[0].status==='cancelled')return res.status(200).json({record:rr[0]});
      if(rr[0].status!=='posted')return res.status(409).json({error:'Only posted supplier return can be cancelled'});
      const items=await sql`SELECT product_id,SUM(quantity)::numeric quantity,MAX(unit_cost)::numeric unit_cost
        FROM erp_supplier_return_items WHERE supplier_return_id=${returnId} AND company_id=${u.company_id}
        GROUP BY product_id`;
      const existing=await sql`SELECT id FROM erp_inventory_movements WHERE company_id=${u.company_id} AND reference_type='SUPPLIER_RETURN_CANCEL' AND reference_id=${returnId} LIMIT 1`;
      if(!existing[0]){
        for(const item of items)await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${rr[0].warehouse_id},'RETURN_IN',${number(item.quantity)},0,${number(item.unit_cost)},'SUPPLIER_RETURN_CANCEL',${returnId},${rr[0].return_number},'Supplier return cancellation reversal',${u.id})`;
      }
      const rows=await sql`UPDATE erp_supplier_returns SET status='cancelled',cancelled_at=now(),updated_at=now()
        WHERE id=${returnId} AND company_id=${u.company_id} RETURNING *`;
      const inv=await sql`SELECT i.id,i.amount,i.status,
        COALESCE((SELECT SUM(r.amount) FROM erp_supplier_returns r WHERE r.company_id=i.company_id AND r.supplier_invoice_id=i.id AND r.status='posted'),0)::numeric returned,
        COALESCE((SELECT SUM(a.amount) FROM erp_supplier_payment_allocations a WHERE a.company_id=i.company_id AND a.supplier_invoice_id=i.id),0)::numeric paid
        FROM erp_supplier_invoices i WHERE i.id=${rr[0].supplier_invoice_id} AND i.company_id=${u.company_id} LIMIT 1`;
      if(inv[0]&&inv[0].status!=='cancelled'){
        const net=Math.max(0,number(inv[0].amount)-number(inv[0].returned)),paid=number(inv[0].paid),status=paid+0.000001>=net?'paid':paid>0?'partial':'unpaid';
        await sql`UPDATE erp_supplier_invoices SET status=${status},updated_at=now() WHERE id=${inv[0].id} AND company_id=${u.company_id}`;
      }
      await companyAudit(sql,u,'SUPPLIER_RETURN_CANCELLED',{entityType:'supplier_return',entityId:String(returnId),metadata:{return_number:rr[0].return_number,amount:rr[0].amount}});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='cancel_client_return'){
      const returnId=positiveInt(b.return_id,0);
      if(!returnId)return res.status(400).json({error:'Valid customer return required'});
      const rr=await sql`SELECT id,return_number,client_invoice_id,status,amount FROM erp_client_returns
        WHERE id=${returnId} AND company_id=${u.company_id} LIMIT 1`;
      if(!rr[0])return res.status(404).json({error:'Customer return not found'});
      if(rr[0].status==='cancelled')return res.status(200).json({record:rr[0]});
      if(rr[0].status!=='posted')return res.status(409).json({error:'Only posted customer return can be cancelled'});
      const items=await sql`SELECT product_id,warehouse_id,SUM(quantity)::numeric quantity,MAX(unit_cost)::numeric unit_cost
        FROM erp_client_return_items WHERE client_return_id=${returnId} AND company_id=${u.company_id}
        GROUP BY product_id,warehouse_id`;
      for(const item of items){
        const stock=await sql`SELECT COALESCE(SUM(qty_in-qty_out),0)::numeric quantity FROM erp_inventory_movements
          WHERE company_id=${u.company_id} AND warehouse_id=${item.warehouse_id} AND product_id=${item.product_id}`;
        if(number(stock[0]?.quantity)+0.000001<number(item.quantity))return res.status(409).json({error:'Customer return cannot be cancelled because returned stock has already been consumed or moved'});
      }
      const existing=await sql`SELECT id FROM erp_inventory_movements WHERE company_id=${u.company_id} AND reference_type='CUSTOMER_RETURN_CANCEL' AND reference_id=${returnId} LIMIT 1`;
      if(!existing[0]){
        for(const item of items)await sql`INSERT INTO erp_inventory_movements(company_id,product_id,warehouse_id,movement_type,qty_in,qty_out,unit_cost,reference_type,reference_id,reference_number,notes,created_by_user_id)
          VALUES(${u.company_id},${item.product_id},${item.warehouse_id},'RETURN_OUT',0,${number(item.quantity)},${number(item.unit_cost)},'CUSTOMER_RETURN_CANCEL',${returnId},${rr[0].return_number},'Customer return cancellation reversal',${u.id})`;
      }
      const rows=await sql`UPDATE erp_client_returns SET status='cancelled',cancelled_at=now(),updated_at=now()
        WHERE id=${returnId} AND company_id=${u.company_id} RETURNING *`;
      const inv=await sql`SELECT i.id,i.amount,i.status,
        COALESCE((SELECT SUM(r.amount) FROM erp_client_returns r WHERE r.company_id=i.company_id AND r.client_invoice_id=i.id AND r.status='posted'),0)::numeric returned,
        COALESCE((SELECT SUM(a.amount) FROM erp_client_receipt_allocations a WHERE a.company_id=i.company_id AND a.client_invoice_id=i.id),0)::numeric paid
        FROM erp_client_invoices i WHERE i.id=${rr[0].client_invoice_id} AND i.company_id=${u.company_id} LIMIT 1`;
      if(inv[0]&&inv[0].status!=='cancelled'){
        const net=Math.max(0,number(inv[0].amount)-number(inv[0].returned)),paid=number(inv[0].paid),status=paid+0.000001>=net?'paid':paid>0?'partial':'unpaid';
        await sql`UPDATE erp_client_invoices SET status=${status},updated_at=now() WHERE id=${inv[0].id} AND company_id=${u.company_id}`;
      }
      await companyAudit(sql,u,'CLIENT_RETURN_CANCELLED',{entityType:'client_return',entityId:String(returnId),metadata:{return_number:rr[0].return_number,amount:rr[0].amount}});
      return res.status(200).json({record:rows[0]});
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
      const a=await sql`INSERT INTO erp_stock_adjustments(company_id,adjustment_number,warehouse_id,product_id,adjustment_date,adjustment_type,quantity,unit_cost,reason,notes,status,created_by_user_id)
        VALUES(${u.company_id},${adjustmentNumber},${warehouseId},${productId},${adjustmentDate}::date,${type},${quantity},${unitCost},${reason},${notes},'posted',${u.id}) RETURNING *`;
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
