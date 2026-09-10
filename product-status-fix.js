'use strict';

// Product status UI patch. Backend already supports products.status and defaults to active.
document.addEventListener('click',event=>{
  const addButton=event.target.closest('#pAdd');
  if(!addButton) return;
  setTimeout(()=>{
    const form=document.querySelector('#invModal #invForm');
    if(!form || form.querySelector('[name="status"]')) return;
    const grid=form.querySelector('.grid');
    if(!grid) return;
    const field=document.createElement('div');
    field.className='field';
    field.innerHTML='<label>Status</label><select name="status"><option value="active" selected>Active</option><option value="inactive">Inactive</option></select>';
    grid.appendChild(field);
  },0);
});
