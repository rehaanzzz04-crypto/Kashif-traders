'use strict';
// Approval-aware feedback + WhatsApp follow-up hooks.
(function(){
  const originalFetch=window.fetch.bind(window);
  let pendingUntil=0;
  function postFollowup(url,id,label){if(!id)return;originalFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}).then(async r=>{if(!r.ok){const j=await r.json().catch(()=>({}));console.warn(label+':',j.error||r.status)}}).catch(e=>console.warn(label+':',e));}
  const supplierFollowup=id=>postFollowup('/api/payment-whatsapp',id,'Supplier payment WhatsApp follow-up');
  const clientBillFollowup=id=>postFollowup('/api/client-bill-whatsapp',id,'Client bill WhatsApp follow-up');
  window.fetch=async function(...args){
    const response=await originalFetch(...args);
    if(response.status===202){pendingUntil=Date.now()+5000;window.KT_PENDING_APPROVAL=true;}
    try{
      const url=String(args[0]?.url||args[0]||''),method=String(args[1]?.method||'GET').toUpperCase();
      if(method==='POST'&&response.ok){
        if(url.includes('/api/data?')){
          const u=new URL(url,location.origin),resource=u.searchParams.get('resource');if(response.status===201){const j=await response.clone().json();if(resource==='supplier_payments')supplierFollowup(j?.record?.id);if(resource==='client_invoices')clientBillFollowup(j?.record?.id);}
        }else if(url.includes('/api/approvals')){
          const j=await response.clone().json();if(j?.record?.status==='approved'&&j?.applied_record?.id){if(j.record.resource_key==='supplier_payments')supplierFollowup(j.applied_record.id);if(j.record.resource_key==='client_invoices')clientBillFollowup(j.applied_record.id);}
        }
      }
    }catch(e){console.warn('WhatsApp follow-up hook:',e)}
    return response;
  };
  function install(){if(typeof window.toast!=='function')return false;if(window.toast.__approvalAware)return true;const original=window.toast;const wrapped=function(message,bad=false){if(!bad&&(window.KT_PENDING_APPROVAL||Date.now()<pendingUntil)){window.KT_PENDING_APPROVAL=false;pendingUntil=0;return original('Submitted for Admin approval',false);}return original(message,bad);};wrapped.__approvalAware=true;window.toast=wrapped;return true;}
  let tries=0;const timer=setInterval(()=>{if(install()||++tries>100)clearInterval(timer);},50);
})();
