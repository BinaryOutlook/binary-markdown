'use strict';
const embeddedAssets=JSON.parse(document.getElementById('embedded-assets').textContent);
document.querySelectorAll('img[data-asset]').forEach(img=>{img.src=embeddedAssets[img.dataset.asset]});
document.querySelectorAll('.image-zoom').forEach(btn=>{btn.dataset.image=embeddedAssets[btn.dataset.image]});
document.querySelectorAll('a[data-asset-open]').forEach(link=>link.addEventListener('click',event=>{
 event.preventDefault();
 document.getElementById('zoom-image').src=embeddedAssets[link.dataset.assetOpen];
 document.getElementById('zoom-image').alt=link.textContent;
 document.getElementById('zoom-caption').textContent=link.textContent;
 document.getElementById('image-dialog').showModal();
}));
document.querySelectorAll('.export-notes').forEach(button=>button.addEventListener('click',()=>{
 const allowed=['Not reviewed','Recommended','Moderate','Experimental','Request revision','Defer'];
 const lines=['Binary Markdown UI/UX visual review feedback','Review ID: BM-UX-20260930-944b4dd-r1','Snapshot: 2026-09-30 / 944b4dd2781c906ee9a912295c814e77a0a9f3f0','Review label: '+document.getElementById('review-label').value,'','Overall perspective:',document.getElementById('overall-feedback').value,''];
 document.querySelectorAll('.reviewer-choice').forEach(select=>{
  if(!allowed.includes(select.value))return;
  const notes=document.getElementById('notes-'+select.dataset.area).value;
  lines.push(select.dataset.area+' — '+select.value,notes||'(No notes entered)','');
 });
 lines.push('Selections are review feedback; the product owner decides implementation.');
 const content=lines.join('\n');
 document.getElementById('feedback-text').value=content;
 document.getElementById('feedback-result').hidden=false;
 const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='Binary-Markdown-UI-UX-Review-feedback.txt';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 document.querySelectorAll('.note-status').forEach(status=>status.textContent='Feedback text is ready below; a download was requested. Copy the text if your browser blocks downloads.');
}));
