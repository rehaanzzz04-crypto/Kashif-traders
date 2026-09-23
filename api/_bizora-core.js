import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ADMIN_COOKIE='bizora_session';
const COMPANY_COOKIE='bizora_company_session';
const HOURS=12;
const enc=v=>Buffer.from(v).toString('base64url');
const dec=v=>Buffer.from(v,'base64url').toString('utf8');

export function bizoraSql(){
  const url=process.env.BIZORA_DATABASE_URL;
  if(!url){const e=new Error('Bizora SaaS database is not connected');e.statusCode=503;throw e}
  return neon(url);
}

function secret(){
  const s=String(process.env.BIZORA_SESSION_SECRET||'');
  if(s.length<32){const e=new Error('BIZORA_SESSION_SECRET is not configured');e.statusCode=503;throw e}
  return s;
}

export function hashPassword(password){
  const salt=crypto.randomBytes(18).toString('hex'),iterations=160000;
  const hash=crypto.pbkdf2Sync(String(password),salt,iterations,32,'sha256').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}
export function verifyPassword(password,stored){
  const [kind,it,salt,want]=String(stored||'').split('$');
  if(kind!=='pbkdf2'||!it||!salt||!want)return false;
  const got=crypto.pbkdf2Sync(String(password),salt,Number(it),32,'sha256').toString('hex');
  try{return crypto.timingSafeEqual(Buffer.from(got,'hex'),Buffer.from(want,'hex'))}catch{return false}
}
function sign(payload){
  const body=enc(JSON.stringify(payload));
  const sig=crypto.createHmac('sha256',secret()).update(body).digest('base64url');
  return body+'.'+sig;
}
function verify(token){
  const [body,sig]=String(token||'').split('.');
  if(!body||!sig)return null;
  const want=crypto.createHmac('sha256',secret()).update(body).digest('base64url');
  try{if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(want)))return null}catch{return null}
  try{const p=JSON.parse(dec(body));if(!p?.exp||Date.now()>p.exp)return null;return p}catch{return null}
}
function cookieValue(req,name){
  const raw=String(req.headers?.cookie||'');
  for(const part of raw.split(';')){const i=part.indexOf('=');if(i<0)continue;if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim())}
  return '';
}
function setCookie(res,name,payload){
  const token=sign(payload);
  res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${HOURS*3600}`);
}
function clearCookie(res,name){res.setHeader('Set-Cookie',`${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)}

export function setSession(res,admin){setCookie(res,ADMIN_COOKIE,{id:admin.id,email:admin.email,name:admin.full_name,role:'super_admin',exp:Date.now()+HOURS*3600000})}
export function clearSession(res){clearCookie(res,ADMIN_COOKIE)}
export function session(req){return verify(cookieValue(req,ADMIN_COOKIE))}
export function requireSuperAdmin(req,res){const s=session(req);if(!s||s.role!=='super_admin'){res.status(401).json({error:'Super Admin login required'});return null}return s}

export function setCompanySession(res,user){setCookie(res,COMPANY_COOKIE,{user_id:user.id,company_id:user.company_id,role:user.role,exp:Date.now()+HOURS*3600000})}
export function clearCompanySession(res){clearCookie(res,COMPANY_COOKIE)}
export function companySession(req){return verify(cookieValue(req,COMPANY_COOKIE))}

export function body(req){if(!req.body)return{};if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{return{}}}return req.body}
export const clean=v=>String(v??'').trim();
export const positiveInt=(v,fallback=1)=>{const n=Math.trunc(Number(v));return Number.isFinite(n)&&n>0?n:fallback};

