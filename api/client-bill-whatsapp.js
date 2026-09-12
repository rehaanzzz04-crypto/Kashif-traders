import { requireUser,bodyOf } from './_auth.js';
import { ensureEntryNumbers,attachEntryNumbers } from './_entry-number.js';
import { sendWhatsAppAttachment,sendWhatsAppText,normalizePhone } from './_whatsapp.js';
import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';

const id=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
const clean=v=>String(v??'').trim();
const money=v=>`PKR ${Number(v||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
const graphVersion=()=>clean(process.env.WHATSAPP_GRAPH_VERSION)||'v23.0';
const graphUrl=path=>`https://graph.facebook.com/${graphVersion()}/${path}`;

async function statement(sql,clientId){
 const parties=await sql`SELECT id,business_name,whatsapp_number,mobile_number,opening_balance FROM clients WHERE id=${clientId}`;const party=parties[0];if(!party)throw Error('CLIENT_NOT_FOUND');
 const bills=await sql`SELECT COALESCE(SUM(amount),0) total FROM client_invoices WHERE client_id=${clientId}`;
 const pays=await sql`SELECT COALESCE(SUM(amount),0) total FROM client_receipts WHERE client_id=${clientId}`;
 const opening=Number(party.opening_balance||0),billTotal=Number(bills[0]?.total||0),payTotal=Number(pays[0]?.total||0),balance=opening+billTotal-payTotal;
 return {party,opening,billTotal,payTotal,balance};
}
function statementText(s,invoiceNo,amount){return `Kashif Traders — Client Bill\nInvoice: ${invoiceNo}\nClient: ${s.party.business_name}\nBill Amount: ${money(amount)}\n\nUpdated Statement\nOpening: ${money(s.opening)}\nBills: ${money(s.billTotal)}\nPayments: ${money(s.payTotal)}\nNew Balance: ${money(s.balance)}`}
async function statementPdf(s,invoiceNo,record){
 const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);let y=790;
 const line=(text,size=11,isBold=false)=>{page.drawText(String(text),{x:48,y,size,font:isBold?bold:font,color:rgb(0.08,0.18,0.15)});y-=size+12};
 line('KASHIF TRADERS',20,true);line('Client Statement',14,true);y-=8;line(`Client: ${s.party.business_name}`,12,true);line(`Invoice: ${invoiceNo}`);line(`Invoice Date: ${record.invoice_date||'-'}`);line(`Due Date: ${record.due_date||'-'}`);line(`Current Bill: ${money(record.amount)}`);y-=12;line('ACCOUNT SUMMARY',12,true);line(`Opening Balance: ${money(s.opening)}`);line(`Total Bills: ${money(s.billTotal)}`);line(`Total Payments: ${money(s.payTotal)}`);line(`Outstanding Balance: ${money(s.balance)}`,13,true);y-=18;line('This statement was generated automatically by Kashif Traders ERP.',9);
 return Buffer.from(await pdf.save());
}
async function sendPdf(to,buf,filename,caption){
 const token=clean(process.env.WHATSAPP_ACCESS_TOKEN),phoneId=clean(process.env.WHATSAPP_PHONE_NUMBER_ID);if(!token||!phoneId)throw Error('WHATSAPP_SEND_NOT_CONFIGURED');
 const form=new FormData();form.append('messaging_product','whatsapp');form.append('type','application/pdf');form.append('file',new Blob([buf],{type:'application/pdf'}),filename);
 const up=await fetch(graphUrl(`${encodeURIComponent(phoneId)}/media`),{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});const uj=await up.json().catch(()=>({}));if(!up.ok||!uj.id)throw Error('WHATSAPP_PDF_UPLOAD_FAILED');
 const r=await fetch(graphUrl(`${encodeURIComponent(phoneId)}/messages`),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:normalizePhone(to),type:'document',document:{id:uj.id,filename,caption:clean(caption).slice(0,1024)}})});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error('WHATSAPP_PDF_SEND_FAILED');return j;
}
async function deliveryTable(sql){await sql`CREATE TABLE IF NOT EXISTS whatsapp_client_bill_delivery (id BIGSERIAL PRIMARY KEY,record_id BIGINT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending',image_sent BOOLEAN NOT NULL DEFAULT false,pdf_sent BOOLEAN NOT NULL DEFAULT false,message_id TEXT,error_message TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const auth=await requireUser(req,res);if(!auth)return;const {sql}=auth,b=bodyOf(req),recordId=id(b.id||b.record_id);if(!recordId)return res.status(400).json({error:'Valid client bill id required'});
  await ensureEntryNumbers(sql);let rows=await sql`SELECT * FROM client_invoices WHERE id=${recordId}`;if(!rows[0])return res.status(404).json({error:'Client bill not found'});const record=(await attachEntryNumbers(sql,'client_invoices',rows))[0],invoiceNo=record.entry_number||record.invoice_number||`CINV-${record.id}`;
  if(!record.invoice_number)await sql`UPDATE client_invoices SET invoice_number=${invoiceNo},updated_at=now() WHERE id=${recordId}`;
  const s=await statement(sql,record.client_id),to=s.party.whatsapp_number||s.party.mobile_number;if(!to)return res.status(422).json({error:'Client WhatsApp number missing'});if(!process.env.WHATSAPP_ACCESS_TOKEN||!process.env.WHATSAPP_PHONE_NUMBER_ID)return res.status(503).json({error:'WhatsApp sending is not configured'});
  await deliveryTable(sql);await sql`INSERT INTO whatsapp_client_bill_delivery(record_id,status) VALUES(${recordId},'pending') ON CONFLICT(record_id) DO UPDATE SET status='pending',error_message=NULL,updated_at=now()`;
  let imageSent=false,pdfSent=false,imageResult=null,pdfResult=null;const text=statementText(s,invoiceNo,record.amount);
  try{if(record.attachment_url){imageResult=await sendWhatsAppAttachment(to,record.attachment_url,`Kashif Traders — Bill ${invoiceNo}`);imageSent=true}const pdf=await statementPdf(s,invoiceNo,record);pdfResult=await sendPdf(to,pdf,`${invoiceNo}-statement.pdf`,`Updated statement — ${s.party.business_name}`);pdfSent=true;await sendWhatsAppText(to,text);const messageId=pdfResult?.messages?.[0]?.id||imageResult?.messages?.[0]?.id||null;await sql`UPDATE whatsapp_client_bill_delivery SET status='sent',image_sent=${imageSent},pdf_sent=${pdfSent},message_id=${messageId},error_message=${record.attachment_url&&!imageSent?'Statement sent; bill image failed':null},updated_at=now() WHERE record_id=${recordId}`;return res.status(200).json({sent:true,image_sent:imageSent,pdf_sent:pdfSent,invoice_number:invoiceNo,new_balance:s.balance});}
  catch(e){await sql`UPDATE whatsapp_client_bill_delivery SET status='failed',image_sent=${imageSent},pdf_sent=${pdfSent},error_message=${String(e?.message||e).slice(0,500)},updated_at=now() WHERE record_id=${recordId}`;throw e}
 }catch(e){console.error('Client bill WhatsApp API error',e);return res.status(502).json({error:e?.message||'Client bill WhatsApp failed'})}
}
