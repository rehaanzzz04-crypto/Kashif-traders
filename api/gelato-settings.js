import { neon } from '@neondatabase/serverless';
import { getSessionUser } from './_auth.js';

const cleanText=v=>{
  if(v===undefined||v===null)return null;
  const s=String(v).trim();
  return s||null;
};
const num=(v,fallback=0)=>{
  const n=Number(v);
  return Number.isFinite(n)?n:fallback;
};
const pct=v=>Math.max(0,Math.min(100,num(v,0)));
const safeId=(v,prefix)=>cleanText(v)||prefix+'-'+Date.now().toString(36);

const DEFAULT_SETTINGS={
  whole_milk:{name:'Whole Milk',fat_pct:3.5,msnf_pct:8.5},
  cream:{name:'Cream',fat_pct:35,msnf_pct:5.5},
  dry_milk_profiles:[{
    id:'melco-26',
    name:'Melco Vegetable Fat Filled Powder',
    fat_pct:26,
    protein_pct:16,
    carbs_pct:50,
    moisture_pct:4,
    other_pct:4,
    added_sugar_pct:null,
    note:'Bag label profile. Carbohydrates include sugar/corn syrup; exact sugar split should be updated from current COA when available.'
  }],
  cremodan_profiles:[],
  default_dry_milk_id:'melco-26',
  default_cremodan_id:null
};

function normalizeProfile(body={}){
  const whole=body.whole_milk||{},cream=body.cream||{};
  const powders=(Array.isArray(body.dry_milk_profiles)?body.dry_milk_profiles:[]).slice(0,20).map((p,i)=>({
    id:safeId(p?.id,'powder-'+i),
    name:cleanText(p?.name)||('Dry Milk Profile '+(i+1)),
    fat_pct:pct(p?.fat_pct),
    protein_pct:pct(p?.protein_pct),
    carbs_pct:pct(p?.carbs_pct),
    moisture_pct:pct(p?.moisture_pct),
    other_pct:pct(p?.other_pct),
    added_sugar_pct:p?.added_sugar_pct===null||p?.added_sugar_pct===''?null:pct(p?.added_sugar_pct),
    note:cleanText(p?.note)
  }));
  const cremodans=(Array.isArray(body.cremodan_profiles)?body.cremodan_profiles:[]).slice(0,20).map((p,i)=>({
    id:safeId(p?.id,'cremodan-'+i),
    grade:cleanText(p?.grade)||('CREMODAN '+(i+1)),
    dosage_g_per_kg:Math.max(0,Math.min(30,num(p?.dosage_g_per_kg,0))),
    includes_emulsifier:p?.includes_emulsifier!==false,
    product_type:cleanText(p?.product_type)||'General',
    note:cleanText(p?.note)
  }));
  return {
    whole_milk:{name:cleanText(whole.name)||'Whole Milk',fat_pct:pct(whole.fat_pct||3.5),msnf_pct:pct(whole.msnf_pct||8.5)},
    cream:{name:cleanText(cream.name)||'Cream',fat_pct:pct(cream.fat_pct||35),msnf_pct:pct(cream.msnf_pct||5.5)},
    dry_milk_profiles:powders.length?powders:DEFAULT_SETTINGS.dry_milk_profiles,
    cremodan_profiles:cremodans,
    default_dry_milk_id:cleanText(body.default_dry_milk_id)||(powders[0]?.id||DEFAULT_SETTINGS.default_dry_milk_id),
    default_cremodan_id:cleanText(body.default_cremodan_id)
  };
}

async function ensure(sql){
  await sql`CREATE TABLE IF NOT EXISTS gelato_ingredient_settings(
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),
    settings JSONB NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  const existing=await sql`SELECT id FROM gelato_ingredient_settings WHERE id=1`;
  if(!existing[0]) await sql`INSERT INTO gelato_ingredient_settings(id,settings) VALUES(1,${JSON.stringify(DEFAULT_SETTINGS)}::jsonb)`;
}

export default async function handler(req,res){
  const url=process.env.DATABASE_URL;
  if(!url)return res.status(503).json({error:'DATABASE_URL is not configured'});
  try{
    const sql=neon(url);
    const user=await getSessionUser(req,sql);
    if(!user)return res.status(401).json({error:'Authentication required'});
    await ensure(sql);
    if(req.method==='GET'){
      const row=(await sql`SELECT settings,updated_by,updated_at FROM gelato_ingredient_settings WHERE id=1`)[0];
      return res.status(200).json({settings:row?.settings||DEFAULT_SETTINGS,updated_by:row?.updated_by||null,updated_at:row?.updated_at||null});
    }
    if(req.method==='PUT'||req.method==='PATCH'){
      if(String(user.designation||'').toLowerCase()!=='admin')return res.status(403).json({error:'Sirf Admin ingredient profiles update kar sakta hai'});
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const settings=normalizeProfile(body);
      const by=user.full_name||user.employee_code||'Admin';
      const row=(await sql`UPDATE gelato_ingredient_settings SET settings=${JSON.stringify(settings)}::jsonb,updated_by=${by},updated_at=now() WHERE id=1 RETURNING settings,updated_by,updated_at`)[0];
      return res.status(200).json(row);
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('gelato settings error',e);
    return res.status(500).json({error:'Ingredient settings request failed'});
  }
}
