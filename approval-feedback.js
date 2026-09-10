'use strict';
// Converts legacy success toasts into accurate approval feedback after any API 202 response.
(function(){
  const originalFetch=window.fetch.bind(window);
  let pendingUntil=0;
  window.fetch=async function(...args){
    const response=await originalFetch(...args);
    if(response.status===202){
      pendingUntil=Date.now()+5000;
      window.KT_PENDING_APPROVAL=true;
    }
    return response;
  };
  function install(){
    if(typeof window.toast!=='function')return false;
    if(window.toast.__approvalAware)return true;
    const original=window.toast;
    const wrapped=function(message,bad=false){
      if(!bad&&(window.KT_PENDING_APPROVAL||Date.now()<pendingUntil)){
        window.KT_PENDING_APPROVAL=false;
        pendingUntil=0;
        return original('Submitted for Admin approval',false);
      }
      return original(message,bad);
    };
    wrapped.__approvalAware=true;
    window.toast=wrapped;
    return true;
  }
  let tries=0;
  const timer=setInterval(()=>{if(install()||++tries>100)clearInterval(timer);},50);
})();
