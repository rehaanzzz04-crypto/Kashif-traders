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
  whole_milk:{name:'Whole Milk',fat_pct:3.5,msnf_pct:8.5,protein_pct:3.2,lactose_pct:4.8,ash_pct:.7,moisture_pct:87.8},
  cream:{name:'Cream',fat_pct:35,msnf_pct:5.5,protein_pct:2.1,lactose_pct:3.0,ash_pct:.5,moisture_pct:59.4},
  dry_milk_profiles:[{id:'melco-26',name:'Melco Vegetable Fat Filled Powder',fat_pct:26,protein_pct:16,carbs_pct:50,lactose_pct:null,true_msnf_pct:null,moisture_pct:4,ash_pct:null,other_pct:4,added_sugar_pct:null,total_solids_pct:96,note:'Bag label profile; true dairy MSNF/lactose/added sugar split requires current COA.'}],
  cremodan_profiles:[],
  machine_profiles:[],
  flavor_profiles:[],
  ingredient_profiles:[],
  sugar_profiles:[
    {id:'sucrose-ref',name:'Sucrose',type:'sucrose',de:null,dry_solids_pct:100,relative_sweetness:1,fpdf:1,verified:true,price_per_kg:0,source_name:'Tetra Pak Dairy Processing Handbook',source_url:'https://dairyprocessinghandbook.tetrapak.com/chapter/ice-cream',note:'Reference factor'},
    {id:'dextrose-ref',name:'Dextrose / Glucose',type:'dextrose',de:100,dry_solids_pct:100,relative_sweetness:.8,fpdf:1.9,verified:true,price_per_kg:0,source_name:'Tetra Pak Dairy Processing Handbook',source_url:'https://dairyprocessinghandbook.tetrapak.com/chapter/ice-cream',note:'Reference factor'},
    {id:'glucose42-ref',name:'Glucose Syrup Solids 42DE',type:'glucose_syrup',de:42,dry_solids_pct:100,relative_sweetness:.3,fpdf:.8,verified:true,price_per_kg:0,source_name:'Tetra Pak Dairy Processing Handbook',source_url:'https://dairyprocessinghandbook.tetrapak.com/chapter/ice-cream',note:'Reference 42DE'},
    {id:'fructose-ref',name:'Fructose',type:'fructose',de:null,dry_solids_pct:100,relative_sweetness:1.7,fpdf:1.9,verified:true,price_per_kg:0,source_name:'Tetra Pak Dairy Processing Handbook',source_url:'https://dairyprocessinghandbook.tetrapak.com/chapter/ice-cream',note:'Reference factor'}
  ],
  cost_settings:{currency:'PKR',whole_milk_per_kg:0,cream_per_kg:0,sucrose_per_kg:0,glucose_per_kg:0,water_per_kg:0,stabilizer_per_kg:0,emulsifier_per_kg:0},
  quality_lock:{fat_tolerance_pct:.35,msnf_tolerance_pct:.50,total_solids_tolerance_pct:1,sweetness_index_tolerance:1.5,freezing_index_tolerance:2},
  default_dry_milk_id:'melco-26',
  default_cremodan_id:null,
  default_machine_id:null,
  default_flavor_id:null,
  default_sugar_id:'glucose42-ref'
};
const settingsKey='kt_gelato_ingredient_settings_v1';

