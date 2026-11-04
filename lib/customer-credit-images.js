// Isolated Customer Credit original bill image archive.
// Binary images are stored in the customer_credit_bill_images table, not in ERP records.
// Keep images private; the calling API authenticates every read and write.
export const MAX_BILL_IMAGE_BYTES=700000;
export const MAX_BILL_IMAGES=3;

export function validateBillImage(base64){
 if(typeof base64!=='string'||base64.length<24||base64.length>Math.ceil(MAX_BILL_IMAGE_BYTES*4/3)+16||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw Error('Invalid or oversized bill image');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length<24||bytes.length>MAX_BILL_IMAGE_BYTES)throw Error('Bill image must be below 700 KB');
 const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!jpeg&&!webp)throw Error('Only JPEG and WebP bill photos are supported');
 return {bytes,mime:jpeg?'image/jpeg':'image/webp'};
}
export async function ensureBillImageTable(sql){
 await sql`CREATE TABLE IF NOT EXISTS customer_credit_bill_images(
  id BIGSERIAL PRIMARY KEY,
  bill_id BIGINT NOT NULL REFERENCES customer_credit_entries(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customer_credit_accounts(id),
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 24 AND 700000),
  file_data BYTEA NOT NULL,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bill_id,slot)
 )`;
 await sql`CREATE INDEX IF NOT EXISTS cc_bill_images_customer_idx ON customer_credit_bill_images(customer_id,bill_id)`;
}
export async function getCreditBill(sql,billId){
 const [bill]=await sql`SELECT id,customer_id,entry_type,voided_at FROM customer_credit_entries
 WHERE id=${billId} AND entry_type='bill' AND voided_at IS NULL LIMIT 1`;
 return bill||null;
}
export async function listCreditBillImages(sql,billId){
 return sql`SELECT id,bill_id,slot,original_name,mime_type,byte_size,created_at
 FROM customer_credit_bill_images WHERE bill_id=${billId} ORDER BY slot`;
}
export async function addCreditBillImage(sql,{billId,customerId,base64,filename,actorId}){
 const {bytes,mime}=validateBillImage(base64);
 const cleanName=String(filename||'Original Bill').replace(/[^\p{L}\p{N}_. -]/gu,'').slice(0,100)||'Original Bill';
 const [saved]=await sql`WITH available AS (
 SELECT s.slot FROM generate_series(1,3) AS s(slot)
 WHERE NOT EXISTS(SELECT 1 FROM customer_credit_bill_images i WHERE i.bill_id=${billId} AND i.slot=s.slot)
 ORDER BY s.slot LIMIT 1
 )
 INSERT INTO customer_credit_bill_images(bill_id,customer_id,slot,original_name,mime_type,byte_size,file_data,created_by)
 SELECT b.id,b.customer_id,a.slot,${cleanName},${mime},${bytes.length},decode(${base64},'base64'),${actorId}
 FROM customer_credit_entries b CROSS JOIN available a
 WHERE b.id=${billId} AND b.customer_id=${customerId} AND b.entry_type='bill' AND b.voided_at IS NULL
 RETURNING id,bill_id,slot,original_name,mime_type,byte_size,created_at`;
 return saved||null;
}
export async function getCreditBillImage(sql,imageId){
 const [row]=await sql`SELECT i.id,i.bill_id,i.original_name,i.mime_type,
 encode(i.file_data,'base64') AS content_base64
 FROM customer_credit_bill_images i
 JOIN customer_credit_entries b ON b.id=i.bill_id
 WHERE i.id=${imageId} AND b.entry_type='bill' AND b.voided_at IS NULL
 LIMIT 1`;
 return row||null;
}
export async function removeCreditBillImage(sql,imageId){
 const [removed]=await sql`DELETE FROM customer_credit_bill_images
 WHERE id=${imageId}
 RETURNING id,bill_id,original_name,byte_size`;
 return removed||null;
}
