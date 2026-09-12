'use strict';
(()=>{
 const money=v=>Number(v||0);
 async function employeeRow(id){
  try{const r=await fetch('/api/employees',{cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)return null;return (j.records||[]).find(x=>Number(x.id)===Number(id))||null}catch{return null}
 }
 function addFields(row){
  const form=document.getElementById('empForm');if(!form||form.querySelector('[name="monthly_salary"]'))return;
  const grid=form.querySelector('.grid');if(!grid)return;
  const wrap=document.createElement('div');wrap.style.display='contents';
  wrap.innerHTML='<div class="field"><label>Monthly Salary (PKR)</label><input name="monthly_salary" type="number" min="0" step="0.01" value="'+(row?money(row.monthly_salary):0)+'" placeholder="e.g. 45000"></div><div class="field"><label>Salary Effective From</label><input name="salary_effective_from" type="date" value="'+(row?.salary_effective_from?String(row.salary_effective_from).slice(0,10):'')+'"></div><div class="field"><label>Salary Status</label><select name="salary_status"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>';
  grid.appendChild(wrap);const s=form.querySelector('[name="salary_status"]');if(s)s.value=row?.salary_status||'active';
 }
 document.addEventListener('click',e=>{
  const edit=e.target.closest('.empEdit'),add=e.target.closest('#empAdd');if(!edit&&!add)return;
  const id=edit?.dataset?.id;
  setTimeout(async()=>{addFields(id?await employeeRow(id):null)},0);
 },true);
})();
