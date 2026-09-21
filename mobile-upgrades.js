'use strict';
(function(){
  const VERSION='1.0.4'; // Android camera + native PDF sharing support
  const q=s=>document.querySelector(s);
  const notify=(m,b=false)=>typeof window.toast==='function'?window.toast(m,b):console[b?'error':'log'](m);

  function download(url,name){
    if(!url){notify(name+' is not configured yet.',true);return;}
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  }
  function showIosInstallHelp(){
    document.getElementById('ktIosInstallModal')?.remove();
    const m=document.createElement('div');m.id='ktIosInstallModal';m.className='modal';
    m.innerHTML='<div class="box" style="width:min(520px,100%)"><h3>Install on iPhone / iPad</h3><p class="kt-delete-note">Kashif Traders can be installed from Safari without TestFlight or an Apple Developer account.</p><div class="panel" style="margin:0 0 14px"><b>1.</b> Open Kashif Traders in <b>Safari</b><br><br><b>2.</b> Tap the <b>Share</b> button<br><br><b>3.</b> Choose <b>Add to Home Screen</b><br><br><b>4.</b> Tap <b>Add</b></div><div class="actions"><button class="btn" id="ktIosInstallDone">Done</button></div></div>';
    document.body.appendChild(m);
    m.querySelector('#ktIosInstallDone').onclick=()=>m.remove();
    m.onclick=e=>{if(e.target===m)m.remove();};
  }
  function ensureAppRefresh(){
    if(q('#ktAppRefresh'))return;
    const top=q('.topin');if(!top)return;
    if(!q('#ktAppRefreshStyle')){
      const style=document.createElement('style');style.id='ktAppRefreshStyle';
      style.textContent='.kt-app-refresh{flex:0 0 auto;margin-left:auto;width:38px;height:38px;display:grid;place-items:center;border:1px solid #e8d4a366;border-radius:11px;background:#0e3028;color:#f0dfb0;font-size:22px;font-weight:800;line-height:1;box-shadow:0 5px 14px #0002;cursor:pointer}.kt-app-refresh:active{transform:scale(.94)}.kt-app-refresh.is-refreshing{animation:ktRefreshSpin .65s linear infinite}@keyframes ktRefreshSpin{to{transform:rotate(360deg)}}.kt-app-refresh+.status{margin-left:0}@media(max-width:620px){.kt-app-refresh{width:38px;height:38px}}';
      document.head.appendChild(style);
    }
    const button=document.createElement('button');button.id='ktAppRefresh';button.className='kt-app-refresh';button.type='button';button.setAttribute('aria-label','Refresh app');button.title='Refresh app';button.textContent='↻';
    const status=q('#status');top.insertBefore(button,status||null);
    button.addEventListener('click',()=>{button.classList.add('is-refreshing');button.disabled=true;setTimeout(()=>window.location.reload(),160);});
  }

  function enhanceSettings(){
    const active=q('#nav [data-view="settings"].active');
    if(!active||q('[data-kt-app-updates]'))return;
    const module=q('#module');if(!module)return;
    const panel=document.createElement('div');panel.className='panel kt-app-updates';panel.dataset.ktAppUpdates='1';
    panel.innerHTML='<h2>App & Updates</h2><p class="kt-app-sub">Install or update Kashif Traders on your phone.</p><div class="kt-app-list"><button class="kt-app-option" data-app-action="android"><span class="kt-app-icon">A</span><span><strong>Download Android App</strong><small>Latest Android APK: v'+VERSION+'</small></span><span class="kt-app-arrow">›</span></button><button class="kt-app-option" data-app-action="ios"><span class="kt-app-icon">i</span><span><strong>Install on iPhone / iPad</strong><small>Latest production app · Safari → Add to Home Screen</small></span><span class="kt-app-arrow">›</span></button><button class="kt-app-option" data-app-action="check"><span class="kt-app-icon">↻</span><span><strong>Check for App Update</strong><small>Latest version: '+VERSION+'</small></span><span class="kt-app-arrow">›</span></button></div><div class="kt-update-note">Production: kashif-traders.vercel.app · Android v'+VERSION+' includes camera capture and native PDF/download support.</div>';
    module.appendChild(panel);
    panel.querySelector('[data-app-action="android"]').onclick=()=>download(window.KT_ANDROID_APK_URL||'https://github.com/rehaanzzz04-crypto/Kashif-traders/releases/download/v1.0.4/Kashif-Traders-ERP-v1.0.4.apk','Android app');
    panel.querySelector('[data-app-action="ios"]').onclick=()=>download(window.KT_IOS_PRODUCTION_URL||'https://kashif-traders.vercel.app/','iPhone app');
    panel.querySelector('[data-app-action="check"]').onclick=()=>{const current=String(window.KT_NATIVE_APP_VERSION||VERSION);if(current===VERSION)notify('Kashif Traders Android app is up to date: v'+VERSION+'.');else if(window.KT_NATIVE_APP_VERSION){notify('Update available: v'+current+' → v'+VERSION+'.');setTimeout(()=>download(window.KT_ANDROID_APK_URL||'https://github.com/rehaanzzz04-crypto/Kashif-traders/releases/download/v1.0.4/Kashif-Traders-ERP-v1.0.4.apk','Android update'),450);}else notify('Latest Kashif Traders app version is v'+VERSION+'.');};
  }

  async function shareReportsPdf(button){
    const old=button.textContent;button.disabled=true;button.textContent='Generating PDF…';
    try{
      const r=await fetch('/api/dashboard?format=pdf',{cache:'no-store'});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Report PDF failed');}
      const blob=await r.blob(),file=new File([blob],'Kashif-Traders-Business-Report-'+new Date().toISOString().slice(0,10)+'.pdf',{type:'application/pdf'});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({files:[file],title:'Kashif Traders Business Report'});
      else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('Report PDF downloaded');}
    }catch(e){if(e?.name!=='AbortError')notify(e.message||'Report PDF failed',true);}
    finally{button.disabled=false;button.textContent=old;}
  }
  function enhanceReports(){
    if(!q('#nav [data-view="reports"].active'))return;
    const old=q('#printReport');if(!old||old.dataset.ktReportPdf)return;
    const button=old.cloneNode(true);button.dataset.ktReportPdf='1';button.textContent='Generate PDF & Share';old.replaceWith(button);
    button.addEventListener('click',()=>shareReportsPdf(button));
  }

  function moveEmployeeExcel(){
    const active=q('#nav [data-view="employees"].active');if(!active)return;
    const module=q('#module'),head=module?.querySelector('.modulehead');if(!head)return;
    const b=module.querySelector('[data-common-excel="employees"]');if(!b)return;
    const actions=[...head.children].find(el=>el!==head.firstElementChild&&(el.querySelector?.('#approvalBtn')||el.querySelector?.('#accessBtn')||el.querySelector?.('#empAdd')));
    if(!actions)return;
    actions.classList.add('employee-head-actions');
    if(b.parentElement!==actions)actions.appendChild(b);
  }

  const noPrintViews=new Set(['suppliers','supplier-bills','supplier-payments','clients','client-sales','client-receipts']);
  const managedActionViews=new Set(['suppliers','supplier-bills','supplier-payments','clients','client-sales','client-receipts','inventory-ledger','warehouses','warehouse-stock','stock-adjustment','stock-transfer']);
  function tone(button,name){
    if(!button)return;
    button.classList.add('kt-module-action-card');
    button.classList.toggle('kt-action-gold',name==='gold');
    button.classList.toggle('kt-action-green',name==='green');
  }
  function arrangeModuleActions(){
    const active=q('#nav [data-view].active'),view=active?.dataset.view||'';
    if(!managedActionViews.has(view))return;
    const module=q('#module'),head=module?.querySelector('.modulehead');if(!module||!head)return;
    if(noPrintViews.has(view))module.querySelector('#printBtn')?.remove();
    const common=[...module.querySelectorAll('[data-common-excel]')];
    const mainCommon=common.find(b=>b.dataset.commonExcel!=='supplier_bill_items');
    const billItems=common.find(b=>b.dataset.commonExcel==='supplier_bill_items');
    const supplierExcel=module.querySelector('[data-supplier-excel]');
    let buttons=[],tones=[];
    if(['suppliers','supplier-payments','clients','client-sales','client-receipts'].includes(view)){
      buttons=[module.querySelector('#refreshBtn'),module.querySelector('#addBtn'),module.querySelector('#printBtn'),mainCommon];
      tones=['gold','green','green','green'];
    }else if(view==='supplier-bills'){
      buttons=[module.querySelector('#refreshBtn'),module.querySelector('#addBtn'),module.querySelector('#printBtn'),supplierExcel,billItems];
      tones=['gold','green','green','green','green'];
    }else if(view==='warehouses'){
      buttons=[module.querySelector('#wAdd'),mainCommon];tones=['green','gold'];
    }else if(view==='stock-adjustment'){
      buttons=[module.querySelector('#adjAdd'),mainCommon];tones=['green','gold'];
    }else if(view==='stock-transfer'){
      buttons=[module.querySelector('#trAdd'),mainCommon];tones=['green','gold'];
    }else if(view==='inventory-ledger'||view==='warehouse-stock'){
      buttons=[mainCommon];tones=['green'];
    }
    const pairs=buttons.map((b,i)=>({b,t:tones[i]})).filter(x=>x.b);
    if(!pairs.length)return;
    let grid=module.querySelector('.kt-module-action-grid');
    if(!grid){grid=document.createElement('div');grid.className='kt-module-action-grid';head.insertAdjacentElement('afterend',grid);}
    grid.className='kt-module-action-grid kt-action-count-'+pairs.length;
    pairs.forEach(({b,t},i)=>{tone(b,t);b.classList.toggle('kt-action-wide',view==='supplier-bills'&&i===4);});
    const ordered=pairs.map(x=>x.b),current=[...grid.children];
    if(current.length!==ordered.length||ordered.some((b,i)=>current[i]!==b))ordered.forEach(b=>grid.appendChild(b));
    const toolbar=module.querySelector('.toolbar');if(toolbar&&toolbar.querySelector('.searchbox'))toolbar.classList.add('kt-search-only-toolbar');
  }

  const observer=new MutationObserver(()=>{ensureAppRefresh();enhanceSettings();enhanceReports();setTimeout(()=>{moveEmployeeExcel();arrangeModuleActions();},0);});
  const module=q('#module');if(module)observer.observe(module,{childList:true,subtree:true});
  q('#nav')?.addEventListener('click',()=>setTimeout(()=>{enhanceSettings();enhanceReports();moveEmployeeExcel();arrangeModuleActions();},40));
  setTimeout(()=>{ensureAppRefresh();enhanceSettings();enhanceReports();moveEmployeeExcel();arrangeModuleActions();},100);
})();
