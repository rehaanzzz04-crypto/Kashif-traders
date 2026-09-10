import { neon } from '@neondatabase/serverless';

const allowed = new Set([
  'suppliers','supplier_invoices','supplier_payments',
  'clients','client_invoices','client_receipts','documents'
]);

function db(){
  const url = process.env.DATABASE_URL;
  if(!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return neon(url);
}

function asId(v){
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function bodyOf(req){
  if(!req.body) return {};
  if(typeof req.body === 'string'){
    try{return JSON.parse(req.body);}catch{return {};}
  }
  return req.body;
}

function cleanText(v){
  if(v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function cleanAmount(v){
  if(v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function list(sql, resource, id){
  if(resource === 'suppliers'){
    if(id) return sql`SELECT * FROM suppliers WHERE id=${id}`;
    return sql`SELECT * FROM suppliers ORDER BY business_name ASC,id ASC`;
  }
  if(resource === 'clients'){
    if(id) return sql`SELECT * FROM clients WHERE id=${id}`;
    return sql`SELECT * FROM clients ORDER BY business_name ASC,id ASC`;
  }
  if(resource === 'supplier_invoices'){
    if(id) return sql`SELECT i.*,s.business_name FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id WHERE i.id=${id}`;
    return sql`SELECT i.*,s.business_name FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id ORDER BY i.invoice_date DESC,i.id DESC`;
  }
  if(resource === 'supplier_payments'){
    if(id) return sql`SELECT p.*,s.business_name FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=${id}`;
    return sql`SELECT p.*,s.business_name FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.payment_date DESC,p.id DESC`;
  }
  if(resource === 'client_invoices'){
    if(id) return sql`SELECT i.*,c.business_name FROM client_invoices i JOIN clients c ON c.id=i.client_id WHERE i.id=${id}`;
    return sql`SELECT i.*,c.business_name FROM client_invoices i JOIN clients c ON c.id=i.client_id ORDER BY i.invoice_date DESC,i.id DESC`;
  }
  if(resource === 'client_receipts'){
    if(id) return sql`SELECT r.*,c.business_name FROM client_receipts r JOIN clients c ON c.id=r.client_id WHERE r.id=${id}`;
    return sql`SELECT r.*,c.business_name FROM client_receipts r JOIN clients c ON c.id=r.client_id ORDER BY r.receipt_date DESC,r.id DESC`;
  }
  if(resource === 'documents'){
    if(id) return sql`SELECT * FROM documents WHERE id=${id}`;
    return sql`SELECT * FROM documents ORDER BY created_at DESC,id DESC`;
  }
  return [];
}

async function create(sql, resource, b){
  if(resource === 'suppliers') return sql`
    INSERT INTO suppliers(business_name,contact_person,mobile_number,whatsapp_number,address,opening_balance,notes,status)
    VALUES(${cleanText(b.business_name)},${cleanText(b.contact_person)},${cleanText(b.mobile_number)},${cleanText(b.whatsapp_number)},${cleanText(b.address)},${cleanAmount(b.opening_balance) ?? 0},${cleanText(b.notes)},${cleanText(b.status) ?? 'active'}) RETURNING *`;
  if(resource === 'clients') return sql`
    INSERT INTO clients(business_name,contact_person,mobile_number,whatsapp_number,address,credit_limit,opening_balance,notes,status)
    VALUES(${cleanText(b.business_name)},${cleanText(b.contact_person)},${cleanText(b.mobile_number)},${cleanText(b.whatsapp_number)},${cleanText(b.address)},${cleanAmount(b.credit_limit)},${cleanAmount(b.opening_balance) ?? 0},${cleanText(b.notes)},${cleanText(b.status) ?? 'active'}) RETURNING *`;
  if(resource === 'supplier_invoices') return sql`
    INSERT INTO supplier_invoices(supplier_id,invoice_number,invoice_date,due_date,amount,notes,attachment_url,status)
    VALUES(${asId(b.supplier_id)},${cleanText(b.invoice_number)},${cleanText(b.invoice_date)},${cleanText(b.due_date)},${cleanAmount(b.amount)},${cleanText(b.notes)},${cleanText(b.attachment_url)},${cleanText(b.status) ?? 'unpaid'}) RETURNING *`;
  if(resource === 'supplier_payments') return sql`
    INSERT INTO supplier_payments(supplier_id,payment_date,amount,payment_method,bank,reference_number,notes,attachment_url)
    VALUES(${asId(b.supplier_id)},${cleanText(b.payment_date)},${cleanAmount(b.amount)},${cleanText(b.payment_method)},${cleanText(b.bank)},${cleanText(b.reference_number)},${cleanText(b.notes)},${cleanText(b.attachment_url)}) RETURNING *`;
  if(resource === 'client_invoices') return sql`
    INSERT INTO client_invoices(client_id,invoice_number,invoice_date,due_date,amount,notes,attachment_url,status)
    VALUES(${asId(b.client_id)},${cleanText(b.invoice_number)},${cleanText(b.invoice_date)},${cleanText(b.due_date)},${cleanAmount(b.amount)},${cleanText(b.notes)},${cleanText(b.attachment_url)},${cleanText(b.status) ?? 'unpaid'}) RETURNING *`;
  if(resource === 'client_receipts') return sql`
    INSERT INTO client_receipts(client_id,receipt_date,amount,payment_method,bank,reference_number,notes,attachment_url)
    VALUES(${asId(b.client_id)},${cleanText(b.receipt_date)},${cleanAmount(b.amount)},${cleanText(b.payment_method)},${cleanText(b.bank)},${cleanText(b.reference_number)},${cleanText(b.notes)},${cleanText(b.attachment_url)}) RETURNING *`;
  if(resource === 'documents') return sql`
    INSERT INTO documents(entity_type,entity_id,document_type,file_url,file_name,mime_type)
    VALUES(${cleanText(b.entity_type)},${asId(b.entity_id)},${cleanText(b.document_type)},${cleanText(b.file_url)},${cleanText(b.file_name)},${cleanText(b.mime_type)}) RETURNING *`;
  return [];
}

async function patch(sql, resource, id, b){
  if(resource === 'suppliers') return sql`UPDATE suppliers SET
    business_name=COALESCE(${cleanText(b.business_name)},business_name),
    contact_person=COALESCE(${cleanText(b.contact_person)},contact_person),
    mobile_number=COALESCE(${cleanText(b.mobile_number)},mobile_number),
    whatsapp_number=COALESCE(${cleanText(b.whatsapp_number)},whatsapp_number),
    address=COALESCE(${cleanText(b.address)},address),
    opening_balance=COALESCE(${cleanAmount(b.opening_balance)},opening_balance),
    notes=COALESCE(${cleanText(b.notes)},notes),status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
  if(resource === 'clients') return sql`UPDATE clients SET
    business_name=COALESCE(${cleanText(b.business_name)},business_name),
    contact_person=COALESCE(${cleanText(b.contact_person)},contact_person),
    mobile_number=COALESCE(${cleanText(b.mobile_number)},mobile_number),
    whatsapp_number=COALESCE(${cleanText(b.whatsapp_number)},whatsapp_number),
    address=COALESCE(${cleanText(b.address)},address),credit_limit=COALESCE(${cleanAmount(b.credit_limit)},credit_limit),
    opening_balance=COALESCE(${cleanAmount(b.opening_balance)},opening_balance),notes=COALESCE(${cleanText(b.notes)},notes),
    status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
  if(resource === 'supplier_invoices') return sql`UPDATE supplier_invoices SET supplier_id=COALESCE(${asId(b.supplier_id)},supplier_id),invoice_number=COALESCE(${cleanText(b.invoice_number)},invoice_number),invoice_date=COALESCE(${cleanText(b.invoice_date)},invoice_date),due_date=COALESCE(${cleanText(b.due_date)},due_date),amount=COALESCE(${cleanAmount(b.amount)},amount),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
  if(resource === 'supplier_payments') return sql`UPDATE supplier_payments SET supplier_id=COALESCE(${asId(b.supplier_id)},supplier_id),payment_date=COALESCE(${cleanText(b.payment_date)},payment_date),amount=COALESCE(${cleanAmount(b.amount)},amount),payment_method=COALESCE(${cleanText(b.payment_method)},payment_method),bank=COALESCE(${cleanText(b.bank)},bank),reference_number=COALESCE(${cleanText(b.reference_number)},reference_number),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),updated_at=now() WHERE id=${id} RETURNING *`;
  if(resource === 'client_invoices') return sql`UPDATE client_invoices SET client_id=COALESCE(${asId(b.client_id)},client_id),invoice_number=COALESCE(${cleanText(b.invoice_number)},invoice_number),invoice_date=COALESCE(${cleanText(b.invoice_date)},invoice_date),due_date=COALESCE(${cleanText(b.due_date)},due_date),amount=COALESCE(${cleanAmount(b.amount)},amount),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),status=COALESCE(${cleanText(b.status)},status),updated_at=now() WHERE id=${id} RETURNING *`;
  if(resource === 'client_receipts') return sql`UPDATE client_receipts SET client_id=COALESCE(${asId(b.client_id)},client_id),receipt_date=COALESCE(${cleanText(b.receipt_date)},receipt_date),amount=COALESCE(${cleanAmount(b.amount)},amount),payment_method=COALESCE(${cleanText(b.payment_method)},payment_method),bank=COALESCE(${cleanText(b.bank)},bank),reference_number=COALESCE(${cleanText(b.reference_number)},reference_number),notes=COALESCE(${cleanText(b.notes)},notes),attachment_url=COALESCE(${cleanText(b.attachment_url)},attachment_url),updated_at=now() WHERE id=${id} RETURNING *`;
  if(resource === 'documents') return sql`UPDATE documents SET
    entity_type=COALESCE(${cleanText(b.entity_type)},entity_type),
    entity_id=COALESCE(${asId(b.entity_id)},entity_id),
    document_type=COALESCE(${cleanText(b.document_type)},document_type),
    file_url=COALESCE(${cleanText(b.file_url)},file_url),
    file_name=COALESCE(${cleanText(b.file_name)},file_name),
    mime_type=COALESCE(${cleanText(b.mime_type)},mime_type)
    WHERE id=${id} RETURNING *`;
  return [];
}

async function remove(sql, resource, id){
  if(resource === 'suppliers') return sql`DELETE FROM suppliers WHERE id=${id} RETURNING id`;
  if(resource === 'supplier_invoices') return sql`DELETE FROM supplier_invoices WHERE id=${id} RETURNING id`;
  if(resource === 'supplier_payments') return sql`DELETE FROM supplier_payments WHERE id=${id} RETURNING id`;
  if(resource === 'clients') return sql`DELETE FROM clients WHERE id=${id} RETURNING id`;
  if(resource === 'client_invoices') return sql`DELETE FROM client_invoices WHERE id=${id} RETURNING id`;
  if(resource === 'client_receipts') return sql`DELETE FROM client_receipts WHERE id=${id} RETURNING id`;
  if(resource === 'documents') return sql`DELETE FROM documents WHERE id=${id} RETURNING id`;
  return [];
}

export default async function handler(req,res){
  const resource = String(req.query?.resource || '').trim();
  if(!allowed.has(resource)) return res.status(400).json({error:'Unknown resource'});
  try{
    const sql = db();
    const id = asId(req.query?.id);
    if(req.method === 'GET') return res.status(200).json({records:await list(sql,resource,id)});
    if(req.method === 'POST'){
      const records = await create(sql,resource,bodyOf(req));
      return res.status(201).json({record:records[0] || null});
    }
    if(req.method === 'PATCH'){
      if(!id) return res.status(400).json({error:'Valid id is required'});
      const records = await patch(sql,resource,id,bodyOf(req));
      return res.status(200).json({record:records[0] || null});
    }
    if(req.method === 'DELETE'){
      if(!id) return res.status(400).json({error:'Valid id is required'});
      const records = await remove(sql,resource,id);
      return res.status(200).json({deleted:Boolean(records[0])});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('Kashif Traders API error',e);
    const msg = e?.message === 'DATABASE_URL_NOT_CONFIGURED' ? 'DATABASE_URL is not configured' : (e?.code === '23505' ? 'Duplicate record' : e?.code === '23503' ? 'This record is linked to other data' : 'Database request failed');
    return res.status(e?.message === 'DATABASE_URL_NOT_CONFIGURED' ? 503 : 500).json({error:msg});
  }
}
