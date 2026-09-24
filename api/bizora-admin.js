import { bizoraSql,ensureBizoraSchema,requireSuperAdmin,body,clean,positiveInt,hashPassword,audit } from './_bizora-core.js';

const companyCode=v=>clean(v).toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24);

function companyCodeBase(name){
  const words=clean(name).toUpperCase().match(/[A-Z0-9]+/g)||[];
  if(!words.length)return 'CMP';
  let base=(words[0]||'').slice(0,3);
  if(base.length<3)base=(base+words.slice(1).join('')).slice(0,3);
  if(base.length<3)base=(base+'CMP').slice(0,3);
  return companyCode(base);
}

async function nextCompanyCode(sql,name){
  const base=companyCodeBase(name);
  const rows=await sql`SELECT company_code FROM companies WHERE company_code LIKE ${base+'%'} ORDER BY company_code`;
  const used=new Set(rows.map(r=>String(r.company_code||'').toUpperCase()));
  for(let n=1;n<=9999;n++){
    const code=base+String(n).padStart(3,'0');
    if(!used.has(code))return code;
  }
  const e=new Error('Unable to generate a unique company code');e.statusCode=409;throw e;
}

async function overview(sql){
  const [stats,companies,plans,auditPrices,auditRequests,supportTickets]=await Promise.all([
    sql`SELECT
      (SELECT COUNT(*) FROM companies)::int companies,
      (SELECT COUNT(*) FROM companies WHERE status='active')::int active_companies,
      (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND expires_on>=CURRENT_DATE)::int active_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '14 days')::int expiring_14_days,
      (SELECT COUNT(*) FROM audit_requests WHERE status='submitted')::int pending_audits,
      (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open','in_progress','waiting_company'))::int open_support`,
    sql`SELECT c.id,c.company_code,c.company_name,c.logo_url,c.status,c.created_at,
      s.id subscription_id,s.status subscription_status,s.starts_on,s.expires_on,s.billing_cycle,s.amount,
      p.id plan_id,p.plan_code,p.plan_name
      FROM companies c
      LEFT JOIN LATERAL(
        SELECT * FROM subscriptions x WHERE x.company_id=c.id ORDER BY x.expires_on DESC,x.id DESC LIMIT 1
      ) s ON true
      LEFT JOIN plans p ON p.id=s.plan_id
      ORDER BY c.created_at DESC,c.id DESC LIMIT 200`,
    sql`SELECT id,plan_code,plan_name,monthly_price,yearly_price,user_limit,warehouse_limit,features,active FROM plans ORDER BY monthly_price,id`,
    sql`SELECT asp.id,asp.plan_id,p.plan_code,p.plan_name,asp.per_audit_price,asp.active,asp.updated_at
      FROM audit_service_prices asp JOIN plans p ON p.id=asp.plan_id ORDER BY p.monthly_price,p.id`,
    sql`SELECT r.id,r.company_id,c.company_name,c.company_code,r.plan_id,p.plan_code,p.plan_name,r.price,
      r.period_from,r.period_to,r.payment_method,r.payment_reference,r.payment_status,r.status,r.notes,
      r.requested_at,r.reviewed_at,r.completed_at,cu.full_name requested_by
      FROM audit_requests r
      JOIN companies c ON c.id=r.company_id
      JOIN plans p ON p.id=r.plan_id
      LEFT JOIN company_users cu ON cu.id=r.created_by_user_id
      ORDER BY r.requested_at DESC,r.id DESC LIMIT 500`,
    sql`SELECT t.id,t.company_id,t.ticket_number,t.subject,t.category,t.priority,t.status,t.updated_at,c.company_name,c.company_code,
      COALESCE(m.message_count,0)::int message_count FROM support_tickets t JOIN companies c ON c.id=t.company_id
      LEFT JOIN LATERAL(SELECT COUNT(*)::int message_count FROM support_messages x WHERE x.company_id=t.company_id AND x.ticket_id=t.id) m ON true
      ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'waiting_company' THEN 2 ELSE 3 END,t.updated_at DESC LIMIT 500`
  ]);
  return {stats:stats[0]||{},companies,plans,audit_prices:auditPrices,audit_requests:auditRequests,support_tickets:supportTickets};
}

