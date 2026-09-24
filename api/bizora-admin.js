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
  const [stats,companies,plans]=await Promise.all([
    sql`SELECT
      (SELECT COUNT(*) FROM companies)::int companies,
      (SELECT COUNT(*) FROM companies WHERE status='active')::int active_companies,
      (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND expires_on>=CURRENT_DATE)::int active_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '14 days')::int expiring_14_days`,
    sql`SELECT c.id,c.company_code,c.company_name,c.logo_url,c.status,c.created_at,
      s.id subscription_id,s.status subscription_status,s.starts_on,s.expires_on,s.billing_cycle,s.amount,
      p.id plan_id,p.plan_code,p.plan_name
      FROM companies c
      LEFT JOIN LATERAL(
        SELECT * FROM subscriptions x WHERE x.company_id=c.id ORDER BY x.expires_on DESC,x.id DESC LIMIT 1
      ) s ON true
      LEFT JOIN plans p ON p.id=s.plan_id
      ORDER BY c.created_at DESC,c.id DESC LIMIT 200`,
    sql`SELECT id,plan_code,plan_name,monthly_price,yearly_price,user_limit,warehouse_limit,features,active FROM plans ORDER BY monthly_price,id`
  ]);
  return {stats:stats[0]||{},companies,plans};
}

export default async function handler(req,res){
  try{
    const sql=bizoraSql();await ensureBizoraSchema(sql);
    const admin=requireSuperAdmin(req,res);if(!admin)return;
    const b=body(req),action=clean(req.query?.action||b.action||'overview');

    if(req.method==='GET'&&action==='overview')return res.status(200).json(await overview(sql));

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
