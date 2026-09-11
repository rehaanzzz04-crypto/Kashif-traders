const prefixes={
 suppliers:'SUP',clients:'CLI',supplier_invoices:'SINV',supplier_payments:'SPAY',client_invoices:'CINV',client_receipts:'CREC',documents:'DOC',
 warehouses:'WH',products:'PRD',invoice_items:'SITEM',adjustments:'ADJ',grn_post:'GRN',transfer_post:'TRF'
};
let ready=false;
export function entryPrefix(resource){return prefixes[resource]||String(resource||'ENT').replace(/[^A-Za-z0-9]/g,'').slice(0,5).toUpperCase()||'ENT'}
export function formatEntryNumber(resource,n){return entryPrefix(resource)+'-'+String(Number(n)||0).padStart(6,'0')}
export async function ensureEntryNumbers(sql){
 if(ready)return;
 await sql`CREATE TABLE IF NOT EXISTS erp_entry_numbers(
  id BIGSERIAL PRIMARY KEY,
  resource_key TEXT NOT NULL,
  record_id BIGINT NOT NULL,
  number_value BIGINT NOT NULL,
  entry_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  UNIQUE(resource_key,record_id),
  UNIQUE(resource_key,number_value),
  UNIQUE(entry_number)
 )`;
 ready=true;
}
export async function assignEntryNumber(sql,resource,recordId){
 const rid=Number(recordId);if(!Number.isInteger(rid)||rid<=0)return null;
 await ensureEntryNumbers(sql);
 const old=await sql`SELECT entry_number FROM erp_entry_numbers WHERE resource_key=${resource} AND record_id=${rid} LIMIT 1`;
 if(old[0])return old[0].entry_number;
 for(let attempt=0;attempt<5;attempt++){
  const next=await sql`SELECT COALESCE(MAX(number_value),0)::bigint+1 AS n FROM erp_entry_numbers WHERE resource_key=${resource}`;
  const n=Number(next[0]?.n||1),code=formatEntryNumber(resource,n);
  try{
   const rows=await sql`INSERT INTO erp_entry_numbers(resource_key,record_id,number_value,entry_number) VALUES(${resource},${rid},${n},${code}) ON CONFLICT(resource_key,record_id) DO UPDATE SET record_id=EXCLUDED.record_id RETURNING entry_number`;
   return rows[0]?.entry_number||code;
  }catch(e){if(e?.code!=='23505')throw e;}
 }
 throw Error('Could not allocate entry number');
}
export async function attachEntryNumbers(sql,resource,rows){
 if(!Array.isArray(rows)||!rows.length)return rows||[];
 await ensureEntryNumbers(sql);
 const out=[];
 for(const row of rows){
  if(!row?.id){out.push(row);continue;}
  let code=(await sql`SELECT entry_number FROM erp_entry_numbers WHERE resource_key=${resource} AND record_id=${Number(row.id)} LIMIT 1`)[0]?.entry_number;
  if(!code)code=await assignEntryNumber(sql,resource,row.id);
  out.push({...row,entry_number:code});
 }
 return out;
}
export async function voidEntryNumber(sql,resource,recordId){
 await ensureEntryNumbers(sql);
 await sql`UPDATE erp_entry_numbers SET status='void',voided_at=now() WHERE resource_key=${resource} AND record_id=${Number(recordId)} AND status<>'void'`;
}
