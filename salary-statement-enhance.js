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
      *{box-sizing:border-box}html,body{width:100%;margin:0;padding:0;background:#fff}body{font-family:Arial,sans-serif;color:#173f35}.sheet{width:100%;max-width:186mm;margin:0 auto;padding:5mm}.brand{border-bottom:2px solid #b99642;padding:0 0 7mm;margin-bottom:6mm}.brand h1{margin:0;font-size:22pt;line-height:1.05}.brand p{margin:2mm 0 0;color:#68716c;font-size:11pt}.salary-card{width:100%!important;max-width:none!important;border:1px solid #ddd5c2;border-radius:4mm;padding:6mm!important;overflow:visible!important}.salary-card:before{display:none!important}.salary-card-top{display:flex!important;justify-content:space-between;align-items:flex-start;gap:5mm}.salary-card h3{margin:0;font-size:16pt;line-height:1.15}.salary-meta{margin-top:2mm;color:#68716c;font-size:9pt;line-height:1.35}.salary-status{border-radius:20mm;padding:2mm 4mm;background:#e5f2ec;font-size:8pt;font-weight:800;height:max-content;white-space:nowrap}.salary-summary{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:3mm!important;margin:6mm 0!important;width:100%!important}.salary-summary>div{min-width:0!important;border:1px solid #e1dac9;border-radius:3mm;padding:4mm!important;break-inside:avoid;page-break-inside:avoid}.salary-k{font-size:7.5pt!important;line-height:1.35;text-transform:uppercase;font-weight:800;color:#738078}.salary-summary b{display:block;margin-top:1.5mm;font-size:13pt!important;line-height:1.2;white-space:normal}.salary-history{display:table!important;width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;margin-top:6mm!important}.salary-history thead{display:table-header-group!important}.salary-history tbody{display:table-row-group!important}.salary-history tr{display:table-row!important;border:0!important;background:none!important;box-shadow:none!important;padding:0!important}.salary-history th,.salary-history td{display:table-cell!important;border:0!important;border-bottom:1px solid #e5dfd1!important;padding:2.5mm 2mm!important;text-align:left!important;vertical-align:top!important;font-size:8pt!important;line-height:1.3!important;word-break:break-word!important;overflow-wrap:anywhere!important}.salary-history th{background:#f2ecdf!important;text-transform:uppercase;font-size:7pt!important}.salary-history td:before{display:none!important;content:none!important}.salary-history th:nth-child(1),.salary-history td:nth-child(1){width:16%}.salary-history th:nth-child(2),.salary-history td:nth-child(2){width:16%}.salary-history th:nth-child(3),.salary-history td:nth-child(3){width:18%}.salary-history th:nth-child(4),.salary-history td:nth-child(4){width:14%}.salary-history th:nth-child(5),.salary-history td:nth-child(5){width:36%}.salary-history td:nth-child(5){border-top:0!important}.print-note{margin-top:6mm;font-size:7.5pt;color:#777;text-align:center}.salary-actions{display:none!important}@media print{.sheet{max-width:none;padding:0}.salary-card{break-inside:auto;page-break-inside:auto}.salary-card-top,.salary-summary>div,.salary-history tr{break-inside:avoid;page-break-inside:avoid}.brand{break-after:avoid;page-break-after:avoid}}@page{size:A4 portrait;margin:12mm}
    </style></head><body><div class="sheet"><div class="brand"><h1>Kashif Traders</h1><p>Employee Salary Statement</p></div>${card.outerHTML}<div class="print-note">Generated from Kashif Traders ERP</div></div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
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
