const prefixes={
 suppliers:'SUP',clients:'CLI',supplier_invoices:'SINV',supplier_payments:'SPAY',client_invoices:'CINV',client_receipts:'CREC',documents:'DOC',
 warehouses:'WH',products:'PRD',supplier_invoice_items:'SITEM',stock_adjustments:'ADJ',goods_receipts:'GRN',stock_transfers:'TRF',salary_requests:'SALREQ'
};
let ready=false;
export function entryPrefix(resource){return prefixes[resource]||String(resource||'ENT').replace(/[^A-Za-z0-9]/g,'').slice(0,6).toUpperCase()||'ENT'}
export function formatEntryNumber(resource,n){return entryPrefix(resource)+'-'+String(Number(n)||0).padStart(6,'0')}

async function safe(sql,fn){try{await fn()}catch(e){if(!['42P01','42710'].includes(e?.code))throw e}}

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
 await sql`CREATE OR REPLACE FUNCTION kt_assign_entry_number() RETURNS trigger AS $$
 DECLARE rkey text; pfx text; n bigint; code text;
 BEGIN
  rkey:=TG_TABLE_NAME;
  pfx:=CASE rkey
   WHEN 'suppliers' THEN 'SUP' WHEN 'clients' THEN 'CLI' WHEN 'supplier_invoices' THEN 'SINV'
   WHEN 'supplier_payments' THEN 'SPAY' WHEN 'client_invoices' THEN 'CINV' WHEN 'client_receipts' THEN 'CREC'
   WHEN 'documents' THEN 'DOC' WHEN 'warehouses' THEN 'WH' WHEN 'products' THEN 'PRD'
   WHEN 'supplier_invoice_items' THEN 'SITEM' WHEN 'stock_adjustments' THEN 'ADJ'
   WHEN 'goods_receipts' THEN 'GRN' WHEN 'stock_transfers' THEN 'TRF' ELSE upper(substr(rkey,1,6)) END;
  PERFORM pg_advisory_xact_lock(hashtext(rkey));
  IF NOT EXISTS(SELECT 1 FROM erp_entry_numbers WHERE resource_key=rkey AND record_id=NEW.id) THEN
   SELECT COALESCE(MAX(number_value),0)+1 INTO n FROM erp_entry_numbers WHERE resource_key=rkey;
   code:=pfx||'-'||lpad(n::text,6,'0');
   INSERT INTO erp_entry_numbers(resource_key,record_id,number_value,entry_number) VALUES(rkey,NEW.id,n,code);
  END IF;
  RETURN NEW;
 END; $$ LANGUAGE plpgsql`;
 await sql`CREATE OR REPLACE FUNCTION kt_void_entry_number() RETURNS trigger AS $$
 BEGIN
  UPDATE erp_entry_numbers SET status='void',voided_at=now() WHERE resource_key=TG_TABLE_NAME AND record_id=OLD.id AND status<>'void';
  RETURN OLD;
 END; $$ LANGUAGE plpgsql`;
 await sql`CREATE OR REPLACE FUNCTION kt_salary_final_number() RETURNS trigger AS $$
 DECLARE n bigint; code text;
 BEGIN
  IF NEW.status IN ('approved','paid') AND COALESCE(OLD.status,'') NOT IN ('approved','paid') THEN
   PERFORM pg_advisory_xact_lock(hashtext('salary_requests'));
   IF NOT EXISTS(SELECT 1 FROM erp_entry_numbers WHERE resource_key='salary_requests' AND record_id=NEW.id) THEN
    SELECT COALESCE(MAX(number_value),0)+1 INTO n FROM erp_entry_numbers WHERE resource_key='salary_requests';
    code:='SALREQ-'||lpad(n::text,6,'0');
    INSERT INTO erp_entry_numbers(resource_key,record_id,number_value,entry_number) VALUES('salary_requests',NEW.id,n,code);
   END IF;
  END IF;
  RETURN NEW;
 END; $$ LANGUAGE plpgsql`;
 const tables=['suppliers','clients','supplier_invoices','supplier_payments','client_invoices','client_receipts','documents','warehouses','products','supplier_invoice_items','stock_adjustments','goods_receipts','stock_transfers'];
 for(const t of tables){
  await safe(sql,()=>sql.unsafe(`CREATE TRIGGER kt_num_${t} AFTER INSERT ON ${t} FOR EACH ROW EXECUTE FUNCTION kt_assign_entry_number()`));
  await safe(sql,()=>sql.unsafe(`CREATE TRIGGER kt_void_${t} BEFORE DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION kt_void_entry_number()`));
 }
 await safe(sql,()=>sql.unsafe(`CREATE TRIGGER kt_num_salary AFTER UPDATE OF status ON salary_requests FOR EACH ROW EXECUTE FUNCTION kt_salary_final_number()`));
 await safe(sql,()=>sql.unsafe(`CREATE TRIGGER kt_void_salary BEFORE DELETE ON salary_requests FOR EACH ROW EXECUTE FUNCTION kt_void_entry_number()`));
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
export async function attachEntryNumbers(sql,resource,rows,{assignMissing=true}={}){
 if(!Array.isArray(rows)||!rows.length)return rows||[];
 await ensureEntryNumbers(sql);
 const out=[];
 for(const row of rows){
  if(!row?.id){out.push(row);continue;}
  let code=(await sql`SELECT entry_number FROM erp_entry_numbers WHERE resource_key=${resource} AND record_id=${Number(row.id)} LIMIT 1`)[0]?.entry_number;
  if(!code&&assignMissing)code=await assignEntryNumber(sql,resource,row.id);
  out.push({...row,entry_number:code||null});
 }
 return out;
}
export async function voidEntryNumber(sql,resource,recordId){
 await ensureEntryNumbers(sql);
 await sql`UPDATE erp_entry_numbers SET status='void',voided_at=now() WHERE resource_key=${resource} AND record_id=${Number(recordId)} AND status<>'void'`;
}
