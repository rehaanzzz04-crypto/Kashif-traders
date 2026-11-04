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