function activeDryMilkProfile(){
  return ingredientSettings.dry_milk_profiles?.find(x=>x.id===ingredientSettings.default_dry_milk_id)||ingredientSettings.dry_milk_profiles?.[0]||null;
}
function activeCremodanProfile(){
  return ingredientSettings.cremodan_profiles?.find(x=>x.id===ingredientSettings.default_cremodan_id)||null;
}
function activeMachineProfile(id){
  const key=id||ingredientSettings.default_machine_id;
  return ingredientSettings.machine_profiles?.find(x=>x.id===key)||null;
}
function activeFlavorProfile(id){
  const key=id||ingredientSettings.default_flavor_id;
  return ingredientSettings.flavor_profiles?.find(x=>x.id===key)||null;
}
function activeSugarProfile(id){
  const key=id||ingredientSettings.default_sugar_id;
  return ingredientSettings.sugar_profiles?.find(x=>x.id===key)||ingredientSettings.sugar_profiles?.find(x=>x.id==='glucose42-ref')||null;
}
function sugarProfileByName(name){
  const n=String(name||'').toLowerCase();
  return (ingredientSettings.sugar_profiles||[]).find(x=>String(x.name||'').toLowerCase()===n)||null;
}
function flavorByName(name){
  const n=String(name||'').toLowerCase();
  return (ingredientSettings.flavor_profiles||[]).find(x=>String(x.name||'').toLowerCase()===n)||null;
}
function ingredientProfileByName(name){
  const n=String(name||'').trim().toLowerCase();
  if(!n)return null;
  return (ingredientSettings.ingredient_profiles||[]).find(p=>{
    if(String(p.name||'').trim().toLowerCase()===n)return true;
    const aliases=String(p.aliases||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    return aliases.includes(n);
  })||null;
}
function powderNonFatSolids(p){
  if(!p)return null;
  const v=p.true_msnf_pct;
  if(v===null||v===undefined||v==='')return null;
  return Math.max(0,Math.min(.99,Number(v)/100));
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
  if(powderMsnf===null)throw Error('Selected dry milk/fat-filled powder ka True Dairy MSNF % missing hai. Current COA/lab value Ingredient Profiles mein enter karein.');
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
  if(glucose){const sp=activeSugarProfile();items.push([sp?.name||'Glucose/corn syrup solids',glucose]);}
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
  const powder=activeDryMilkProfile(),flavor=flavorByName(name),sugarProfile=sugarProfileByName(name),ingredientProfile=ingredientProfileByName(name);
  const milk=ingredientSettings.whole_milk||{};
  const cream=ingredientSettings.cream||{};
  if(n.includes('whole milk')||n===String(milk.name||'').toLowerCase())return {fat:Number(milk.fat_pct||0),protein:Number(milk.protein_pct||0),lactose:Number(milk.lactose_pct||0),ash:Number(milk.ash_pct||0),moisture:Number(milk.moisture_pct||0),sucrose:0,dextrose:0,glucose:0,fructose:0,dairyMsnf:Number(milk.msnf_pct||0),known:true};
  if(n.includes('cream')||n===String(cream.name||'').toLowerCase())return {fat:Number(cream.fat_pct||0),protein:Number(cream.protein_pct||0),lactose:Number(cream.lactose_pct||0),ash:Number(cream.ash_pct||0),moisture:Number(cream.moisture_pct||0),sucrose:0,dextrose:0,glucose:0,fructose:0,dairyMsnf:Number(cream.msnf_pct||0),known:true};
  if(powder&&(n.includes('milk powder')||n.includes('fat filled')||n===String(powder.name||'').toLowerCase()))return {fat:Number(powder.fat_pct||0),protein:Number(powder.protein_pct||0),lactose:powder.lactose_pct==null?0:Number(powder.lactose_pct||0),ash:powder.ash_pct==null?0:Number(powder.ash_pct||0),moisture:Number(powder.moisture_pct||0),sucrose:powder.added_sugar_pct==null?0:Number(powder.added_sugar_pct||0),dextrose:0,glucose:0,fructose:0,dairyMsnf:powder.true_msnf_pct==null?0:Number(powder.true_msnf_pct||0),known:powder.lactose_pct!=null&&powder.added_sugar_pct!=null&&powder.true_msnf_pct!=null};
  if(flavor)return {fat:Number(flavor.fat_pct||0),protein:Number(flavor.protein_pct||0),lactose:0,ash:Number(flavor.ash_pct||0),moisture:Number(flavor.moisture_pct||0),totalSolids:100-Number(flavor.moisture_pct||0),sucrose:Number(flavor.sucrose_pct||0),dextrose:Number(flavor.dextrose_pct||0),glucose:Number(flavor.glucose_pct||0),fructose:Number(flavor.fructose_pct||0),dairyMsnf:Number(flavor.dairy_msnf_pct||0),known:flavor.composition_verified===true};
  if(ingredientProfile){
    const moisture=ingredientProfile.moisture_pct==null?null:Number(ingredientProfile.moisture_pct);
    const totalSolids=ingredientProfile.total_solids_pct==null?(moisture==null?null:100-moisture):Number(ingredientProfile.total_solids_pct);
    const sugarSolids=Number(ingredientProfile.sucrose_pct||0)+Number(ingredientProfile.dextrose_pct||0)+Number(ingredientProfile.glucose_pct||0)+Number(ingredientProfile.fructose_pct||0);
    return {fat:Number(ingredientProfile.fat_pct||0),protein:Number(ingredientProfile.protein_pct||0),lactose:Number(ingredientProfile.lactose_pct||0),ash:Number(ingredientProfile.ash_pct||0),moisture:moisture??0,totalSolids:totalSolids??0,sucrose:Number(ingredientProfile.sucrose_pct||0),dextrose:Number(ingredientProfile.dextrose_pct||0),glucose:Number(ingredientProfile.glucose_pct||0),fructose:Number(ingredientProfile.fructose_pct||0),dairyMsnf:Number(ingredientProfile.dairy_msnf_pct||0),rsFactor:ingredientProfile.relative_sweetness==null?null:Number(ingredientProfile.relative_sweetness),fpdfFactor:ingredientProfile.fpdf==null?null:Number(ingredientProfile.fpdf),sugarSolids,known:ingredientProfile.verified===true&&totalSolids!==null};
  }
  if(sugarProfile){
    const solids=Number(sugarProfile.dry_solids_pct||100),water=Math.max(0,100-solids),type=String(sugarProfile.type||'').toLowerCase();
    return {fat:0,protein:0,lactose:0,ash:0,moisture:water,sucrose:type==='sucrose'?solids:0,dextrose:type==='dextrose'?solids:0,glucose:type==='glucose_syrup'?solids:0,fructose:type==='fructose'?solids:0,dairyMsnf:0,rsFactor:Number(sugarProfile.relative_sweetness||0),fpdfFactor:Number(sugarProfile.fpdf||0),sugarSolids:solids,known:sugarProfile.verified===true};
  }
  if(n.includes('sugar sucrose')||n==='sugar'||n.includes('granulated sugar')||n.includes('caster sugar'))return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:100,dextrose:0,glucose:0,fructose:0,rsFactor:1,fpdfFactor:1,sugarSolids:100,known:true};
  if(n.includes('dextrose'))return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:100,glucose:0,fructose:0,rsFactor:.8,fpdfFactor:1.9,sugarSolids:100,known:true};
  if(n.includes('glucose'))return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:0,glucose:100,fructose:0,rsFactor:.3,fpdfFactor:.8,sugarSolids:100,known:false};
  if(n.includes('stabilizer')||n.includes('emulsifier')||n.includes('cremodan')||n.includes('base 50'))return {fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:0,glucose:0,fructose:0,known:true};
  if(n.includes('water'))return {fat:0,protein:0,lactose:0,ash:0,moisture:100,sucrose:0,dextrose:0,glucose:0,fructose:0,known:true};
  return {fat:0,protein:0,lactose:0,ash:0,moisture:0,totalSolids:null,sucrose:0,dextrose:0,glucose:0,fructose:0,known:false};
}
function compositionAnalysis(items,total){
  const acc={fat:0,protein:0,lactose:0,ash:0,moisture:0,sucrose:0,dextrose:0,glucose:0,fructose:0,dairyMsnf:0,covered:0,knownSolids:0,pod:0,pac:0};
  items.forEach(i=>{
    const c=ingredientComposition(i.name),f=Number(i.g||0)/total;
    ['fat','protein','lactose','ash','moisture','sucrose','dextrose','glucose','fructose','dairyMsnf'].forEach(k=>acc[k]+=f*Number(c[k]||0));
    if(c.known){
      const solids=c.totalSolids==null?Math.max(0,100-Number(c.moisture||0)):Number(c.totalSolids);
      acc.knownSolids+=f*solids;
    }
    const sugarPct=Number(c.sugarSolids||0);
    if(sugarPct>0&&Number.isFinite(Number(c.rsFactor))&&Number.isFinite(Number(c.fpdfFactor))){
      acc.pod+=f*sugarPct*Number(c.rsFactor);
      acc.pac+=f*sugarPct*Number(c.fpdfFactor);
    }else{
      acc.pod+=f*(Number(c.sucrose||0)*1+Number(c.dextrose||0)*.8+Number(c.glucose||0)*.3+Number(c.fructose||0)*1.7+Number(c.lactose||0)*.16);
      acc.pac+=f*(Number(c.sucrose||0)*1+Number(c.dextrose||0)*1.9+Number(c.glucose||0)*.8+Number(c.fructose||0)*1.9+Number(c.lactose||0)*1);
    }
    if(c.known)acc.covered+=Number(i.g||0);
  });
  const knownSolids=acc.knownSolids;
  const pod=acc.pod,pac=acc.pac;
  const coverage=Math.max(0,Math.min(100,(acc.covered/total)*100));
  const warnings=[];
  if(coverage<90)warnings.push('Ingredient composition data incomplete hai; analysis estimate hai.');
  if(acc.lactose>10)warnings.push('Lactose load high hai; sandy texture / lactose crystallization risk barh sakta hai.');
  if(knownSolids<32)warnings.push('Total solids low side par hain; body weak ya icy ho sakti hai.');
  if(knownSolids>46)warnings.push('Total solids high hain; body heavy ya freezing difficult ho sakti hai.');
  return {
    fat:acc.fat,protein:acc.protein,lactose:acc.lactose,ash:acc.ash,dairyMsnf:acc.dairyMsnf,totalSolids:knownSolids,water:acc.moisture,
    sucrose:acc.sucrose,dextrose:acc.dextrose,glucose:acc.glucose,fructose:acc.fructose,pod,pac,coverage,warnings
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

const PREMIUM_RESEARCH_RANGES={
  Premium:{fat:[12,15],solids:[38,40],overrun:[60,90]},
  'Super Premium':{fat:[15,18],solids:[40,46],overrun:[25,50]}
};
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}


function ingredientRatePerKg(name){
  const n=String(name||'').toLowerCase(),cost=ingredientSettings.cost_settings||{};
  const powder=activeDryMilkProfile(),cremodan=activeCremodanProfile(),flavor=flavorByName(name),sugarProfile=sugarProfileByName(name),ingredientProfile=ingredientProfileByName(name);
  if(powder&&(n===String(powder.name||'').toLowerCase()||n.includes('milk powder')||n.includes('fat filled')))return Number(powder.price_per_kg||0);
  if(cremodan&&(n===String(cremodan.grade||'').toLowerCase()||n.includes('cremodan')))return Number(cremodan.price_per_kg||0);
  if(flavor)return Number(flavor.price_per_kg||0);
  if(sugarProfile)return Number(sugarProfile.price_per_kg||0);
  if(ingredientProfile)return Number(ingredientProfile.price_per_kg||0);
  if(n.includes('whole milk')||n.includes('fresh whole milk'))return Number(cost.whole_milk_per_kg||0);
  if(n.includes('cream'))return Number(cost.cream_per_kg||0);
  if(n.includes('sugar')||n.includes('sucrose'))return Number(cost.sucrose_per_kg||0);
  if(n.includes('glucose')||n.includes('dextrose'))return Number(cost.glucose_per_kg||0);
  if(n==='water')return Number(cost.water_per_kg||0);
  if(n.includes('stabilizer')||n.includes('base 50'))return Number(cost.stabilizer_per_kg||0);
  if(n.includes('emulsifier'))return Number(cost.emulsifier_per_kg||0);
  return 0;
}
function recipeCost(items){
  const currency=ingredientSettings.cost_settings?.currency||'PKR';
  let total=0,knownWeight=0,weight=0;
  const lines=items.map(i=>{
    const rate=ingredientRatePerKg(i.name),g=Number(i.g||0),cost=(g/1000)*rate;
    weight+=g;if(rate>0)knownWeight+=g;total+=cost;
    return {name:i.name,g,rate,cost};
  });
  return {currency,total,perKg:weight?total/(weight/1000):0,coverage:weight?knownWeight/weight*100:0,lines};
}
function qualityLockCheck(items,total,master,referenceItems){
  const a=compositionAnalysis(items,total),ref=compositionAnalysis(referenceItems||items,total);
  const lock=ingredientSettings.quality_lock||{};
  const actualMsnf=a.dairyMsnf>0?a.dairyMsnf:(a.protein+a.lactose+a.ash),refMsnf=ref.dairyMsnf>0?ref.dairyMsnf:(ref.protein+ref.lactose+ref.ash);
  const targetFat=Number(master.fat),targetMsnf=Number(master.msnf);
  const expectedSolids=ref.totalSolids;
  const checks=[
    {name:'Fat',actual:a.fat,target:targetFat,tol:Number(lock.fat_tolerance_pct??.35)},
    {name:'MSNF',actual:actualMsnf,target:targetMsnf,tol:Number(lock.msnf_tolerance_pct??.5)},
    {name:'Total Solids',actual:a.totalSolids,target:expectedSolids,tol:Number(lock.total_solids_tolerance_pct??1)},
    {name:'Sweetness Index',actual:a.pod,target:ref.pod,tol:Number(lock.sweetness_index_tolerance??1.5)},
    {name:'Freezing Index',actual:a.pac,target:ref.pac,tol:Number(lock.freezing_index_tolerance??2)}
  ];
  const dataComplete=a.coverage>=90&&ref.coverage>=90;
  checks.forEach(x=>x.pass=Math.abs(x.actual-x.target)<=x.tol);
  return {pass:dataComplete&&checks.every(x=>x.pass),dataComplete,coverage:a.coverage,checks,a};
}

function buildFlavoredFormula(master,base,total,flavor,dosePct){
  if(!flavor||!dosePct)return scale(componentRecipe(master,base),total);
  if(flavor.composition_verified!==true)throw Error('Flavor profile composition verified nahi hai. Supplier COA / verified composition enter karein.');
  const dose=Math.max(0,Math.min(60,Number(dosePct)||0));
  const min=Number(flavor.recommended_min_pct||0),max=Number(flavor.recommended_max_pct||0);
  if(min&&dose<min)throw Error('Flavor dose recommended minimum '+min+'% se kam hai.');
  if(max&&dose>max)throw Error('Flavor dose recommended maximum '+max+'% se zyada hai.');
  const powder=activeDryMilkProfile(),cremodan=activeCremodanProfile(),sugarProfile=activeSugarProfile($('wizardSugarProfile')?.value);
  const powderMsnf=powderNonFatSolids(powder);
  if(powderMsnf===null)throw Error('True Dairy MSNF % required for research-grade flavor balancing.');
  const flavorG=dose*10;
  const fFat=flavorG*Number(flavor.fat_pct||0)/100;
  const fMsnf=flavorG*Number(flavor.dairy_msnf_pct||0)/100;
  const fs={sucrose:flavorG*Number(flavor.sucrose_pct||0)/100,dextrose:flavorG*Number(flavor.dextrose_pct||0)/100,glucose:flavorG*Number(flavor.glucose_pct||0)/100,fructose:flavorG*Number(flavor.fructose_pct||0)/100};
  const spRS=Number(sugarProfile?.relative_sweetness||.3),spFPDF=Number(sugarProfile?.fpdf||.8),spSolids=Math.max(.01,Number(sugarProfile?.dry_solids_pct||100)/100);
  if(sugarProfile&&sugarProfile.verified!==true)throw Error('Selected glucose/sugar profile verified nahi hai. Supplier TDS/COA values verify karein.');
  const targetPod=Number(master.sucrose||0)*10+Number(master.glucose||0)*10*spRS*spSolids;
  const targetPac=Number(master.sucrose||0)*10+Number(master.glucose||0)*10*spFPDF*spSolids;
  const fPod=fs.sucrose+fs.dextrose*.74+fs.glucose*.5+fs.fructose*1.7;
  const fPac=fs.sucrose+fs.dextrose*1.9+fs.glucose*.8+fs.fructose*1.9;
  const remPod=targetPod-fPod,remPac=targetPac-fPac;
  const denom=(spFPDF-spRS)*spSolids;
  if(Math.abs(denom)<.01)throw Error('Selected sugar profile sweetness/freezing factors formula solve ke liye suitable nahi.');
  let glucose=(remPac-remPod)/denom,sucrose=remPod-(glucose*spRS*spSolids);
  if(!Number.isFinite(glucose)||!Number.isFinite(sucrose)||glucose<-.01||sucrose<-.01)throw Error('Selected flavor/dose ke saath current sucrose + glucose system research sweetness/freezing target ko solve nahi kar sakta. Dose ya sugar system change karein.');
  glucose=Math.max(0,glucose);sucrose=Math.max(0,sucrose);
  const cremodanG=cremodan?Math.max(0,Number(cremodan.dosage_g_per_kg||0)):0;
  const stab=cremodan?0:Number(master.stabilizer||0)*10;
  const emul=cremodan&&cremodan.includes_emulsifier!==false?0:Number(master.emulsifier||0)*10;
  const dairy=1000-flavorG-sucrose-glucose-stab-emul-cremodanG;
  const fat=Number(master.fat||0)*10-fFat,msnf=Number(master.msnf||0)*10-fMsnf;
  if(dairy<=0||fat<0||msnf<0)throw Error('Flavor dose research dairy/fat target se incompatible hai.');
  const milkFat=Math.max(.0001,Number(ingredientSettings.whole_milk?.fat_pct||3.5)/100),milkMsnf=Math.max(0,Number(ingredientSettings.whole_milk?.msnf_pct||8.5)/100);
  const creamFat=Math.max(.0001,Number(ingredientSettings.cream?.fat_pct||35)/100),creamMsnf=Math.max(0,Number(ingredientSettings.cream?.msnf_pct||5.5)/100);
  const powderFat=Math.max(0,Number(powder?.fat_pct||0)/100);
  let x,names;
  if(base==='fresh'){
    x=solve3([[1,1,1],[milkFat,creamFat,powderFat],[milkMsnf,creamMsnf,powderMsnf]],[dairy,fat,msnf]);
    names=[ingredientSettings.whole_milk?.name||'Whole Milk',ingredientSettings.cream?.name||'Cream',powder?.name||'Dry Milk Powder'];
  }else{
    x=solve3([[1,1,1],[0,creamFat,powderFat],[0,creamMsnf,powderMsnf]],[dairy,fat,msnf]);
    names=['Water',ingredientSettings.cream?.name||'Cream',powder?.name||'Dry Milk Powder'];
  }
  if(x.some(v=>!Number.isFinite(v)||v<-.01))throw Error('Flavor profile ke saath selected dairy system research targets solve nahi kar sakta.');
  const perKg=names.map((n,i)=>({name:n,g:Math.max(0,x[i])}));
  perKg.push({name:flavor.name,g:flavorG});
  if(sucrose)perKg.push({name:'Sugar sucrose',g:sucrose});
  if(glucose)perKg.push({name:sugarProfile?.name||'Glucose/corn syrup solids',g:glucose});
  if(cremodanG)perKg.push({name:cremodan.grade||'CREMODAN',g:cremodanG});
  if(stab)perKg.push({name:'Stabilizer (supplier dosage check)',g:stab});
  if(emul)perKg.push({name:'Emulsifier (supplier dosage check)',g:emul});
  const factor=total/1000;
  return perKg.map(x=>({name:x.name,g:x.g*factor}));
}
function flavorBalanceHtml(items,total,master,reference,flavor,dose){
  if(!flavor||!Number(dose))return '';
  const q=qualityLockCheck(items,total,master,reference),a=q.a,cost=recipeCost(items);
  const state=!q.dataComplete?'DATA INCOMPLETE':q.pass?'QUALITY LOCK PASS':'REBALANCE';
  return '<div class="subpanel flavorBalance"><div class="recipeHead"><div><h3>Flavor Balance • '+esc(flavor.name)+'</h3><p>Dose '+Number(dose).toFixed(1)+'% • composition '+(flavor.composition_verified?'verified':'not verified')+'</p></div><span class="badge '+(q.pass?'finalBadge':'')+'">'+state+'</span></div>'+
    '<div class="businessMetrics"><span>Fat <b>'+a.fat.toFixed(2)+'%</b></span><span>Solids <b>'+a.totalSolids.toFixed(2)+'%</b></span><span>Sweetness <b>'+a.pod.toFixed(2)+'</b></span><span>Freezing <b>'+a.pac.toFixed(2)+'</b></span><span>COA Coverage <b>'+a.coverage.toFixed(1)+'%</b></span><span>Cost <b>'+esc(cost.currency)+' '+cost.total.toFixed(2)+'</b></span></div>'+
    '<div class="source">Flavor ke fat, sugars, moisture aur verified dairy MSNF ko base formula mein include karke added sucrose/glucose aur dairy quantities rebalance ki gayi hain.</div></div>';
}
function costOptimizerCandidates(master,total,currentBase){
  const modes=[currentBase,currentBase==='fresh'?'dry':'fresh'];
  const candidates=[];
  for(const base of modes){
    try{
      const reference=scale(componentRecipe(master,base),total);
      const variants=controlledTrialVariants(master,base,total);
      variants.forEach(v=>{
        const q=qualityLockCheck(v.items,total,master,reference);
        const cost=recipeCost(v.items);
        candidates.push({base,variant:v.code,name:v.name,items:v.items,q,cost});
      });
    }catch{}
  }
  candidates.sort((a,b)=>a.cost.total-b.cost.total);
  return candidates;
}
function costOptimizerHtml(master,total,base){
  const candidates=costOptimizerCandidates(master,total,base);
  if(!candidates.length)return '<div class="warning">Cost candidates calculate nahi ho sake. Ingredient profiles check karein.</div>';
  const accepted=candidates.filter(x=>x.q.pass&&x.cost.coverage>=90);
  const best=accepted[0]||null;
  const rows=candidates.map(x=>{
    const state=!x.q.dataComplete?'DATA INCOMPLETE':x.q.pass?'PASS':'REJECTED';
    return '<div class="costCandidate '+(best===x?'bestCost':'')+'"><div><b>'+esc(x.base.toUpperCase()+' • Variant '+x.variant)+'</b><small>'+esc(x.name)+'</small></div><span>'+esc(x.cost.currency)+' '+x.cost.total.toFixed(2)+'<small>'+x.cost.perKg.toFixed(2)+'/kg</small></span><em class="'+(x.q.pass?'ok':'')+'">'+state+'</em></div>';
  }).join('');
  const saving=best&&candidates.length?Math.max(0,candidates.filter(x=>x.q.pass)[0]?.cost.total-best.cost.total||0):0;
  return '<div class="subpanel"><h3>Quality Lock + Cost Optimizer</h3><div class="costSummary">'+(best?'<b>Best approved: '+esc(best.base.toUpperCase())+' • Variant '+best.variant+'</b><span>'+esc(best.cost.currency)+' '+best.cost.total.toFixed(2)+' total • '+best.cost.perKg.toFixed(2)+'/kg</span>':'<b>No cost option approved yet</b><span>COA/rates/quality lock complete karein.</span>')+'</div>'+rows+'<div class="source">Cost optimization quality ke baad hoti hai. Research composition ya COA coverage fail ho to cheapest option automatically reject hota hai.</div></div>';
}

function stabilizerCompatibility(master,items){
  const p=activeCremodanProfile();
  if(!p)return {status:'generic',pass:true,comments:['No verified stabilizer profile selected; generic research stabilizer assumption active.']};
  const a=compositionAnalysis(items,items.reduce((s,x)=>s+Number(x.g||0),0));
  const dose=Number(p.dosage_g_per_kg||0),min=p.dosage_min_g_per_kg==null?null:Number(p.dosage_min_g_per_kg),max=p.dosage_max_g_per_kg==null?null:Number(p.dosage_max_g_per_kg);
  const comments=[]; let pass=true;
  if(p.verified!==true){pass=false;comments.push('Stabilizer profile verified nahi hai; manufacturer TDS/source required.');}
  if(min!==null&&dose<min){pass=false;comments.push('Dosage manufacturer minimum '+min+' g/kg se kam hai.');}
  if(max!==null&&dose>max){pass=false;comments.push('Dosage manufacturer maximum '+max+' g/kg se zyada hai.');}
  if(p.fat_min_pct!=null&&a.fat<Number(p.fat_min_pct)){pass=false;comments.push('Formula fat stabilizer application range se low hai.');}
  if(p.fat_max_pct!=null&&a.fat>Number(p.fat_max_pct)){pass=false;comments.push('Formula fat stabilizer application range se high hai.');}
  if(p.solids_min_pct!=null&&a.totalSolids<Number(p.solids_min_pct)){pass=false;comments.push('Formula solids stabilizer application range se low hain.');}
  if(p.solids_max_pct!=null&&a.totalSolids>Number(p.solids_max_pct)){pass=false;comments.push('Formula solids stabilizer application range se high hain.');}
  if(!comments.length)comments.push('Selected stabilizer profile dosage/application range ke andar hai.');
  return {status:pass?'pass':'review',pass,profile:p,comments};
}
function autoBalanceCandidates(master,base,total,flavor,dose,machine){
  const sugarProfiles=(ingredientSettings.sugar_profiles||[]).filter(x=>x.verified===true);
  const originalDefault=ingredientSettings.default_sugar_id;
  const out=[];
  for(const sp of sugarProfiles){
    try{
      ingredientSettings.default_sugar_id=sp.id;
      const items=flavor&&dose>0?buildFlavoredFormula(master,base,total,flavor,dose):scale(componentRecipe(master,base),total);
      const reference=scale(componentRecipe(master,base),total);
      const q=qualityLockCheck(items,total,master,reference);
      const st=stabilizerCompatibility(master,items);
      const mc=machineCheck(machine,total/1000,Number($('wizardOverrun').value||0));
      const cost=recipeCost(items);
      const analysis=premiumWizardAnalysis(items,total,master,$('wizardServingTemp').value,$('wizardOverrun').value,'balanced','balanced',machine);
      const approved=q.pass&&st.pass&&mc.ok&&analysis.researchPass;
      const penalty=(q.pass?0:1000)+(st.pass?0:700)+(mc.ok?0:500)+(analysis.researchPass?0:700)+(100-q.coverage)*5+cost.total/10000;
      out.push({sp,items,q,st,mc,cost,analysis,approved,penalty});
    }catch(e){out.push({sp,error:e.message,approved:false,penalty:9999});}
  }
  ingredientSettings.default_sugar_id=originalDefault;
  return out.sort((a,b)=>(a.approved===b.approved?0:(a.approved?-1:1))||a.penalty-b.penalty);
}
function autoBalancerHtml(master,base,total,flavor,dose,machine){
  const rows=autoBalanceCandidates(master,base,total,flavor,dose,machine);
  if(!rows.length)return '<div class="warning">Verified sugar profiles available nahi hain; Auto-Balancer run nahi ho sakta.</div>';
  const best=rows.find(x=>x.approved)||rows[0];
  const cards=rows.slice(0,6).map((x,i)=>{
    if(x.error)return '<div class="costCandidate"><div><b>'+esc(x.sp.name)+'</b><small>'+esc(x.error)+'</small></div><em>REJECTED</em></div>';
    return '<div class="costCandidate '+(x===best?'bestCost':'')+'"><div><b>'+esc(x.sp.name)+(x===best?' • BEST':'')+'</b><small>Sweet '+x.analysis.a.pod.toFixed(1)+' • Freeze '+x.analysis.a.pac.toFixed(1)+' • Solids '+x.analysis.a.totalSolids.toFixed(1)+'%</small></div><span>'+esc(x.cost.currency)+' '+x.cost.total.toFixed(2)+'<small>'+x.cost.perKg.toFixed(2)+'/kg</small></span><em class="'+(x.approved?'ok':'')+'">'+(x.approved?'APPROVED R&D CANDIDATE':'REVIEW')+'</em></div>';
  }).join('');
  return '<div class="subpanel"><h3>Multi-Constraint Auto-Balancer</h3><div class="costSummary"><b>Priority: Quality → Research → Machine → Stabilizer → Cost</b><span>'+esc(best.sp?.name||'No candidate')+'</span></div>'+cards+'<div class="source">Auto-Balancer verified sugar profiles aur current ingredient/stabilizer/machine data use karta hai. Approved candidate bhi production QC aur sensory validation ke baghair Golden Recipe nahi banti.</div></div>';
}
function machineCheck(machine,batchKg,overrun){
  if(!machine)return {ok:true,warnings:['No machine profile selected; process compatibility not checked.'],notes:[]};
  const warnings=[],notes=[];
  const min=Number(machine.min_batch_kg||0),max=Number(machine.max_batch_kg||0),ovMin=Number(machine.overrun_min_pct||0),ovMax=Number(machine.overrun_max_pct||0);
  if(min&&batchKg<min)warnings.push('Batch '+batchKg+' kg machine minimum '+min+' kg se kam hai.');
  if(max&&batchKg>max)warnings.push('Batch '+batchKg+' kg machine maximum '+max+' kg se zyada hai.');
  if(ovMin&&overrun<ovMin)warnings.push('Target overrun machine practical minimum '+ovMin+'% se kam hai.');
  if(ovMax&&overrun>ovMax)warnings.push('Target overrun machine practical maximum '+ovMax+'% se zyada hai.');
  if(machine.draw_temp_c!=null)notes.push('Machine draw target: '+Number(machine.draw_temp_c).toFixed(1)+'°C');
  if(Number(machine.ageing_min_hours||0)>0)notes.push('Minimum ageing: '+Number(machine.ageing_min_hours)+' h');
  if(machine.hardening_temp_c!=null)notes.push('Hardening target: '+Number(machine.hardening_temp_c).toFixed(1)+'°C');
  return {ok:!warnings.length,warnings,notes};
}
function controlledTrialVariants(master,base,total){
  const baseline=scale(componentRecipe(master,base),total).map(x=>({...x}));
  const adjust=(items,mode)=>{
    const out=items.map(x=>({...x}));
    const sugar=out.find(x=>/sugar sucrose/i.test(x.name));
    const glucose=out.find(x=>/glucose\/corn syrup solids/i.test(x.name));
    const water=out.find(x=>/^water$/i.test(x.name));
    if(!sugar||!glucose||!water)return out;
    const delta=Math.min(total*.01,sugar.g*.12);
    if(mode==='softer'){
      sugar.g-=delta; glucose.g+=delta;
    }else if(mode==='firmer'){
      const d=Math.min(delta,glucose.g*.35);
      glucose.g-=d; sugar.g+=d;
    }
    return out;
  };
  return [
    {code:'A',name:'Balanced Research Master',items:baseline,note:'Exact research master using current ingredient profile.'},
    {code:'B',name:'Softer / Easier Scoop',items:adjust(baseline,'softer'),note:'Controlled sucrose→glucose-solids substitution; batch mass unchanged.'},
    {code:'C',name:'Firmer / Better Hold',items:adjust(baseline,'firmer'),note:'Controlled glucose-solids→sucrose substitution; batch mass unchanged.'}
  ];
}
function trialVariantHtml(v,total,master,servingTemp,overrun,machine){
  const a=premiumWizardAnalysis(v.items,total,master,servingTemp,overrun,'balanced',v.code==='B'?'softer':v.code==='C'?'firmer':'balanced');
  const comp=a.a;
  return '<div class="trialVariant"><div class="trialVariantHead"><span>'+v.code+'</span><div><b>'+esc(v.name)+'</b><small>'+esc(v.note)+'</small></div></div>'+
    '<div class="businessMetrics"><span>Sweetness <b>'+comp.pod.toFixed(1)+'</b></span><span>Freezing <b>'+comp.pac.toFixed(1)+'</b></span><span>Solids <b>'+comp.totalSolids.toFixed(1)+'%</b></span><span>Texture <b>'+esc(a.zone)+'</b></span></div>'+
    '<button type="button" class="secondary chooseVariant" data-variant="'+v.code+'">Use Variant '+v.code+'</button></div>';
}
function premiumWizardAnalysis(items,total,master,servingTemp,overrun,sweetness,texture,machine=null){
  const a=compositionAnalysis(items,total);
  const tier=String(master.tier||'Premium').includes('Super')?'Super Premium':'Premium';
  const range=PREMIUM_RESEARCH_RANGES[tier];
  const within=(v,r)=>Number.isFinite(v)&&v>=r[0]&&v<=r[1];
  const checks=[
    {name:'Fat',value:a.fat,range:range.fat,unit:'%'},
    {name:'Total Solids',value:a.totalSolids,range:range.solids,unit:'%'},
    {name:'Overrun',value:Number(overrun),range:range.overrun,unit:'%'}
  ];
  const researchPass=checks.every(x=>within(x.value,x.range));
  const targetT=Number(servingTemp);
  const pac=Math.max(.1,a.pac);
  const curve=[-8,-10,-12,-14,-18].map(t=>{
    const cold=Math.abs(t);
    const base=(cold*6.5)-(pac*1.8)+(a.totalSolids-38)*1.4;
    return {temp:t,firmness:clamp(base,0,100)};
  });
  const nearest=curve.reduce((best,x)=>Math.abs(x.temp-targetT)<Math.abs(best.temp-targetT)?x:best,curve[0]);
  const zone=nearest.firmness<32?'Very Soft':nearest.firmness<48?'Soft/Scoopable':nearest.firmness<68?'Balanced/Firm':'Very Firm';
  const advice=[];
  if(sweetness==='lower')advice.push('Less-sweet target: sucrose ko blind reduce na karein; controlled high-PAC/low-sweetness sugar substitution ko A/B trial mein validate karein.');
  if(sweetness==='richer')advice.push('Richer sweetness target: total sugar barhane se freezing behavior bhi change hoga; sweetness aur freezing power dono ko saath rebalance karein.');
  if(texture==='softer')advice.push('Softer target: serving temperature, sugar freezing power, overrun aur total solids ko ek saath optimize karein; sirf stabilizer increase na karein.');
  if(texture==='firmer')advice.push('Firmer target: lower freezing-power sugar blend ya colder service possible hai, magar iciness/melt test ke saath validate karein.');
  if(a.coverage<90)advice.push('Ingredient COA coverage 90% se kam hai; freezing/texture model ko research-grade decision ke liye incomplete samjhein.');
  if(!researchPass)advice.push('Current calculated composition selected '+tier+' research range se bahar hai. Golden recipe se pehle rebalance required hai.');
  const machineResult=machineCheck(machine,total/1000,Number(overrun));
  advice.push(...machineResult.warnings);
  return {a,tier,range,checks,researchPass,curve,zone,advice,servingTemp:targetT,machineResult,machine};
}
function premiumWizardHtml(x){
  const checkHtml=x.checks.map(c=>'<div class="stat"><small>'+esc(c.name)+'</small><strong>'+Number(c.value).toFixed(1)+c.unit+'</strong><span>'+c.range[0]+'–'+c.range[1]+c.unit+'</span></div>').join('');
  const curve=x.curve.map(p=>'<div class="curvePoint"><span>'+p.temp+'°C</span><div><i style="width:'+p.firmness.toFixed(0)+'%"></i></div><b>'+p.firmness.toFixed(0)+'</b></div>').join('');
  return '<div class="wizardResult"><div class="recipeHead"><div><h3>'+esc(x.tier)+' Research Check</h3><p>Serving target '+esc(x.servingTemp)+'°C • '+esc(x.zone)+'</p></div><span class="badge '+(x.researchPass?'finalBadge':'')+'">'+(x.researchPass?'IN RANGE':'REBALANCE')+'</span></div>'+
    '<div class="stats">'+checkHtml+'<div class="stat"><small>Sweetness Index</small><strong>'+x.a.pod.toFixed(1)+'</strong><span>comparative</span></div><div class="stat"><small>Freezing Index</small><strong>'+x.a.pac.toFixed(1)+'</strong><span>comparative</span></div><div class="stat"><small>COA Coverage</small><strong>'+x.a.coverage.toFixed(1)+'%</strong><span>model confidence input</span></div></div>'+
    '<div class="subpanel"><h3>Relative Freezing / Firmness Curve</h3>'+curve+'<div class="source">Curve is a comparative formulation model using sugar freezing power, solids and temperature. It is not a laboratory measurement of frozen-water fraction. Production hardness/draw-temperature data will be used later to calibrate it.</div></div>'+
    (x.machine?'<div class="source"><b>Machine:</b> '+esc(x.machine.name)+(x.machineResult.notes.length?'<br>'+x.machineResult.notes.map(esc).join(' • '):'')+'</div>':'')+
    (x.advice.length?'<div class="warning">'+x.advice.map(t=>'• '+esc(t)).join('<br>')+'</div>':'')+'</div>';
}
function premiumWizardMaster(){
  return (TARGETS.hard||[]).find(x=>x.id===$('wizardMaster').value)||TARGETS.hard.find(x=>x.id==='guelph-hard-14');
}
function previewPremiumWizard(){
  try{
    const master=premiumWizardMaster();
    const total=Math.max(.5,Number($('wizardBatch').value)||10)*1000;
    const base=$('wizardBase').value;
    const reference=scale(componentRecipe(master,base),total);
    const flavor=activeFlavorProfile($('wizardFlavor').value),dose=Number($('wizardFlavorDose').value||0);
    const items=flavor&&dose>0?buildFlavoredFormula(master,base,total,flavor,dose):reference;
    const machine=activeMachineProfile($('wizardMachine').value);
    const a=premiumWizardAnalysis(items,total,master,$('wizardServingTemp').value,$('wizardOverrun').value,$('wizardSweetness').value,$('wizardTexture').value,machine);
    const variants=controlledTrialVariants(master,base,total);
    $('wizardPreview').innerHTML=premiumWizardHtml(a)+flavorBalanceHtml(items,total,master,reference,flavor,dose)+processProfileHtml(wizardProcessProfile())+'<div class="subpanel"><h3>A/B/C Controlled R&D Trials</h3><div class="trialGrid">'+variants.map(v=>trialVariantHtml(v,total,master,$('wizardServingTemp').value,$('wizardOverrun').value,machine)).join('')+'</div></div>'+costOptimizerHtml(master,total,base)+autoBalancerHtml(master,base,total,flavor,dose,machine);
    $('wizardStatus').textContent=a.researchPass&&a.machineResult.ok?'Research + machine range matched':'Review warnings before production';
    $('wizardPreview').querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>{window.__premiumVariant=b.dataset.variant;$('wizardStatus').textContent='Variant '+b.dataset.variant+' selected for production trial';});
  }catch(e){
    $('wizardPreview').innerHTML='<div class="warning"><b>Cannot build research-grade recipe:</b> '+esc(e.message||'Ingredient profile incomplete')+'</div>';
    $('wizardStatus').textContent='Ingredient profile / COA check required';
  }
}

