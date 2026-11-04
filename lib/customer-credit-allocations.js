// Customer Credit ONLY: allocations are derived from its own saved bills and payments.
// No ERP clients, invoices, stock, or payment tables are involved.
const cents=v=>Math.max(0,Math.round(Number(v||0)*100));
const money=v=>Math.round(v)/100;
const id=v=>Number(v);
const ordered=(a,b)=>String(a.entry_date).slice(0,10).localeCompare(String(b.entry_date).slice(0,10))||id(a.id)-id(b.id);
export function calculateCreditAllocations(entries,{excludeEntryId=null}={}){
 const valid=(entries||[]).filter(e=>!e.voided_at&&id(e.id)!==id(excludeEntryId));
 const bills=valid.filter(e=>e.entry_type==='bill').sort(ordered).map(e=>({
  id:id(e.id),bill_no:e.bill_no||'BILL-'+e.id,date:String(e.entry_date).slice(0,10),
  amount:money(cents(e.amount)),remaining_cents:cents(e.amount)
 }));
 const byId=new Map(bills.map(b=>[b.id,b]));
 const payments=valid.filter(e=>e.entry_type==='payment').sort(ordered);
 const allocationsByPayment={};
 for(const payment of payments){
  let remaining=cents(payment.amount);
  const matches=[];
  const allocate=b=>{
   if(!b||remaining<=0||b.remaining_cents<=0)return;
   const used=Math.min(remaining,b.remaining_cents);
   b.remaining_cents-=used;
   remaining-=used;
   matches.push({bill_id:b.id,bill_no:b.bill_no,amount:money(used)});
  };
  if(payment.allocation_mode==='invoice'){
   const target=byId.get(id(payment.target_bill_id));
   allocate(target);
  }else{
   for(const bill of bills)allocate(bill);
  }
  allocationsByPayment[id(payment.id)]={
   mode:payment.allocation_mode==='invoice'?'invoice':'auto',
   applied:matches,
   unapplied:money(remaining),
   total:money(cents(payment.amount))
  };
 }
 const pendingBills=bills.filter(b=>b.remaining_cents>0).map(b=>({
  id:b.id,bill_no:b.bill_no,date:b.date,amount:b.amount,
  paid:money(cents(b.amount)-b.remaining_cents),due:money(b.remaining_cents)
 }));
 const unapplied=Object.values(allocationsByPayment).reduce((sum,p)=>sum+cents(p.unapplied),0);
 return {
  pending_bills:pendingBills,allocations_by_payment:allocationsByPayment,
  pending_total:money(pendingBills.reduce((s,b)=>s+cents(b.due),0)),
  unapplied_advance:money(unapplied)
 };
}
export function previewAutoAllocation(pendingBills,amount){
 let remaining=cents(amount);
 const preview=[];
 for(const bill of pendingBills||[]){
  const take=Math.min(remaining,cents(bill.due));
  if(take>0)preview.push({bill_id:bill.id,bill_no:bill.bill_no,amount:money(take)});
  remaining-=take;
  if(remaining<=0)break;
 }
 return {applied:preview,advance:money(remaining)};
}
