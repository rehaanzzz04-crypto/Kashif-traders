// Dedicated Customer Credit WhatsApp Business API configuration.
// This integration never queries or modifies the ERP clients or invoices.
export function customerCreditWhatsappNumber(input){
  let digits=String(input||'').replace(/\D/g,'');
  if(/^00923\d{9}$/.test(digits))digits=digits.slice(2);
  else if(/^03\d{9}$/.test(digits))digits='92'+digits.slice(1);
  else if(/^3\d{9}$/.test(digits))digits='92'+digits;
  return /^923\d{9}$/.test(digits)?digits:null;
}
export async function sendCustomerCreditWhatsApp(mobile,document){
  const phone=customerCreditWhatsappNumber(mobile);
  if(!phone)throw new Error('Customer has no valid Pakistan WhatsApp number saved');
  const token=String(process.env.CUSTOMER_CREDIT_WHATSAPP_ACCESS_TOKEN||'').trim();
  const sender=String(process.env.CUSTOMER_CREDIT_WHATSAPP_PHONE_NUMBER_ID||'').trim();
  if(!token||!sender)throw new Error('CUSTOMER_CREDIT_WHATSAPP_NOT_CONFIGURED');
  const version=String(process.env.CUSTOMER_CREDIT_WHATSAPP_GRAPH_VERSION||'v23.0').trim();
  const url='https://graph.facebook.com/'+encodeURIComponent(version)+'/'+encodeURIComponent(sender);
  const form=new FormData();
  form.append('messaging_product','whatsapp');
  form.append('type','application/pdf');
  form.append('file',new Blob([document.buffer],{type:'application/pdf'}),document.filename);
  const upload=await fetch(url+'/media',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
  const uploaded=await upload.json().catch(()=>({}));
  if(!upload.ok||!uploaded.id)throw new Error('WhatsApp document upload failed');
  const response=await fetch(url+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'document',
      document:{id:uploaded.id,filename:document.filename,caption:'Kashif Traders Customer Credit Statement'}})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.messages?.[0]?.id)throw new Error('WhatsApp document could not be sent (check contact permission and messaging window)');
  return {sent:true,phone,message_id:result.messages[0].id};
}
