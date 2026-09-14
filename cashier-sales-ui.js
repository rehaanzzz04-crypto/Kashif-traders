'use strict';
(()=>{
  const $=id=>document.getElementById(id);$('cashierBack').onclick=()=>location.href='/';
  fetch('/api/auth?action=me',{cache:'no-store'}).then(r=>r.json()).then(j=>{const u=j?.user;if(!u)return;$('cashierUser').textContent=(u.full_name||u.employee_code)+' · '+String(u.designation||'').toUpperCase()}).catch(()=>{});
  const bills={14:{name:'Haider',at:'14 Sep 2026, 10:42 AM',due:'PKR 6,450'},15:{name:'Rizwan',at:'14 Sep 2026, 10:44 AM',due:'PKR 2,375'}};
  document.querySelectorAll('[data-bill]').forEach(button=>{const bill=bills[button.dataset.bill],small=button.querySelector('small');if(bill&&small)small.textContent='Created by '+bill.name+' · '+bill.at;button.onclick=()=>{document.querySelectorAll('[data-bill]').forEach(x=>x.classList.remove('active'));button.classList.add('active');const x=bills[button.dataset.bill];$('cashierBillNo').textContent='CS-TEST-0000'+button.dataset.bill;$('cashierBillBy').textContent='Created by '+x.name;let at=$('cashierBillAt');if(!at){at=document.createElement('p');at.id='cashierBillAt';$('cashierBillBy').after(at)}at.textContent=x.at;$('cashierDue').textContent=x.due}});
  const initial=$('cashierBillBy');if(initial){initial.textContent='Created by Haider';const at=document.createElement('p');at.id='cashierBillAt';at.textContent=bills[14].at;initial.after(at)}
})();
