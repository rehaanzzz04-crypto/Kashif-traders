'use strict';

const SOURCE_CARPIGIANI='https://www.gelatouniversity.com/binary_files/hpdedicate_materiali/07___ENG___Recipe_book_Basic_course_25_26_12561.pdf';
const SOURCE_GUELPH='https://books.lib.uoguelph.ca/icecreamtechnologyebook/chapter/suggested-mixes-for-ice-cream/';
const SOURCE_TETRA='https://dairyprocessinghandbook.tetrapak.com/chapter/ice-cream';
const SOURCE_ICE='https://www.ice.edu/blog/science-of-ice-cream';
const SOURCE_SALTSTRAW='https://saltandstraw.com/blogs/news/we-teamed-up-with-thrillist-to-level-up-your-homemade-ice-cream';
const SOURCE_INNOVA='https://www.innovaitalia.com/en/chocolate-ice-cream-recipe-2/';
const SOURCE_CALLEBAUT_SAUCE='https://www.callebaut.com/en/callebaut-chocolate-academy/tutorials/chocolate-sauce';
const SOURCE_CALLEBAUT_CARAMEL='https://www.callebaut.com/en/recipes/Caramel-Milkshake/4004';
const SOURCE_CALLEBAUT_BROWNIE='https://www.callebaut.com/en/recipes/classic-chocolate-brownies/3552';
const SOURCE_CALLEBAUT_BROWNIE2='https://www.callebaut.com/en/recipes/brownie/1233';
const SOURCE_KING_HOTFUDGE='https://www.kingarthurbaking.com/recipes/hot-fudge-sauce-recipe';
const SOURCE_KING_CARAMEL='https://www.kingarthurbaking.com/recipes/caramel-sauce-recipe';
const SOURCE_KING_BUTTERSCOTCH='https://www.kingarthurbaking.com/recipes/butterscotch-sauce-recipe';

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
    {id:'guelph-hard-10',name:'Research Hard Mix 1 - 10% Fat',tier:'Standard',overrun:'100-120%',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:10,msnf:11,sucrose:10,glucose:5,stabilizer:.35,emulsifier:.15},
    {id:'guelph-hard-11',name:'Research Hard Mix 2 - 11% Fat',tier:'Standard',overrun:'100-120%',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:11,msnf:11,sucrose:10,glucose:5,stabilizer:.35,emulsifier:.15},
    {id:'guelph-hard-12',name:'Research Hard Mix 3 - 12% Fat',tier:'Premium',overrun:'60-90%',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:12,msnf:10.5,sucrose:12,glucose:4,stabilizer:.30,emulsifier:.15},
    {id:'guelph-hard-13',name:'Research Hard Mix 4 - 13% Fat',tier:'Premium',overrun:'60-90%',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:13,msnf:10.5,sucrose:14,glucose:3,stabilizer:.30,emulsifier:.14},
    {id:'guelph-hard-14',name:'Research Hard Mix 5 - 14% Fat',tier:'Premium',overrun:'60-90%',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:14,msnf:10,sucrose:14,glucose:3,stabilizer:.25,emulsifier:.13},
    {id:'guelph-hard-15',name:'Research Hard Mix 6 - 15% Fat',tier:'Super Premium',overrun:'25-50%',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:15,msnf:10,sucrose:15,glucose:0,stabilizer:.20,emulsifier:.12},
    {id:'guelph-hard-16',name:'Research Hard Mix 7 - 16% Fat',tier:'Super Premium',overrun:'25-50%',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:16,msnf:9.5,sucrose:15,glucose:0,stabilizer:.15,emulsifier:.10},
    {id:'ice-vanilla',name:'ICE Professional Vanilla',tier:'Institute Recipe',sourceClass:'institute',sourceName:'Institute of Culinary Education',sourceUrl:SOURCE_ICE,baseMass:1800,items:[['Whole milk',970],['Nonfat dry milk',97],['Sugar sucrose',200],['Glucose powder',85],['Sugar sucrose (2)',80],['Ice cream stabilizer blend',8],['Pasteurized egg yolks',60],['Heavy cream',360]]},
    {id:'innova-chocolate',name:'Innova Professional Chocolate - 5 kg',tier:'Manufacturer Recipe',sourceClass:'training',sourceName:'Innova Italia',sourceUrl:SOURCE_INNOVA,baseMass:4912,items:[['Fresh whole milk',2600],['Fresh cream 35%',800],['Granulated sugar',600],['Dextrose',200],['Skimmed milk powder',150],['Cocoa powder 22/24',150],['Dark chocolate 70%',400],['Neutral stabilizer',10],['Fine salt',2]]}
  ],
  soft:[
    {id:'guelph-soft-1',name:'Research Soft Serve Mix 1',tier:'Soft Frozen',overrun:'Machine dependent',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:10,msnf:12.5,sucrose:13,glucose:0,stabilizer:.35,emulsifier:.15},
    {id:'guelph-soft-2',name:'Research Soft Serve Mix 2 - CSS',tier:'Soft Frozen',overrun:'Machine dependent',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:10,msnf:12,sucrose:10,glucose:4,stabilizer:.15,emulsifier:.15}
  ],
  'frozen-yogurt':[
    {id:'guelph-fy',name:'Research Frozen Yogurt Base',tier:'Frozen Yogurt',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:2,msnf:14,sucrose:15,glucose:0,stabilizer:.35,emulsifier:0,yogurt:true}
  ],
  sherbet:[
    {id:'guelph-sherbet-1',name:'Research Sherbet Mix 1',tier:'Sherbet',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:.5,msnf:2,sucrose:24,glucose:9,stabilizer:.4,emulsifier:0,citric:.7,water:63.5,sherbet:true},
    {id:'guelph-sherbet-2',name:'Research Sherbet Mix 2',tier:'Sherbet',sourceClass:'institute',sourceName:'University of Guelph',sourceUrl:SOURCE_GUELPH,fat:1.5,msnf:3.5,sucrose:24,glucose:6,stabilizer:.3,emulsifier:0,citric:.7,water:64,sherbet:true}
  ],
  creator:[
    {id:'salt-straw-base',name:'Salt & Straw Official Ice Cream Base',tier:'Creator / Business',sourceClass:'creator',sourceName:'Salt & Straw',sourceUrl:SOURCE_SALTSTRAW,creatorVolume:true,originalUnits:'½ cup sugar; 2 Tbsp dry milk powder; ¼ tsp xanthan gum; 2 Tbsp light corn syrup; 1⅓ cups whole milk; 1⅓ cups heavy cream'}
  ]
};

