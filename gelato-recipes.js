'use strict';

const SOURCE_CARPIGIANI='https://www.gelatouniversity.com/binary_files/hpdedicate_materiali/07___ENG___Recipe_book_Basic_course_25_26_12561.pdf';
const SOURCE_GUELPH='https://books.lib.uoguelph.ca/icecreamtechnologyebook/chapter/suggested-mixes-for-ice-cream/';
const SOURCE_TETRA='https://dairyprocessinghandbook.tetrapak.com/chapter/ice-cream';

const GELATO=[
  {id:'white-base',name:'White Base',cat:'Base',page:1,solids:[18,6,10.5,.6,64.9,35.1],items:[['Whole milk (3.5% fat)',667],['Cream (35% fat)',104],['Skim milk powder (1% fat)',28],['Sugar sucrose',137],['Dry glucose syrup 38DE',31.5],['Base 50 C.H.',32.5]]},
  {id:'yellow-base',name:'Yellow Base',cat:'Base',page:2,solids:[20,8,9,2.3,60.7,39.3],items:[['Whole milk (3.5% fat)',571],['Cream (35% fat)',85],['Skim milk powder (1% fat)',24],['Egg yolk',100],['Sugar sucrose',136],['Dextrose',15],['Dry glucose syrup 38DE',41],['Base 50 C.H.',28]]},
  {id:'chocolate-base',name:'Chocolate Base',cat:'Base',page:3,solids:[20,8.5,7.5,6.2,57.8,42.2],items:[['Whole milk (3.5% fat)',605.5],['Cream (35% fat)',70],['Skim milk powder (1% fat)',5],['Dark chocolate 70%',70],['Cocoa powder 22-24%',50],['Sugar sucrose',125],['Dextrose',23],['Dry glucose syrup 38DE',22],['Base 50 C.H.',29.5]]},
  {id:'fiordilatte-direct',name:'Fiordilatte - Direct Method',cat:'Milk Gelato',page:18,solids:[20,8,10,.5,61.5,38.5],items:[['Whole milk (3.5% fat)',581],['Cream (35% fat)',170],['Skim milk powder (1% fat)',29],['Sugar sucrose',120],['Dextrose',17],['Dry glucose syrup 38DE',55],['Base 50 C.H.',28]]},
  {id:'fiordilatte-1',name:'Fiordilatte 1 - White Base',cat:'Milk Gelato',page:14,solids:[20.5,8.2,9.6,.5,61.2,38.8],items:[['White Base',864],['Cream (35% fat)',87],['Sugar sucrose',49]]},
  {id:'pistachio-direct',name:'Pistachio - Direct Method',cat:'Nut Gelato',page:57,solids:[19,9.5,8,4.2,59.3,40.7],items:[['Whole milk (3.5% fat)',638],['Cream (35% fat)',47],['Skim milk powder (1% fat)',10],['Pistachio paste',100],['Sugar sucrose',134],['Dextrose',16],['Dry glucose syrup 38DE',27],['Base 50 C.H.',28]]},
  {id:'strawberry-milk-1',name:'Strawberry 1 - Milk Base',cat:'Fruit Gelato',page:95,solids:[22.5,3.6,6.3,1.5,66.1,33.9],items:[['White Base',598],['Strawberry',299],['Sugar sucrose',103]]},
  {id:'strawberry-milk-2',name:'Strawberry 2 - Puree Milk Base',cat:'Fruit Gelato',page:96,solids:[22.5,3.9,6.6,1.2,65.8,34.2],items:[['White Base',632],['Strawberry puree',316],['Sugar sucrose',52]]},
  {id:'strawberry-sorbet-1',name:'Strawberry - Sorbet',cat:'Sorbet',page:97,solids:[27.5,0,0,2.3,70.2,29.8],items:[['Strawberry',500],['Sugar sucrose',226],['Lemon juice',10],['Base 50 F.C.',30],['Water',234]]},
  {id:'strawberry-sorbet-2',name:'Strawberry Puree - Sorbet',cat:'Sorbet',page:98,solids:[27.5,0,0,1.8,70.7,29.3],items:[['Strawberry puree',500],['Sugar sucrose',157],['Lemon juice',10],['Base 50 F.C.',30],['Water',303]]},
  {id:'mango-milk-1',name:'Mango 1 - Milk Base',cat:'Fruit Gelato',page:117,solids:[22.5,3.8,6.5,1.7,65.5,34.5],items:[['White Base',622],['Mango',311],['Sugar sucrose',67]]},
  {id:'mango-milk-2',name:'Mango 2 - Custard Milk Base',cat:'Fruit Gelato',page:118,solids:[22.5,4.7,5.9,2.5,64.4,35.6],items:[['White Base',189],['Yellow Base',440],['Mango',314],['Sugar sucrose',57]]},
  {id:'mango-milk-3',name:'Mango 3 - Chocolate Milk Base',cat:'Fruit Gelato',page:119,solids:[22.5,5,5.3,4.2,63,37],items:[['White Base',189],['Chocolate Base',440],['Mango',314],['Sugar sucrose',57]]},
  {id:'mango-sorbet',name:'Mango - Sorbet',cat:'Sorbet',page:120,solids:[28,0,0,2.5,69.5,30.5],items:[['Mango',500],['Sugar sucrose',191],['Lemon juice',10],['Base 50 F.C.',20],['Water',279]]}
];

