'use strict';
const state={
  companies:[
    {name:'Kashif Traders',code:'KASHIF001',plan:'Premium',status:'Active',expiry:'30 Dec 2026'},
    {name:'Gulshan Traders',code:'GULSHAN001',plan:'Standard',status:'Active',expiry:'15 Nov 2026'},
    {name:'ABC Foods',code:'ABC001',plan:'Basic',status:'Active',expiry:'10 Jan 2027'}
  ],
  plans:[
    {name:'Basic',price:'PKR 2,000 / month',note:'3 users • 1 warehouse • Core ERP'},
    {name:'Standard',price:'PKR 5,000 / month',note:'10 users • Multi-warehouse • Audit reports'},
    {name:'Premium',price:'PKR 10,000 / month',note:'More users • Advanced controls • Priority support'}
  ]
};
const $=id=>document.getElementById(id);
function render(){
  $('stats').innerHTML=[
    ['Companies',state.companies.length],
    ['Active',state.companies.filter(x=>x.status==='Active').length],
    ['Plans',state.plans.length],
    ['Data Model','Tenant Isolated']
  ].map(([k,v])=>'<div class="stat"><small>'+k+'</small><b>'+v+'</b></div>').join('');
  const q=($('companySearch').value||'').trim().toLowerCase();
  const rows=state.companies.filter(x=>!q||[x.name,x.code,x.plan].join(' ').toLowerCase().includes(q));
  $('companyRows').innerHTML=rows.map(x=>'<tr><td><b>'+x.name+'</b></td><td>'+x.code+'</td><td>'+x.plan+'</td><td><span class="pill '+x.status.toLowerCase()+'">'+x.status+'</span></td><td>'+x.expiry+'</td><td><button class="secondary" type="button">Open</button></td></tr>').join('');
  $('plans').innerHTML=state.plans.map(x=>'<div class="plan"><b><span>'+x.name+'</span><span>'+x.price+'</span></b><small>'+x.note+'</small></div>').join('');
}
$('companySearch').addEventListener('input',render);
$('addCompany').onclick=()=>$('companyDialog').showModal();
$('companyForm').addEventListener('submit',e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget),name=String(fd.get('name')||'').trim(),code=String(fd.get('code')||'').trim().toUpperCase(),plan=String(fd.get('plan')||'Standard');
  if(!name||!code)return;
  state.companies.push({name,code,plan,status:'Active',expiry:'Draft'});
  $('companyDialog').close();e.currentTarget.reset();render();
});
render();
