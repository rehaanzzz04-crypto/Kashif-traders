'use strict';
(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function ensureCss(){
    if(document.getElementById('salaryStatementEnhanceCss'))return;
    const s=document.createElement('style');s.id='salaryStatementEnhanceCss';s.textContent=`
      .salary-actions .pdf-btn{background:#b99642!important;color:#fff!important;border:0!important;box-shadow:0 4px 12px rgba(185,150,66,.22)!important}
      @media(max-width:600px){
        .salary-history{display:block;width:100%;margin-top:14px;border-collapse:separate}.salary-history thead{display:none}.salary-history tbody{display:grid;gap:10px}.salary-history tr{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;border:1px solid #e1dac9;border-radius:13px;padding:12px;background:#fffdf7;box-shadow:0 3px 10px rgba(23,63,53,.04)}.salary-history td{display:block;border:0!important;padding:0!important;min-width:0;font-size:13px;word-break:break-word}.salary-history td:before{display:block;font-size:9px;line-height:1.2;text-transform:uppercase;letter-spacing:.55px;font-weight:900;color:#7a857f;margin-bottom:3px}.salary-history td:nth-child(1):before{content:'Date'}.salary-history td:nth-child(2):before{content:'Type'}.salary-history td:nth-child(3):before{content:'Amount'}.salary-history td:nth-child(4):before{content:'Status'}.salary-history td:nth-child(5):before{content:'Reference'}.salary-history td:nth-child(5){grid-column:1/-1;padding-top:4px!important;border-top:1px solid #eee6d7!important}.salary-history td:nth-child(3),.salary-history td:nth-child(4){font-weight:800;color:#173f35}
      }
    `;document.head.appendChild(s);
  }
  function printStatement(){
    const modal=document.getElementById('salaryModal');
    const card=modal?.querySelector('#ssBody .salary-card');
    if(!card){alert('View a salary statement first.');return;}
    const title=modal.querySelector('h2')?.textContent||'Salary Statement';
    const w=window.open('','_blank');
    if(!w){alert('Please allow pop-ups to save the PDF.');return;}
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#173f35;background:#fff;margin:0;padding:28px}.sheet{max-width:820px;margin:auto}.brand{border-bottom:3px solid #b99642;padding-bottom:12px;margin-bottom:18px}.brand h1{margin:0;font-size:26px}.brand p{margin:4px 0 0;color:#68716c}.salary-card{border:1px solid #ddd5c2;border-radius:16px;padding:18px}.salary-card:before{display:none}.salary-card-top{display:flex;justify-content:space-between;gap:12px}.salary-card h3{margin:0;font-size:21px}.salary-meta{margin-top:5px;color:#68716c;font-size:12px}.salary-status{border-radius:999px;padding:6px 10px;background:#e5f2ec;font-size:11px;font-weight:800;height:max-content}.salary-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.salary-summary>div{border:1px solid #e1dac9;border-radius:12px;padding:11px}.salary-k{font-size:9px;text-transform:uppercase;font-weight:800;color:#738078}.salary-summary b{display:block;margin-top:4px;font-size:16px}.salary-history{width:100%;border-collapse:collapse;margin-top:14px}.salary-history th,.salary-history td{padding:8px;border-bottom:1px solid #e5dfd1;text-align:left;font-size:11px}.salary-history th{background:#f2ecdf;text-transform:uppercase}.print-note{margin-top:18px;font-size:10px;color:#777;text-align:center}@media print{body{padding:0}.sheet{max-width:none}.salary-card{break-inside:avoid}.salary-summary>div{break-inside:avoid}}@page{size:A4;margin:12mm}
    </style></head><body><div class="sheet"><div class="brand"><h1>Kashif Traders</h1><p>Employee Salary Statement</p></div>${card.outerHTML}<div class="print-note">Generated from Kashif Traders ERP</div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
  }
  function enhance(){
    ensureCss();
    const modal=document.getElementById('salaryModal');if(!modal)return;
    const heading=modal.querySelector('h2');if(!heading||heading.textContent.trim()!=='Salary Statement')return;
    const actions=modal.querySelector('.salary-actions');if(!actions||actions.querySelector('#ssPdf'))return;
    const b=document.createElement('button');b.id='ssPdf';b.className='pdf-btn';b.type='button';b.textContent='Save PDF';b.onclick=printStatement;actions.insertBefore(b,actions.firstChild);
  }
  ensureCss();
  new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(enhance,0),true);
})();
