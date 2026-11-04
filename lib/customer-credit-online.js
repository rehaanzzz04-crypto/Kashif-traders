import crypto from 'node:crypto';
export const newStatementToken=()=>crypto.randomBytes(32).toString('hex');
export const statementTokenHash=t=>crypto.createHash('sha256').update(t).digest('hex');
export const validStatementToken=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
export async function ensureCreditStatementLinks(sql){
 await sql`CREATE TABLE IF NOT EXISTS customer_credit_statement_links (
 token_hash TEXT PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customer_credit_accounts(id),
 from_date DATE, to_date DATE, expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
}

export async function createCreditStatementLink(sql,id,from='',to=''){
 await ensureCreditStatementLinks(sql);
 const token=newStatementToken(),hash=statementTokenHash(token);
 await sql`INSERT INTO customer_credit_statement_links(token_hash,customer_id,from_date,to_date,expires_at)
 VALUES(${hash},${id},${from||null}::date,${to||null}::date,now()+interval '30 days')`;
 const domain=process.env.VERCEL_BRANCH_URL||process.env.VERCEL_URL;
 if(!domain)throw Error('Statement host is not configured');
 return 'https://'+domain+'/customer-credit-online.html?token='+token;
}
export async function revokeCreditStatementLinks(sql,id){
 await ensureCreditStatementLinks(sql);
 const result=await sql`UPDATE customer_credit_statement_links SET revoked_at=now()
 WHERE customer_id=${id} AND revoked_at IS NULL AND expires_at>now() RETURNING token_hash`;
 return result.length;
}

export async function findCreditStatementLink(sql,token){
 if(!validStatementToken(token))return null;
 const hash=statementTokenHash(token);
 const [record]=await sql`SELECT customer_id,from_date::text AS from_date,to_date::text AS to_date,expires_at
 FROM customer_credit_statement_links
 WHERE token_hash=${hash} AND revoked_at IS NULL AND expires_at>now() LIMIT 1`;
 return record||null;
}