export async function ensureBizoraSchema(sql){
  await sql`CREATE TABLE IF NOT EXISTS bizora_admins(
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS companies(
    id BIGSERIAL PRIMARY KEY,
    company_code TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','trial','closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS plans(
    id BIGSERIAL PRIMARY KEY,
    plan_code TEXT NOT NULL UNIQUE,
    plan_name TEXT NOT NULL,
    monthly_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    yearly_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    user_limit INT,
    warehouse_limit INT,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS subscriptions(
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    starts_on DATE NOT NULL,
    expires_on DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trial','active','expired','suspended','cancelled')),
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','yearly','custom')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS company_users(
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    user_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'company_admin',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    UNIQUE(company_id,user_code)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS erp_warehouses(
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    warehouse_code TEXT NOT NULL,
    warehouse_name TEXT NOT NULL,
    address TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id,warehouse_code)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS erp_suppliers(
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    supplier_code TEXT NOT NULL,
    business_name TEXT NOT NULL,
    contact_person TEXT,
    mobile_number TEXT,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id,supplier_code)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS erp_clients(
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    client_code TEXT NOT NULL,
    business_name TEXT NOT NULL,
    contact_person TEXT,
    mobile_number TEXT,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id,client_code)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS erp_products(
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sku TEXT NOT NULL,
    barcode TEXT,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id,sku),
    UNIQUE(company_id,barcode)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS audit_events(
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT,
    actor_admin_id BIGINT REFERENCES bizora_admins(id) ON DELETE SET NULL,
    actor_company_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE company_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`;
  await sql`ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_company_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS subscriptions_company_idx ON subscriptions(company_id,expires_on DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS company_users_company_idx ON company_users(company_id,active)`;
  await sql`CREATE INDEX IF NOT EXISTS erp_warehouses_company_idx ON erp_warehouses(company_id,active)`;
  await sql`CREATE INDEX IF NOT EXISTS erp_suppliers_company_idx ON erp_suppliers(company_id,status)`;
  await sql`CREATE INDEX IF NOT EXISTS erp_clients_company_idx ON erp_clients(company_id,status)`;
  await sql`CREATE INDEX IF NOT EXISTS erp_products_company_idx ON erp_products(company_id,active)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_events_company_idx ON audit_events(company_id,created_at DESC)`;

  const planCount=await sql`SELECT COUNT(*)::int count FROM plans`;
  if(!Number(planCount[0]?.count||0)){
    await sql`INSERT INTO plans(plan_code,plan_name,monthly_price,yearly_price,user_limit,warehouse_limit,features) VALUES
      ('basic','Basic',2000,20000,3,1,'{"core_erp":true,"audit_reports":false,"ecommerce":false}'::jsonb),
      ('standard','Standard',5000,50000,10,5,'{"core_erp":true,"audit_reports":true,"ecommerce":true}'::jsonb),
      ('premium','Premium',10000,100000,NULL,NULL,'{"core_erp":true,"audit_reports":true,"ecommerce":true,"priority_support":true}'::jsonb)
      ON CONFLICT(plan_code) DO NOTHING`;
  }

  const adminCount=await sql`SELECT COUNT(*)::int count FROM bizora_admins`;
  if(!Number(adminCount[0]?.count||0)){
    const email=clean(process.env.BIZORA_BOOTSTRAP_EMAIL).toLowerCase(),password=String(process.env.BIZORA_BOOTSTRAP_PASSWORD||'');
    if(email&&password.length>=10){
      await sql`INSERT INTO bizora_admins(email,full_name,password_hash) VALUES(${email},'Bizora Super Admin',${hashPassword(password)}) ON CONFLICT(email) DO NOTHING`;
    }
  }
}

export async function getCompanyAccess(sql,req){
  const s=companySession(req);
  if(!s?.user_id||!s?.company_id)return null;
  const rows=await sql`SELECT
      u.id,u.company_id,u.user_code,u.full_name,u.email,u.role,u.active,
      c.company_code,c.company_name,c.logo_url,c.status company_status,
      sub.id subscription_id,sub.status subscription_status,sub.starts_on,sub.expires_on,
      p.id plan_id,p.plan_code,p.plan_name,p.user_limit,p.warehouse_limit,p.features
    FROM company_users u
    JOIN companies c ON c.id=u.company_id
    LEFT JOIN LATERAL(
      SELECT * FROM subscriptions s
      WHERE s.company_id=c.id
      ORDER BY s.expires_on DESC,s.id DESC LIMIT 1
    ) sub ON true
    LEFT JOIN plans p ON p.id=sub.plan_id
    WHERE u.id=${s.user_id} AND u.company_id=${s.company_id}
    LIMIT 1`;
  const u=rows[0];
  if(!u?.active)return null;
  const blocked=['suspended','closed'].includes(String(u.company_status));
  const subValid=['active','trial'].includes(String(u.subscription_status))&&u.expires_on&&new Date(String(u.expires_on).slice(0,10)+'T23:59:59Z').getTime()>=Date.now();
  const access_mode=blocked?'blocked':subValid?'write':'read_only';
  return {...u,access_mode};
}

export async function requireCompanyUser(sql,req,res,{write=false}={}){
  const u=await getCompanyAccess(sql,req);
  if(!u){res.status(401).json({error:'Company login required'});return null}
  if(u.access_mode==='blocked'){res.status(403).json({error:'Company workspace is suspended'});return null}
  if(write&&u.access_mode!=='write'){res.status(403).json({error:'Subscription expired — workspace is read-only until renewal'});return null}
  return u;
}

export async function audit(sql,adminId,eventType,{companyId=null,entityType=null,entityId=null,metadata={}}={}){
  try{await sql`INSERT INTO audit_events(company_id,actor_admin_id,event_type,entity_type,entity_id,metadata) VALUES(${companyId},${adminId},${eventType},${entityType},${entityId},${JSON.stringify(metadata)}::jsonb)`}catch(e){console.error('Bizora audit event failed',e)}
}
export async function companyAudit(sql,user,eventType,{entityType=null,entityId=null,metadata={}}={}){
  try{await sql`INSERT INTO audit_events(company_id,actor_company_user_id,event_type,entity_type,entity_id,metadata) VALUES(${user.company_id},${user.id},${eventType},${entityType},${entityId},${JSON.stringify(metadata)}::jsonb)`}catch(e){console.error('Bizora company audit failed',e)}
}
