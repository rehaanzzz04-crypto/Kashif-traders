'use strict';
// Approval-aware feedback + supplier payment WhatsApp follow-up.
(function(){
  const originalFetch=window.fetch.bind(window);
  let pendingUntil=0;
  function supplierFollowup(id){
    if(!id)return;
    originalFetch('/api/payment-whatsapp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})
      .then(async r=>{if(!r.ok){const j=await r.json().catch(()=>({}));console.warn('Supplier payment WhatsApp follow-up:',j.error||r.status)}})
      .catch(e=>console.warn('Supplier payment WhatsApp follow-up:',e));
  }
  window.fetch=async function(...args){
    const response=await originalFetch(...args);
    if(response.status===202){pendingUntil=Date.now()+5000;window.KT_PENDING_APPROVAL=true;}
    try{
      const url=String(args[0]?.url||args[0]||''),method=String(args[1]?.method||'GET').toUpperCase();
      if(method==='POST'&&response.ok){
        if(url.includes('/api/data?')){
          const u=new URL(url,location.origin);if(u.searchParams.get('resource')==='supplier_payments'&&response.status===201){const j=await response.clone().json();supplierFollowup(j?.record?.id);}
        }else if(url.includes('/api/approvals')){
          const j=await response.clone().json();if(j?.record?.status==='approved'&&j?.record?.resource_key==='supplier_payments'&&j?.applied_record?.id)supplierFollowup(j.applied_record.id);
        }
      }
    }catch(e){console.warn('Supplier payment follow-up hook:',e)}
    return response;
  };
  function install(){
    if(typeof window.toast!=='function')return false;if(window.toast.__approvalAware)return true;const original=window.toast;
    const wrapped=function(message,bad=false){if(!bad&&(window.KT_PENDING_APPROVAL||Date.now()<pendingUntil)){window.KT_PENDING_APPROVAL=false;pendingUntil=0;return original('Submitted for Admin approval',false);}return original(message,bad);};
    wrapped.__approvalAware=true;window.toast=wrapped;return true;
  }
  let tries=0;const timer=setInterval(()=>{if(install()||++tries>100)clearInterval(timer);},50);
})();