const TARGETS={
  hard:[
    {id:'hard-balanced',name:'Professional Hard Ice Cream Base',fat:10,msnf:11,sucrose:13,glucose:4,stabilizer:.30,emulsifier:.15},
    {id:'hard-premium',name:'Premium Hard Ice Cream Base',fat:12,msnf:10.5,sucrose:13,glucose:4,stabilizer:.25,emulsifier:.12},
    {id:'hard-rich',name:'Rich Hard Ice Cream Base',fat:14,msnf:10,sucrose:14,glucose:3,stabilizer:.20,emulsifier:.10}
  ],
  soft:[
    {id:'soft-standard',name:'Professional Soft Serve Base',fat:8,msnf:12,sucrose:12,glucose:4,stabilizer:.30,emulsifier:.15},
    {id:'soft-rich',name:'Rich Soft Serve Base',fat:10,msnf:12.5,sucrose:13,glucose:0,stabilizer:.35,emulsifier:.15}
  ]
};

const BASES={
  'White Base':GELATO.find(x=>x.id==='white-base'),
  'Yellow Base':GELATO.find(x=>x.id==='yellow-base'),
  'Chocolate Base':GELATO.find(x=>x.id==='chocolate-base')
};

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=g=>g>=1000?(g/1000).toLocaleString('en',{maximumFractionDigits:3})+' kg':g.toLocaleString('en',{maximumFractionDigits:1})+' g';
const batchGrams=()=>{const n=Number($('batch').value||0);return $('unit').value==='kg'?n*1000:n};
let current={};

