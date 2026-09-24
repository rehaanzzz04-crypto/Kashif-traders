import crypto from 'node:crypto';
import { bizoraSql,ensureBizoraSchema,body,clean,positiveInt } from './_bizora-core.js';

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const methods=new Set(['COD','CASH','BANK','ONLINE','EASYPAISA','JAZZCASH']);

async function storeFor(sql,companyCode){
  const rows=await sql`SELECT c.id,c.company_code,c.company_name,c.logo_url,p.plan_code,p.plan_name,
    COALESCE((p.features->>'ecommerce')::boolean,false) ecommerce_enabled,
    COALESCE(st.store_name,c.company_name) store_name,st.contact_phone,st.whatsapp_number,st.address,
    COALESCE(st.delivery_charge,0)::numeric delivery_charge,COALESCE(st.active,true) store_active
    FROM companies c
    JOIN LATERAL(
      SELECT * FROM subscriptions s
      WHERE s.company_id=c.id AND s.status IN ('active','trial') AND s.expires_on>=CURRENT_DATE
      ORDER BY s.expires_on DESC,s.id DESC LIMIT 1
    ) sub ON true
    JOIN plans p ON p.id=sub.plan_id
    LEFT JOIN ecommerce_store_settings st ON st.company_id=c.id
    WHERE upper(c.company_code)=upper(${companyCode}) AND c.status='active'
    LIMIT 1`;
  const x=rows[0];
  if(!x||x.ecommerce_enabled!==true||x.store_active!==true)return null;
  return x;
}

async function restoreStock(sql,companyId,reserved){
  for(const x of reserved){
    try{await sql`UPDATE ecommerce_products SET stock_qty=stock_qty+${x.quantity},updated_at=now() WHERE id=${x.product_id} AND company_id=${companyId}`}catch{}
  }
}

export default async function handler(req,res){
  try{
    const sql=bizoraSql();await ensureBizoraSchema(sql);
    const b=body(req),companyCode=clean(req.query?.company||b.company_code).toUpperCase();
    if(!companyCode)return res.status(400).json({error:'Company store code required'});
    const store=await storeFor(sql,companyCode);
    if(!store)return res.status(404).json({error:'Store is unavailable'});

    if(req.method==='GET'){
      const products=await sql`SELECT id,sku,product_name,description,price,stock_qty,image_url
        FROM ecommerce_products
        WHERE company_id=${store.id} AND active=true AND stock_qty>0
        ORDER BY product_name,id LIMIT 1000`;
      return res.status(200).json({
        store:{company_code:store.company_code,company_name:store.company_name,store_name:store.store_name,logo_url:store.logo_url,contact_phone:store.contact_phone,whatsapp_number:store.whatsapp_number,address:store.address,delivery_charge:store.delivery_charge},
        products
      });
    }

    if(req.method==='POST'){
      const action=clean(b.action||'place_order');
      if(action!=='place_order')return res.status(400).json({error:'Unsupported store action'});
      if(clean(b.website))return res.status(400).json({error:'Invalid order'});
      const customerName=clean(b.customer_name),phone=clean(b.phone),address=clean(b.address),method=clean(b.payment_method||'COD').toUpperCase(),notes=clean(b.notes)||null;
      const items=Array.isArray(b.items)?b.items.slice(0,50).map(x=>({product_id:positiveInt(x.product_id,0),quantity:num(x.quantity)})):[];
      if(!customerName||customerName.length>120||!phone||phone.length>40||!items.length||!methods.has(method))return res.status(400).json({error:'Customer name, phone, products and payment method required'});
      if(address.length>1000||clean(b.notes).length>1000||items.some(x=>!x.product_id||x.quantity<=0||x.quantity>100000))return res.status(400).json({error:'Invalid order details'});

      const prepared=[];
      for(const item of items){
        const p=await sql`SELECT id,product_name,price,stock_qty FROM ecommerce_products
          WHERE id=${item.product_id} AND company_id=${store.id} AND active=true LIMIT 1`;
        if(!p[0])return res.status(400).json({error:'One or more products are unavailable'});
        if(num(p[0].stock_qty)+1e-9<item.quantity)return res.status(409).json({error:'Not enough stock for '+p[0].product_name});
        prepared.push({product_id:item.product_id,quantity:item.quantity,product_name:p[0].product_name,unit_price:num(p[0].price)});
      }

      const deliveryCharge=num(store.delivery_charge),subtotal=prepared.reduce((n,x)=>n+x.quantity*x.unit_price,0),total=Number((subtotal+deliveryCharge).toFixed(2));
      const orderNumber='WEB-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Date.now().toString().slice(-6)+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
      const reserved=[];
      let orderId=null;
      try{
        for(const item of prepared){
          const updated=await sql`UPDATE ecommerce_products SET stock_qty=stock_qty-${item.quantity},updated_at=now()
            WHERE id=${item.product_id} AND company_id=${store.id} AND active=true AND stock_qty>=${item.quantity}
            RETURNING id`;
          if(!updated[0])throw Object.assign(new Error('One or more products just went out of stock'),{statusCode:409});
          reserved.push(item);
        }
        const order=await sql`INSERT INTO ecommerce_orders(company_id,order_number,customer_name,phone,address,payment_method,status,subtotal,delivery_charge,total,notes)
          VALUES(${store.id},${orderNumber},${customerName},${phone},${address||null},${method},'pending',${subtotal},${deliveryCharge},${total},${notes})
          RETURNING id,order_number,status,subtotal,delivery_charge,total,created_at`;
        orderId=order[0].id;
        for(const item of prepared){
          await sql`INSERT INTO ecommerce_order_items(company_id,ecommerce_order_id,ecommerce_product_id,product_name,quantity,unit_price)
            VALUES(${store.id},${orderId},${item.product_id},${item.product_name},${item.quantity},${item.unit_price})`;
        }
        await sql`INSERT INTO audit_events(company_id,event_type,entity_type,entity_id,metadata)
          VALUES(${store.id},'ECOM_PUBLIC_ORDER_CREATED','ecommerce_order',${String(orderId)},${JSON.stringify({order_number:orderNumber,total,items:prepared.length})}::jsonb)`;
        return res.status(201).json({order:{order_number:orderNumber,status:'pending',subtotal,delivery_charge:deliveryCharge,total,created_at:order[0].created_at},store_name:store.store_name});
      }catch(e){
        if(orderId){
          try{await sql`DELETE FROM ecommerce_order_items WHERE company_id=${store.id} AND ecommerce_order_id=${orderId}`}catch{}
          try{await sql`DELETE FROM ecommerce_orders WHERE company_id=${store.id} AND id=${orderId}`}catch{}
        }
        await restoreStock(sql,store.id,reserved);
        throw e;
      }
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('bizora-store',e);
    return res.status(e?.statusCode||500).json({error:e?.message||'Store request failed'});
  }
}
