import { neon } from '@neondatabase/serverless';

const clean = (v) => String(v ?? '').trim();
const json = (res, status, body) => res.status(status).json(body);

function page({ appId, configId, configured }) {
  const safeAppId = JSON.stringify(appId || '');
  const safeConfigId = JSON.stringify(configId || '');
  const missing = configured ? '' : '<div class="warn">Meta App ID / Embedded Signup Config ID is not configured in Vercel yet.</div>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Kashif Traders · WhatsApp Connect</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#14213d;background:#f6f8fb}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px}.card{width:min(560px,100%);background:#fff;border:1px solid #e7ebf1;border-radius:22px;padding:28px;box-shadow:0 18px 50px rgba(20,33,61,.08)}h1{font-size:26px;margin:0 0 8px}p{line-height:1.55;color:#526075}.badge{display:inline-block;padding:6px 10px;border-radius:999px;background:#eaf7ef;color:#157347;font-weight:700;font-size:12px;margin-bottom:16px}.warn{padding:12px 14px;border-radius:12px;background:#fff4e5;color:#8a4b08;margin:14px 0}.status{margin-top:16px;padding:12px 14px;border-radius:12px;background:#f3f6fa;white-space:pre-wrap;font-size:14px}.ok{background:#eaf7ef;color:#146c43}.bad{background:#fdecec;color:#9b1c1c}button{width:100%;border:0;border-radius:14px;padding:14px 18px;font-size:16px;font-weight:800;background:#1877f2;color:#fff;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.small{font-size:12px;color:#748196;margin-top:14px}</style>
</head>
<body>
<div class="card">
  <div class="badge">WhatsApp Business App Coexistence</div>
  <h1>Connect Kashif Traders WhatsApp</h1>
  <p>Use Meta Embedded Signup to connect the existing WhatsApp Business App number to the ERP without using the normal “Add phone number” screen.</p>
  ${missing}
  <button id="connect" ${configured ? '' : 'disabled'}>Connect existing WhatsApp Business</button>
  <div id="status" class="status">Ready.</div>
  <div class="small">Do not delete or unregister the existing WhatsApp Business account during this flow.</div>
</div>
<script>
const APP_ID=${safeAppId};
const CONFIG_ID=${safeConfigId};
const statusEl=document.getElementById('status');
const btn=document.getElementById('connect');
let sessionInfo={};
function setStatus(text,type=''){statusEl.textContent=text;statusEl.className='status '+type}
window.addEventListener('message',(event)=>{
  if(event.origin!=='https://www.facebook.com'&&event.origin!=='https://web.facebook.com')return;
  try{
    const data=typeof event.data==='string'?JSON.parse(event.data):event.data;
    if(data?.type==='WA_EMBEDDED_SIGNUP'){
      sessionInfo=data?.data||{};
      setStatus('Meta signup session received. Finishing connection…');
    }
  }catch{}
});
window.fbAsyncInit=function(){
  FB.init({appId:APP_ID,autoLogAppEvents:true,xfbml:true,version:'v23.0'});
};
(function(d,s,id){let js,fjs=d.getElementsByTagName(s)[0];if(d.getElementById(id))return;js=d.createElement(s);js.id=id;js.src='https://connect.facebook.net/en_US/sdk.js';fjs.parentNode.insertBefore(js,fjs)}(document,'script','facebook-jssdk'));
btn.addEventListener('click',()=>{
  if(!window.FB)return setStatus('Meta SDK is still loading. Try again in a few seconds.','bad');
  btn.disabled=true;setStatus('Opening Meta Embedded Signup…');
  FB.login(async(response)=>{
    try{
      const code=response?.authResponse?.code;
      if(!code){setStatus('Signup was cancelled or Meta did not return an authorization code.','bad');btn.disabled=false;return}
      const r=await fetch('/api/whatsapp-coexistence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,session:sessionInfo})});
      const out=await r.json();
      if(!r.ok)throw new Error(out?.error||'Connection failed');
      setStatus('Connected successfully.\nWABA ID: '+(out.waba_id||'received')+'\nPhone Number ID: '+(out.phone_number_id||'received'),'ok');
    }catch(e){setStatus(e.message||'Connection failed','bad');btn.disabled=false}
  },{
    config_id:CONFIG_ID,
    response_type:'code',
    override_default_response_type:true,
    extras:{featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}
  });
});
</script>
</body></html>`;
}

async function exchangeCode(code) {
  const appId = clean(process.env.WHATSAPP_APP_ID || process.env.META_APP_ID);
  const appSecret = clean(process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET);
  if (!appId || !appSecret) throw new Error('Meta App ID / App Secret is not configured');
  const version = clean(process.env.WHATSAPP_GRAPH_VERSION) || 'v23.0';
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', code);
  const r = await fetch(url, { method: 'GET' });
  const data = await r.json();
  if (!r.ok || !data?.access_token) throw new Error(data?.error?.message || 'Meta code exchange failed');
  return data.access_token;
}

async function persistConnection(session) {
  const db = clean(process.env.DATABASE_URL);
  if (!db) return;
  const sql = neon(db);
  await sql`CREATE TABLE IF NOT EXISTS whatsapp_connection (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'meta',
    waba_id TEXT,
    phone_number_id TEXT,
    business_id TEXT,
    coexistence BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'connected',
    raw_session JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  const waba = clean(session?.waba_id || session?.wabaId);
  const phone = clean(session?.phone_number_id || session?.phoneNumberId);
  const business = clean(session?.business_id || session?.businessId);
  await sql`INSERT INTO whatsapp_connection(waba_id,phone_number_id,business_id,raw_session)
    VALUES(${waba || null},${phone || null},${business || null},${JSON.stringify(session || {})}::jsonb)`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    const appId = clean(process.env.WHATSAPP_APP_ID || process.env.META_APP_ID);
    const configId = clean(process.env.WHATSAPP_CONFIG_ID || process.env.META_WHATSAPP_CONFIG_ID);
    return res.status(200).send(page({ appId, configId, configured: Boolean(appId && configId) }));
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const code = clean(body.code);
    if (!code) return json(res, 400, { error: 'Missing authorization code' });
    await exchangeCode(code);
    const session = body.session && typeof body.session === 'object' ? body.session : {};
    await persistConnection(session);
    return json(res, 200, {
      connected: true,
      coexistence: true,
      waba_id: clean(session?.waba_id || session?.wabaId) || null,
      phone_number_id: clean(session?.phone_number_id || session?.phoneNumberId) || null
    });
  } catch (e) {
    console.error('WhatsApp coexistence onboarding failed', e);
    return json(res, 500, { error: e?.message || 'WhatsApp coexistence onboarding failed' });
  }
}
