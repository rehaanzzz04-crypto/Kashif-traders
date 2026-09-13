'use strict';
(function(){
  const VERSION='1.0.1';
  const q=s=>document.querySelector(s);
  const notify=(m,b=false)=>typeof window.toast==='function'?window.toast(m,b):console[b?'error':'log'](m);

  function download(url,name){
    if(!url){notify(name+' is not configured yet.',true);return;}
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  }
  function enhanceSettings(){
    const active=q('#nav [data-view="settings"].active');
    if(!active||q('[data-kt-app-updates]'))return;
    const module=q('#module');if(!module)return;
    const panel=document.createElement('div');panel.className='panel kt-app-updates';panel.dataset.ktAppUpdates='1';
    panel.innerHTML='<h2>App & Updates</h2><p class="kt-app-sub">Download or update the Kashif Traders mobile app.</p><div class="kt-app-list"><button class="kt-app-option" data-app-action="android"><span class="kt-app-icon">A</span><span><strong>Download Android App</strong><small>Get the latest APK version</small></span><span class="kt-app-arrow">›</span></button><button class="kt-app-option" data-app-action="ios"><span class="kt-app-icon">i</span><span><strong>Install iOS App (TestFlight)</strong><small>Join our TestFlight app</small></span><span class="kt-app-arrow">›</span></button><button class="kt-app-option" data-app-action="check"><span class="kt-app-icon">↻</span><span><strong>Check for App Update</strong><small>Current version: '+VERSION+'</small></span><span class="kt-app-arrow">›</span></button></div><div class="kt-update-note">App updates are separate from the existing Settings Excel backup. Existing backup/export controls are unchanged.</div>';
    module.appendChild(panel);
    panel.querySelector('[data-app-action="android"]').onclick=()=>download(window.KT_ANDROID_APK_URL||'https://github.com/rehaanzzz04-crypto/Kashif-traders/releases/download/v1.0.1/Kashif-Traders-ERP-v1.0.1.apk','Android app');
    panel.querySelector('[data-app-action="ios"]').onclick=()=>download(window.KT_IOS_TESTFLIGHT_URL||'', 'iOS TestFlight');
    panel.querySelector('[data-app-action="check"]').onclick=()=>{notify('You are using Kashif Traders app version '+VERSION+'.');};
  }

  function moveEmployeeExcel(){
    const active=q('#nav [data-view="employees"].active');if(!active)return;
    const module=q('#module'),head=module?.querySelector('.modulehead');if(!head)return;
    const b=module.querySelector('[data-common-excel="employees"]');if(!b)return;
    let slot=head.querySelector('.employee-excel-slot');
    if(!slot){const left=head.firstElementChild;if(!left)return;slot=document.createElement('div');slot.className='employee-excel-slot';left.appendChild(slot);}
    if(b.parentElement!==slot)slot.appendChild(b);
  }

  let startY=0,pulling=false,armed=false;
  const indicator=document.createElement('div');indicator.className='kt-pull-refresh';indicator.textContent='Pull down to refresh';document.body.appendChild(indicator);
  document.addEventListener('touchstart',e=>{if(window.scrollY>2||e.touches.length!==1)return;startY=e.touches[0].clientY;pulling=true;armed=false;},{passive:true});
  document.addEventListener('touchmove',e=>{if(!pulling)return;const d=e.touches[0].clientY-startY;if(d<=10){indicator.classList.remove('show','ready');return;}indicator.classList.add('show');armed=d>=72;indicator.classList.toggle('ready',armed);indicator.textContent=armed?'Release to refresh':'Pull down to refresh';},{passive:true});
  document.addEventListener('touchend',()=>{if(!pulling)return;pulling=false;if(armed){indicator.textContent='Refreshing…';setTimeout(()=>location.reload(),120);}else indicator.classList.remove('show','ready');armed=false;},{passive:true});

  const observer=new MutationObserver(()=>{enhanceSettings();setTimeout(moveEmployeeExcel,0);});
  const module=q('#module');if(module)observer.observe(module,{childList:true,subtree:true});
  q('#nav')?.addEventListener('click',()=>setTimeout(()=>{enhanceSettings();moveEmployeeExcel();},40));
  setTimeout(()=>{enhanceSettings();moveEmployeeExcel();},100);
})();
