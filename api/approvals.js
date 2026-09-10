import { requireUser, bodyOf } from './_auth.js';

const clean=v=>v===undefined||v===null?null:String(v).trim();

export async function queueApproval(sql,user,{moduleKey,resourceKey,action,targetId=null,oldData=null,newData=null}){
  if(user.designation==='admin') return null;
  const rows=await sql`INSERT INTO approval_requests(
    requested_by_employee_id,requested_by_code,requested_by_name,requested_by_designation,
    module_key,resource_key,action,target_id,old_data,new_data
  ) VALUES(
    ${user.id},${user.employee_code},${user.full_name},${user.designation},
    ${moduleKey},${resourceKey},${action},${targetId},${oldData?JSON.stringify(oldData):null}::jsonb,${newData?JSON.stringify(newData):null}::jsonb
  ) RETURNING *`;
  return rows[0];
}

export default async function handler(req,res){
  try{
    const auth=await requireUser(req,res); if(!auth)return;
    const {sql,user}=auth;
    if(user.designation!=='admin') return res.status(403).json({error:'Admin only'});
    if(req.method==='GET'){
      const status=clean(req.query?.status)||'pending';
      const rows=await sql`SELECT * FROM approval_requests WHERE (${status}='all' OR status=${status}) ORDER BY requested_at DESC,id DESC LIMIT 500`;
      const counts=await sql`SELECT status,COUNT(*)::int count FROM approval_requests GROUP BY status`;
      return res.status(200).json({records:rows,counts:Object.fromEntries(counts.map(x=>[x.status,Number(x.count)]))});
    }
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const b=bodyOf(req), approvalId=Number(b.id);
    if(!Number.isInteger(approvalId)||approvalId<1) return res.status(400).json({error:'Valid approval id required'});
    const decision=String(b.decision||'').toLowerCase();
    if(!['approved','rejected'].includes(decision)) return res.status(400).json({error:'Decision must be approved or rejected'});
    const current=await sql`SELECT * FROM approval_requests WHERE id=${approvalId} FOR UPDATE`;
    if(!current[0]) return res.status(404).json({error:'Approval request not found'});
    if(current[0].status!=='pending') return res.status(409).json({error:'Request already reviewed'});
    const rows=await sql`UPDATE approval_requests SET status=${decision},reviewed_by_employee_id=${user.id},reviewed_by_code=${user.employee_code},reviewed_by_name=${user.full_name},reviewed_at=now(),review_note=${clean(b.note)} WHERE id=${approvalId} AND status='pending' RETURNING *`;
    return res.status(200).json({record:rows[0]});
  }catch(e){console.error('Approvals API error',e);return res.status(500).json({error:e?.message||'Approval request failed'});}
}
