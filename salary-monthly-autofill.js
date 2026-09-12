'use strict';
(()=>{
  const ym=v=>{if(!v)return '';const s=String(v),m=s.match(/^(\d{4})-(\d{2})/);if(m)return m[1]+'-'+m[2];const d=new Date(v);return Number.isNaN(d.getTime())?'':d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')};
  let latest=null,loading=null;
  async function load(){
    if(latest)return latest;
    if(loading)return loading;
    loading=fetch('/api/salaries',{cache:'no-store'}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to calculate salary');latest=j;return j}).finally(()=>loading=null);
    return loading;
  }
  function currentProfile(data){
    const profiles=data?.salary_profiles||[];
    const uid=Number(window.KT_USER?.id||0);
    return profiles.find(p=>Number(p.id)===uid)||profiles[0]||null;
  }
  function remainingFor(data,month){
    const p=currentProfile(data);if(!p)return null;
    const fixed=Number(p.monthly_salary||0);
    const rows=(data.records||[]).filter(r=>Number(r.employee_id)===Number(p.id)&&ym(r.salary_month||r.requested_at)===month&&['pending','approved','paid'].includes(String(r.status||'').toLowerCase()));
    const used=rows.reduce((a,r)=>a+Number(r.amount||0),0);
    return {fixed,used,remaining:Math.max(0,fixed-used)};
  }
  async function apply(modal){
    const type=modal?.querySelector('#srType'),month=modal?.querySelector('#srMonth'),amount=modal?.querySelector('#srAmount');
    if(!type||!month||!amount)return;
    let hint=modal.querySelector('#srAutoHint');
    if(!hint){hint=document.createElement('small');hint.id='srAutoHint';hint.style.cssText='display:none;color:#52665f;margin-top:-2px;line-height:1.35';amount.insertAdjacentElement('afterend',hint)}
    if(type.value!=='monthly_salary'){
      amount.readOnly=false;amount.removeAttribute('aria-readonly');amount.placeholder='Amount';hint.style.display='none';return;
    }
    amount.readOnly=true;amount.setAttribute('aria-readonly','true');amount.placeholder='Calculating remaining salary...';
    try{
      latest=null;const data=await load(),calc=remainingFor(data,month.value);
      if(!calc){amount.value='';hint.textContent='Salary profile not found.';hint.style.display='block';return;}
      amount.value=calc.remaining.toFixed(2);
      hint.textContent=`Auto calculated: Fixed PKR ${calc.fixed.toLocaleString()} − already requested/paid PKR ${calc.used.toLocaleString()} = remaining payable PKR ${calc.remaining.toLocaleString()}.`;
      hint.style.display='block';
    }catch(e){amount.value='';hint.textContent=e.message||'Unable to calculate remaining salary.';hint.style.display='block'}
  }
  function wire(){
    const modal=document.getElementById('salaryModal');if(!modal)return;
    const type=modal.querySelector('#srType'),month=modal.querySelector('#srMonth');if(!type||!month||type.dataset.monthlyAutoWired)return;
    type.dataset.monthlyAutoWired='1';
    type.addEventListener('change',()=>apply(modal));
    month.addEventListener('change',()=>apply(modal));
    apply(modal);
  }
  new MutationObserver(wire).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(wire,0),true);
})();
