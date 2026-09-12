'use strict';
(()=>{
 const user=window.KT_USER;if(!user||user.designation==='admin')return;
 const money=n=>'PKR '+Number(n||0).toLocaleString();
 const ym=v=>{if(!v)return '';const s=String(v),m=s.match(/^(\d{4})-(\d{2})/);if(m)return m[1]+'-'+m[2];const d=new Date(v);return Number.isNaN(d.getTime())?'':d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')};
 function setHero(){const hero=document.querySelector('.hero');if(!hero)return;hero.querySelector('h1').textContent=user.full_name||user.employee_code||'Employee';hero.querySelector('p').textContent=(user.designation||'Employee').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())+' · '+(user.employee_code||'');}
 async function render(){
  setHero();if(!(user.access||[]).includes('salary-advances'))return;
  const dash=document.getElementById('dashboard');if(!dash||dash.querySelector('#mySalaryDash'))return;
  try{
   const r=await fetch('/api/salaries',{cache:'no-store'});if(!r.ok)return;const d=await r.json();
   const p=(d.salary_profiles||[])[0];if(!p)return;
   const now=new Date(),month=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
   const rows=(d.records||[]).filter(x=>ym(x.salary_month||x.requested_at)===month);
   const fixed=Number(p.monthly_salary||0),paid=rows.filter(x=>x.status==='paid').reduce((a,x)=>a+Number(x.amount||0),0),pending=rows.filter(x=>x.status==='pending').reduce((a,x)=>a+Number(x.amount||0),0),committed=rows.filter(x=>['pending','approved','paid'].includes(x.status)).reduce((a,x)=>a+Number(x.amount||0),0),remaining=Math.max(0,fixed-committed);
   const box=document.createElement('section');box.id='mySalaryDash';box.innerHTML='<div class="msHead"><div><b>My Salary</b><small>'+month+' salary overview</small></div><span>'+String(p.salary_status||'active').toUpperCase()+'</span></div><div class="msGrid"><div><small>Fixed Salary</small><strong>'+money(fixed)+'</strong></div><div><small>Paid</small><strong>'+money(paid)+'</strong></div><div><small>Remaining</small><strong>'+money(remaining)+'</strong></div><div><small>Pending</small><strong>'+money(pending)+'</strong></div></div><button type="button" id="mySalaryView">View Salary Statement</button>';
   const first=dash.firstElementChild;first?dash.insertBefore(box,first):dash.appendChild(box);
   box.querySelector('#mySalaryView').onclick=()=>document.querySelector('#nav [data-view="salary-advances"]')?.click();
  }catch(e){console.error('My Salary dashboard unavailable',e)}
 }
 if(!document.getElementById('mySalaryDashStyle')){const s=document.createElement('style');s.id='mySalaryDashStyle';s.textContent='#mySalaryDash{margin:0 0 18px;background:#fffdf8;border:1px solid #e4dccb;border-left:6px solid #b9913e;border-radius:22px;padding:18px;box-shadow:0 8px 22px rgba(25,65,53,.07)}.msHead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.msHead b{display:block;font:700 25px Georgia,serif;color:#163f34}.msHead small{display:block;margin-top:4px;color:#77827c;font-weight:700}.msHead span{background:#e8f3ed;color:#176448;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900}.msGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.msGrid div{border:1px solid #e5dfd2;border-radius:15px;padding:12px;background:#fffefa}.msGrid small{display:block;color:#7b847f;font-size:11px;font-weight:900;text-transform:uppercase}.msGrid strong{display:block;margin-top:6px;color:#174c3c;font-size:18px}#mySalaryView{width:100%;margin-top:12px;border:0;border-radius:14px;background:#174c3c;color:white;padding:13px;font-weight:900;font-size:15px}@media(max-width:370px){.msGrid{grid-template-columns:1fr 1fr}.msGrid strong{font-size:16px}}';document.head.appendChild(s)}
 setHero();setTimeout(render,500);document.querySelector('#nav [data-view="dashboard"]')?.addEventListener('click',()=>setTimeout(()=>{setHero();render()},400),true);
})();