const SUNDAE_RECIPES=[
  {id:'callebaut-choc-sauce',name:'Callebaut Belgian Chocolate Sauce',sourceClass:'training',sourceName:'Callebaut Chocolate Academy',sourceUrl:SOURCE_CALLEBAUT_SAUCE,baseMass:320,items:[['Whole milk',100],['Cream 35%',100],['Glucose syrup',20],['Dark chocolate',100]],method:['Heat milk, cream aur glucose syrup ko 50°C tak le jayen.','Dark chocolate add karke continuously stir karein jab tak sauce homogeneous ho.','Serving ke liye approximately 35°C target karein.']},
  {id:'callebaut-caramel',name:'Callebaut Professional Caramel Sauce',sourceClass:'training',sourceName:'Callebaut',sourceUrl:SOURCE_CALLEBAUT_CARAMEL,baseMass:476,items:[['Heavy cream',180],['Granulated sugar',180],['Glucose syrup',90],['Butter',20],['Smoked Maldon salt',6]],method:['Heavy cream ko warm rakhein.','Sugar ka dry light caramel banayein.','Warm cream se carefully deglaze karein.','Butter aur salt add karke smooth karein, phir cool karein.']},
  {id:'callebaut-dark-sauce',name:'Callebaut Dark Chocolate Sundae Sauce',sourceClass:'training',sourceName:'Callebaut',sourceUrl:'https://www.callebaut.com/en-GB/recipes/chocolate-brownie-ice-cream-sundae/5120?units=metric',baseMass:250,items:[['Dark chocolate 811',100],['Cream',150]],method:['Cream ko boil tak le jayen.','Hot cream chocolate par pour karein.','Smooth hone tak mix karein; cool karein aur service ke waqt reheat karein.']},
  {id:'callebaut-cocoa-sauce',name:'Callebaut Cocoa Chocolate Sauce',sourceClass:'training',sourceName:'Callebaut',sourceUrl:'https://www.callebaut.com/en-GB/recipes/slowcial-dessert-box/1519',baseMass:999,items:[['Sugar',98],['Cocoa powder 22/24',60],['Water',437],['Glucose syrup',98],['Dark chocolate C811',306]],method:['Sugar aur cocoa powder ko dry mix karein.','Water aur glucose syrup ko boil karein.','Sugar-cocoa mix add karke short boil karein.','Hot mix chocolate par pour karke immersion blender se homogeneous karein; overnight chill karein.']},
  {id:'king-hot-fudge',name:'King Arthur Hot Fudge Sauce',sourceClass:'institute',sourceName:'King Arthur Baking',sourceUrl:SOURCE_KING_HOTFUDGE,baseMass:405,items:[['Unsalted butter',57],['Unsweetened baking chocolate',43],['Half-and-half',113],['Granulated sugar',149],['Dutch-process cocoa',43]],method:['Butter aur chocolate ko medium-low heat par smooth melt karein.','Half-and-half whisk karein.','Sugar aur cocoa add karke whisk karein.','Boil tak le ja kar heat se remove karein; original formula ke mutabiq espresso, salt aur vanilla finish mein add karein.']},
  {id:'king-caramel',name:'King Arthur Caramel Sauce',sourceClass:'institute',sourceName:'King Arthur Baking',sourceUrl:SOURCE_KING_CARAMEL,baseMass:424,items:[['Granulated sugar',198],['Water',28],['Unsalted butter',85],['Heavy cream',113]],method:['Sugar aur water ko heavy saucepan mein medium-high heat par caramelize karein; crystallization se bachne ke liye pan swirl karein.','Light-to-medium amber par heat se remove karein.','Butter gradually add karein, phir cream slowly add karke smooth karein.','Original formula ke mutabiq salt/cream of tartar/vanilla finishing mein use karein.']},
  {id:'king-butterscotch',name:'King Arthur Butterscotch Sauce',sourceClass:'institute',sourceName:'King Arthur Baking',sourceUrl:SOURCE_KING_BUTTERSCOTCH,baseMass:1842,items:[['Light brown sugar',354],['Dark brown sugar',354],['Unsalted butter',227],['Heavy cream',907]],method:['Sugars aur butter ko medium heat par just melt hone tak cook karein.','Cream ko four additions mein add karein; har addition ke darmiyan simmer/reduce karein.','Sauce slightly sheet karne lage to heat se remove karein.','Original formula ke mutabiq vanilla aur salts finish mein add karein.']}
];

const BROWNIE_RECIPES=[
  {id:'callebaut-classic',name:'Callebaut Classic Chocolate Brownie',sourceClass:'training',sourceName:'Callebaut',sourceUrl:SOURCE_CALLEBAUT_BROWNIE,baseMass:1201,items:[['Butter 82%',208],['Dark chocolate 811',208],['Sugar',162],['Dark brown sugar',162],['Cocoa powder',51],['All-purpose flour',115],['Potato starch',62],['Sea salt',2],['Whole eggs',231]],method:['Butter aur chocolate ko gently melt karke smooth karein.','Dry ingredients add karte hue whisk karein.','Eggs akhir mein add karein.','Molds mein pipe karein aur 160°C par approximately 12 minutes bake karein.','Cool/freeze briefly, unmold karein aur chilled reserve karein.']},
  {id:'callebaut-pecan',name:'Callebaut Pecan Brownie',sourceClass:'training',sourceName:'Callebaut',sourceUrl:SOURCE_CALLEBAUT_BROWNIE2,baseMass:999,items:[['Dark chocolate 70-30-38',149],['Fresh butter',176],['Caster sugar',253],['Whole eggs',167],['Pastry flour',87],['Pecan nuts',167]],method:['Chocolate aur butter ko 45°C tak melt karein.','Sugar aur eggs ko gently whisk karke chocolate-butter mix mein combine karein.','Flour fold karein, phir pecans add karein.','Tray mein spread karke 180°C par 8-10 minutes bake karein; center moist rakhein.']},
  {id:'callebaut-dense',name:'Callebaut Dense Dark Brownie',sourceClass:'training',sourceName:'Callebaut',sourceUrl:'https://www.callebaut.com/en-GB/recipes/brownie/1332',baseMass:862,items:[['Dark chocolate 70-30-38',95],['Butter',170],['Sugar',205],['Whole eggs',135],['Flour',85],['Pecan nuts',167]],method:['Chocolate aur butter ko 45°C tak melt karein.','Sugar aur eggs ko pale hone tak beat karein; chocolate mix fold karein.','Flour aur pecans fold karein.','At least 1 cm layer mein spread karke 180°C par 12-15 minutes bake karein.']},
  {id:'king-fudge',name:'King Arthur Fudge Brownies',sourceClass:'institute',sourceName:'King Arthur Baking',sourceUrl:'https://www.kingarthurbaking.com/recipes/fudge-brownies-recipe',originalOnly:true,originalUnits:'4 large eggs; 106g cocoa; salt; baking powder; espresso optional; vanilla; 227g butter; 447g sugar; 180g flour; 340g chocolate chips',method:['Oven 350°F / 177°C preheat karein aur 9x13 pan prepare karein.','Eggs, cocoa aur dry seasonings ko combine karein.','Butter melt karke sugar ke saath 110-120°F tak warm karein.','Mixtures combine karke flour/chips fold karein aur 28-32 minutes bake karein.']}
];
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
let ingredientSettings={
  whole_milk:{name:'Whole Milk',fat_pct:3.5,msnf_pct:8.5},
  cream:{name:'Cream',fat_pct:35,msnf_pct:5.5},
  dry_milk_profiles:[{id:'melco-26',name:'Melco Vegetable Fat Filled Powder',fat_pct:26,protein_pct:16,carbs_pct:50,moisture_pct:4,other_pct:4,added_sugar_pct:null,note:'Bag label profile'}],
  cremodan_profiles:[],
  default_dry_milk_id:'melco-26',
  default_cremodan_id:null
};
const settingsKey='kt_gelato_ingredient_settings_v1';

