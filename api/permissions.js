import { requireUser,bodyOf,MENU_KEYS } from './_auth.js';

const ROLES=['admin','manager','accountant','salesman'];

export default async function handler(req,res){
  try{
    const auth=await requireUser(req,res,'employees');if(!auth)return;
    const {sql,user}=auth;
    if(user.designation!=='admin')return res.status(403).json({error:'Admin only'});

    if(req.method==='GET'){
      const rows=await sql`SELECT designation,menu_key,allowed FROM role_permissions ORDER BY designation,menu_key`;
      const permissions={};
      for(const role of ROLES){permissions[role]={};for(const key of MENU_KEYS)permissions[role][key]=false;}
      for(const r of rows){if(permissions[r.designation]&&MENU_KEYS.includes(r.menu_key))permissions[r.designation][r.menu_key]=Boolean(r.allowed);}
      return res.status(200).json({roles:ROLES,menuKeys:MENU_KEYS,permissions});
    }

    if(req.method==='POST'){
      const b=bodyOf(req);
      const role=String(b.designation||'').toLowerCase();
      if(!ROLES.includes(role))return res.status(400).json({error:'Invalid designation'});
      const selected=Array.isArray(b.allowed)?b.allowed.map(String).filter(k=>MENU_KEYS.includes(k)):[];
      const finalSelected=new Set(selected);
      if(role==='admin'){
        finalSelected.add('dashboard');
        finalSelected.add('employees');
      }
      for(const key of MENU_KEYS){
        const allowed=finalSelected.has(key);
        await sql`INSERT INTO role_permissions(designation,menu_key,allowed,updated_at)
          VALUES(${role},${key},${allowed},now())
          ON CONFLICT (designation,menu_key) DO UPDATE SET allowed=EXCLUDED.allowed,updated_at=now()`;
      }
      return res.status(200).json({ok:true,designation:role,allowed:[...finalSelected]});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(e){console.error('Permissions API error',e);return res.status(500).json({error:e?.message||'Permissions request failed'});}
}
