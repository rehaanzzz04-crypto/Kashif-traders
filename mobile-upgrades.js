'use strict';
(function(){
  const VERSION='1.0.1';
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
  function enhanceSettings(){
    const active=q('#nav [data-view="settings"].active');
    if(!active||q('[data-kt-app-updates]'))return;
    const module=q('#module');if(!module)return;
    const panel=document.createElement('div');panel.className='panel kt-app-updates';panel.dataset.ktAppUpdates='1';
    panel.innerHTML='<h2>App & Updates</h2><p class="kt-app-sub">Install or update Kashif Traders on your phone.</p><div class="kt-app-list"><button class="kt-app-option" data-app-action="android"><span class="kt-app-icon">A</span><span><strong>Download Android App</strong><small>Get the latest APK version</small></span><span class="kt-app-arrow">›</span></button><button class="kt-app-option" data-app-action="ios"><span class="kt-app-icon">i</span><span><strong>Install on iPhone / iPad</strong><small>Safari → Share → Add to Home Screen</small></span><span class="kt-app-arrow">›</span></button><button class="kt-app-option" data-app-action="check"><span class="kt-app-icon">↻</span><span><strong>Check for App Update</strong><small>Current version: '+VERSION+'</small></span><span class="kt-app-arrow">›</span></button></div><div class="kt-update-note">App updates are separate from the existing Settings Excel backup. Existing backup/export controls are unchanged.</div>';
    module.appendChild(panel);
    panel.querySelector('[data-app-action="android"]').onclick=()=>download(window.KT_ANDROID_APK_URL||'https://github.com/rehaanzzz04-crypto/Kashif-traders/releases/download/v1.0.1/Kashif-Traders-ERP-v1.0.1.apk','Android app');
    panel.querySelector('[data-app-action="ios"]').onclick=showIosInstallHelp;
    panel.querySelector('[data-app-action="check"]').onclick=()=>{notify('You are using Kashif Traders app version '+VERSION+'.');};
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

  const observer=new MutationObserver(()=>{enhanceSettings();setTimeout(moveEmployeeExcel,0);});
  const module=q('#module');if(module)observer.observe(module,{childList:true,subtree:true});
  q('#nav')?.addEventListener('click',()=>setTimeout(()=>{enhanceSettings();moveEmployeeExcel();},40));
  setTimeout(()=>{enhanceSettings();moveEmployeeExcel();},100);
})();
