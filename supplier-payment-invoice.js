'use strict';
(()=>{
  const isSupplierPayments=()=>document.querySelector('#nav [data-view="supplier-payments"]')?.classList.contains('active');
  const money=n=>'PKR '+Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2});
  async function getJson(url){const r=await fetch(url,{cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}
  async function enhance(form){
    if(!form||form.dataset.invoiceLinked==='1'||!isSupplierPayments())return;
    form.dataset.invoiceLinked='1';
    const supplier=form.querySelector('[name="supplier_id"]'),amount=form.querySelector('[name="amount"]');
    if(!supplier||!amount)return;
    const grid=form.querySelector('.grid')||form;
    const wrap=document.createElement('div');wrap.className='field';wrap.innerHTML='<label>Supplier Invoice (Optional)</label><select name="supplier_invoice_id"><option value="">Auto Adjust Oldest Unpaid Invoices</option></select><small data-invoice-balance style="display:block;margin-top:6px;color:#61736d">Auto Adjust select rehne dein to payment oldest unpaid invoices par FIFO order mein adjust hogi.</small>';
    const supplierField=supplier.closest('.field');if(supplierField?.nextSibling)grid.insertBefore(wrap,supplierField.nextSibling);else grid.appendChild(wrap);
    const invoice=wrap.querySelector('select'),hint=wrap.querySelector('[data-invoice-balance]');
    let invoices=[],payments=[];
    async function load(){
      const sid=Number(supplier.value||0);invoice.innerHTML='<option value="">Loading…</option>';hint.textContent='Supplier select karne ke baad Auto Adjust option available rahega.';
      if(!sid){invoice.innerHTML='<option value="">Select supplier first — Auto Adjust</option>';return}
      try{
        const [ir,pr]=await Promise.all([getJson('/api/data?resource=supplier_invoices'),getJson('/api/data?resource=supplier_payments')]);
        invoices=(ir.records||[]).filter(x=>Number(x.supplier_id)===sid);payments=(pr.records||[]);
        const opts=invoices.map(x=>{const paid=Number(x.allocated_amount??payments.filter(p=>Number(p.supplier_invoice_id)===Number(x.id)).reduce((s,p)=>s+Number(p.amount||0),0)),remaining=Number(x.outstanding??Math.max(0,Number(x.amount||0)-paid));return {...x,paid,remaining}}).filter(x=>x.remaining>0.005);
        invoice.innerHTML='<option value="">Auto Adjust Oldest Unpaid Invoices</option>'+opts.map(x=>'<option value="'+x.id+'" data-remaining="'+x.remaining+'">'+(x.invoice_number||x.entry_number||('Invoice '+x.id))+' — '+money(x.remaining)+' remaining</option>').join('');
        if(!opts.length)invoice.innerHTML='<option value="">No Unpaid Invoice — Save as Advance</option>';
      }catch(e){invoice.innerHTML='<option value="">Unable to load invoices</option>';hint.textContent=e.message||'Invoice loading failed'}
    }
    function syncAmount(){const opt=invoice.selectedOptions?.[0],remaining=Number(opt?.dataset?.remaining||0);if(remaining>0){amount.value=String(remaining);hint.textContent='Selected invoice first, then remaining payment adjusts oldest invoices'}else{amount.removeAttribute('max');hint.textContent='Payment oldest unpaid invoices par automatic FIFO adjustment se apply hogi.'}}
    supplier.addEventListener('change',load);invoice.addEventListener('change',syncAmount);await load();
  }
  const mo=new MutationObserver(()=>{const f=document.querySelector('#recordForm');if(f)enhance(f)});mo.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('submit',async e=>{
    const form=e.target;if(form?.id!=='recordForm'||form.dataset.invoiceLinked!=='1'||!isSupplierPayments())return;
    e.preventDefault();e.stopImmediatePropagation();
    const b=Object.fromEntries(new FormData(form).entries()),invoiceId=Number(b.supplier_invoice_id||0),amt=Number(b.amount||0),sel=form.querySelector('[name="supplier_invoice_id"]'),remaining=Number(sel?.selectedOptions?.[0]?.dataset?.remaining||0);
    if(!(amt>0))return window.toast?.('Valid payment amount required',true);
    const save=form.querySelector('[type="submit"]'),old=save?.textContent;if(save){save.disabled=true;save.textContent='Saving…'}
    try{
      const editId=Number(form.dataset.recordId||0)||null,method=editId?'PATCH':'POST',url='/api/data?resource=supplier_payments'+(editId?'&id='+encodeURIComponent(editId):'');
      const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Supplier payment failed');
      document.getElementById('modal')?.remove();window.toast?.(editId?'Payment updated':'Payment saved — invoices auto-adjusted');
      setTimeout(()=>document.querySelector('#nav [data-view="supplier-payments"]')?.click(),80);
    }catch(err){window.toast?.(err.message||'Supplier payment failed',true);if(save){save.disabled=false;save.textContent=old||'Save'}}
  },true);
})();