function wizardProcessProfile(){
  const machine=activeMachineProfile($('wizardMachine').value);
  const n=id=>{const v=$(id)?.value;return v===''||v==null?null:Number(v)};
  return {
    pasteurization_min_c:n('wizardPasteurMin'),
    pasteurization_max_c:n('wizardPasteurMax'),
    pasteurization_hold_min_sec:n('wizardPasteurHold'),
    cooling_target_max_c:n('wizardCoolMax'),
    cooling_max_minutes:n('wizardCoolTime'),
    homogenization_min_bar:null,
    homogenization_max_bar:null,
    ageing_temp_max_c:n('wizardAgeTemp'),
    ageing_min_hours:n('wizardAgeMin'),
    ageing_max_hours:n('wizardAgeMax'),
    draw_temp_target_c:machine?.draw_temp_c!=null?Number(machine.draw_temp_c):n('wizardDrawTarget'),
    draw_temp_tolerance_c:n('wizardDrawTol'),
    hardening_target_max_c:machine?.hardening_temp_c!=null?Number(machine.hardening_temp_c):n('wizardHardeningTemp'),
    hardening_max_minutes:n('wizardHardeningTime'),
    storage_target_max_c:n('wizardStorageTemp'),
    source_note:'Professional R&D SOP target; local regulatory/equipment validation still required.',
    notes:machine?'Machine targets inherit: '+machine.name:''
  };
}
function processProfileHtml(p){
  if(!p)return '';
  const rows=[
    ['Pasteurization',(p.pasteurization_min_c??'—')+'–'+(p.pasteurization_max_c??'—')+'°C'],
    ['Hold','≥ '+(p.pasteurization_hold_min_sec??'—')+' sec'],
    ['Cooling','≤ '+(p.cooling_target_max_c??'—')+'°C / '+(p.cooling_max_minutes??'—')+' min'],
    ['Ageing','≤ '+(p.ageing_temp_max_c??'—')+'°C • '+(p.ageing_min_hours??'—')+'–'+(p.ageing_max_hours??'—')+' h'],
    ['Draw',(p.draw_temp_target_c??'—')+'°C ± '+(p.draw_temp_tolerance_c??'—')],
    ['Hardening','≤ '+(p.hardening_target_max_c??'—')+'°C / '+(p.hardening_max_minutes??'—')+' min'],
    ['Storage','≤ '+(p.storage_target_max_c??'—')+'°C']
  ];
  return '<div class="subpanel"><h3>Production SOP Targets</h3><div class="businessMetrics">'+rows.map(x=>'<span>'+esc(x[0])+' <b>'+esc(String(x[1]))+'</b></span>').join('')+'</div><div class="source">Targets production SOP ke liye hain; applicable local regulation aur equipment validation separately verify karein.</div></div>';
}
function buildPremiumRecipe(){
  const master=premiumWizardMaster();
  const batch=Math.max(.5,Number($('wizardBatch').value)||10);
  $('department').value='icecream';
  $('sourceType').value='institute';
  $('system').value='hard';
  populate();
  $('baseMode').value=$('wizardBase').value;
  $('batch').value=batch;$('unit').value='kg';
  if([...$('recipe').options].some(o=>o.value===master.id))$('recipe').value=master.id;
  $('businessName').value=$('wizardName').value.trim()||('Premium R&D '+master.name);
  render();
  const total=batch*1000;
  try{
    const machine=activeMachineProfile($('wizardMachine').value);
    const flavor=activeFlavorProfile($('wizardFlavor').value),dose=Number($('wizardFlavorDose').value||0);
    const variants=controlledTrialVariants(master,$('wizardBase').value,total);
    let selected=variants.find(v=>v.code===(window.__premiumVariant||'A'))||variants[0];
    if(flavor&&dose>0)selected={code:'F',name:'Flavor Balanced '+flavor.name,items:buildFlavoredFormula(master,$('wizardBase').value,total,flavor,dose)};
    current.items=selected.items;
    const analysis=premiumWizardAnalysis(selected.items,total,master,$('wizardServingTemp').value,$('wizardOverrun').value,$('wizardSweetness').value,$('wizardTexture').value,machine);
    current.premiumRAndD={variant:selected.code,variant_name:selected.name,flavor_id:flavor?.id||null,flavor_name:flavor?.name||null,flavor_dose_pct:dose||0,sugar_profile_id:$('wizardSugarProfile').value||ingredientSettings.default_sugar_id||null,sugar_profile_name:activeSugarProfile($('wizardSugarProfile').value)?.name||null,machine_id:machine?.id||null,machine_name:machine?.name||null,serving_temp_c:Number($('wizardServingTemp').value),target_overrun_pct:Number($('wizardOverrun').value),target_shelf_life_days:Number($('wizardShelfLifeDays').value)||null,sweetness_target:$('wizardSweetness').value,texture_target:$('wizardTexture').value,process_profile:wizardProcessProfile(),analysis};
    $('formulaTable').innerHTML=ingredientTable(selected.items,total);
    $('result').insertAdjacentHTML('afterbegin',premiumWizardHtml(analysis));
    $('trialNotes').value='Premium R&D Wizard • Variant '+current.premiumRAndD.variant+' '+current.premiumRAndD.variant_name+' • '+analysis.tier+' • serving '+analysis.servingTemp+'°C • target overrun '+Number($('wizardOverrun').value)+'% • '+analysis.zone+(machine?' • machine '+machine.name:'');
    $('premiumWizardModal').classList.add('hidden');
  }catch(e){alert(e.message||'Premium formula build failed')}
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
  $('wholeMilkProtein').value=w.protein_pct??3.2;$('wholeMilkLactose').value=w.lactose_pct??4.8;$('wholeMilkAsh').value=w.ash_pct??.7;$('wholeMilkMoisture').value=w.moisture_pct??87.8;
  $('creamFat').value=c.fat_pct??35;$('creamMsnf').value=c.msnf_pct??5.5;
  $('creamProtein').value=c.protein_pct??2.1;$('creamLactose').value=c.lactose_pct??3;$('creamAsh').value=c.ash_pct??.5;$('creamMoisture').value=c.moisture_pct??59.4;
  const powders=ingredientSettings.dry_milk_profiles||[];
  $('dryMilkProfiles').innerHTML=powders.map((p,i)=>'<div class="profileCard" data-powder="'+i+'"><div class="profileCardHead"><b>'+esc(p.name||('Dry Milk '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-powder="'+i+'">Delete</button></div><div class="profileGrid"><label>Name<input data-k="name" value="'+esc(p.name||'')+'"></label><label>Fat %<input data-k="fat_pct" type="number" step="0.1" value="'+Number(p.fat_pct||0)+'"></label><label>Protein %<input data-k="protein_pct" type="number" step="0.1" value="'+Number(p.protein_pct||0)+'"></label><label>Carbohydrates %<input data-k="carbs_pct" type="number" step="0.1" value="'+Number(p.carbs_pct||0)+'"></label><label>Lactose %<input data-k="lactose_pct" type="number" step="0.1" value="'+(p.lactose_pct??'')+'" placeholder="COA"></label><label>True Dairy MSNF %<input data-k="true_msnf_pct" type="number" step="0.1" value="'+(p.true_msnf_pct??'')+'" placeholder="COA / lab"></label><label>Moisture %<input data-k="moisture_pct" type="number" step="0.1" value="'+Number(p.moisture_pct||0)+'"></label><label>Ash %<input data-k="ash_pct" type="number" step="0.1" value="'+(p.ash_pct??'')+'" placeholder="COA"></label><label>Total Solids %<input data-k="total_solids_pct" type="number" step="0.1" value="'+(p.total_solids_pct??'')+'" placeholder="optional"></label><label>Other Solids %<input data-k="other_pct" type="number" step="0.1" value="'+Number(p.other_pct||0)+'"></label><label>Known Added Sugar %<input data-k="added_sugar_pct" type="number" step="0.1" value="'+(p.added_sugar_pct??'')+'" placeholder="COA"></label><label>Price / kg<input data-k="price_per_kg" type="number" step="0.01" value="'+Number(p.price_per_kg||0)+'"></label><label class="wide">Notes<input data-k="note" value="'+esc(p.note||'')+'"></label></div></div>').join('');
  $('defaultDryMilk').innerHTML=powders.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('defaultDryMilk').value=ingredientSettings.default_dry_milk_id||powders[0]?.id||'';

  const creams=ingredientSettings.cremodan_profiles||[];
  $('cremodanProfiles').innerHTML=creams.map((p,i)=>'<div class="profileCard" data-cremodan="'+i+'"><div class="profileCardHead"><b>'+esc(p.grade||('CREMODAN '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-cremodan="'+i+'">Delete</button></div><div class="profileGrid"><label>Grade / Number<input data-k="grade" value="'+esc(p.grade||'')+'" placeholder="e.g. SE 46"></label><label>Dosage g/kg<input data-k="dosage_g_per_kg" type="number" step="0.1" value="'+Number(p.dosage_g_per_kg||0)+'"></label><label>Dosage Min g/kg<input data-k="dosage_min_g_per_kg" type="number" step="0.1" value="'+(p.dosage_min_g_per_kg??'')+'"></label><label>Dosage Max g/kg<input data-k="dosage_max_g_per_kg" type="number" step="0.1" value="'+(p.dosage_max_g_per_kg??'')+'"></label><label>Product Type<input data-k="product_type" value="'+esc(p.product_type||'General')+'"></label><label>Fat Min %<input data-k="fat_min_pct" type="number" step="0.1" value="'+(p.fat_min_pct??'')+'"></label><label>Fat Max %<input data-k="fat_max_pct" type="number" step="0.1" value="'+(p.fat_max_pct??'')+'"></label><label>Solids Min %<input data-k="solids_min_pct" type="number" step="0.1" value="'+(p.solids_min_pct??'')+'"></label><label>Solids Max %<input data-k="solids_max_pct" type="number" step="0.1" value="'+(p.solids_max_pct??'')+'"></label><label>Includes Emulsifier<select data-k="includes_emulsifier"><option value="true" '+(p.includes_emulsifier!==false?'selected':'')+'>Yes</option><option value="false" '+(p.includes_emulsifier===false?'selected':'')+'>No</option></select></label><label>Cold Process Compatible<select data-k="cold_process_compatible"><option value="true" '+(p.cold_process_compatible===true?'selected':'')+'>Yes</option><option value="false" '+(p.cold_process_compatible!==true?'selected':'')+'>No</option></select></label><label>Verified<select data-k="verified"><option value="true" '+(p.verified===true?'selected':'')+'>Yes</option><option value="false" '+(p.verified!==true?'selected':'')+'>No</option></select></label><label>Price / kg<input data-k="price_per_kg" type="number" step="0.01" value="'+Number(p.price_per_kg||0)+'"></label><label class="wide">Source Name<input data-k="source_name" value="'+esc(p.source_name||'')+'"></label><label class="wide">Source URL<input data-k="source_url" value="'+esc(p.source_url||'')+'"></label><label class="wide">Notes<input data-k="note" value="'+esc(p.note||'')+'"></label></div></div>').join('');
  $('defaultCremodan').innerHTML='<option value="">None</option>'+creams.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.grade)+'</option>').join('');
  $('defaultCremodan').value=ingredientSettings.default_cremodan_id||'';

  const machines=ingredientSettings.machine_profiles||[];
  $('machineProfiles').innerHTML=machines.map((p,i)=>'<div class="profileCard" data-machine="'+i+'"><div class="profileCardHead"><b>'+esc(p.name||('Machine '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-machine="'+i+'">Delete</button></div><div class="profileGrid"><label>Name<input data-k="name" value="'+esc(p.name||'')+'"></label><label>Type<input data-k="type" value="'+esc(p.type||'Batch Freezer')+'"></label><label>Min Batch kg<input data-k="min_batch_kg" type="number" step="0.1" value="'+Number(p.min_batch_kg||0)+'"></label><label>Max Batch kg<input data-k="max_batch_kg" type="number" step="0.1" value="'+Number(p.max_batch_kg||0)+'"></label><label>Overrun Min %<input data-k="overrun_min_pct" type="number" step="1" value="'+Number(p.overrun_min_pct||0)+'"></label><label>Overrun Max %<input data-k="overrun_max_pct" type="number" step="1" value="'+Number(p.overrun_max_pct||0)+'"></label><label>Draw Temp °C<input data-k="draw_temp_c" type="number" step="0.1" value="'+(p.draw_temp_c??'')+'"></label><label>Ageing Min h<input data-k="ageing_min_hours" type="number" step="0.1" value="'+Number(p.ageing_min_hours||0)+'"></label><label>Hardening Temp °C<input data-k="hardening_temp_c" type="number" step="0.1" value="'+(p.hardening_temp_c??'')+'"></label><label class="wide">Notes<input data-k="notes" value="'+esc(p.notes||'')+'"></label></div></div>').join('');
  $('defaultMachine').innerHTML='<option value="">None</option>'+machines.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('defaultMachine').value=ingredientSettings.default_machine_id||'';
  $('wizardMachine').innerHTML='<option value="">No Machine Profile</option>'+machines.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('wizardMachine').value=ingredientSettings.default_machine_id||'';
  const flavors=ingredientSettings.flavor_profiles||[];
  $('flavorProfiles').innerHTML=flavors.map((p,i)=>'<div class="profileCard" data-flavor="'+i+'"><div class="profileCardHead"><b>'+esc(p.name||('Flavor '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-flavor="'+i+'">Delete</button></div><div class="profileGrid"><label>Name<input data-k="name" value="'+esc(p.name||'')+'"></label><label>Category<input data-k="category" value="'+esc(p.category||'Flavor / Inclusion')+'"></label><label>Min Dose %<input data-k="recommended_min_pct" type="number" step="0.1" value="'+Number(p.recommended_min_pct||0)+'"></label><label>Max Dose %<input data-k="recommended_max_pct" type="number" step="0.1" value="'+Number(p.recommended_max_pct||0)+'"></label><label>Fat %<input data-k="fat_pct" type="number" step="0.1" value="'+Number(p.fat_pct||0)+'"></label><label>Protein %<input data-k="protein_pct" type="number" step="0.1" value="'+Number(p.protein_pct||0)+'"></label><label>Dairy MSNF %<input data-k="dairy_msnf_pct" type="number" step="0.1" value="'+(p.dairy_msnf_pct??'')+'"></label><label>Sucrose %<input data-k="sucrose_pct" type="number" step="0.1" value="'+Number(p.sucrose_pct||0)+'"></label><label>Dextrose %<input data-k="dextrose_pct" type="number" step="0.1" value="'+Number(p.dextrose_pct||0)+'"></label><label>Glucose %<input data-k="glucose_pct" type="number" step="0.1" value="'+Number(p.glucose_pct||0)+'"></label><label>Fructose %<input data-k="fructose_pct" type="number" step="0.1" value="'+Number(p.fructose_pct||0)+'"></label><label>Moisture %<input data-k="moisture_pct" type="number" step="0.1" value="'+Number(p.moisture_pct||0)+'"></label><label>Ash %<input data-k="ash_pct" type="number" step="0.1" value="'+Number(p.ash_pct||0)+'"></label><label>Brix %<input data-k="brix_pct" type="number" step="0.1" value="'+(p.brix_pct??'')+'"></label><label>Acidity %<input data-k="acidity_pct" type="number" step="0.01" value="'+(p.acidity_pct??'')+'"></label><label>Price / kg<input data-k="price_per_kg" type="number" step="0.01" value="'+Number(p.price_per_kg||0)+'"></label><label>Composition Verified<select data-k="composition_verified"><option value="true" '+(p.composition_verified===true?'selected':'')+'>Yes</option><option value="false" '+(p.composition_verified!==true?'selected':'')+'>No</option></select></label><label class="wide">Source / COA<input data-k="source_note" value="'+esc(p.source_note||'')+'"></label><label class="wide">Notes<input data-k="note" value="'+esc(p.note||'')+'"></label></div></div>').join('');
  $('defaultFlavor').innerHTML='<option value="">None</option>'+flavors.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('defaultFlavor').value=ingredientSettings.default_flavor_id||'';
  $('wizardFlavor').innerHTML='<option value="">No Flavor Profile</option>'+flavors.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('wizardFlavor').value=ingredientSettings.default_flavor_id||'';
  $('flavorProfiles').querySelectorAll('[data-del-flavor]').forEach(b=>b.onclick=()=>{ingredientSettings.flavor_profiles.splice(Number(b.dataset.delFlavor),1);renderIngredientProfiles()});
  const ingredients=ingredientSettings.ingredient_profiles||[];
  $('ingredientProfiles').innerHTML=ingredients.map((p,i)=>'<div class="profileCard" data-ingredient="'+i+'"><div class="profileCardHead"><b>'+esc(p.name||('Ingredient '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-ingredient="'+i+'">Delete</button></div><div class="profileGrid"><label>Name<input data-k="name" value="'+esc(p.name||'')+'"></label><label>Aliases<input data-k="aliases" value="'+esc(p.aliases||'')+'" placeholder="Dark Chocolate 70%, Chocolate 70"></label><label>Category<input data-k="category" value="'+esc(p.category||'Other')+'"></label><label>Fat %<input data-k="fat_pct" type="number" step="0.1" value="'+Number(p.fat_pct||0)+'"></label><label>Protein %<input data-k="protein_pct" type="number" step="0.1" value="'+Number(p.protein_pct||0)+'"></label><label>Lactose %<input data-k="lactose_pct" type="number" step="0.1" value="'+(p.lactose_pct??'')+'"></label><label>Ash %<input data-k="ash_pct" type="number" step="0.1" value="'+(p.ash_pct??'')+'"></label><label>Moisture %<input data-k="moisture_pct" type="number" step="0.1" value="'+(p.moisture_pct??'')+'"></label><label>Total Solids %<input data-k="total_solids_pct" type="number" step="0.1" value="'+(p.total_solids_pct??'')+'"></label><label>Dairy MSNF %<input data-k="dairy_msnf_pct" type="number" step="0.1" value="'+(p.dairy_msnf_pct??'')+'"></label><label>Sucrose %<input data-k="sucrose_pct" type="number" step="0.1" value="'+Number(p.sucrose_pct||0)+'"></label><label>Dextrose %<input data-k="dextrose_pct" type="number" step="0.1" value="'+Number(p.dextrose_pct||0)+'"></label><label>Glucose %<input data-k="glucose_pct" type="number" step="0.1" value="'+Number(p.glucose_pct||0)+'"></label><label>Fructose %<input data-k="fructose_pct" type="number" step="0.1" value="'+Number(p.fructose_pct||0)+'"></label><label>Rel Sweetness<input data-k="relative_sweetness" type="number" step="0.01" value="'+(p.relative_sweetness??'')+'"></label><label>Freezing Factor<input data-k="fpdf" type="number" step="0.01" value="'+(p.fpdf??'')+'"></label><label>Verified<select data-k="verified"><option value="true" '+(p.verified===true?'selected':'')+'>Yes</option><option value="false" '+(p.verified!==true?'selected':'')+'>No</option></select></label><label>Price / kg<input data-k="price_per_kg" type="number" step="0.01" value="'+Number(p.price_per_kg||0)+'"></label><label class="wide">Source Name<input data-k="source_name" value="'+esc(p.source_name||'')+'"></label><label class="wide">Source URL<input data-k="source_url" value="'+esc(p.source_url||'')+'"></label><label class="wide">COA Reference<input data-k="coa_reference" value="'+esc(p.coa_reference||'')+'"></label><label class="wide">Notes<input data-k="note" value="'+esc(p.note||'')+'"></label></div></div>').join('');
  $('ingredientProfiles').querySelectorAll('[data-del-ingredient]').forEach(b=>b.onclick=()=>{ingredientSettings.ingredient_profiles.splice(Number(b.dataset.delIngredient),1);renderIngredientProfiles()});
  const sugars=ingredientSettings.sugar_profiles||[];
  $('sugarProfiles').innerHTML=sugars.map((p,i)=>'<div class="profileCard" data-sugar="'+i+'"><div class="profileCardHead"><b>'+esc(p.name||('Sugar '+(i+1)))+'</b><button type="button" class="danger miniDelete" data-del-sugar="'+i+'">Delete</button></div><div class="profileGrid"><label>Name<input data-k="name" value="'+esc(p.name||'')+'"></label><label>Type<select data-k="type"><option value="sucrose" '+(p.type==='sucrose'?'selected':'')+'>Sucrose</option><option value="dextrose" '+(p.type==='dextrose'?'selected':'')+'>Dextrose</option><option value="glucose_syrup" '+(p.type==='glucose_syrup'?'selected':'')+'>Glucose Syrup</option><option value="fructose" '+(p.type==='fructose'?'selected':'')+'>Fructose</option></select></label><label>DE<input data-k="de" type="number" min="0" max="100" step="1" value="'+(p.de??'')+'"></label><label>Dry Solids %<input data-k="dry_solids_pct" type="number" min="0" max="100" step="0.1" value="'+Number(p.dry_solids_pct||100)+'"></label><label>Relative Sweetness<input data-k="relative_sweetness" type="number" step="0.01" value="'+Number(p.relative_sweetness||0)+'"></label><label>Freezing Factor<input data-k="fpdf" type="number" step="0.01" value="'+Number(p.fpdf||0)+'"></label><label>Verified<select data-k="verified"><option value="true" '+(p.verified===true?'selected':'')+'>Yes</option><option value="false" '+(p.verified!==true?'selected':'')+'>No</option></select></label><label>Price / kg<input data-k="price_per_kg" type="number" step="0.01" value="'+Number(p.price_per_kg||0)+'"></label><label class="wide">Source Name<input data-k="source_name" value="'+esc(p.source_name||'')+'"></label><label class="wide">Source URL<input data-k="source_url" value="'+esc(p.source_url||'')+'"></label><label class="wide">Notes<input data-k="note" value="'+esc(p.note||'')+'"></label></div></div>').join('');
  $('defaultSugar').innerHTML='<option value="">None</option>'+sugars.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('defaultSugar').value=ingredientSettings.default_sugar_id||'';
  $('wizardSugarProfile').innerHTML='<option value="">Default Sugar Profile</option>'+sugars.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $('wizardSugarProfile').value=ingredientSettings.default_sugar_id||'';
  $('sugarProfiles').querySelectorAll('[data-del-sugar]').forEach(b=>b.onclick=()=>{ingredientSettings.sugar_profiles.splice(Number(b.dataset.delSugar),1);renderIngredientProfiles()});
  const cost=ingredientSettings.cost_settings||{},lock=ingredientSettings.quality_lock||{};
  $('costCurrency').value=cost.currency||'PKR';
  $('costMilk').value=Number(cost.whole_milk_per_kg||0);$('costCream').value=Number(cost.cream_per_kg||0);
  $('costSugar').value=Number(cost.sucrose_per_kg||0);$('costGlucose').value=Number(cost.glucose_per_kg||0);
  $('costWater').value=Number(cost.water_per_kg||0);$('costStabilizer').value=Number(cost.stabilizer_per_kg||0);$('costEmulsifier').value=Number(cost.emulsifier_per_kg||0);
  $('lockFat').value=lock.fat_tolerance_pct??.35;$('lockMsnf').value=lock.msnf_tolerance_pct??.5;$('lockSolids').value=lock.total_solids_tolerance_pct??1;
  $('lockSweet').value=lock.sweetness_index_tolerance??1.5;$('lockFreeze').value=lock.freezing_index_tolerance??2;
  $('machineProfiles').querySelectorAll('[data-del-machine]').forEach(b=>b.onclick=()=>{ingredientSettings.machine_profiles.splice(Number(b.dataset.delMachine),1);renderIngredientProfiles()});
  $('dryMilkProfiles').querySelectorAll('[data-del-powder]').forEach(b=>b.onclick=()=>{ingredientSettings.dry_milk_profiles.splice(Number(b.dataset.delPowder),1);renderIngredientProfiles()});
  $('cremodanProfiles').querySelectorAll('[data-del-cremodan]').forEach(b=>b.onclick=()=>{ingredientSettings.cremodan_profiles.splice(Number(b.dataset.delCremodan),1);renderIngredientProfiles()});
}
function collectProfiles(){
  ingredientSettings.whole_milk={name:'Whole Milk',fat_pct:Number($('wholeMilkFat').value||0),msnf_pct:Number($('wholeMilkMsnf').value||0),protein_pct:Number($('wholeMilkProtein').value||0),lactose_pct:Number($('wholeMilkLactose').value||0),ash_pct:Number($('wholeMilkAsh').value||0),moisture_pct:Number($('wholeMilkMoisture').value||0)};
  ingredientSettings.cream={name:'Cream',fat_pct:Number($('creamFat').value||0),msnf_pct:Number($('creamMsnf').value||0),protein_pct:Number($('creamProtein').value||0),lactose_pct:Number($('creamLactose').value||0),ash_pct:Number($('creamAsh').value||0),moisture_pct:Number($('creamMoisture').value||0)};
  document.querySelectorAll('#dryMilkProfiles [data-powder]').forEach(card=>{
    const p=ingredientSettings.dry_milk_profiles[Number(card.dataset.powder)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=x.type==='number'?(x.value===''?null:Number(x.value)):x.value});
  });
  document.querySelectorAll('#cremodanProfiles [data-cremodan]').forEach(card=>{
    const p=ingredientSettings.cremodan_profiles[Number(card.dataset.cremodan)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=['includes_emulsifier','cold_process_compatible','verified'].includes(k)?x.value==='true':x.type==='number'?(x.value===''?null:Number(x.value)):x.value});
  });
  ingredientSettings.default_dry_milk_id=$('defaultDryMilk').value||ingredientSettings.dry_milk_profiles[0]?.id||null;
  document.querySelectorAll('#machineProfiles [data-machine]').forEach(card=>{
    const p=ingredientSettings.machine_profiles[Number(card.dataset.machine)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=x.type==='number'?(x.value===''?null:Number(x.value)):x.value});
  });
  document.querySelectorAll('#flavorProfiles [data-flavor]').forEach(card=>{
    const p=ingredientSettings.flavor_profiles[Number(card.dataset.flavor)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=k==='composition_verified'?x.value==='true':x.type==='number'?(x.value===''?null:Number(x.value)):x.value});
  });
  ingredientSettings.default_flavor_id=$('defaultFlavor').value||null;
  document.querySelectorAll('#ingredientProfiles [data-ingredient]').forEach(card=>{
    const p=ingredientSettings.ingredient_profiles[Number(card.dataset.ingredient)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=k==='verified'?x.value==='true':x.type==='number'?(x.value===''?null:Number(x.value)):x.value});
  });
  document.querySelectorAll('#sugarProfiles [data-sugar]').forEach(card=>{
    const p=ingredientSettings.sugar_profiles[Number(card.dataset.sugar)];
    card.querySelectorAll('[data-k]').forEach(x=>{const k=x.dataset.k;p[k]=k==='verified'?x.value==='true':x.type==='number'?(x.value===''?null:Number(x.value)):x.value});
  });
  ingredientSettings.default_sugar_id=$('defaultSugar').value||null;
  ingredientSettings.cost_settings={
    currency:$('costCurrency').value.trim()||'PKR',
    whole_milk_per_kg:Number($('costMilk').value||0),cream_per_kg:Number($('costCream').value||0),
    sucrose_per_kg:Number($('costSugar').value||0),glucose_per_kg:Number($('costGlucose').value||0),
    water_per_kg:Number($('costWater').value||0),stabilizer_per_kg:Number($('costStabilizer').value||0),emulsifier_per_kg:Number($('costEmulsifier').value||0)
  };
  ingredientSettings.quality_lock={
    fat_tolerance_pct:Number($('lockFat').value||.35),msnf_tolerance_pct:Number($('lockMsnf').value||.5),
    total_solids_tolerance_pct:Number($('lockSolids').value||1),sweetness_index_tolerance:Number($('lockSweet').value||1.5),
    freezing_index_tolerance:Number($('lockFreeze').value||2)
  };
  ingredientSettings.default_cremodan_id=$('defaultCremodan').value||null;
  ingredientSettings.default_machine_id=$('defaultMachine').value||null;
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
  const comp=compositionAnalysis(current.items,current.total);
  const target=current.r.solids?{
    sugars:current.r.solids[0],fat:current.r.solids[1],msnf:current.r.solids[2],other_solids:current.r.solids[3],water:current.r.solids[4],total_solids:current.r.solids[5]
  }:{
    fat:current.r.fat??null,msnf:current.r.msnf??null,sucrose:current.r.sucrose??null,glucose:current.r.glucose??null,stabilizer:current.r.stabilizer??null,emulsifier:current.r.emulsifier??null
  };
  if(current?.premiumRAndD)target.premium_r_and_d={
    serving_temp_c:current.premiumRAndD.serving_temp_c,
    target_overrun_pct:current.premiumRAndD.target_overrun_pct,
    target_shelf_life_days:current.premiumRAndD.target_shelf_life_days||null,
    sweetness_target:current.premiumRAndD.sweetness_target,
    texture_target:current.premiumRAndD.texture_target,
    tier:current.premiumRAndD.analysis?.tier||null,
    variant:current.premiumRAndD.variant||null,
    variant_name:current.premiumRAndD.variant_name||null,
    machine_id:current.premiumRAndD.machine_id||null,
    machine_name:current.premiumRAndD.machine_name||null,
    flavor_id:current.premiumRAndD.flavor_id||null,
    flavor_name:current.premiumRAndD.flavor_name||null,
    flavor_dose_pct:current.premiumRAndD.flavor_dose_pct||0,
    sugar_profile_id:current.premiumRAndD.sugar_profile_id||null,
    sugar_profile_name:current.premiumRAndD.sugar_profile_name||null
  };
  target.actual={
    fat:comp.fat,
    protein:comp.protein,
    lactose:comp.lactose,
    msnf:comp.dairyMsnf>0?comp.dairyMsnf:(comp.protein+comp.lactose+comp.ash),
    total_solids:comp.totalSolids,
    water:comp.water,
    sucrose:comp.sucrose,
    dextrose:comp.dextrose,
    glucose:comp.glucose,
    known_sugars:comp.sucrose+comp.dextrose+comp.glucose+comp.lactose,
    sweetness_index:comp.pod,
    freezing_index:comp.pac,
    data_coverage:comp.coverage
  };
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
    process_profile:current?.premiumRAndD?.process_profile||{},
    research_target:target,
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
    loadReleaseReadiness(id);
    loadTextureCalibration(id);
    loadQcForRecipe(id);
    loadSensoryForRecipe(id);
    loadStabilityForRecipe(id);
    loadBioForRecipe(id);
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



async function loadMaterialLots(){
  const r=await fetch('/api/data?resource=gelato_lots',{cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||'Material lots load failed');
  materialLotsCache=j.records||[];
  return materialLotsCache;
}
function lotStatusClass(s){return String(s||'pending').toLowerCase()==='verified'?'finalBadge':''}
function renderMaterialLots(){
  const el=$('materialLotsList'); if(!el)return;
  if(!materialLotsCache.length){el.innerHTML='<div class="note">No material lots saved yet.</div>';return}
  el.innerHTML='<button type="button" class="secondary profileBtn" id="quickCremodanLot">+ CREMODAN SE 46-M • 1275590</button>'+materialLotsCache.map(x=>
    '<div class="profileCard"><div class="profileCardHead"><div><b>'+esc(x.ingredient_name)+'</b><small>'+esc(x.material_number||'No material no.')+' • '+esc(x.lot_number||'No lot')+'</small></div><span class="badge '+lotStatusClass(x.verification_status)+'">'+esc(String(x.verification_status||'pending').toUpperCase())+'</span></div>'+
    '<div class="businessMetrics"><span>Supplier <b>'+esc(x.supplier||'—')+'</b></span><span>Pack <b>'+esc(x.pack_size_kg??'—')+' kg</b></span><span>Prod <b>'+esc(x.production_date?String(x.production_date).slice(0,10):'—')+'</b></span><span>Best Before <b>'+esc(x.best_before?String(x.best_before).slice(0,10):'—')+'</b></span><span>COA <b>'+esc(x.coa_reference||'Missing')+'</b></span><span>TDS <b>'+esc(x.tds_reference||'Missing')+'</b></span></div></div>'
  ).join('');
  const q=$('quickCremodanLot');if(q)q.onclick=()=>showMaterialLotForm({ingredient_name:'CREMODAN SE 46-M',profile_type:'cremodan',manufacturer:'Danisco / IFF',material_number:'1275590',lot_number:'711489461',production_date:'2025-06-02',best_before:'2028-06-01',pack_size_kg:25,verification_status:'tds_pending',notes:'Bag label confirms CREMODAN SE 46-M, material 1275590, batch 711489461, 25 kg, production 02-Jun-2025, best before 01-Jun-2028. Dosage/application range still requires manufacturer TDS before verification.'});
}
async function openMaterialLots(){
  try{await loadMaterialLots();renderMaterialLots();$('materialLotsModal').classList.remove('hidden')}catch(e){alert(e.message)}
}
function showMaterialLotForm(prefill={}){
  $('materialLotsList').insertAdjacentHTML('afterbegin','<div class="profileCard" id="newLotCard"><div class="profileCardHead"><b>New Material Lot</b><button id="cancelLot" class="ghost" type="button">Cancel</button></div><div class="profileGrid">'+
    '<label>Ingredient Name<input id="lotIngredient" value="'+esc(prefill.ingredient_name||'')+'"></label><label>Profile Type<input id="lotProfileType" value="'+esc(prefill.profile_type||'')+'"></label>'+
    '<label>Supplier<input id="lotSupplier" value="'+esc(prefill.supplier||'')+'"></label><label>Manufacturer<input id="lotManufacturer" value="'+esc(prefill.manufacturer||'')+'"></label>'+
    '<label>Material No.<input id="lotMaterialNo" value="'+esc(prefill.material_number||'')+'"></label><label>Lot / Batch No.<input id="lotNumber" value="'+esc(prefill.lot_number||'')+'"></label>'+
    '<label>Production Date<input id="lotProdDate" type="date" value="'+esc(prefill.production_date||'')+'"></label><label>Best Before<input id="lotBestBefore" type="date" value="'+esc(prefill.best_before||'')+'"></label>'+
    '<label>Pack Size kg<input id="lotPack" type="number" step="0.001" value="'+esc(prefill.pack_size_kg??'')+'"></label><label>Status<select id="lotStatus"><option value="pending">Pending</option><option value="tds_pending" '+(prefill.verification_status==='tds_pending'?'selected':'')+'>TDS Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label>'+
    '<label>COA Reference<input id="lotCoa" value="'+esc(prefill.coa_reference||'')+'"></label><label>TDS Reference<input id="lotTds" value="'+esc(prefill.tds_reference||'')+'"></label>'+
    '<label class="wide">Notes<input id="lotNotes" value="'+esc(prefill.notes||'')+'"></label></div><button class="primary" id="saveLot" type="button">Save Material Lot</button></div>');
  $('cancelLot').onclick=()=>$('newLotCard')?.remove();
  $('saveLot').onclick=async()=>{
    const body={ingredient_name:$('lotIngredient').value,profile_type:$('lotProfileType').value,supplier:$('lotSupplier').value,manufacturer:$('lotManufacturer').value,material_number:$('lotMaterialNo').value,lot_number:$('lotNumber').value,production_date:$('lotProdDate').value||null,best_before:$('lotBestBefore').value||null,pack_size_kg:$('lotPack').value,verification_status:$('lotStatus').value,coa_reference:$('lotCoa').value,tds_reference:$('lotTds').value,notes:$('lotNotes').value};
    const r=await fetch('/api/data?resource=gelato_lots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){alert(j.error||'Material lot save failed');return}
    await loadMaterialLots();renderMaterialLots();alert('Material lot saved');
  };
}
function qcLotSelectorHtml(){
  if(!materialLotsCache.length)return '<div class="note wide">Raw Material Lots abhi saved nahi hain.</div>';
  return '<div class="wide"><div class="label">Raw Material Lots Used</div><div class="lotPickGrid">'+materialLotsCache.map(x=>
    '<label class="lotPick"><input type="checkbox" data-qc-lot="'+x.id+'"><span><b>'+esc(x.ingredient_name)+'</b><small>'+esc(x.material_number||'No material no.')+' • '+esc(x.lot_number||'No lot')+' • '+esc(String(x.verification_status||'pending').toUpperCase())+'</small></span><input data-qc-lot-qty="'+x.id+'" type="number" min="0" step="0.1" placeholder="g">'
  ).join('')+'</div></div>';
}
function rdFeedbackAdvice(rows){
  if(!rows?.length)return ['QC batch save karne ke baad R&D feedback yahan generate hoga.'];
  const q=rows[0],a=[];
  const hard=Number(q.hardness_score),sweet=Number(q.sweetness_score),ice=Number(q.iciness_score),body=Number(q.body_score),melt=Number(q.melt_30min_pct),over=Number(q.overrun_pct),draw=Number(q.draw_temp_c);
  if(Number.isFinite(hard)&&hard>=8)a.push('Too hard: pehle serving/draw temperature aur sugar freezing power check karein; controlled Variant B trial karein, stabilizer ko blind increase na karein.');
  if(Number.isFinite(hard)&&hard<=3)a.push('Too soft: total solids, overrun aur freezing power review karein; controlled Variant C trial useful ho sakta hai.');
  if(Number.isFinite(sweet)&&sweet>=8)a.push('Too sweet: total sugar kam karne se pehle low-sweetness/high-freezing-power substitution consider karein taa-ke hardness suddenly na barhe.');
  if(Number.isFinite(sweet)&&sweet<=3)a.push('Sweetness low: sucrose increase se PAC/freezing behavior bhi badlega; target serving temperature ke against rebalance karein.');
  if(Number.isFinite(ice)&&ice>=7)a.push('Iciness high: total solids, freezing rate, hardening speed, heat shock aur storage stability inspect karein; sirf gum/stabilizer increase ko first fix na banayein.');
  if(Number.isFinite(body)&&body<=4)a.push('Weak body: MSNF/protein/total-solids contribution aur overrun review karein; ingredient COA accuracy confirm karein.');
  if(Number.isFinite(melt)&&melt>=45)a.push('Fast melt: fat/protein emulsification, stabilizer system, overrun aur hardening process jointly review karein.');
  if(Number.isFinite(over)&&over>100)a.push('High overrun recorded: premium density/body target dilute ho sakta hai; machine air incorporation setting compare karein.');
  if(Number.isFinite(draw)&&draw>-4)a.push('Draw temperature relatively warm record hui; freezer endpoint/machine load validate karein.');
  if(!a.length)a.push('Latest QC mein koi major sensory/process warning trigger nahi hui. Next batch repeatability aur storage-day results continue karein.');
  return a;
}

async function loadReleaseReadiness(recipeId){
  try{
    const r=await fetch('/api/data?resource=gelato_release&recipe_id='+encodeURIComponent(recipeId),{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Release readiness load failed');
    renderReleaseReadiness(j);
  }catch(e){
    $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="warning">'+esc(e.message)+'</div>');
  }
}
function renderReleaseReadiness(j){
  const label=j.release_status==='ready'?'READY FOR COMMERCIAL REVIEW':j.release_status==='hold'?'HOLD':'NOT READY';
  const checks=(j.checks||[]).map(x=>'<div class="releaseCheck '+(x.pass?'pass':'fail')+'"><span>'+(x.pass?'✓':'!')+'</span><div><b>'+esc(x.label)+'</b><small>'+esc(x.value==null?'—':String(x.value))+'</small></div></div>').join('');
  const m=j.machine_calibration||{};
  const blockers=(j.blockers||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
  $('businessRecipeList').insertAdjacentHTML('beforeend',
    '<div class="businessRecipeCard releaseCard"><div class="businessRecipeHead"><div><h3>Commercial Release Readiness</h3><small>R&D + Production + Biological release checklist</small></div><span class="badge '+(j.release_status==='ready'?'finalBadge':'')+'">'+esc(label)+'</span></div>'+
    '<div class="stats"><div class="stat"><small>Readiness</small><strong>'+Number(j.readiness_pct||0).toFixed(1)+'%</strong></div><div class="stat"><small>Passed QC</small><strong>'+Number(j.passed_qc_batches||0)+'</strong></div><div class="stat"><small>Machine Calibration</small><strong>'+esc((m.status||'insufficient').toUpperCase())+'</strong></div><div class="stat"><small>Bio Status</small><strong>'+esc(String(j.biological?.status||'incomplete').toUpperCase())+'</strong></div><div class="stat"><small>Physical Stability</small><strong>'+esc(String(j.stability?.status||'not_started').toUpperCase())+'</strong></div><div class="stat"><small>Texture Calibration</small><strong>'+esc(String(j.texture_calibration?.status||'insufficient').toUpperCase())+'</strong></div><div class="stat"><small>Lot Traceability</small><strong>'+esc(String(j.material_traceability?.status||'incomplete').toUpperCase())+'</strong></div></div>'+
    '<div class="releaseGrid">'+checks+'</div>'+
    (blockers?'<div class="warning"><b>Release blockers:</b><ul>'+blockers+'</ul></div>':'<div class="source"><b>No checklist blocker detected.</b> Final commercial/regulatory review still required.</div>')+
    '<div class="subpanel"><h3>Machine Calibration</h3><div class="businessMetrics">'+
      '<span>Machine <b>'+esc(m.machine||'—')+'</b></span><span>Samples <b>'+esc(m.sample_count??0)+'</b></span><span>Target Overrun <b>'+esc(m.target_overrun_pct??'—')+'%</b></span><span>Measured Avg <b>'+esc(m.measured_overrun_avg??'—')+'%</b></span>'+
      '<span>Bias <b>'+esc(m.overrun_bias_pct_points??'—')+'</b></span><span>SD <b>'+esc(m.overrun_sd_pct_points??'—')+'</b></span><span>Avg Draw Temp <b>'+esc(m.avg_draw_temp_c??'—')+'°C</b></span><span>Avg Yield <b>'+esc(m.avg_finished_yield_l??'—')+' L</b></span>'+
    '</div><div class="steps">'+(m.comments||[]).map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div></div>'+
    '<div class="source">'+esc(j.note||'')+'</div></div>'
  );
}

async function loadTextureCalibration(recipeId){
  try{
    const r=await fetch('/api/data?resource=gelato_texture&recipe_id='+encodeURIComponent(recipeId),{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Texture calibration load failed');
    renderTextureCalibration(j.summary||{});
  }catch(e){$('businessRecipeList').insertAdjacentHTML('beforeend','<div class="warning">'+esc(e.message)+'</div>')}
}
function renderTextureCalibration(s){
  const label=String(s.status||'insufficient').replaceAll('_',' ').toUpperCase();
  const zone=String(s.predicted_zone||'—').replaceAll('_',' ').toUpperCase();
  $('businessRecipeList').insertAdjacentHTML('beforeend',
    '<div class="businessRecipeCard"><div class="businessRecipeHead"><div><h3>Empirical Texture Calibration</h3><small>Passed QC hardness-vs-temperature model</small></div><span class="badge '+(s.status==='calibrated'?'finalBadge':'')+'">'+esc(label)+'</span></div>'+
    '<div class="stats"><div class="stat"><small>Confidence</small><strong>'+Number(s.confidence||0).toFixed(1)+'%</strong></div><div class="stat"><small>Samples</small><strong>'+Number(s.sample_count||0)+'</strong></div><div class="stat"><small>Temperatures</small><strong>'+Number(s.distinct_temperatures||0)+'</strong></div><div class="stat"><small>Target Temp</small><strong>'+esc(s.target_serving_temp_c??'—')+'°C</strong></div></div>'+
    '<div class="businessMetrics"><span>Predicted Hardness <b>'+esc(s.predicted_hardness_1_10??'—')+'/10</b></span><span>Texture Zone <b>'+esc(zone)+'</b></span><span>Measured Range <b>'+esc(s.measured_temp_min_c??'—')+' to '+esc(s.measured_temp_max_c??'—')+'°C</b></span><span>RMSE <b>'+esc(s.rmse??'—')+'</b></span><span>Avg Overrun <b>'+esc(s.avg_overrun_pct??'—')+'%</b></span><span>Avg Melt 30m <b>'+esc(s.avg_melt_30min_pct??'—')+'%</b></span></div>'+
    '<div class="steps">'+(s.comments||[]).map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div>'+
    '<div class="source">Ye model sirf aap ke measured passed QC data par calibrate hota hai. Serving temperature range ke bahar prediction ko extrapolation samjhein.</div></div>'
  );
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
  const feedback=rdFeedbackAdvice(rows);
  const cards=rows.map(x=>'<div class="qcCard"><div class="businessRecipeHead"><div><b>'+esc(x.batch_code||('QC #'+x.id))+'</b><small>'+esc(String(x.test_date||''))+' • '+esc(x.machine||'No machine')+'</small></div><span class="badge '+(x.result==='pass'?'finalBadge':'')+'">'+esc(x.result)+'</span></div><div class="businessMetrics"><span>Overrun <b>'+esc(x.calculated_overrun_pct??x.overrun_pct??'—')+'%</b></span><span>Draw Temp <b>'+esc(x.draw_temp_c??'—')+'°C</b></span><span>Yield <b>'+esc(x.finished_yield_l??'—')+' L</b></span><span>Process <b>'+esc(x.process_compliance_pct??'—')+'%</b></span></div>'+(Array.isArray(x.material_lots)&&x.material_lots.length?'<div class="miniComment">Lots: '+x.material_lots.map(l=>esc(l.ingredient_name)+' '+esc(l.material_number||'')+'/'+esc(l.lot_number||'')).join(' • ')+'</div>':'')+'</div>').join('');
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="businessRecipeCard"><h3>Production QC</h3><div class="stats"><div class="stat"><small>Production Confidence</small><strong>'+Number(recipe.production_confidence||0).toFixed(1)+'%</strong></div><div class="stat"><small>QC Batches</small><strong>'+rows.length+'</strong></div></div><div id="qcList">'+(cards||'<div class="note">No QC tests yet.</div>')+'</div><div class="subpanel"><h3>R&D Feedback Rebalancing</h3><div class="steps">'+feedback.map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div><div class="source">Suggestions cause-oriented hain; formula automatically change nahi hoti. Next controlled trial ke baad Research Fit aur Production Confidence dobara compare karein.</div></div><button class="primary" id="addQcBtn" type="button">+ Add QC Test</button><button class="secondary profileBtn" id="goldenBtn" type="button">Mark Golden Production Recipe</button></div>');
  $('addQcBtn').onclick=()=>showQcForm(recipeId);
  $('goldenBtn').onclick=()=>markGolden(recipeId);
}
async function showQcForm(recipeId){
  try{await loadMaterialLots()}catch{materialLotsCache=[]}
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="profileModal" id="qcModal"><div class="profileBox"><div class="profileHead"><div><h2>Production QC Test</h2><p>Actual production measurements enter karein.</p></div><button id="qcClose" class="ghost">Close</button></div><div class="profileGrid">'+
    '<label>Batch Code<input id="qcBatch"></label><label>Test Date<input id="qcDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label><label>Machine<input id="qcMachine"></label><label>Operator<input id="qcOperator"></label>'+
    '<label>Mix Temp °C<input id="qcMixTemp" type="number" step="0.1"></label><label>Pasteurization Peak °C<input id="qcPasteur" type="number" step="0.1"></label><label>Pasteurization Hold sec<input id="qcPasteurHold" type="number" step="1"></label><label>Cooling End °C<input id="qcCoolingEnd" type="number" step="0.1"></label><label>Cooling Time min<input id="qcCoolingTime" type="number" step="0.1"></label><label>Homogenization bar<input id="qcHomoBar" type="number" step="1"></label><label>Ageing Temp °C<input id="qcAgeTemp" type="number" step="0.1"></label><label>Ageing Hours<input id="qcAge" type="number" step="0.1"></label><label>Hardening Temp °C<input id="qcHardTemp" type="number" step="0.1"></label><label>Hardening Time min<input id="qcHardTime" type="number" step="1"></label><label>Storage Temp °C<input id="qcStorageTemp" type="number" step="0.1"></label><label>pH<input id="qcPh" type="number" step="0.01"></label>'+
    '<label>Brix<input id="qcBrix" type="number" step="0.1"></label><label>Manual Overrun %<input id="qcOverrun" type="number" step="0.1"></label><label>Draw Temp °C<input id="qcDraw" type="number" step="0.1"></label><label>Melt 30min %<input id="qcMelt" type="number" step="0.1"></label>'+
    '<label>Same-volume Mix Weight g<input id="qcMixSample" type="number" step="0.1"></label><label>Same-volume Frozen Weight g<input id="qcFrozenSample" type="number" step="0.1"></label><label>Sample Volume mL<input id="qcSampleVolume" type="number" step="1"></label><label>Finished Yield L<input id="qcYieldL" type="number" step="0.01"></label><label>Batch Output kg<input id="qcOutputKg" type="number" step="0.01"></label>'+
    '<label>Hardness 1-10<input id="qcHard" type="number" min="1" max="10"></label><label>Hardness Test Temp °C<input id="qcHardTemp" type="number" step="0.1" value="-13"></label><label>Sweetness 1-10<input id="qcSweet" type="number" min="1" max="10"></label><label>Iciness 1-10<input id="qcIce" type="number" min="1" max="10"></label><label>Body 1-10<input id="qcBody" type="number" min="1" max="10"></label>'+
    '<label>Aftertaste 1-10<input id="qcAfter" type="number" min="1" max="10"></label><label>Result<select id="qcResult"><option value="trial">Trial</option><option value="pass">Pass</option><option value="fail">Fail</option></select></label><label class="wide">Day 1 Notes<input id="qcDay1"></label><label class="wide">Day 7 Notes<input id="qcDay7"></label>'+
    qcLotSelectorHtml()+
    '</div><button class="primary" id="saveQc">Save QC Test</button></div></div>');
  $('qcClose').onclick=()=>$('qcModal').remove();
  $('saveQc').onclick=async()=>{
    const body={batch_code:$('qcBatch').value,test_date:$('qcDate').value,machine:$('qcMachine').value,operator_name:$('qcOperator').value,mix_temp_c:$('qcMixTemp').value,pasteurization_peak_c:$('qcPasteur').value,pasteurization_hold_sec:$('qcPasteurHold').value,cooling_end_temp_c:$('qcCoolingEnd').value,cooling_time_min:$('qcCoolingTime').value,homogenization_pressure_bar:$('qcHomoBar').value,ageing_temp_c:$('qcAgeTemp').value,ageing_hours:$('qcAge').value,hardening_temp_c:$('qcHardTemp').value,hardening_time_min:$('qcHardTime').value,storage_temp_c:$('qcStorageTemp').value,ph:$('qcPh').value,brix:$('qcBrix').value,overrun_pct:$('qcOverrun').value,draw_temp_c:$('qcDraw').value,melt_30min_pct:$('qcMelt').value,mix_sample_g:$('qcMixSample').value,frozen_sample_g:$('qcFrozenSample').value,sample_volume_ml:$('qcSampleVolume').value,finished_yield_l:$('qcYieldL').value,batch_output_kg:$('qcOutputKg').value,hardness_score:$('qcHard').value,hardness_test_temp_c:$('qcHardTemp').value,sweetness_score:$('qcSweet').value,iciness_score:$('qcIce').value,body_score:$('qcBody').value,aftertaste_score:$('qcAfter').value,day1_notes:$('qcDay1').value,day7_notes:$('qcDay7').value,result:$('qcResult').value,material_lots:[...document.querySelectorAll('[data-qc-lot]:checked')].map(x=>({lot_id:Number(x.dataset.qcLot),ingredient_name:materialLotsCache.find(y=>Number(y.id)===Number(x.dataset.qcLot))?.ingredient_name||'',quantity_g:document.querySelector('[data-qc-lot-qty="'+x.dataset.qcLot+'"]')?.value||null}))};
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


async function loadSensoryForRecipe(recipeId){
  try{
    const r=await fetch('/api/data?resource=gelato_sensory&recipe_id='+encodeURIComponent(recipeId),{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Sensory panel load failed');
    renderSensoryPanel(recipeId,j.records||[],j.summary||{});
  }catch(e){$('businessRecipeList').insertAdjacentHTML('beforeend','<div class="warning">'+esc(e.message)+'</div>')}
}
function renderSensoryPanel(recipeId,rows,summary){
  const avg=summary.attribute_avg||{};
  const cards=rows.map(x=>'<div class="qcCard"><div class="businessRecipeHead"><div><b>'+esc(x.tester_name||('Panel #'+x.id))+'</b><small>'+esc(String(x.panel_date||''))+'</small></div><span class="badge">'+esc(x.overall_score??'—')+'/10</span></div><div class="businessMetrics"><span>Creaminess <b>'+esc(x.creaminess_score??'—')+'</b></span><span>Smoothness <b>'+esc(x.smoothness_score??'—')+'</b></span><span>Flavor <b>'+esc(x.flavor_score??'—')+'</b></span><span>Melt <b>'+esc(x.melt_score??'—')+'</b></span></div></div>').join('');
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="businessRecipeCard"><h3>Sensory Panel</h3><div class="stats"><div class="stat"><small>Panelists</small><strong>'+Number(summary.panel_count||0)+'</strong></div><div class="stat"><small>Overall Avg</small><strong>'+(summary.overall_avg==null?'—':Number(summary.overall_avg).toFixed(1)+'/10')+'</strong></div><div class="stat"><small>Panel Confidence</small><strong>'+Number(summary.confidence||0).toFixed(1)+'%</strong></div><div class="stat"><small>Creaminess Avg</small><strong>'+(avg.creaminess_score==null?'—':Number(avg.creaminess_score).toFixed(1))+'</strong></div></div>'+
  '<div class="steps">'+(summary.comments||[]).map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div>'+
  '<div id="sensoryList">'+(cards||'<div class="note">No sensory panel results yet.</div>')+'</div><button class="primary" id="addSensoryBtn" type="button">+ Add Sensory Score</button></div>');
  $('addSensoryBtn').onclick=()=>showSensoryForm(recipeId);
}
function showSensoryForm(recipeId){
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="profileModal" id="sensoryModal"><div class="profileBox"><div class="profileHead"><div><h2>Sensory Panel Score</h2><p>Har taster apna independent 1–10 score enter kare.</p></div><button id="sensoryClose" class="ghost">Close</button></div><div class="profileGrid">'+
    '<label>Tester Name<input id="sensTester"></label><label>Date<input id="sensDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label>'+
    '<label>Creaminess 1-10<input id="sensCream" type="number" min="1" max="10"></label><label>Smoothness 1-10<input id="sensSmooth" type="number" min="1" max="10"></label><label>Sweetness 1-10<input id="sensSweet" type="number" min="1" max="10"></label><label>Flavor 1-10<input id="sensFlavor" type="number" min="1" max="10"></label>'+
    '<label>Body 1-10<input id="sensBody" type="number" min="1" max="10"></label><label>Melt 1-10<input id="sensMelt" type="number" min="1" max="10"></label><label>Aftertaste 1-10<input id="sensAfter" type="number" min="1" max="10"></label><label>Overall 1-10<input id="sensOverall" type="number" min="1" max="10"></label>'+
    '<label class="wide">Comments<input id="sensComments"></label></div><button class="primary" id="saveSensory">Save Sensory Score</button></div></div>');
  $('sensoryClose').onclick=()=>$('sensoryModal').remove();
  $('saveSensory').onclick=async()=>{
    const body={tester_name:$('sensTester').value,panel_date:$('sensDate').value,creaminess_score:$('sensCream').value,smoothness_score:$('sensSmooth').value,sweetness_score:$('sensSweet').value,flavor_score:$('sensFlavor').value,body_score:$('sensBody').value,melt_score:$('sensMelt').value,aftertaste_score:$('sensAfter').value,overall_score:$('sensOverall').value,comments:$('sensComments').value};
    const r=await fetch('/api/data?resource=gelato_sensory&recipe_id='+recipeId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){alert(j.error||'Sensory score save failed');return}
    $('sensoryModal').remove();alert('Sensory score saved • Panel average '+(j.summary?.overall_avg==null?'—':Number(j.summary.overall_avg).toFixed(1)+'/10'));viewBusinessRecipe(recipeId);
  };
}

async function loadStabilityForRecipe(recipeId){
  try{
    const r=await fetch('/api/data?resource=gelato_stability&recipe_id='+encodeURIComponent(recipeId),{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Stability study load failed');
    renderStabilityPanel(recipeId,j.records||[],j.summary||{});
  }catch(e){$('businessRecipeList').insertAdjacentHTML('beforeend','<div class="warning">'+esc(e.message)+'</div>')}
}
function renderStabilityPanel(recipeId,rows,summary){
  const label=String(summary.status||'not_started').replaceAll('_',' ').toUpperCase();
  const cards=rows.map(x=>'<div class="qcCard"><div class="businessRecipeHead"><div><b>Day '+esc(x.checkpoint_day??0)+'</b><small>'+esc(String(x.test_date||''))+' • '+esc(x.batch_code||'No batch')+'</small></div><span class="badge">'+esc(x.heat_shock_cycles||0)+' shock</span></div><div class="businessMetrics"><span>Storage <b>'+esc(x.storage_temp_c??'—')+'°C</b></span><span>Hardness <b>'+esc(x.hardness_score??'—')+'</b></span><span>Iciness <b>'+esc(x.iciness_score??'—')+'</b></span><span>Melt 30m <b>'+esc(x.melt_30min_pct??'—')+'%</b></span><span>Overall <b>'+esc(x.overall_score??'—')+'/10</b></span><span>Flavor <b>'+esc(x.flavor_score??'—')+'/10</b></span></div></div>').join('');
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="businessRecipeCard"><div class="businessRecipeHead"><div><h3>Storage Stability & Heat-Shock Study</h3><small>Physical shelf-life validation</small></div><span class="badge '+(summary.status==='stable'?'finalBadge':'')+'">'+esc(label)+'</span></div>'+
    '<div class="stats"><div class="stat"><small>Stability Confidence</small><strong>'+Number(summary.confidence||0).toFixed(1)+'%</strong></div><div class="stat"><small>Target Shelf Life</small><strong>'+esc(summary.target_days??'—')+' d</strong></div><div class="stat"><small>Latest Checkpoint</small><strong>Day '+esc(summary.max_day??0)+'</strong></div><div class="stat"><small>Checkpoints</small><strong>'+esc(summary.checkpoints??0)+'</strong></div></div>'+
    '<div class="businessMetrics"><span>Hardness Drift <b>'+esc(summary.hardness_drift??'—')+'</b></span><span>Iciness Drift <b>'+esc(summary.iciness_drift??'—')+'</b></span><span>Sensory Drift <b>'+esc(summary.overall_drift??'—')+'</b></span><span>Melt Drift <b>'+esc(summary.melt_drift_pct_points??'—')+'</b></span></div>'+
    '<div class="steps">'+(summary.comments||[]).map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div>'+
    '<div id="stabilityList">'+(cards||'<div class="note">No stability checkpoints yet.</div>')+'</div>'+
    '<button class="primary" id="addStabilityBtn" type="button">+ Add Stability Checkpoint</button>'+
    '<div class="source">Physical stability score formulation/sensory drift ko track karta hai. Microbiological shelf-life validation separate hai aur required reh sakti hai.</div></div>');
  $('addStabilityBtn').onclick=()=>showStabilityForm(recipeId);
}
function showStabilityForm(recipeId){
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="profileModal" id="stabilityModal"><div class="profileBox"><div class="profileHead"><div><h2>Storage Stability Checkpoint</h2><p>Normal storage ya heat-shock challenge ka actual result enter karein.</p></div><button id="stabilityClose" class="ghost">Close</button></div><div class="profileGrid">'+
    '<label>Batch Code<input id="stBatch"></label><label>Checkpoint Day<input id="stDay" type="number" min="0" step="1" value="0"></label><label>Test Date<input id="stDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label><label>Storage Temp °C<input id="stTemp" type="number" step="0.1" value="-18"></label>'+
    '<label>Heat-Shock Cycles<input id="stShockCycles" type="number" min="0" step="1" value="0"></label><label>Heat-Shock High Temp °C<input id="stShockTemp" type="number" step="0.1"></label><label>Heat-Shock Duration min<input id="stShockMin" type="number" step="1"></label>'+
    '<label>Hardness 1-10<input id="stHard" type="number" min="1" max="10"></label><label>Iciness 1-10<input id="stIce" type="number" min="1" max="10"></label><label>Smoothness 1-10<input id="stSmooth" type="number" min="1" max="10"></label><label>Flavor 1-10<input id="stFlavor" type="number" min="1" max="10"></label><label>Body 1-10<input id="stBody" type="number" min="1" max="10"></label><label>Overall 1-10<input id="stOverall" type="number" min="1" max="10"></label><label>Melt 30min %<input id="stMelt" type="number" step="0.1"></label>'+
    '<label>Package Condition<input id="stPack"></label><label>Visible Ice Crystals<input id="stCrystals"></label><label class="wide">Notes<input id="stNotes"></label>'+
    '</div><button class="primary" id="saveStability">Save Checkpoint</button></div></div>');
  $('stabilityClose').onclick=()=>$('stabilityModal').remove();
  $('saveStability').onclick=async()=>{
    const body={batch_code:$('stBatch').value,checkpoint_day:$('stDay').value,test_date:$('stDate').value,storage_temp_c:$('stTemp').value,heat_shock_cycles:$('stShockCycles').value,heat_shock_high_temp_c:$('stShockTemp').value,heat_shock_duration_min:$('stShockMin').value,hardness_score:$('stHard').value,iciness_score:$('stIce').value,smoothness_score:$('stSmooth').value,flavor_score:$('stFlavor').value,body_score:$('stBody').value,overall_score:$('stOverall').value,melt_30min_pct:$('stMelt').value,package_condition:$('stPack').value,visible_ice_crystals:$('stCrystals').value,notes:$('stNotes').value};
    const r=await fetch('/api/data?resource=gelato_stability&recipe_id='+recipeId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){alert(j.error||'Stability checkpoint save failed');return}
    $('stabilityModal').remove();alert('Stability checkpoint saved • '+String(j.summary?.status||'in_progress').toUpperCase()+' • '+Number(j.summary?.confidence||0).toFixed(1)+'%');viewBusinessRecipe(recipeId);
  };
}
async function loadBioForRecipe(recipeId){
  try{
    const r=await fetch('/api/data?resource=gelato_bio&recipe_id='+encodeURIComponent(recipeId),{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Biological validation load failed');
    renderBioPanel(recipeId,j.records||[],j.summary||{status:'incomplete',confidence:0,comments:[]});
  }catch(e){$('businessRecipeList').insertAdjacentHTML('beforeend','<div class="warning">'+esc(e.message)+'</div>')}
}
function renderBioPanel(recipeId,rows,summary){
  const statusLabel=summary.status==='lab_validated'?'LAB-VALIDATED':summary.status==='hold'?'HOLD':'INCOMPLETE';
  const cards=rows.map(x=>'<div class="qcCard"><div class="businessRecipeHead"><div><b>'+esc(x.sample_code||('BIO #'+x.id))+'</b><small>'+esc(String(x.test_date||''))+' • Day '+esc(x.storage_day??'—')+' • '+esc(x.lab_name||'No lab')+'</small></div><span class="badge '+(summary.status==='lab_validated'?'finalBadge':'')+'">'+esc(statusLabel)+'</span></div><div class="businessMetrics"><span>Listeria <b>'+esc(x.listeria_status||'—')+'</b></span><span>Salmonella <b>'+esc(x.salmonella_status||'—')+'</b></span><span>TPC <b>'+esc(x.total_plate_count??'—')+'</b></span><span>Yeast/Mold <b>'+esc(x.yeast_mold_count??'—')+'</b></span></div></div>').join('');
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="businessRecipeCard"><h3>Microbiology & Shelf-Life Validation</h3><div class="stats"><div class="stat"><small>Validation Status</small><strong>'+esc(statusLabel)+'</strong></div><div class="stat"><small>Validation Confidence</small><strong>'+Number(summary.confidence||0).toFixed(1)+'%</strong></div><div class="stat"><small>Storage Checkpoints</small><strong>'+rows.length+'</strong></div><div class="stat"><small>Release Rule</small><strong>'+(summary.status==='hold'?'HOLD':'Review')+'</strong></div></div>'+
    '<div class="warning"><b>Important:</b> Confidence % data-completeness indicator hai; food-safety clearance nahi. Applicable lab/regulatory criteria ke baghair product automatically safe declare nahi hoga.</div>'+
    '<div class="steps">'+(summary.comments||[]).map((t,i)=>'<div class="step"><b>'+(i+1)+'</b><p>'+esc(t)+'</p></div>').join('')+'</div>'+
    '<div id="bioList">'+(cards||'<div class="note">No biological validation tests yet.</div>')+'</div><button class="primary" id="addBioBtn" type="button">+ Add Biological / Lab Test</button></div>');
  $('addBioBtn').onclick=()=>showBioForm(recipeId);
}
function showBioForm(recipeId){
  $('businessRecipeList').insertAdjacentHTML('beforeend','<div class="profileModal" id="bioModal"><div class="profileBox"><div class="profileHead"><div><h2>Biological / Shelf-Life Test</h2><p>Lab aur storage validation record karein.</p></div><button id="bioClose" class="ghost">Close</button></div><div class="profileGrid">'+
    '<label>Sample Code<input id="bioSample"></label><label>Lab Name<input id="bioLab"></label><label>Report Reference<input id="bioReport"></label><label>Test Date<input id="bioDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label>'+
    '<label>Storage Day<input id="bioDay" type="number" min="0"></label><label>Storage Temp °C<input id="bioStoreTemp" type="number" step="0.1"></label><label>Packaging<input id="bioPack"></label><label>pH<input id="bioPh" type="number" step="0.01"></label>'+
    '<label>Water Activity aw<input id="bioAw" type="number" step="0.001"></label><label>Total Plate Count CFU/g<input id="bioTpc" type="number" step="1"></label><label>Coliform CFU/g<input id="bioColi" type="number" step="1"></label><label>Yeast/Mold CFU/g<input id="bioYm" type="number" step="1"></label>'+
    '<label>Listeria<select id="bioListeria"><option value="">Not Tested</option><option>Not Detected</option><option>Detected</option></select></label><label>Salmonella<select id="bioSalmonella"><option value="">Not Tested</option><option>Not Detected</option><option>Detected</option></select></label><label>Staphylococcus<select id="bioStaph"><option value="">Not Tested</option><option>Not Detected</option><option>Detected</option></select></label>'+
    '<label>Probiotic CFU/g<input id="bioProbiotic" type="number" step="1"></label><label class="wide">Culture Strain<input id="bioCulture" placeholder="e.g. Lactobacillus..."></label><label class="wide">Notes<input id="bioNotes"></label>'+
    '</div><button class="primary" id="saveBio">Save Biological Test</button></div></div>');
  $('bioClose').onclick=()=>$('bioModal').remove();
  $('saveBio').onclick=async()=>{
    const body={sample_code:$('bioSample').value,lab_name:$('bioLab').value,report_reference:$('bioReport').value,test_date:$('bioDate').value,storage_day:$('bioDay').value,storage_temp_c:$('bioStoreTemp').value,packaging:$('bioPack').value,ph:$('bioPh').value,water_activity:$('bioAw').value,total_plate_count:$('bioTpc').value,coliform_count:$('bioColi').value,yeast_mold_count:$('bioYm').value,listeria_status:$('bioListeria').value,salmonella_status:$('bioSalmonella').value,staph_status:$('bioStaph').value,probiotic_cfu:$('bioProbiotic').value,culture_strain:$('bioCulture').value,notes:$('bioNotes').value};
    const r=await fetch('/api/data?resource=gelato_bio&recipe_id='+recipeId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){alert(j.error||'Biological test save failed');return}
    $('bioModal').remove();alert('Biological validation saved • '+String(j.summary?.status||'incomplete').toUpperCase()+' • '+Number(j.summary?.confidence||0).toFixed(1)+'%');viewBusinessRecipe(recipeId);
  };
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
$('premiumWizardBtn').onclick=()=>{$('premiumWizardModal').classList.remove('hidden');previewPremiumWizard()};
$('premiumWizardClose').onclick=()=>$('premiumWizardModal').classList.add('hidden');
$('premiumWizardModal').onclick=e=>{if(e.target===$('premiumWizardModal'))$('premiumWizardModal').classList.add('hidden')};
['wizardMaster','wizardBase','wizardBatch','wizardServingTemp','wizardSweetness','wizardTexture','wizardOverrun','wizardMachine','wizardFlavor','wizardFlavorDose','wizardPasteurMin','wizardPasteurMax','wizardPasteurHold','wizardCoolMax','wizardCoolTime','wizardAgeTemp','wizardAgeMin','wizardAgeMax','wizardDrawTarget','wizardDrawTol','wizardHardeningTemp','wizardHardeningTime','wizardStorageTemp','wizardShelfLifeDays','wizardSugarProfile'].forEach(id=>$(id).oninput=previewPremiumWizard);
$('buildPremiumRecipe').onclick=buildPremiumRecipe;
$('ingredientSettingsBtn').onclick=()=>{renderIngredientProfiles();$('profileModal').classList.remove('hidden')};
$('materialLotsBtn').onclick=openMaterialLots;
$('materialLotsClose').onclick=()=>$('materialLotsModal').classList.add('hidden');
$('materialLotsModal').onclick=e=>{if(e.target===$('materialLotsModal'))$('materialLotsModal').classList.add('hidden')};
$('addMaterialLot').onclick=()=>showMaterialLotForm();

$('profileClose').onclick=()=>$('profileModal').classList.add('hidden');
$('profileModal').onclick=e=>{if(e.target===$('profileModal'))$('profileModal').classList.add('hidden')};
$('addDryMilkProfile').onclick=()=>{ingredientSettings.dry_milk_profiles=ingredientSettings.dry_milk_profiles||[];ingredientSettings.dry_milk_profiles.push({id:profileId('powder'),name:'New Dry Milk',fat_pct:0,protein_pct:0,carbs_pct:0,lactose_pct:null,true_msnf_pct:null,moisture_pct:0,ash_pct:null,total_solids_pct:null,other_pct:0,added_sugar_pct:null,price_per_kg:0,note:''});renderIngredientProfiles()};
$('addCremodanProfile').onclick=()=>{ingredientSettings.cremodan_profiles=ingredientSettings.cremodan_profiles||[];ingredientSettings.cremodan_profiles.push({id:profileId('cremodan'),grade:'CREMODAN',dosage_g_per_kg:0,dosage_min_g_per_kg:null,dosage_max_g_per_kg:null,includes_emulsifier:true,product_type:'General',fat_min_pct:null,fat_max_pct:null,solids_min_pct:null,solids_max_pct:null,cold_process_compatible:false,verified:false,source_name:'',source_url:'',price_per_kg:0,note:''});renderIngredientProfiles()};
$('addMachineProfile').onclick=()=>{ingredientSettings.machine_profiles=ingredientSettings.machine_profiles||[];ingredientSettings.machine_profiles.push({id:profileId('machine'),name:'New Batch Freezer',type:'Batch Freezer',min_batch_kg:0,max_batch_kg:0,overrun_min_pct:0,overrun_max_pct:0,draw_temp_c:null,ageing_min_hours:4,hardening_temp_c:-30,notes:''});renderIngredientProfiles()};
$('addFlavorProfile').onclick=()=>{ingredientSettings.flavor_profiles=ingredientSettings.flavor_profiles||[];ingredientSettings.flavor_profiles.push({id:profileId('flavor'),name:'New Flavor',category:'Flavor / Inclusion',recommended_min_pct:0,recommended_max_pct:0,fat_pct:0,protein_pct:0,dairy_msnf_pct:null,sucrose_pct:0,dextrose_pct:0,glucose_pct:0,fructose_pct:0,moisture_pct:0,ash_pct:0,brix_pct:null,acidity_pct:null,composition_verified:false,price_per_kg:0,source_note:'',note:''});renderIngredientProfiles()};
$('addSugarProfile').onclick=()=>{ingredientSettings.sugar_profiles=ingredientSettings.sugar_profiles||[];ingredientSettings.sugar_profiles.push({id:profileId('sugar'),name:'New Glucose Syrup',type:'glucose_syrup',de:null,dry_solids_pct:100,relative_sweetness:0,fpdf:0,verified:false,price_per_kg:0,source_name:'',source_url:'',note:''});renderIngredientProfiles()};
$('addIngredientProfile').onclick=()=>{ingredientSettings.ingredient_profiles=ingredientSettings.ingredient_profiles||[];ingredientSettings.ingredient_profiles.push({id:profileId('ingredient'),name:'New Ingredient',aliases:'',category:'Other',fat_pct:0,protein_pct:0,lactose_pct:null,ash_pct:null,moisture_pct:null,total_solids_pct:null,dairy_msnf_pct:null,sucrose_pct:0,dextrose_pct:0,glucose_pct:0,fructose_pct:0,relative_sweetness:null,fpdf:null,verified:false,price_per_kg:0,source_name:'',source_url:'',coa_reference:'',note:''});renderIngredientProfiles()};
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