function solve3(A,b){
  const M=A.map((r,i)=>[...r,b[i]]);
  for(let i=0;i<3;i++){
    let p=i;for(let j=i+1;j<3;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;
    [M[i],M[p]]=[M[p],M[i]];
    const d=M[i][i];if(Math.abs(d)<1e-9)throw Error('Formula cannot be solved');
    for(let k=i;k<4;k++)M[i][k]/=d;
    for(let j=0;j<3;j++)if(j!==i){const f=M[j][i];for(let k=i;k<4;k++)M[j][k]-=f*M[i][k];}
  }
  return M.map(r=>r[3]);
}

function componentRecipe(t,mode){
  const sugar=t.sucrose*10, glucose=t.glucose*10, stab=t.stabilizer*10, emul=t.emulsifier*10;
  const dairy=1000-sugar-glucose-stab-emul, fat=t.fat*10, msnf=t.msnf*10;
  let x,names;
  if(mode==='fresh'){
    x=solve3([[1,1,1],[.035,.35,.01],[.085,.055,.96]],[dairy,fat,msnf]);
    names=['Whole milk (3.5% fat)','Cream (35% fat)','Skim milk powder (1% fat)'];
  }else{
    x=solve3([[1,1,1],[0,.35,.01],[0,.055,.96]],[dairy,fat,msnf]);
    names=['Water','Cream (35% fat)','Skim milk powder (1% fat)'];
  }
  const items=names.map((n,i)=>[n,Math.max(0,x[i])]);
  if(sugar)items.push(['Sugar sucrose',sugar]);
  if(glucose)items.push(['Glucose/corn syrup solids',glucose]);
  if(stab)items.push(['Stabilizer (supplier dosage check)',stab]);
  if(emul)items.push(['Emulsifier (supplier dosage check)',emul]);
  return items;
}

function scale(items,total){const f=total/1000;return items.map(x=>({name:x[0],g:x[1]*f}))}
function expand(items,total){
  const out={}; const add=(name,g,depth)=>{
    if(BASES[name]&&depth<4){const f=g/1000;BASES[name].items.forEach(i=>add(i[0],i[1]*f,depth+1));}
    else out[name]=(out[name]||0)+g;
  };
  scale(items,total).forEach(x=>add(x.name,x.g,0));
  return Object.entries(out).map(([name,g])=>({name,g}));
}
function sourceBlock(kind,page){
  if(kind==='gelato')return '<div class="source"><b>Formula source:</b> Carpigiani Gelato University, Basic Gelato Course Recipe Book'+(page?' • page '+page:'')+'.<br><a target="_blank" rel="noopener" href="'+SOURCE_CARPIGIANI+'">Open official Carpigiani PDF</a></div>';
  return '<div class="source"><b>Formulation references:</b> University of Guelph Ice Cream Technology e-Book + Tetra Pak Dairy Processing Handbook. Ingredient weights are calculated from component targets and the selected fresh/dry milk system.<br><a target="_blank" rel="noopener" href="'+SOURCE_GUELPH+'">University of Guelph formulation reference</a> • <a target="_blank" rel="noopener" href="'+SOURCE_TETRA+'">Tetra Pak processing reference</a></div>';
}
function methods(kind,cat){
  if(kind==='gelato'){
    if(cat==='Sorbet')return[
      'Water, sugars aur stabilizing base ko exact weight se prepare karein.',
      'Dry ingredients ko disperse karke supplier ke base instructions ke mutabiq syrup phase process karein; phir rapidly chill karein.',
      'Fruit/puree aur lemon juice ko chilled phase mein add karke smooth blend karein.',
      'Mix ko cold rest dein, phir batch freezer mein freeze karein.',
      'Extraction ke baad rapid hardening karein aur covered frozen storage mein transfer karein.'
    ];
    return[
      'Tamam ingredients ko exact weight se weigh karein; dry powders ko pehle mix karein.',
      'Milk/cream phase ko warm karte hue powders gradually add karein aur uniform mix banayein.',
      'Professional pasteurization cycle follow karein, phir mix ko rapidly approximately 4°C tak cool karein.',
      'Cold maturation/ageing ke baad short blend/emulsification karein.',
      'Batch freezer mein freeze karein; extraction ke foran baad rapid hardening aur frozen storage karein.'
    ];
  }
  if(kind==='soft')return[
    'Liquid ingredients ko mixing temperature tak warm karein; dry milk solids ko smoothly disperse karein.',
    'Sugars add karein; stabilizer/emulsifier ko sugar ke saath preblend karke process ke late stage mein disperse karein.',
    'Approved pasteurization and homogenization process follow karein, phir mix ko below 5°C rapidly cool karein.',
    'Mix ko below 5°C minimum 4 hours age karein.',
    'Soft-serve freezer/hopper mein machine manufacturer ki sanitation, holding-temperature aur draw settings ke mutabiq use karein. Product ko harden na karein.'
  ];
  return[
    'Liquid ingredients ko warm karein; dry milk solids ko fully disperse karein.',
    'Sugars add karein; stabilizer/emulsifier ko sugar ke saath preblend karke late mixing stage mein add karein.',
    'Approved pasteurization and homogenization process follow karein, phir mix ko below 5°C rapidly cool karein.',
    'Mix ko below 5°C minimum 4 hours age karein.',
    'Freezer mein desired overrun/body tak freeze karein, package karein aur immediately harden karein.',
    'Cold chain stable rakhein; heat shock texture aur lactose crystallization risk ko barhata hai.'
  ];
}

function targetStats(t){
  const total=t.fat+t.msnf+t.sucrose+t.glucose+t.stabilizer+t.emulsifier;
  return [
    ['Milk fat',t.fat+'%'],['MSNF',t.msnf+'%'],['Sucrose',t.sucrose+'%'],['Glucose solids',t.glucose+'%'],
    ['Stabilizer',t.stabilizer+'%'],['Emulsifier',t.emulsifier+'%'],['Target solids','~'+total.toFixed(2)+'%'],['Water','~'+(100-total).toFixed(2)+'%']
  ];
}
function gelatoStats(s){
  if(!s)return[];
  return [['Sugars',s[0]+'%'],['Fat',s[1]+'%'],['M.S.N.F.',s[2]+'%'],['Other solids',s[3]+'%'],['Water',s[4]+'%'],['Total solids',s[5]+'%']];
}
function ingredientTable(rows,total){
  return '<div class="tablewrap"><table><thead><tr><th>Ingredient</th><th>Required Weight</th><th>% Batch</th></tr></thead><tbody>'+
    rows.map(x=>'<tr><td>'+esc(x.name)+'</td><td class="qty">'+fmt(x.g)+'</td><td class="pct">'+((x.g/total)*100).toFixed(2)+'%</td></tr>').join('')+
    '<tr class="totalRow"><td>Total Batch</td><td>'+fmt(total)+'</td><td>100.00%</td></tr></tbody></table></div>';
}
function populate(){
  const kind=$('system').value;
  $('baseModeWrap').classList.toggle('hidden',kind==='gelato');
  let list=kind==='gelato'?GELATO:TARGETS[kind];
  $('recipe').innerHTML=list.map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('');
  render();
}
function getRecipe(){
  const kind=$('system').value;
  return (kind==='gelato'?GELATO:TARGETS[kind]).find(r=>r.id===$('recipe').value);
}
function render(){
  const kind=$('system').value,r=getRecipe(),total=batchGrams();
  if(!r||!Number.isFinite(total)||total<=0){$('result').innerHTML='<div class="warning">Valid batch quantity enter karein.</div>';return}
  let items,stats,subtitle,src,raw=null;
  if(kind==='gelato'){
    items=scale(r.items,total);raw=expand(r.items,total);
    stats=gelatoStats(r.solids);subtitle='Official Carpigiani formula • source page '+r.page;
    src=sourceBlock('gelato',r.page);
  }else{
    const base=$('baseMode').value;items=scale(componentRecipe(r,base),total);stats=targetStats(r);
    subtitle=(kind==='hard'?'Hard ice cream':'Soft serve')+' • '+(base==='fresh'?'Fresh Milk Base':'Dry Milk Base');
    src=sourceBlock(kind);
  }
  current={kind,r,total,items};
  const statHtml=stats.map(x=>'<div class="stat"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('');
  const method=methods(kind,r.cat);
  const hasPrepared=kind==='gelato'&&r.items.some(x=>BASES[x[0]]);
  $('result').innerHTML=
    '<div class="recipeHead"><div><h2>'+esc(r.name)+'</h2><p>'+esc(subtitle)+'</p></div><span class="badge">'+esc(kind==='gelato'?(r.cat||'Gelato'):(kind==='hard'?'Hard Ice Cream':'Soft Serve'))+'</span></div>'+
    '<div class="stats">'+
      '<div class="stat"><small>Batch</small><strong>'+fmt(total)+'</strong></div>'+
      '<div class="stat"><small>Base System</small><strong>'+esc(kind==='gelato'?'Carpigiani':($('baseMode').value==='fresh'?'Fresh Milk':'Dry Milk'))+'</strong></div>'+
      '<div class="stat"><small>Ingredients</small><strong>'+items.length+'</strong></div>'+
      '<div class="stat"><small>Recipe Type</small><strong>'+esc(kind==='gelato'?'Gelato':kind==='hard'?'Hard':'Soft')+'</strong></div>'+
    '</div>'+
    (hasPrepared?'<div class="tabs"><button class="tab active" data-view="book">Book Formula</button><button class="tab" data-view="raw">Expanded Raw Ingredients</button></div>':'')+
    '<div id="formulaTable">'+ingredientTable(items,total)+'</div>'+
    '<div class="split"><div class="subpanel"><h3>Production Method</h3><div class="steps">'+method.map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div></div>'+
    '<div><div class="subpanel"><h3>Technical Balance</h3><div class="balance">'+statHtml+'</div></div>'+src+
    (kind==='gelato'?'':'<div class="warning"><b>Ingredient specification:</b> Calculation assumes whole milk 3.5% fat / 8.5% MSNF, cream 35% fat / ~5.5% MSNF, and skim milk powder 1% fat / ~96% MSNF. Actual supplier analysis vary karta hai; production release se pehle apne ingredient COA ke mutabiq values verify karein.</div>')+
    '</div></div>';
  if(hasPrepared){
    $('result').querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
      $('result').querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));
      $('formulaTable').innerHTML=ingredientTable(b.dataset.view==='raw'?raw:items,total);
    });
  }
}
function historyRead(){try{return JSON.parse(localStorage.getItem('kt_icecream_batches_v2')||'[]')}catch{return[]}}
function historyRender(){
  const h=historyRead();
  $('history').innerHTML=h.length?h.map((x,i)=>'<div class="historyItem"><div><b>'+esc(x.name)+'</b><small>'+esc(x.system)+' • '+esc(x.batch)+' • '+esc(x.when)+'</small></div><button data-load="'+i+'">Load</button></div>').join(''):'<div class="note">No saved batches yet.</div>';
  $('history').querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{
    const x=h[Number(b.dataset.load)];if(!x)return;
    $('system').value=x.system;$('baseMode').value=x.base||'fresh';$('batch').value=x.value;$('unit').value=x.unit;populate();
    if([...$('recipe').options].some(o=>o.value===x.id))$('recipe').value=x.id;render();
  });
}
function saveBatch(){
  if(!current.r)return;
  const h=historyRead();
  h.unshift({id:current.r.id,name:current.r.name,system:$('system').value,base:$('baseMode').value,value:$('batch').value,unit:$('unit').value,batch:fmt(current.total),when:new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date())});
  localStorage.setItem('kt_icecream_batches_v2',JSON.stringify(h.slice(0,40)));historyRender();alert('Batch saved');
}
async function shareRecipe(){
  if(!current.r)return;
  const txt=current.r.name+' - '+fmt(current.total)+'\\n\\n'+current.items.map(x=>x.name+': '+fmt(x.g)).join('\\n')+'\\n\\nKashif Traders Ice Cream Lab';
  try{if(navigator.share)await navigator.share({title:current.r.name,text:txt});else{await navigator.clipboard.writeText(txt);alert('Recipe copied')}}catch(e){if(e?.name!=='AbortError')alert('Share unavailable')}
}
async function auth(){
  const key='kt_offline_user_v1';let ok=false;
  try{const r=await fetch('/api/auth?action=me',{cache:'no-store'});if(r.status===401||r.status===403){location.replace('/login.html');return}if(r.ok){const j=await r.json();ok=!!j.user;if(j.user)localStorage.setItem(key,JSON.stringify({user:j.user,saved_at:new Date().toISOString()}));}}
  catch(e){if(!navigator.onLine){try{ok=!!JSON.parse(localStorage.getItem(key)||'null')?.user}catch{}}}
  if(!ok&&navigator.onLine){location.replace('/login.html');return}
  $('authLoading').classList.add('hidden');$('app').classList.remove('hidden');
}

$('backBtn').onclick=()=>location.href='/';
$('system').onchange=populate;$('baseMode').onchange=render;$('recipe').onchange=render;$('batch').oninput=render;$('unit').onchange=render;$('generate').onclick=render;
document.querySelectorAll('[data-kg]').forEach(b=>b.onclick=()=>{$('batch').value=b.dataset.kg;$('unit').value='kg';render()});
$('save').onclick=saveBatch;$('print').onclick=()=>window.print();$('share').onclick=shareRecipe;
$('clearHistory').onclick=()=>{if(confirm('Clear saved batch history?')){localStorage.removeItem('kt_icecream_batches_v2');historyRender()}};

populate();historyRender();auth();