export default async function handler(req,res){
  try{
    const sql=bizoraSql();await ensureBizoraSchema(sql);
    const admin=requireSuperAdmin(req,res);if(!admin)return;
    const b=body(req),action=clean(req.query?.action||b.action||'overview');

    if(req.method==='GET'&&action==='overview')return res.status(200).json(await overview(sql));
    if(req.method==='GET'&&action==='support_ticket_detail'){
      const ticketId=positiveInt(req.query?.ticket_id,0);if(!ticketId)return res.status(400).json({error:'Valid support ticket required'});
      const rows=await sql`SELECT t.*,c.company_name,c.company_code,cu.full_name created_by,ba.full_name assigned_admin
        FROM support_tickets t JOIN companies c ON c.id=t.company_id
        LEFT JOIN company_users cu ON cu.id=t.created_by_user_id AND cu.company_id=t.company_id
        LEFT JOIN bizora_admins ba ON ba.id=t.assigned_admin_id WHERE t.id=${ticketId} LIMIT 1`;
      if(!rows[0])return res.status(404).json({error:'Support ticket not found'});
      const messages=await sql`SELECT m.id,m.sender_type,m.message,m.created_at,cu.full_name company_user,ba.full_name admin_name
        FROM support_messages m LEFT JOIN company_users cu ON cu.id=m.sender_company_user_id AND cu.company_id=m.company_id
        LEFT JOIN bizora_admins ba ON ba.id=m.sender_admin_id WHERE m.ticket_id=${ticketId} AND m.company_id=${rows[0].company_id} ORDER BY m.created_at,m.id`;
      return res.status(200).json({record:rows[0],messages});
    }

    if(req.method==='POST'&&action==='create_company'){
      const name=clean(b.company_name),planCode=clean(b.plan_code||'standard').toLowerCase();
      const code=await nextCompanyCode(sql,name);
      const adminName=clean(b.admin_name),adminEmail=clean(b.admin_email).toLowerCase(),adminPassword=String(b.admin_password||'');
      const months=Math.min(36,positiveInt(b.months,1));
      if(!name)return res.status(400).json({error:'Company name required'});
      if(!adminName||!adminEmail||adminPassword.length<8)return res.status(400).json({error:'Company Admin name, email and 8+ character password required'});
      const passHash=hashPassword(adminPassword);
      const rows=await sql`WITH p AS(
          SELECT * FROM plans WHERE plan_code=${planCode} AND active=true LIMIT 1
        ), c AS(
          INSERT INTO companies(company_code,company_name,status)
          SELECT ${code},${name},'active' WHERE EXISTS(SELECT 1 FROM p)
          RETURNING *
        ), s AS(
          INSERT INTO subscriptions(company_id,plan_id,starts_on,expires_on,status,amount,billing_cycle)
          SELECT c.id,p.id,CURRENT_DATE,(CURRENT_DATE + make_interval(months=>${months}))::date,'active',
            CASE WHEN ${months}>=12 THEN p.yearly_price ELSE p.monthly_price*${months} END,
            CASE WHEN ${months}>=12 THEN 'yearly' ELSE 'monthly' END
          FROM c,p RETURNING *
        ), u AS(
          INSERT INTO company_users(company_id,user_code,full_name,email,password_hash,role)
          SELECT c.id,'ADMIN001',${adminName},${adminEmail},${passHash},'company_admin' FROM c
          RETURNING id,company_id,user_code,full_name,email,role
        ), w AS(
          INSERT INTO erp_warehouses(company_id,warehouse_code,warehouse_name,created_by_user_id)
          SELECT c.id,'MAIN','Main Warehouse',u.id FROM c,u
          RETURNING id,company_id
        )
        SELECT c.id,c.company_code,c.company_name,c.status,s.id subscription_id,s.starts_on,s.expires_on,u.id company_admin_id,w.id warehouse_id
        FROM c JOIN s ON s.company_id=c.id JOIN u ON u.company_id=c.id JOIN w ON w.company_id=c.id`;
      if(!rows[0])return res.status(400).json({error:'Subscription plan not found'});
      await audit(sql,admin.id,'COMPANY_CREATED',{companyId:rows[0].id,entityType:'company',entityId:String(rows[0].id),metadata:{plan_code:planCode,months}});
      return res.status(201).json({company:rows[0]});
    }

    if(req.method==='POST'&&action==='renew_subscription'){
      const companyId=positiveInt(b.company_id,0),planCode=clean(b.plan_code||'standard').toLowerCase(),months=Math.min(36,positiveInt(b.months,1));
      if(!companyId)return res.status(400).json({error:'Company required'});
      const rows=await sql`WITH p AS(
          SELECT * FROM plans WHERE plan_code=${planCode} AND active=true LIMIT 1
        ), old AS(
          UPDATE subscriptions SET status='expired' WHERE company_id=${companyId} AND status='active' AND expires_on<CURRENT_DATE RETURNING id
        ), last AS(
          SELECT GREATEST(CURRENT_DATE,COALESCE(MAX(expires_on),CURRENT_DATE)) base_date FROM subscriptions WHERE company_id=${companyId} AND status IN('active','trial')
        )
        INSERT INTO subscriptions(company_id,plan_id,starts_on,expires_on,status,amount,billing_cycle)
        SELECT ${companyId},p.id,last.base_date,(last.base_date+make_interval(months=>${months}))::date,'active',
          CASE WHEN ${months}>=12 THEN p.yearly_price ELSE p.monthly_price*${months} END,
          CASE WHEN ${months}>=12 THEN 'yearly' ELSE 'monthly' END
        FROM p,last WHERE EXISTS(SELECT 1 FROM companies WHERE id=${companyId})
        RETURNING *`;
      if(!rows[0])return res.status(404).json({error:'Company or plan not found'});
      await audit(sql,admin.id,'SUBSCRIPTION_RENEWED',{companyId,entityType:'subscription',entityId:String(rows[0].id),metadata:{plan_code:planCode,months}});
      return res.status(201).json({subscription:rows[0]});
    }

    if(req.method==='POST'&&action==='set_audit_price'){
      const planCode=clean(b.plan_code).toLowerCase(),price=Number(b.per_audit_price);
      if(!planCode||!Number.isFinite(price)||price<=0)return res.status(400).json({error:'Valid plan and per-audit price required'});
      const rows=await sql`INSERT INTO audit_service_prices(plan_id,per_audit_price,active,updated_at)
        SELECT p.id,${price},true,now() FROM plans p WHERE p.plan_code=${planCode}
        ON CONFLICT(plan_id) DO UPDATE SET per_audit_price=EXCLUDED.per_audit_price,active=true,updated_at=now()
        RETURNING *`;
      if(!rows[0])return res.status(404).json({error:'Plan not found'});
      await audit(sql,admin.id,'AUDIT_PRICE_UPDATED',{entityType:'audit_service_price',entityId:String(rows[0].id),metadata:{plan_code:planCode,per_audit_price:price}});
      return res.status(200).json({audit_price:rows[0]});
    }

    if(req.method==='POST'&&action==='review_audit_request'){
      const requestId=positiveInt(b.request_id,0),decision=clean(b.decision).toLowerCase();
      if(!requestId||!['approve','reject'].includes(decision))return res.status(400).json({error:'Valid audit request and decision required'});
      const rows=await sql`UPDATE audit_requests SET
        payment_status=${decision==='approve'?'verified':'rejected'},
        status=${decision==='approve'?'approved':'rejected'},
        reviewed_by_admin_id=${admin.id},reviewed_at=now(),
        notes=COALESCE(${clean(b.notes)||null},notes)
        WHERE id=${requestId}
        RETURNING *`;
      if(!rows[0])return res.status(404).json({error:'Audit request not found'});
      await audit(sql,admin.id,decision==='approve'?'AUDIT_REQUEST_APPROVED':'AUDIT_REQUEST_REJECTED',{companyId:rows[0].company_id,entityType:'audit_request',entityId:String(requestId),metadata:{price:rows[0].price}});
      return res.status(200).json({audit_request:rows[0]});
    }

    if(req.method==='POST'&&action==='reply_support_ticket'){
      const ticketId=positiveInt(b.ticket_id,0),message=String(b.message||'').trim().slice(0,10000);
      if(!ticketId||!message)return res.status(400).json({error:'Ticket and reply message required'});
      const t=await sql`SELECT id,company_id,status FROM support_tickets WHERE id=${ticketId} LIMIT 1`;if(!t[0])return res.status(404).json({error:'Support ticket not found'});
      if(t[0].status==='closed')return res.status(409).json({error:'Closed support ticket cannot receive replies'});
      await sql`INSERT INTO support_messages(company_id,ticket_id,sender_type,sender_admin_id,message) VALUES(${t[0].company_id},${ticketId},'admin',${admin.id},${message})`;
      const rows=await sql`UPDATE support_tickets SET assigned_admin_id=COALESCE(assigned_admin_id,${admin.id}),status='waiting_company',last_message_at=now(),updated_at=now() WHERE id=${ticketId} RETURNING *`;
      await audit(sql,admin.id,'SUPPORT_ADMIN_REPLIED',{companyId:t[0].company_id,entityType:'support_ticket',entityId:String(ticketId)});
      return res.status(200).json({record:rows[0]});
    }
    if(req.method==='POST'&&action==='set_support_ticket_status'){
      const ticketId=positiveInt(b.ticket_id,0),status=clean(b.status).toLowerCase();
      if(!ticketId||!['open','in_progress','waiting_company','resolved','closed'].includes(status))return res.status(400).json({error:'Valid support ticket and status required'});
      const rows=await sql`UPDATE support_tickets SET status=${status},assigned_admin_id=COALESCE(assigned_admin_id,${admin.id}),updated_at=now() WHERE id=${ticketId} RETURNING *`;
      if(!rows[0])return res.status(404).json({error:'Support ticket not found'});
      await audit(sql,admin.id,'SUPPORT_STATUS_CHANGED',{companyId:rows[0].company_id,entityType:'support_ticket',entityId:String(ticketId),metadata:{status}});
      return res.status(200).json({record:rows[0]});
    }

    if(req.method==='POST'&&action==='set_company_status'){
      const companyId=positiveInt(b.company_id,0),status=clean(b.status).toLowerCase();
      if(!companyId||!['active','suspended','trial','closed'].includes(status))return res.status(400).json({error:'Valid company and status required'});
      const rows=await sql`UPDATE companies SET status=${status},updated_at=now() WHERE id=${companyId} RETURNING id,company_code,company_name,status`;
      if(!rows[0])return res.status(404).json({error:'Company not found'});
      await audit(sql,admin.id,'COMPANY_STATUS_CHANGED',{companyId,entityType:'company',entityId:String(companyId),metadata:{status}});
      return res.status(200).json({company:rows[0]});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('Bizora admin error',e);
    const msg=String(e.message||'Bizora admin failed');
    const status=e.statusCode||(/unique|duplicate/i.test(msg)?409:500);
    return res.status(status).json({error:status===409?'Company code or user already exists':msg});
  }
}
