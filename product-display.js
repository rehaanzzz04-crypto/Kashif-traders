'use strict';

(function(){
  function enhanceProducts(){
    const pList=document.getElementById('pList');
    if(!pList || pList.dataset.enhanced==='1') return;
    const table=pList.querySelector('table');
    if(!table) return;
    pList.dataset.enhanced='1';

    const toolbar=document.createElement('div');
    toolbar.className='toolbar product-toolbar';
    toolbar.innerHTML='<input id="productSearch" class="searchbox" type="search" placeholder="Search product by SKU, name, category, unit or barcode"><button id="productSearchBtn" class="btn">Search</button><button id="productClearBtn" class="btn light">Clear</button>';
    pList.parentNode.insertBefore(toolbar,pList);

    const input=toolbar.querySelector('#productSearch');
    const searchBtn=toolbar.querySelector('#productSearchBtn');
    const clearBtn=toolbar.querySelector('#productClearBtn');

    function filterProducts(){
      const q=input.value.trim().toLowerCase();
      let visible=0;
      table.querySelectorAll('tbody tr').forEach(row=>{
        if(row.querySelector('.empty')) return;
        const match=!q || row.textContent.toLowerCase().includes(q);
        row.style.display=match?'':'none';
        if(match) visible++;
      });
      let msg=pList.querySelector('.product-no-match');
      if(q && visible===0){
        if(!msg){
          msg=document.createElement('div');
          msg.className='empty product-no-match';
          msg.textContent='No matching product found';
          pList.appendChild(msg);
        }
      }else if(msg){msg.remove();}
    }

    searchBtn.addEventListener('click',filterProducts);
    input.addEventListener('input',filterProducts);
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();filterProducts();}});
    clearBtn.addEventListener('click',()=>{input.value='';filterProducts();input.focus();});
  }

  const observer=new MutationObserver(()=>enhanceProducts());
  observer.observe(document.body,{childList:true,subtree:true});
  enhanceProducts();
})();
