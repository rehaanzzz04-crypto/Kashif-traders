const text=v=>String(v??'').trim();
const allowed=new Set(['supplier_invoices','supplier_payments','client_invoices','client_receipts','documents']);

function baseUrl(){
  const raw=text(process.env.KT_PUBLIC_BASE_URL||process.env.VERCEL_URL||process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if(!raw)return'';
  const normalized=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
  return normalized.replace(/\/+$/,'');
}

export function excelAttachmentLink(resource,id,storedUrl){
  const value=text(storedUrl);
  if(!value)return'';
  if(/^https?:\/\//i.test(value))return value;
  const n=Number(id),base=baseUrl();
  if(!base||!allowed.has(String(resource))||!Number.isInteger(n)||n<=0)return value;
  return `${base}/api/attachment?resource=${encodeURIComponent(resource)}&id=${n}`;
}