function activeDryMilkProfile(){
  return ingredientSettings.dry_milk_profiles?.find(x=>x.id===ingredientSettings.default_dry_milk_id)||ingredientSettings.dry_milk_profiles?.[0]||null;
}
function activeCremodanProfile(){
  return ingredientSettings.cremodan_profiles?.find(x=>x.id===ingredientSettings.default_cremodan_id)||null;
}
function powderNonFatSolids(p){
  if(!p)return .96;
  const sum=Number(p.protein_pct||0)+Number(p.carbs_pct||0)+Number(p.other_pct||0);
  return Math.max(0,Math.min(.99,(sum>0?sum:(100-Number(p.fat_pct||0)-Number(p.moisture_pct||0)))/100));
}
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
  if(t.items){
    const base=Number(t.baseMass||t.items.reduce((s,i)=>s+Number(i[1]||0),0))||1000;
    return t.items.map(i=>[i[0],Number(i[1])*1000/base]);
  }
  const powder=activeDryMilkProfile(),cremodan=activeCremodanProfile();
  const sugar=t.sucrose*10, glucose=t.glucose*10, citric=Number(t.citric||0)*10, fixedWater=Number(t.water||0)*10;
  const cremodanG=cremodan?Math.max(0,Number(cremodan.dosage_g_per_kg||0)):0;
  const stab=cremodan?0:t.stabilizer*10;
  const emul=cremodan&&cremodan.includes_emulsifier!==false?0:t.emulsifier*10;
  const dairy=1000-sugar-glucose-stab-emul-cremodanG-citric-fixedWater, fat=t.fat*10, msnf=t.msnf*10;
  const milkFat=Math.max(.0001,Number(ingredientSettings.whole_milk?.fat_pct||3.5)/100);
  const milkMsnf=Math.max(0,Number(ingredientSettings.whole_milk?.msnf_pct||8.5)/100);
  const creamFat=Math.max(.0001,Number(ingredientSettings.cream?.fat_pct||35)/100);
  const creamMsnf=Math.max(0,Number(ingredientSettings.cream?.msnf_pct||5.5)/100);
  const powderFat=Math.max(0,Number(powder?.fat_pct||1)/100);
  const powderMsnf=powderNonFatSolids(powder);
  let x,names;
  if(mode==='fresh'){
    x=solve3([[1,1,1],[milkFat,creamFat,powderFat],[milkMsnf,creamMsnf,powderMsnf]],[dairy,fat,msnf]);
    names=[ingredientSettings.whole_milk?.name||'Whole Milk',ingredientSettings.cream?.name||'Cream',powder?.name||'Dry Milk Powder'];
  }else{
    x=solve3([[1,1,1],[0,creamFat,powderFat],[0,creamMsnf,powderMsnf]],[dairy,fat,msnf]);
    names=['Water',ingredientSettings.cream?.name||'Cream',powder?.name||'Dry Milk Powder'];
  }
  if(x.some(v=>!Number.isFinite(v)||v<-.01))throw Error('Selected ingredient composition is not able to meet this recipe target. Dry milk / cream profile check karein.');
  const items=names.map((n,i)=>[n,Math.max(0,x[i])]);
  if(sugar)items.push(['Sugar sucrose',sugar]);
  if(glucose)items.push(['Glucose/corn syrup solids',glucose]);
  if(cremodanG)items.push([cremodan.grade||'CREMODAN',cremodanG]);
  if(stab)items.push(['Stabilizer (supplier dosage check)',stab]);
  if(emul)items.push(['Emulsifier (supplier dosage check)',emul]);
  if(citric)items.push(['Citric acid 50% solution - add before freezing',citric]);
  if(fixedWater)items.unshift(['Water',fixedWater]);
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
function sourceBlock(kind,r){
  if(kind==='gelato')return '<div class="source"><b>Source:</b> Carpigiani Gelato University, Basic Gelato Course Recipe Book'+(r?.page?' • page '+r.page:'')+'.<br><a target="_blank" rel="noopener" href="'+SOURCE_CARPIGIANI+'">Open official source</a></div>';
  if(r?.sourceName)return '<div class="source"><b>Source:</b> '+esc(r.sourceName)+' • '+esc(r.tier||'Professional Recipe')+'.<br><a target="_blank" rel="noopener" href="'+esc(r.sourceUrl||SOURCE_GUELPH)+'">Open original source</a></div>';
  return '<div class="source"><b>Source:</b> University of Guelph Ice Cream Technology e-Book + Tetra Pak Dairy Processing Handbook.<br><a target="_blank" rel="noopener" href="'+SOURCE_GUELPH+'">University of Guelph</a> • <a target="_blank" rel="noopener" href="'+SOURCE_TETRA+'">Tetra Pak</a></div>';
}
function methods(kind,cat,r){
  if(kind==='frozen-yogurt')return[
    'Research target ke mutabiq dairy mix prepare karein; sugar aur stabilizer exact weight se disperse karein.',
    'Total mix ka approximately 20% yogurt portion ke liye skim milk + skim milk powder se cultured phase banaya ja sakta hai.',
    'Cultured portion ko high-temperature yogurt process ke mutabiq pasteurize karein, 40-43°C range par culture inoculate karein, desired acidity tak ferment karein, phir rapidly chill karein.',
    'Sweet dairy mix ko ice-cream process ke mutabiq pasteurize/homogenize/cool karein aur chilled cultured yogurt portion ke saath blend karein.',
    'Completed mix ko age karein, flavor add karein aur batch/continuous freezer mein freeze karein.'
  ];
  if(kind==='sherbet')return[
    'Water, sugars, milk ingredients aur stabilizer/emulsifier ko exact weights se blend karein.',
    'Approved pasteurization process follow karein aur rapidly chill karein.',
    'Mix ko age karein; citric acid solution freezing se just pehle add karein.',
    'Fruit use karna ho to research guidance ke mutabiq approximately 25% fruit addition se start karein aur final solids/acidity rebalance karein.',
    'Batch freezer mein freeze karein aur hardening/storage cold chain maintain karein.'
  ];
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

function ingredientComposition(name){
  const n=String(name||'').toLowerCase();
  const powder=activeDryMilkProfile();
  const milk=ingredientSettings.whole_milk||{};
  const cream=ingredientSettings.cream||{};
  if(n.includes('whole milk')||n===String(milk.name||'').toLowerCase())return {fat:Number(milk.fat_pct||0),protein:Number(milk.protein_pct||0),lactose:Number(milk.lactose_pct||0),ash:Number(milk.ash_pct||0),moisture:Number(milk.moisture_pct||0),sucrose:0,dextrose:0,glucose:0,known:true};
  if(n.includes('cream')||n===String(cream.name||'').toLowerCase())return {fat:Number(cream.fat_pct||0),protein:Number(cream.protein_pct||0),lactose:Number(cream.lactose_pct||0),ash:Number(cream.ash_pct||0),moisture:Number(cream.moisture_pct||0),sucrose:0,dextrose:0,glucose:0,known:true};
  if(powder&&(n.includes('milk powder')||n.includes('fat filled')||n===String(powder.name||'').toLowerCase()))return {fat:Number(powder.fat_pct||0),protein:Number(powder.protein_pct||0),lactose:powder.lactose_pct==null?0:Number(powder.lactose_pct||0),ash:powder.ash_pct==null?0:Number(powder.ash_pct||0),moisture:Number(powder.moisture_pct||0),sucrose:powder.added_sugar_pct==null?0:Number(powder.added_sugar_pct||0),dextrose:0,glucose:0,known:powder.lactose_pct!=null&&powder.added_sugar_pct!=null};
  if(n.includes('sugar sucrose')||n==='sugar'||n.includes('granulated sugar')||n.includes('caster sugar'))return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:100,dextrose:0,glucose:0,known:true};
  if(n.includes('dextrose'))return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:100,glucose:0,known:true};
  if(n.includes('glucose'))return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:0,glucose:100,known:true};
  if(n.includes('water'))return {fat:0,protein:0,lactose:0,ash:0,moisture:100,sucrose:0,dextrose:0,glucose:0,known:true};
  if(n.includes('butter'))return {fat:82,protein:1,moisture:16,sucrose:0,dextrose:0,glucose:0,lactose:.7,ash:.3,known:true};
  if(n.includes('egg yolk'))return {fat:26.5,protein:15.9,moisture:52,sucrose:0,dextrose:0,glucose:0,lactose:0,ash:1.7,known:true};
  if(n.includes('cocoa'))return {fat:22,protein:20,moisture:4,sucrose:0,dextrose:0,glucose:0,lactose:0,ash:6,known:false};
  if(n.includes('dark chocolate'))return {fat:40,protein:7,moisture:1,sucrose:30,dextrose:0,glucose:0,lactose:0,ash:2,known:false};
  return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:0,glucose:0,known:false};
}
function compositionAnalysis(items,total){
  const acc={fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:0,glucose:0,covered:0};
  items.forEach(i=>{
    const c=ingredientComposition(i.name),f=Number(i.g||0)/total;
    ['fat','protein','lactose','ash','moisture','sucrose','dextrose','glucose'].forEach(k=>acc[k]+=f*Number(c[k]||0));
    if(c.known)acc.covered+=Number(i.g||0);
  });
  const knownSolids=100-acc.moisture;
  const pod=acc.sucrose*1+acc.dextrose*.74+acc.glucose*.5+acc.lactose*.16;
  const pac=acc.sucrose*1+acc.dextrose*1.9+acc.glucose*.8+acc.lactose*1;
  const coverage=Math.max(0,Math.min(100,(acc.covered/total)*100));
  const warnings=[];
  if(coverage<90)warnings.push('Ingredient composition data incomplete hai; analysis estimate hai.');
  if(acc.lactose>10)warnings.push('Lactose load high hai; sandy texture / lactose crystallization risk barh sakta hai.');
  if(knownSolids<32)warnings.push('Total solids low side par hain; body weak ya icy ho sakti hai.');
  if(knownSolids>46)warnings.push('Total solids high hain; body heavy ya freezing difficult ho sakti hai.');
  return {
    fat:acc.fat,protein:acc.protein,lactose:acc.lactose,totalSolids:knownSolids,water:acc.moisture,
    sucrose:acc.sucrose,dextrose:acc.dextrose,glucose:acc.glucose,pod,pac,coverage,warnings
  };
}
function compositionHtml(a){
  return '<div class="subpanel"><h3>Advanced Composition</h3><div class="balance">'+
    [['Fat',a.fat],['Protein',a.protein],['Lactose',a.lactose],['Total Solids',a.totalSolids],['Water',a.water],['Data Coverage',a.coverage]].map(x=>'<div><small>'+x[0]+'</small><strong>'+Number(x[1]).toFixed(1)+'%</strong></div>').join('')+
    '</div><div class="balance" style="margin-top:8px">'+
    [['Sweetness Index',a.pod],['Freezing Index',a.pac],['Sucrose',a.sucrose],['Dextrose',a.dextrose],['Glucose solids',a.glucose],['Known solids',a.totalSolids]].map(x=>'<div><small>'+x[0]+'</small><strong>'+Number(x[1]).toFixed(1)+'</strong></div>').join('')+
    '</div>'+(a.warnings.length?'<div class="warning">'+a.warnings.map(x=>'• '+esc(x)).join('<br>')+'</div>':'')+
    '<div class="source">Sweetness/Freezing indexes are comparative formulation indexes, not a laboratory freezing-point measurement. Ingredient COA coverage improves accuracy.</div></div>';
}
function ingredientTable(rows,total){
  return '<div class="tablewrap"><table><thead><tr><th>Ingredient</th><th>Required Weight</th><th>% Batch</th></tr></thead><tbody>'+
    rows.map(x=>'<tr><td>'+esc(x.name)+'</td><td class="qty">'+fmt(x.g)+'</td><td class="pct">'+((x.g/total)*100).toFixed(2)+'%</td></tr>').join('')+
    '<tr class="totalRow"><td>Total Batch</td><td>'+fmt(total)+'</td><td>100.00%</td></tr></tbody></table></div>';
}
function sourceClassFor(r,kind){return r?.sourceClass||(kind==='gelato'?'training':'institute')}
function departmentList(){
  const dep=$('department')?.value||'icecream';
  if(dep==='sauces')return SUNDAE_RECIPES;
  if(dep==='brownies')return BROWNIE_RECIPES;
  const kind=$('system').value;
  return kind==='gelato'?GELATO:(TARGETS[kind]||[]);
}
function populate(){
  const dep=$('department')?.value||'icecream',kind=$('system').value;
  $('systemWrap')?.classList.toggle('hidden',dep!=='icecream');
  $('baseModeWrap').classList.toggle('hidden',dep!=='icecream'||kind==='gelato'||kind==='sherbet');
  let list=departmentList();
  if(dep==='icecream' && ($('sourceType')?.value||'all')==='creator' && kind==='hard') list=[...list,...TARGETS.creator];
  const sourceFilter=$('sourceType')?.value||'all';
  if(sourceFilter!=='all')list=list.filter(r=>sourceClassFor(r,kind)===sourceFilter);
  $('recipe').innerHTML=list.map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('');
  if(!list.length){
    $('result').innerHTML='<div class="recipeHead"><div><h2>No verified recipe in this section yet</h2><p>Source quality filter active hai.</p></div><span class="badge">Quality Gate</span></div>';
    return;
  }
  render();
}
function getRecipe(){
  const dep=$('department')?.value||'icecream',kind=$('system').value;
  let list=departmentList();
  if(dep==='icecream'&&kind==='hard')list=[...list,...TARGETS.creator];
  return list.find(r=>r.id===$('recipe').value);
}
function render(){
  const kind=$('system').value,r=getRecipe(),total=batchGrams();
  if(!r||!Number.isFinite(total)||total<=0){$('result').innerHTML='<div class="warning">Valid batch quantity enter karein.</div>';return}
  let items,stats,subtitle,src,raw=null;
  const dep=$('department')?.value||'icecream';
  if(dep!=='icecream'){
    if(r.originalOnly){
      current={kind:dep,r,total,items:[]};
      $('result').innerHTML='<div class="recipeHead"><div><h2>'+esc(r.name)+'</h2><p>'+esc(dep==='sauces'?'Sundae Sauce':'Professional Brownie')+'</p></div><span class="badge">'+esc(r.sourceName)+'</span></div><div class="warning"><b>Original source batch:</b><br>'+esc(r.originalUnits)+'</div><div class="subpanel"><h3>Production Method</h3><div class="steps">'+r.method.map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div></div>'+sourceBlock('direct',r);
      return;
    }
    const base=Number(r.baseMass||r.items.reduce((s,i)=>s+Number(i[1]||0),0));
    items=r.items.map(i=>({name:i[0],g:Number(i[1])*total/base}));
    current={kind:dep,r,total,items};
    const depName=dep==='sauces'?'Sundae Syrup / Sauce':'Professional Brownie';
    $('result').innerHTML='<div class="recipeHead"><div><h2>'+esc(r.name)+'</h2><p>'+esc(depName)+' • scalable professional formula</p></div><span class="badge">'+esc(r.sourceName)+'</span></div>'+
      '<div class="stats"><div class="stat"><small>Batch</small><strong>'+fmt(total)+'</strong></div><div class="stat"><small>Source Batch</small><strong>'+fmt(base)+'</strong></div><div class="stat"><small>Ingredients</small><strong>'+items.length+'</strong></div><div class="stat"><small>Source Type</small><strong>'+esc(sourceClassFor(r,dep)==='training'?'Professional':'Institute')+'</strong></div></div>'+
      ingredientTable(items,total)+compositionHtml(compositionAnalysis(items,total))+
      '<div class="split"><div class="subpanel"><h3>Production Method</h3><div class="steps">'+r.method.map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div></div><div>'+sourceBlock('direct',r)+'<div class="warning"><b>Scaling note:</b> Formula weight ratio se scale hoti hai. Baking recipes mein pan depth aur bake time batch size ke saath separately validate karein.</div></div></div>';
    return;
  }
  if(kind==='gelato'){
    items=scale(r.items,total);raw=expand(r.items,total);
    stats=gelatoStats(r.solids);subtitle='Official Carpigiani formula • source page '+r.page;
    src=sourceBlock('gelato',r);
  }else{
    const base=$('baseMode').value;
    if(r.creatorVolume){
      current={kind,r,total,items:[]};
      $('result').innerHTML='<div class="recipeHead"><div><h2>'+esc(r.name)+'</h2><p>Professional Creator / Business Recipe</p></div><span class="badge">Creator / Business</span></div><div class="warning"><b>Original verified source uses volume measures.</b><br>'+esc(r.originalUnits)+'<br><br>Is formula ko arbitrary kg scaling ke liye tabhi enable kiya jayega jab ingredients ek controlled test batch mein grams mein weighed aur mass-balanced ho jayen. Original source link neeche diya gaya hai.</div>'+sourceBlock(kind,r);
      return;
    }
    items=scale(componentRecipe(r,base),total);stats=targetStats(r);
    const typeName=kind==='hard'?'Hard ice cream':kind==='soft'?'Soft serve':kind==='frozen-yogurt'?'Frozen yogurt':'Sherbet / Sorbet';
    subtitle=typeName+' • '+(r.tier||'Research Formula')+' • '+(base==='fresh'?'Fresh Milk Base':'Dry Milk Base')+(r.overrun?' • target overrun '+r.overrun:'');
    src=sourceBlock(kind,r);
  }
  current={kind,r,total,items};
  const statHtml=stats.map(x=>'<div class="stat"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('');
  const method=methods(kind,r.cat,r);
  const hasPrepared=kind==='gelato'&&r.items.some(x=>BASES[x[0]]);
  $('result').innerHTML=
    '<div class="recipeHead"><div><h2>'+esc(r.name)+'</h2><p>'+esc(subtitle)+'</p></div><span class="badge">'+esc(kind==='gelato'?(r.cat||'Gelato'):kind==='hard'?'Hard Ice Cream':kind==='soft'?'Soft Serve':kind==='frozen-yogurt'?'Frozen Yogurt':'Sherbet / Sorbet')+'</span></div>'+
    '<div class="stats">'+
      '<div class="stat"><small>Batch</small><strong>'+fmt(total)+'</strong></div>'+
      '<div class="stat"><small>Base System</small><strong>'+esc(kind==='gelato'?'Carpigiani':($('baseMode').value==='fresh'?'Fresh Milk':'Dry Milk'))+'</strong></div>'+
      '<div class="stat"><small>Ingredients</small><strong>'+items.length+'</strong></div>'+
      '<div class="stat"><small>Recipe Type</small><strong>'+esc(kind==='gelato'?'Gelato':kind==='hard'?'Hard':kind==='soft'?'Soft':kind==='frozen-yogurt'?'Frozen Yogurt':'Sherbet')+'</strong></div>'+
    '</div>'+
    (hasPrepared?'<div class="tabs"><button class="tab active" data-view="book">Book Formula</button><button class="tab" data-view="raw">Expanded Raw Ingredients</button></div>':'')+
    '<div id="formulaTable">'+ingredientTable(items,total)+'</div>'+compositionHtml(compositionAnalysis(items,total))+
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

function profileId(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
function renderIngredientProfiles(){
  const w=ingredientSettings.whole_milk||{},c=ingredientSettings.cream||{};
  $('wholeMilkFat').value=w.fat_pct??3.5;$('wholeMilkMsnf').value=w.msnf_pct??8.5;
  $('creamFat').value=c.fat_pct??35;$('creamMsnf').value=c.msnf_pct??5.5;
  const powders=ingredientSettings.dry_milk_profiles||[];
  $('dryMilkProfiles').innerHTML=powders.map((p,i)=>'<div class="profileCard" data-powder="'+i+'"><div class="profileCardHead"><b>'+esc(p.name||('Dry Milk '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-powder="'+i+'">Delete</button></div><div class="profileGrid"><label>Name<input data-k="name" value="'+esc(p.name||'')+'"></label><label>Fat %<input data-k="fat_pct" type="number" step="0.1" value="'+Number(p.fat_pct||0)+'"></label><label>Protein %<input data-k="protein_pct" type="number" step="0.1" value="'+Number(p.protein_pct||0)+'"></label><label>Carbohydrates %<input data-k="carbs_pct" type="number" step="0.1" value="'+Number(p.carbs_pct||0)+'"></label><label>Moisture %<input data-k="moisture_pct" type="number" step="0.1" value="'+Number(p.moisture_pct||0)+'"></label><label>Other Solids %<input data-k="other_pct" type="number" step="0.1" value="'+Number(p.other_pct||0)+'"></label><label>Known Added Sugar %<input data-k="added_sugar_pct" type="number" step="0.1" value="'+(p.added_sugar_pct??'')+'" placeholder="optional"></label><label class="wide">Notes<input data-k="note" value="'+esc(p.note||'')+'"></label></div></div>').join('');
  $('defaultDryMilk').innerHTML=powders.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('defaultDryMilk').value=ingredientSettings.default_dry_milk_id||powders[0]?.id||'';

  const creams=ingredientSettings.cremodan_profiles||[];
  $('cremodanProfiles').innerHTML=creams.map((p,i)=>'<div class="profileCard" data-cremodan="'+i+'"><div class="profileCardHead"><b>'+esc(p.grade||('CREMODAN '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-cremodan="'+i+'">Delete</button></div><div class="profileGrid"><label>Grade / Number<input data-k="grade" value="'+esc(p.grade||'')+'" placeholder="e.g. SE 46"></label><label>Dosage g/kg<input data-k="dosage_g_per_kg" type="number" step="0.1" value="'+Number(p.dosage_g_per_kg||0)+'"></label><label>Product Type<input data-k="product_type" value="'+esc(p.product_type||'General')+'"></label><label>Includes Emulsifier<select data-k="includes_emulsifier"><option value="true" '+(p.includes_emulsifier!==false?'selected':'')+'>Yes</option><option value="false" '+(p.includes_emulsifier===false?'selected':'')+'>No</option></select></label><label class="wide">Notes<input data-k="note" value="'+esc(p.note||'')+'"></label></div></div>').join('');
  $('defaultCremodan').innerHTML='<option value="">None</option>'+creams.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.grade)+'</option>').join('');
  $('defaultCremodan').value=ingredientSettings.default_cremodan_id||'';
  $('dryMilkProfiles').querySelectorAll('[data-del-powder]').forEach(b=>b.onclick=()=>{ingredientSettings.dry_milk_profiles.splice(Number(b.dataset.delPowder),1);renderIngredientProfiles()});
  $('cremodanProfiles').querySelectorAll('[data-del-cremodan]').forEach(b=>b.onclick=()=>{ingredientSettings.cremodan_profiles.splice(Number(b.dataset.delCremodan),1);renderIngredientProfiles()});
}
function collectProfiles(){
  ingredientSettings.whole_milk={name:'Whole Milk',fat_pct:Number($('wholeMilkFat').value||0),msnf_pct:Number($('wholeMilkMsnf').value||0)};
  ingredientSettings.cream={name:'Cream',fat_pct:Number($('creamFat').value||0),msnf_pct:Number($('creamMsnf').value||0)};
  document.querySelectorAll('#dryMilkProfiles [data-powder]').forEach(card=>{
    const p=ingredientSettings.dry_milk_profiles[Number(card.dataset.powder)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=x.type==='number'?(x.value===''?null:Number(x.value)):x.value});
  });
  document.querySelectorAll('#cremodanProfiles [data-cremodan]').forEach(card=>{
    const p=ingredientSettings.cremodan_profiles[Number(card.dataset.cremodan)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=k==='includes_emulsifier'?x.value==='true':x.type==='number'?Number(x.value||0):x.value});
  });
  ingredientSettings.default_dry_milk_id=$('defaultDryMilk').value||ingredientSettings.dry_milk_profiles[0]?.id||null;
  ingredientSettings.default_cremodan_id=$('defaultCremodan').value||null;
}
async function loadIngredientSettings(){
  try{
    const r=await fetch('/api/data?resource=gelato_settings',{cache:'no-store'});
    if(r.ok){const j=await r.json();if(j.settings)ingredientSettings=j.settings;}
    else throw Error('settings unavailable');
  }catch{
    try{const saved=JSON.parse(localStorage.getItem(settingsKey)||'null');if(saved)ingredientSettings=saved;}catch{}
  }
  localStorage.setItem(settingsKey,JSON.stringify(ingredientSettings));
}
async function saveIngredientSettings(){
  collectProfiles();$('profileStatus').textContent='Saving…';
  localStorage.setItem(settingsKey,JSON.stringify(ingredientSettings));
  try{
    const r=await fetch('/api/data?resource=gelato_settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(ingredientSettings)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Save failed');
    if(j.settings)ingredientSettings=j.settings;
    $('profileStatus').textContent='Saved';
    renderIngredientProfiles();render();
  }catch(e){$('profileStatus').textContent='Saved locally • '+(e.message||'cloud unavailable');render();}
}

function currentBusinessPayload(){
  if(!current?.r||!Array.isArray(current.items)||!current.items.length)throw Error('Pehle complete recipe generate karein');
  const dep=$('department')?.value||'icecream',kind=$('system')?.value||dep;
  return {
    business_name:$('businessAccountName').value.trim()||'Kashif Traders',
    recipe_name:$('businessName').value.trim()||(current.r.name+' - Final'),
    department:dep,
    system:kind,
    base_mode:$('baseMode')?.value||null,
    source_recipe_id:current.r.id||null,
    source_name:current.r.sourceName||(kind==='gelato'?'Carpigiani Gelato University':null),
    source_url:current.r.sourceUrl||(kind==='gelato'?SOURCE_CARPIGIANI:null),
    source_type:sourceClassFor(current.r,kind),
    formula:current.items.map(x=>({name:x.name,g:Number(x.g)})),
    source_formula:current.items.map(x=>({name:x.name,g:Number(x.g)})),
    ingredient_settings:ingredientSettings,
    research_target:current.r.solids?{sugars:current.r.solids[0],fat:current.r.solids[1],msnf:current.r.solids[2],other_solids:current.r.solids[3],water:current.r.solids[4],total_solids:current.r.solids[5]}:{
      fat:current.r.fat??null,msnf:current.r.msnf??null,sucrose:current.r.sucrose??null,glucose:current.r.glucose??null,stabilizer:current.r.stabilizer??null,emulsifier:current.r.emulsifier??null
    },
    trial_notes:$('trialNotes').value.trim()||null,
    production_tested_at:$('productionTestDate').value||null
  };
}
function researchScoreHtml(r){
  const score=r?.perfection_score===null||r?.perfection_score===undefined?'—':Number(r.perfection_score).toFixed(1)+'%';
  const shelf=r?.validated_shelf_life||'Not validated';
  const comments=Array.isArray(r?.research_comments)?r.research_comments:[];
  return '<div class="researchReview"><div class="stats"><div class="stat"><small>Research Fit / Perfection</small><strong>'+esc(score)+'</strong></div><div class="stat"><small>Status</small><strong>'+esc((r?.status||'trial').toUpperCase())+'</strong></div><div class="stat"><small>Version</small><strong>V'+esc(r?.version||1)+'</strong></div><div class="stat"><small>Validated Shelf Life</small><strong>'+esc(shelf)+'</strong></div><div class="stat"><small>Production Confidence</small><strong>'+esc(r?.production_confidence==null?'0%':Number(r.production_confidence).toFixed(1)+'%')+'</strong></div></div>'+
    '<div class="subpanel"><h3>Research Comments</h3><div class="steps">'+comments.map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div></div>'+
    '<div class="source"><b>Shelf-life guidance:</b> '+esc(r?.shelf_life_guidance||'Finished product validation required.')+(r?.storage_conditions?'<br><b>Storage:</b> '+esc(r.storage_conditions):'')+'</div></div>';
}
async function saveCurrentBusinessRecipe(finalize=false){
  try{
    const payload=currentBusinessPayload();
    if(finalize&&!payload.production_tested_at)throw Error('Final recipe ke liye production test date select karein');
    const r=await fetch('/api/data?resource=gelato_recipes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Recipe save failed');
    let record=j.record;
    if(finalize){
      const r2=await fetch('/api/data?resource=gelato_recipes&id='+encodeURIComponent(record.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'finalize',production_tested_at:payload.production_tested_at,trial_notes:payload.trial_notes})});
      const j2=await r2.json().catch(()=>({}));
      if(!r2.ok)throw Error(j2.error||'Finalize failed');
      record=j2.record;
    }
    alert(finalize?'Production test passed — Business Final Recipe saved':'Production Trial saved');
    loadBusinessRecipes();
    $('result').insertAdjacentHTML('afterbegin',researchScoreHtml(record));
  }catch(e){alert(e.message||'Recipe save failed')}
}
async function loadBusinessRecipes(){
  try{
    const business=$('businessAccountName')?.value?.trim()||'Kashif Traders';
    const r=await fetch('/api/data?resource=gelato_recipes&business='+encodeURIComponent(business),{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Load failed');
    renderBusinessRecipes(j.records||[]);
  }catch(e){$('businessRecipeList').innerHTML='<div class="warning">'+esc(e.message||'Business recipes unavailable')+'</div>'}
}
function renderBusinessRecipes(rows){
  if(!rows.length){$('businessRecipeList').innerHTML='<div class="note">No business recipes saved yet.</div>';return}
  $('businessRecipeList').innerHTML=rows.map(r=>{
    const comments=Array.isArray(r.research_comments)?r.research_comments:[];
    return '<div class="businessRecipeCard"><div class="businessRecipeHead"><div><b>'+esc(r.recipe_name)+'</b><small>'+esc(r.business_name)+' • '+esc(r.department)+' • V'+esc(r.version)+'</small></div><span class="badge '+(r.status==='final'?'finalBadge':'')+'">'+esc(r.status)+'</span></div>'+
      '<div class="businessMetrics"><span>Research Fit <b>'+(r.perfection_score==null?'—':Number(r.perfection_score).toFixed(1)+'%')+'</b></span><span>Shelf Life <b>'+esc(r.validated_shelf_life||'Not validated')+'</b></span></div>'+
      (comments[0]?'<div class="miniComment">'+esc(comments[0])+'</div>':'')+
      '<div class="actions"><button class="ghost" data-view-business="'+r.id+'" type="button">View</button><button class="secondary" data-edit-business="'+r.id+'" type="button">Edit / Rebalance</button></div></div>';
  }).join('');
  $('businessRecipeList').querySelectorAll('[data-view-business]').forEach(b=>b.onclick=()=>viewBusinessRecipe(Number(b.dataset.viewBusiness)));
  $('businessRecipeList').querySelectorAll('[data-edit-business]').forEach(b=>b.onclick=()=>editBusinessRecipe(Number(b.dataset.editBusiness)));
}
async function fetchBusinessRecipe(id){
  const r=await fetch('/api/data?resource=gelato_recipes&id='+encodeURIComponent(id),{cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||'Recipe not found');
  return j;
}
async function viewBusinessRecipe(id){
  try{
    const {record,versions}=await fetchBusinessRecipe(id);
    $('businessRecipeList').innerHTML='<button class="ghost" id="backBusinessList" type="button">← Back</button><div class="businessRecipeCard"><h2>'+esc(record.recipe_name)+'</h2>'+researchScoreHtml(record)+
      '<div class="tablewrap"><table><thead><tr><th>Ingredient</th><th>Weight</th><th>% Formula</th></tr></thead><tbody>'+
      (record.formula||[]).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+fmt(Number(x.g||0))+'</td><td>'+(((Number(x.g||0)/(record.formula||[]).reduce((s,y)=>s+Number(y.g||0),0))*100)||0).toFixed(2)+'%</td></tr>').join('')+
      '</tbody></table></div><div class="source"><b>Version history:</b> '+(versions||[]).map(v=>'V'+v.version+' • '+new Date(v.changed_at).toLocaleString()).join(' | ')+'</div></div>';
    $('backBusinessList').onclick=loadBusinessRecipes;
    loadQcForRecipe(id);
  }catch(e){alert(e.message)}
}
async function editBusinessRecipe(id){
  try{
    const {record}=await fetchBusinessRecipe(id);
    const formula=Array.isArray(record.formula)?record.formula:[];
    $('businessRecipeList').innerHTML='<button class="ghost" id="backBusinessList" type="button">← Back</button><div class="businessRecipeCard"><h2>Edit '+esc(record.recipe_name)+'</h2><div class="warning">Manual change ke baad research score automatically recalculate hoga. Original research/master formula preserve rahega.</div>'+
      '<div id="businessFormulaEditor">'+formula.map((x,i)=>'<div class="editIngredientRow"><input data-edit-name="'+i+'" value="'+esc(x.name)+'"><input data-edit-g="'+i+'" type="number" step="0.1" min="0" value="'+Number(x.g||0)+'"><span>g</span></div>').join('')+'</div>'+
      '<label class="label">Trial / Change Notes</label><textarea class="field notesField" id="editRecipeNotes">'+esc(record.trial_notes||'')+'</textarea>'+
      '<label class="label">Production Test Date</label><input class="field" id="editTestDate" type="date" value="'+esc(record.production_tested_at?String(record.production_tested_at).slice(0,10):'')+'">'+
      '<label class="label">Validated Shelf Life</label><input class="field" id="editShelfLife" value="'+esc(record.validated_shelf_life||'')+'" placeholder="e.g. 12 weeks — validated">'+
      '<label class="label">Storage Conditions</label><input class="field" id="editStorage" value="'+esc(record.storage_conditions||'')+'" placeholder="e.g. -18°C or colder">'+
      '<div class="actions"><button class="secondary" id="saveBusinessEdit" type="button">Save New Version</button><button class="primary noTop" id="saveBusinessFinal" type="button">Save & Mark Final</button></div></div>';
    $('backBusinessList').onclick=loadBusinessRecipes;
    const save=async final=>{
      const updated=formula.map((x,i)=>({name:document.querySelector('[data-edit-name="'+i+'"]').value.trim()||x.name,g:Number(document.querySelector('[data-edit-g="'+i+'"]').value||0)})).filter(x=>x.g>0);
      const body={formula:updated,trial_notes:$('editRecipeNotes').value,production_tested_at:$('editTestDate').value||null,validated_shelf_life:$('editShelfLife').value,storage_conditions:$('editStorage').value};
      if(final)body.action='finalize';
      const r=await fetch('/api/data?resource=gelato_recipes&id='+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(j.error||'Update failed');
      alert('Recipe V'+j.record.version+' saved • Research Fit '+(j.record.perfection_score==null?'—':Number(j.record.perfection_score).toFixed(1)+'%'));
      viewBusinessRecipe(id);
    };
    $('saveBusinessEdit').onclick=()=>save(false).catch(e=>alert(e.message));
    $('saveBusinessFinal').onclick=()=>save(true).catch(e=>alert(e.message));
  }catch(e){alert(e.message)}
}

async function loadQcForRecipe(recipeId){
  try{
    const r=await fetch('/api/data?resource=gelato_qc&recipe_id='+encodeURIComponent(recipeId),{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'QC load failed');
    renderQcPanel(recipeId,j.records||[],j.recipe||{});
  }catch(e){$('businessRecipeList').insertAdjacentHTML('beforeend','<div class="warning">'+esc(e.message)+'</div>')}
}
function renderQcPanel(recipeId,rows,recipe){
  const cards=rows.map(x=>'<div class="qcCard"><div class="businessRecipeHead"><div><b>'+esc(x.batch_code||('QC #'+x.id))+'</b><small>'+esc(String(x.test_date||''))+' • '+esc(x.machine||'No machine')+'</small></div><span class="badge '+(x.result==='pass'?'finalBadge':'')+'">'+esc(x.result)+'</span></div><div class="businessMetrics"><span>Overrun <b>'+esc(x.overrun_pct??'—')+'%</b></span><span>Draw Temp <b>'+esc(x.draw_temp_c??'—')+'°C</b></span><span>Brix <b>'+esc(x.brix??'—')+'</b></span><span>pH <b>'+esc(x.ph??'—')+'</b></span></div></div>').join('');
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="businessRecipeCard"><h3>Production QC</h3><div class="stats"><div class="stat"><small>Production Confidence</small><strong>'+Number(recipe.production_confidence||0).toFixed(1)+'%</strong></div><div class="stat"><small>QC Batches</small><strong>'+rows.length+'</strong></div></div><div id="qcList">'+(cards||'<div class="note">No QC tests yet.</div>')+'</div><button class="primary" id="addQcBtn" type="button">+ Add QC Test</button><button class="secondary profileBtn" id="goldenBtn" type="button">Mark Golden Production Recipe</button></div>');
  $('addQcBtn').onclick=()=>showQcForm(recipeId);
  $('goldenBtn').onclick=()=>markGolden(recipeId);
}
function showQcForm(recipeId){
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="profileModal" id="qcModal"><div class="profileBox"><div class="profileHead"><div><h2>Production QC Test</h2><p>Actual production measurements enter karein.</p></div><button id="qcClose" class="ghost">Close</button></div><div class="profileGrid">'+
    '<label>Batch Code<input id="qcBatch"></label><label>Test Date<input id="qcDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label><label>Machine<input id="qcMachine"></label><label>Operator<input id="qcOperator"></label>'+
    '<label>Mix Temp °C<input id="qcMixTemp" type="number" step="0.1"></label><label>Pasteurization Peak °C<input id="qcPasteur" type="number" step="0.1"></label><label>Ageing Hours<input id="qcAge" type="number" step="0.1"></label><label>pH<input id="qcPh" type="number" step="0.01"></label>'+
    '<label>Brix<input id="qcBrix" type="number" step="0.1"></label><label>Overrun %<input id="qcOverrun" type="number" step="0.1"></label><label>Draw Temp °C<input id="qcDraw" type="number" step="0.1"></label><label>Melt 30min %<input id="qcMelt" type="number" step="0.1"></label>'+
    '<label>Hardness 1-10<input id="qcHard" type="number" min="1" max="10"></label><label>Sweetness 1-10<input id="qcSweet" type="number" min="1" max="10"></label><label>Iciness 1-10<input id="qcIce" type="number" min="1" max="10"></label><label>Body 1-10<input id="qcBody" type="number" min="1" max="10"></label>'+
    '<label>Aftertaste 1-10<input id="qcAfter" type="number" min="1" max="10"></label><label>Result<select id="qcResult"><option value="trial">Trial</option><option value="pass">Pass</option><option value="fail">Fail</option></select></label><label class="wide">Day 1 Notes<input id="qcDay1"></label><label class="wide">Day 7 Notes<input id="qcDay7"></label>'+
    '</div><button class="primary" id="saveQc">Save QC Test</button></div></div>');
  $('qcClose').onclick=()=>$('qcModal').remove();
  $('saveQc').onclick=async()=>{
    const body={batch_code:$('qcBatch').value,test_date:$('qcDate').value,machine:$('qcMachine').value,operator_name:$('qcOperator').value,mix_temp_c:$('qcMixTemp').value,pasteurization_peak_c:$('qcPasteur').value,ageing_hours:$('qcAge').value,ph:$('qcPh').value,brix:$('qcBrix').value,overrun_pct:$('qcOverrun').value,draw_temp_c:$('qcDraw').value,melt_30min_pct:$('qcMelt').value,hardness_score:$('qcHard').value,sweetness_score:$('qcSweet').value,iciness_score:$('qcIce').value,body_score:$('qcBody').value,aftertaste_score:$('qcAfter').value,day1_notes:$('qcDay1').value,day7_notes:$('qcDay7').value,result:$('qcResult').value};
    const r=await fetch('/api/data?resource=gelato_qc&recipe_id='+recipeId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){alert(j.error||'QC save failed');return}
    $('qcModal').remove();alert('QC saved • Production Confidence '+Number(j.production_confidence||0).toFixed(1)+'%');viewBusinessRecipe(recipeId);
  };
}
async function markGolden(recipeId){
  const r=await fetch('/api/data?resource=gelato_recipes&id='+recipeId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'golden'})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){alert(j.error||'Golden recipe requirements not met');return}
  alert('Golden Production Recipe approved');viewBusinessRecipe(recipeId);
}
async function auth(){
  const key='kt_offline_user_v1';let ok=false;
  try{const r=await fetch('/api/auth?action=me',{cache:'no-store'});if(r.status===401||r.status===403){location.replace('/login.html');return}if(r.ok){const j=await r.json();ok=!!j.user;if(j.user)localStorage.setItem(key,JSON.stringify({user:j.user,saved_at:new Date().toISOString()}));}}
  catch(e){if(!navigator.onLine){try{ok=!!JSON.parse(localStorage.getItem(key)||'null')?.user}catch{}}}
  if(!ok&&navigator.onLine){location.replace('/login.html');return}
  await loadIngredientSettings();
  $('authLoading').classList.add('hidden');$('app').classList.remove('hidden');render();
}

$('backBtn').onclick=()=>location.href='/';
$('ingredientSettingsBtn').onclick=()=>{renderIngredientProfiles();$('profileModal').classList.remove('hidden')};
$('profileClose').onclick=()=>$('profileModal').classList.add('hidden');
$('profileModal').onclick=e=>{if(e.target===$('profileModal'))$('profileModal').classList.add('hidden')};
$('addDryMilkProfile').onclick=()=>{ingredientSettings.dry_milk_profiles=ingredientSettings.dry_milk_profiles||[];ingredientSettings.dry_milk_profiles.push({id:profileId('powder'),name:'New Dry Milk',fat_pct:0,protein_pct:0,carbs_pct:0,moisture_pct:0,other_pct:0,added_sugar_pct:null,note:''});renderIngredientProfiles()};
$('addCremodanProfile').onclick=()=>{ingredientSettings.cremodan_profiles=ingredientSettings.cremodan_profiles||[];ingredientSettings.cremodan_profiles.push({id:profileId('cremodan'),grade:'CREMODAN',dosage_g_per_kg:0,includes_emulsifier:true,product_type:'General',note:''});renderIngredientProfiles()};
$('saveProfiles').onclick=saveIngredientSettings;
$('saveTrial').onclick=()=>saveCurrentBusinessRecipe(false);
$('finalizeRecipe').onclick=()=>saveCurrentBusinessRecipe(true);
$('businessRecipesBtn').onclick=()=>{$('businessRecipesModal').classList.remove('hidden');loadBusinessRecipes()};
$('businessRecipesClose').onclick=()=>$('businessRecipesModal').classList.add('hidden');
$('businessRecipesModal').onclick=e=>{if(e.target===$('businessRecipesModal'))$('businessRecipesModal').classList.add('hidden')};
$('department').onchange=populate;$('sourceType').onchange=populate;$('system').onchange=populate;$('baseMode').onchange=render;$('recipe').onchange=render;$('batch').oninput=render;$('unit').onchange=render;$('generate').onclick=render;
document.querySelectorAll('[data-kg]').forEach(b=>b.onclick=()=>{$('batch').value=b.dataset.kg;$('unit').value='kg';render()});
$('save').onclick=saveBatch;$('print').onclick=()=>window.print();$('share').onclick=shareRecipe;
$('clearHistory').onclick=()=>{if(confirm('Clear saved batch history?')){localStorage.removeItem('kt_icecream_batches_v2');historyRender()}};

populate();historyRender();auth();
