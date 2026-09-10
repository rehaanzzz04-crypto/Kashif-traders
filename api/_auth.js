import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export const ROLE_ACCESS={
  admin:['dashboard','employees','suppliers','supplier-bills','supplier-payments','clients','client-sales','client-receipts','products','goods-receiving','inventory-ledger','warehouses','warehouse-stock','stock-transfer','stock-adjustment','documents','search','reports','settings'],
  manager:['dashboard','suppliers','supplier-bills','supplier-payments','clients','client-sales','client-receipts','products','goods-receiving','inventory-ledger','warehouses','warehouse-stock','stock-transfer','stock-adjustment','documents','search','reports'],
  accountant:['dashboard','suppliers','supplier-bills','supplier-payments','clients','client-sales','client-receipts','documents','search','reports'],
  salesman:['dashboard','clients','client-sales','client-receipts','products','search']
};

export function db(){
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return neon(url);
}

export function cleanText(v){return v===undefined||v===null||String(v).trim()===''?null:String(v).trim();}
export function bodyOf(req){if(!req.body)return{};if(typeof req.body==='string'){try{return JSON.parse(req.body);}catch{return{};}}return req.body;}
export function employeePrefix(role){return ({admin:'ADM',manager:'MGR',accountant:'ACC',salesman:'SAL'})[role]||'EMP';}
export function hashPin(pin,salt){return crypto.scryptSync(String(pin),salt,64).toString('hex');}
export function newSalt(){return crypto.randomBytes(16).toString('hex');}
export function newToken(){return crypto.randomBytes(32).toString('hex');}
export function hashToken(token){return crypto.createHash('sha256').update(token).digest('hex');}

function cookieValue(req,name){
  const raw=String(req.headers?.cookie||'');
  const hit=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return hit?decodeURIComponent(hit.slice(name.length+1)):null;
}

export function setSessionCookie(res,token){
  const maxAge=60*60*12;
  res.setHeader('Set-Cookie',`kt_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`);
}
export function clearSessionCookie(res){res.setHeader('Set-Cookie','kt_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0');}

export async function getSessionUser(req,sql=db()){
  const token=cookieValue(req,'kt_session');
  if(!token)return null;
  const tokenHash=hashToken(token);
  const rows=await sql`SELECT e.id,e.employee_code,e.full_name,e.mobile_number,e.designation,e.status,e.last_login_at
    FROM employee_sessions s JOIN employees e ON e.id=s.employee_id
    WHERE s.token_hash=${tokenHash} AND s.expires_at>now() AND e.status='active' LIMIT 1`;
  if(!rows[0])return null;
  await sql`UPDATE employee_sessions SET last_seen_at=now() WHERE token_hash=${tokenHash}`;
  return rows[0];
}

export function canAccess(role,view){return Boolean(ROLE_ACCESS[role]?.includes(view));}
export async function requireUser(req,res,view=null){
  const sql=db();
  const user=await getSessionUser(req,sql);
  if(!user){res.status(401).json({error:'Authentication required'});return null;}
  if(view&&!canAccess(user.designation,view)){res.status(403).json({error:'Access denied'});return null;}
  return {sql,user};
}
