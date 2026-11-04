import { requireUser, bodyOf } from '../api/_auth.js';
import { createCustomerCreditPdf, createCustomerCreditThermalPdf, creditStatementData } from './customer-credit-pdf.js';
import { sendCustomerCreditWhatsApp } from './customer-credit-whatsapp.js';
import { calculateCreditAllocations } from './customer-credit-allocations.js';
import { ensureBillImageTable, MAX_BILL_IMAGES, getCreditBill, listCreditBillImages, addCreditBillImage, getCreditBillImage, removeCreditBillImage } from './customer-credit-images.js';

const MAX_AMOUNT = 999999999999.99;
const safeText = (value, max = 250) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const validDate = value => {
  const s = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
};
const parseAmount = value => {
  const s = String(value ?? '');
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? n : null;
};
const METHODS = new Set(['Cash', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Other']);

async function ensureTables(sql) {
  await sql`CREATE TABLE IF NOT EXISTS customer_credit_accounts (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS customer_credit_entries (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer_credit_accounts(id),
    entry_type TEXT NOT NULL CHECK(entry_type IN ('bill','payment')),
    entry_date DATE NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
    bill_no TEXT,
    payment_method TEXT,
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    voided_at TIMESTAMPTZ,
    voided_by BIGINT
  )`;
  await sql`ALTER TABLE customer_credit_entries ADD COLUMN IF NOT EXISTS allocation_mode TEXT`;
  await sql`ALTER TABLE customer_credit_entries ADD COLUMN IF NOT EXISTS target_bill_id BIGINT`;
  await sql`CREATE INDEX IF NOT EXISTS cc_entries_customer_date_idx ON customer_credit_entries(customer_id,entry_date,id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS cc_unique_bill_no ON customer_credit_entries(customer_id,lower(bill_no)) WHERE entry_type='bill' AND bill_no IS NOT NULL AND voided_at IS NULL`;
  await sql`CREATE TABLE IF NOT EXISTS customer_credit_audit (
    id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES customer_credit_entries(id),
    action TEXT NOT NULL,
    actor_id BIGINT,
    old_record JSONB,
    new_record JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}
async function audit(sql, entryId, action, actorId, before, after) {
  await sql`INSERT INTO customer_credit_audit(entry_id,action,actor_id,old_record,new_record)
    VALUES(${entryId},${action},${actorId},${before ? JSON.stringify(before) : null}::jsonb,${after ? JSON.stringify(after) : null}::jsonb)`;
}
const fail = (res, error, status = 400) => res.status(status).json({ error });
async function allocationSnapshot(sql,customerId,excludeId=null){
 const items=await sql`SELECT id,customer_id,entry_type,entry_date::text,amount,
 bill_no,allocation_mode,target_bill_id,voided_at
 FROM customer_credit_entries WHERE customer_id=${customerId} AND voided_at IS NULL
 ORDER BY entry_date,id`;
 return calculateCreditAllocations(items,{excludeEntryId:excludeId});
}


export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  try {
    const auth = await requireUser(req, res, 'clients');
    if (!auth) return;
    const { sql, user } = auth;
    await ensureTables(sql);
    const action = safeText(req.query?.action, 60);
    if (['bill_images','bill_image'].includes(action) && req.method==='GET') {
      await ensureBillImageTable(sql);
      if(action==='bill_images'){
        const billId=validId(req.query?.bill_id);
        if(!billId)return fail(res,'Valid credit bill required');
        const bill=await getCreditBill(sql,billId);
        if(!bill)return fail(res,'Credit bill not found',404);
        return res.status(200).json({images:await listCreditBillImages(sql,billId),max:MAX_BILL_IMAGES});
      }
      const imageId=validId(req.query?.image_id);
      if(!imageId)return fail(res,'Valid image required');
      const image=await getCreditBillImage(sql,imageId);
      if(!image)return fail(res,'Image not found',404);
      return res.status(200).json({id:image.id,bill_id:image.bill_id,mime_type:image.mime_type,filename:image.original_name,content_base64:image.content_base64});
    }
    if (['bill_image_upload','bill_image_delete'].includes(action) && req.method==='POST') {
      await ensureBillImageTable(sql);
      const input=bodyOf(req);
      if(action==='bill_image_delete'){
        if(user.designation!=='admin')return fail(res,'Admin access required to delete bill photos',403);
        const imageId=validId(input.image_id);
        if(!imageId)return fail(res,'Valid image required');
        const existing=await getCreditBillImage(sql,imageId);
        if(!existing)return fail(res,'Image not found',404);
        const removed=await removeCreditBillImage(sql,imageId);
        return removed?res.status(200).json({ok:true,removed_id:imageId}):fail(res,'Image not found',404);
      }
      const billId=validId(input.bill_id),customerId=validId(input.customer_id);
      if(!billId||!customerId)return fail(res,'Credit bill and customer required');
      const bill=await getCreditBill(sql,billId);
      if(!bill||Number(bill.customer_id)!==customerId)return fail(res,'Bill does not belong to selected customer',404);
      try{
        const image=await addCreditBillImage(sql,{billId,customerId,base64:input.content_base64,
          filename:input.filename,actorId:user.id});
        return image?res.status(201).json({ok:true,image}):fail(res,'This bill already has three images',409);
      }catch(e){
        if(e?.code==='23505')return fail(res,'Image slot already filled. Refresh and retry.',409);
        if(e?.code==='23514')return fail(res,'Image does not meet size limits',400);
        if(e instanceof Error && /image|JPEG|WebP|700 KB/i.test(e.message))return fail(res,e.message,400);
        throw e;
      }
    }

    if (req.method === 'GET' && action === 'customers') {
      const customers = await sql`
        SELECT a.id,a.name,a.mobile,a.notes,a.created_at,
          COALESCE(SUM(e.amount) FILTER (WHERE e.entry_type='bill' AND e.voided_at IS NULL),0)::numeric AS billed,
          COALESCE(SUM(e.amount) FILTER (WHERE e.entry_type='payment' AND e.voided_at IS NULL),0)::numeric AS received,
          COUNT(e.id) FILTER (WHERE e.voided_at IS NULL)::int AS entries
        FROM customer_credit_accounts a LEFT JOIN customer_credit_entries e ON e.customer_id=a.id
        GROUP BY a.id ORDER BY lower(a.name),a.id LIMIT 5000`;
      return res.status(200).json({ customers, can_edit: user.designation === 'admin' });
    }
    if (req.method === 'GET' && action === 'pending_invoices') {
      const customerId=validId(req.query?.customer_id),excludeId=req.query?.exclude_entry_id?validId(req.query.exclude_entry_id):null;
      if(!customerId || (req.query?.exclude_entry_id&&!excludeId))return fail(res,'Valid customer required');
      const [customer]=await sql`SELECT id FROM customer_credit_accounts WHERE id=${customerId}`;
      if(!customer)return fail(res,'Customer not found',404);
      if(excludeId){
        const [editable]=await sql`SELECT id FROM customer_credit_entries
        WHERE id=${excludeId} AND customer_id=${customerId} AND entry_type='payment' AND voided_at IS NULL`;
        if(!editable)return fail(res,'Payment not found for this customer',404);
      }
      const allocation=await allocationSnapshot(sql,customerId,excludeId);
      return res.status(200).json({allocation});
    }
    if (req.method === 'GET' && action === 'statement') {
      const id = validId(req.query?.customer_id);
      if (!id) return fail(res,'Select a valid customer');
      const [customer] = await sql`SELECT id,name,mobile,notes FROM customer_credit_accounts WHERE id=${id}`;
      if (!customer) return fail(res,'Customer not found',404);
      const entries = await sql`SELECT id,customer_id,entry_type,entry_date,amount,bill_no,payment_method,notes,created_at,allocation_mode,target_bill_id
        FROM customer_credit_entries WHERE customer_id=${id} AND voided_at IS NULL
        ORDER BY entry_date,id LIMIT 5001`;
      const [totals] = await sql`SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_type='bill'),0) AS billed,
        COALESCE(SUM(amount) FILTER (WHERE entry_type='payment'),0) AS received,
        COUNT(*)::int AS count
        FROM customer_credit_entries WHERE customer_id=${id} AND voided_at IS NULL`;
      await ensureBillImageTable(sql);
      const imageCounts=await sql`SELECT bill_id,count(*)::int AS count FROM customer_credit_bill_images
        WHERE customer_id=${id} GROUP BY bill_id`;
      const images_by_bill=Object.fromEntries(imageCounts.map(r=>[String(r.bill_id),Number(r.count)]));
      const allocations=await allocationSnapshot(sql,id);
      return res.status(200).json({ customer, entries:entries.slice(0,5000), has_more: entries.length>5000, totals, allocations, images_by_bill, can_edit: user.designation==='admin' });
    }
    if (req.method === 'GET' && (action === 'pdf' || action === 'thermal_pdf')) {
      const id=validId(req.query?.customer_id),from=req.query?.from?validDate(req.query.from):null,to=req.query?.to?validDate(req.query.to):null;
      if(!id || (req.query?.from&&!from)||(req.query?.to&&!to)||(from&&to&&from>to))return fail(res,'Valid customer and date range required');
      const [customer]=await sql`SELECT id,name,mobile FROM customer_credit_accounts WHERE id=${id}`;
      if(!customer)return fail(res,'Customer not found',404);
      const entries=await sql`SELECT id,entry_type,entry_date::text,amount,bill_no,payment_method,notes
        FROM customer_credit_entries WHERE customer_id=${id} AND voided_at IS NULL
        ORDER BY entry_date,id LIMIT 10001`;
      if(entries.length>10000)return fail(res,'Statement exceeds 10,000 entries. Contact admin to export in parts.',413);
      const data=creditStatementData(entries,from||'',to||'');
      const pdf=action==='thermal_pdf' ? await createCustomerCreditThermalPdf(customer,data,{from:from||'',to:to||''}) : await createCustomerCreditPdf(customer,data,{from:from||'',to:to||''});
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition','attachment; filename="'+pdf.filename+'"');
      return res.status(200).send(pdf.buffer);
    }
    if (req.method !== 'POST') return fail(res,'Method not allowed',405);
    const body=bodyOf(req);
    if (action === 'send_whatsapp') {
      const id=validId(body.customer_id),from=body.from?validDate(body.from):null,to=body.to?validDate(body.to):null;
      if(!id||(body.from&&!from)||(body.to&&!to)||(from&&to&&from>to))return fail(res,'Valid customer/date range required');
      const [customer]=await sql`SELECT id,name,mobile FROM customer_credit_accounts WHERE id=${id}`;
      if(!customer)return fail(res,'Customer not found',404);
      const entries=await sql`SELECT id,entry_type,entry_date::text,amount,bill_no,payment_method,notes
        FROM customer_credit_entries WHERE customer_id=${id} AND voided_at IS NULL
        ORDER BY entry_date,id LIMIT 10001`;
      if(entries.length>10000)return fail(res,'Statement too long. Select a shorter date range.',413);
      const data=creditStatementData(entries,from||'',to||'');
      const pdf=await createCustomerCreditPdf(customer,data,{from:from||'',to:to||''});
      try {const sent=await sendCustomerCreditWhatsApp(customer.mobile,pdf);
        return res.status(200).json(sent);
      }catch(error){
        if(error?.message==='CUSTOMER_CREDIT_WHATSAPP_NOT_CONFIGURED'){
          return fail(res,'Direct WhatsApp Business sending is not configured. Please use device Share PDF instead.',503);
        }
        return fail(res,String(error?.message||'WhatsApp send failed').slice(0,200),422);
      }
    }
    if (action === 'customer') {
      const name=safeText(body.name,120), mobile=safeText(body.mobile,40), notes=safeText(body.notes,500);
      if (!name) return fail(res,'Customer name required');
      const id=body.id ? validId(body.id) : null;
      if (body.id && !id) return fail(res,'Invalid customer ID');
      if (id && user.designation !== 'admin') return fail(res,'Only admin can edit customer details',403);
      const key=name.toLocaleLowerCase('en').replace(/\s+/g,' ').trim();
      const phone=mobile.replace(/\D/g,'').replace(/^0092(?=3\d{9}$)/,'92').replace(/^0(?=3\d{9}$)/,'92').replace(/^(?=3\d{9}$)/,'92');
      const accounts=await sql`SELECT id,name,mobile FROM customer_credit_accounts WHERE id IS DISTINCT FROM ${id} ORDER BY id`;
      const same=accounts.find(c=>c.name.toLocaleLowerCase('en').replace(/\s+/g,' ').trim()===key || (phone && String(c.mobile||'').replace(/\D/g,'').replace(/^0092(?=3\d{9}$)/,'92').replace(/^0(?=3\d{9}$)/,'92').replace(/^(?=3\d{9}$)/,'92')===phone));
      if (same) return res.status(409).json({
        error:'Customer already exists with this name or phone number.',
        existing_customer:{id:same.id,name:same.name,mobile:same.mobile}
      });
      if (id) {
        const [row]=await sql`UPDATE customer_credit_accounts SET name=${name},mobile=${mobile||null},
          notes=${notes||null},updated_at=now() WHERE id=${id} RETURNING id,name,mobile,notes`;
        return row ? res.status(200).json({ok:true,customer:row}) : fail(res,'Customer not found',404);
      }
      const [row]=await sql`INSERT INTO customer_credit_accounts(name,mobile,notes)
        VALUES(${name},${mobile||null},${notes||null}) RETURNING id,name,mobile,notes`;
      return res.status(201).json({ok:true,customer:row});
    }
    if (action === 'entry') {
      const id=body.id ? validId(body.id) : null;
      if (body.id && !id) return fail(res,'Invalid entry ID');
      if (id && user.designation !== 'admin') return fail(res,'Only admin can edit credit records',403);
      const customerId=validId(body.customer_id), type=safeText(body.entry_type,20);
      const date=validDate(body.entry_date), amount=parseAmount(body.amount);
      const billNo=safeText(body.bill_no,80) || null;
      const method=safeText(body.payment_method,40);
      const notes=safeText(body.notes,1000)||null;
      if (!customerId || !['bill','payment'].includes(type) || !date || amount===null) return fail(res,'Customer, valid date, type and positive amount required');
      if (type==='payment' && !METHODS.has(method)) return fail(res,'Select payment method');
      const mode=type==='payment' && body.allocation_mode==='invoice'?'invoice':'auto';
      const targetId=mode==='invoice'?validId(body.target_bill_id):null;
      if(type==='payment'&&mode==='invoice'&&!targetId)return fail(res,'Select a pending invoice');
      if(type==='payment'&&mode==='invoice'){
        const snapshot=await allocationSnapshot(sql,customerId,id);
        const target=snapshot.pending_bills.find(b=>b.id===targetId);
        if(!target)return fail(res,'Selected invoice is already paid or not found',409);
        if(Math.round(amount*100)>Math.round(target.due*100))return fail(res,'Payment exceeds selected invoice outstanding amount',409);
      }

      const [customer]=await sql`SELECT id FROM customer_credit_accounts WHERE id=${customerId}`;
      if (!customer) return fail(res,'Customer not found',404);
      const paymentMethod=type==='payment' ? method : null, reference=type==='bill' ? billNo : (billNo || null);
      if (id) {
        const [before]=await sql`SELECT * FROM customer_credit_entries WHERE id=${id} AND voided_at IS NULL`;
        if (!before) return fail(res,'Entry not found',404);
        const [after]=await sql`UPDATE customer_credit_entries SET customer_id=${customerId},entry_type=${type},
          entry_date=${date},amount=${amount},bill_no=${reference},payment_method=${paymentMethod},
          notes=${notes},allocation_mode=${type==='payment'?mode:null},target_bill_id=${type==='payment'?targetId:null},updated_by=${user.id},updated_at=now() WHERE id=${id} AND voided_at IS NULL RETURNING *`;
        await audit(sql,id,'update',user.id,before,after);
        return res.status(200).json({ok:true,entry:after});
      }
      const [row]=await sql`INSERT INTO customer_credit_entries(customer_id,entry_type,entry_date,amount,bill_no,payment_method,notes,created_by,allocation_mode,target_bill_id)
        VALUES(${customerId},${type},${date},${amount},${reference},${paymentMethod},${notes},${user.id},${type==='payment'?mode:null},${type==='payment'?targetId:null}) RETURNING *`;
      await audit(sql,row.id,'create',user.id,null,row);
      return res.status(201).json({ok:true,entry:row});
    }
    if (action === 'void') {
      if (user.designation !== 'admin') return fail(res,'Only admin can void entries',403);
      const id=validId(body.id);
      if (!id) return fail(res,'Invalid entry ID');
      const [before]=await sql`SELECT * FROM customer_credit_entries WHERE id=${id} AND voided_at IS NULL`;
      if (!before) return fail(res,'Entry not found',404);
      const [after]=await sql`UPDATE customer_credit_entries SET voided_at=now(),voided_by=${user.id},updated_by=${user.id},updated_at=now()
        WHERE id=${id} AND voided_at IS NULL RETURNING *`;
      if (!after) return fail(res,'Entry already voided',409);
      await audit(sql,id,'void',user.id,before,after);
      return res.status(200).json({ok:true});
    }
    return fail(res,'Unknown action');
  } catch (e) {
    console.error('Customer Credit API error',e);
    const duplicate=e?.code==='23505';
    return fail(res,duplicate?'This bill number already exists for this customer':e?.message==='DATABASE_URL_NOT_CONFIGURED'?'Database is not configured':'Customer Credit request failed',duplicate?409:500);
  }
}
