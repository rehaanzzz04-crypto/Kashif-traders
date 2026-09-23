export default function handler(req,res){
  res.status(200).json({
    ok:true,
    product:'Bizora ERP',
    company:'Bizora Technologies',
    stage:'saas-foundation',
    database:'not-connected'
  });
}
