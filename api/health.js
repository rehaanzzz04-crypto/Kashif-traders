export default function handler(req,res){
  res.status(200).json({
    ok:true,
    product:'Bizora ERP',
    company:'Bizora Technologies',
    stage:'super-admin-backend',
    database_configured:Boolean(process.env.BIZORA_DATABASE_URL),
    production_erp_database_used:false
  });
}
