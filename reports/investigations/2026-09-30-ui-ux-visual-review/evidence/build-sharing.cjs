'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const MarkdownIt=require('markdown-it');
const folder=path.resolve(__dirname,'..'),root=path.resolve(folder,'../../..');
const out=path.resolve(process.argv[2]||path.join(root,'dist/ui-ux-visual-review-share'));
fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(fs.readFileSync(path.join(folder,'evidence/review-data.json'),'utf8'));
const reportId='BM-UX-20260930-944b4dd-r1';
const page=new JSDOM(fs.readFileSync(path.join(folder,'index.html'),'utf8')),doc=page.window.document;
doc.title='Binary Markdown UI/UX review — self-contained reviewer edition';
const assets={},imageIds={};
for(const img of doc.querySelectorAll('img[src]')){
 const name=img.getAttribute('src');
 if(!name)continue;
 if(!name.startsWith('images/')||name.includes('..'))throw new Error('Unexpected image path');
 if(!assets[name])assets[name]='data:'+(name.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+fs.readFileSync(path.join(folder,name)).toString('base64');
 img.setAttribute('data-asset',name);img.removeAttribute('src');
 const key='visual-'+name.replace(/[^a-z0-9]+/gi,'-');
 if(!imageIds[name]){imageIds[name]=key;img.closest('figure').id=key;}
}
if(Object.keys(assets).length!==56)throw new Error('Expected all 20 current and 36 final visuals');
function append(where,html){where.insertAdjacentHTML('beforeend',html);}
const style=doc.createElement('style');
style.textContent='.reviewer-guide,.feedback-global{border:1px solid var(--line);padding:20px;margin:24px 0;border-radius:6px;background:var(--surface)}.reviewer-guide h2,.feedback-global h2,#full-report>h2,.appendix>h2{font-size:24px;margin-bottom:14px}.reviewer-guide p,.reviewer-guide li,.feedback-global p{font-size:14px}.feedback-global label,.reviewer-note label{display:block;font-size:14px;font-weight:600;margin:12px 0 6px}input,textarea{font:inherit;color:inherit;background:white;border:1px solid var(--line);border-radius:4px;padding:9px;width:100%;max-width:100%}textarea{min-height:110px;resize:vertical}input:focus-visible,textarea:focus-visible{outline:3px solid var(--blue);outline-offset:3px}.reviewer-note{margin:24px 0;border-top:1px solid var(--line);padding-top:20px}.reviewer-note select{max-width:100%}.export-notes{background:var(--blue);color:white;border:0;border-radius:4px;padding:10px 16px;cursor:pointer}.note-status{font-size:13px;color:var(--muted)}.appendix{border-top:1px solid var(--line);margin-top:48px;padding-top:32px}.appendix pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}.appendix table{font-size:13px}.appendix h1{font-size:28px;margin-top:28px}.appendix h2{margin-top:32px}.appendix h3{margin-top:24px}.appendix code{overflow-wrap:anywhere}.sharing-meta{font-size:13px;color:var(--muted)}@media print{.reviewer-guide,.feedback-global,.reviewer-note{break-inside:avoid}.export-notes{display:none}textarea{min-height:70px}#full-report{break-before:page}}';
doc.head.appendChild(style);
doc.querySelector('.eyebrow').textContent='Independent reviewer edition · proposals';
append(doc.querySelector('#overview'),'<p class="sharing-meta">Review ID: <code>'+reportId+'</code> · Original snapshot: 30 Sep 2026 · Sharing edition: 1 Oct 2026</p>');
append(doc.querySelector('#overview'),'<section class="reviewer-guide" id="reviewer-guide"><h2>Review the design philosophy.</h2><p>This file contains every current screenshot and all 36 final concepts. It opens offline without a repository, server, account or companion files. Source links are optional references; opening them uses the internet.</p><p><strong>Recommendation ownership:</strong> Recommended means the consultant’s proposed balance of usability, consistency and effort. The product owner has not accepted an option. Record your own preference by area and explain the tradeoff.</p><p><strong>Snapshot boundary:</strong> The original visuals describe source <code>'+data.sourceCommit+'</code>. GitHub main advanced after capture, including code-block toolbar and wrapping changes. Recheck current behavior before implementing a choice, especially area 06.</p><ul><li>Does the design keep writing primary while making actions discoverable?</li><li>Which labels and states reduce ambiguity or help recovery?</li><li>Does a new mode, panel or interaction justify its implementation cost?</li><li>Which Markdown, selection, keyboard, theme and undo behaviors must survive?</li><li>What needs a prototype or user study before approval?</li></ul></section><section class="feedback-global" id="reviewer-feedback"><h2>Capture your feedback.</h2><label for="review-label">Review label (optional)</label><input id="review-label" placeholder="For example: Review 1"><label for="overall-feedback">Overall design philosophy, priorities and unresolved questions</label><textarea id="overall-feedback"></textarea><p>Notes remain only in this tab and reset when the original file is reopened. Export them before closing. Exporting downloads a plain-text file; it does not send or upload anything.</p><button type="button" class="export-notes">Export feedback</button><p class="note-status" role="status" aria-live="polite"></p><div id="feedback-result" hidden><label for="feedback-text">Prepared feedback (copy if downloads are blocked)</label><textarea id="feedback-text" readonly></textarea></div></section>');
for(const item of data.items){
 const section=doc.getElementById(item.id),note=doc.createElement('section');note.className='reviewer-note';
 const title=doc.createElement('h3');title.textContent='Your view on '+item.id;note.appendChild(title);
 const label=doc.createElement('label');label.htmlFor='choice-'+item.id;label.textContent='Preferred direction';note.appendChild(label);
 const select=doc.createElement('select');select.id=label.htmlFor;select.className='reviewer-choice';select.dataset.area=item.id;
 for(const value of ['Not reviewed','Recommended','Moderate','Experimental','Request revision','Defer']){
  const option=doc.createElement('option');option.value=value;option.textContent=value;select.appendChild(option);
 }
 note.appendChild(select);
 const notesLabel=doc.createElement('label');notesLabel.htmlFor='notes-'+item.id;notesLabel.textContent='What works, what concerns you, and what would you change?';note.appendChild(notesLabel);
 const textarea=doc.createElement('textarea');textarea.id=notesLabel.htmlFor;textarea.className='reviewer-comments';textarea.dataset.area=item.id;note.appendChild(textarea);section.appendChild(note);
}
const full=doc.createElement('section');full.id='full-report';full.className='appendix';
full.innerHTML='<h2>Complete written review</h2>'+new MarkdownIt({html:true,linkify:false}).render(fs.readFileSync(path.join(folder,'report.md'),'utf8'));
for(const el of full.querySelectorAll('[id]'))el.removeAttribute('id');
for(const img of full.querySelectorAll('img')){
 const link=doc.createElement('a');link.href='#'+imageIds[img.getAttribute('src')];link.textContent='View visual: '+img.alt;img.replaceWith(link);
}
doc.querySelector('main').appendChild(full);
for(const name of fs.readdirSync(path.join(folder,'evidence')).filter(n=>n.endsWith('.json')).sort()){
 const section=doc.createElement('section');section.className='appendix';section.id='evidence-'+name.replace(/[^a-z0-9]+/gi,'-');
 const details=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent='Embedded evidence: '+name;details.appendChild(summary);
 const pre=doc.createElement('pre');pre.textContent=fs.readFileSync(path.join(folder,'evidence',name),'utf8');details.appendChild(pre);section.appendChild(details);doc.querySelector('main').appendChild(section);
}
for(const link of doc.querySelectorAll('a[href]')){
 let href=link.getAttribute('href');
 const area=data.items.find((item,index)=>href==='#'+String(index+1).padStart(2,'0')+'--'+item.title.toLowerCase().replace(/[^a-z0-9 -]/g,'').replaceAll(' ','-'));
 if(area){href='#'+area.id;link.href=href;}
 if(href.startsWith('images/')){link.dataset.assetOpen=href;link.href='#'+imageIds[href];link.removeAttribute('target');}
 else if(href==='report.md'||href==='index.html')link.href=href==='report.md'?'#full-report':'#overview';
 else if(href==='SHARING.md')link.href='#reviewer-guide';
 else if(href.startsWith('evidence/')&&href.endsWith('.json'))link.href='#evidence-'+path.basename(href).replace(/[^a-z0-9]+/gi,'-');
 else if(href.startsWith('../../../'))link.href='https://github.com/BinaryOutlook/binary-markdown/blob/'+data.sourceCommit+'/'+href.slice(9);
 if(link.getAttribute('href').startsWith('https:')){link.rel='noopener noreferrer';link.target='_blank';}
}
append(doc.querySelector('.side-links'),'<a href="#reviewer-feedback">Reviewer feedback</a><a href="#full-report">Complete written review</a>');
for(const summary of doc.querySelectorAll('.source-pointers summary'))summary.textContent='Code references (optional online links)';
const json=doc.createElement('script');json.type='application/json';json.id='embedded-assets';json.textContent=JSON.stringify(assets).replaceAll('<','\\u003c');doc.body.appendChild(json);
const boot=doc.createElement('script');boot.textContent=fs.readFileSync(path.join(__dirname,'sharing-feedback.js'),'utf8');doc.body.appendChild(boot);
const hashes=[...doc.querySelectorAll('script:not([type="application/json"])')].map(s=>"'sha256-"+crypto.createHash('sha256').update(s.textContent).digest('base64')+"'");
const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src "+hashes.join(' ')+"; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";doc.head.insertBefore(csp,doc.head.firstChild);
const noscript=doc.createElement('noscript');noscript.textContent='Enable JavaScript to display embedded visuals and feedback tools, or use the PDF reading copy.';doc.body.insertBefore(noscript,doc.body.firstChild);
const output=path.join(out,'Binary-Markdown-UI-UX-Review-2026-09-30.html');fs.writeFileSync(output,page.serialize());
fs.writeFileSync(path.join(out,'embedded-asset-manifest.json'),JSON.stringify({reportId,imageCount:Object.keys(assets).length,images:Object.keys(assets),sourceCommit:data.sourceCommit},null,2)+'\n');
console.log(JSON.stringify({file:path.basename(output),bytes:fs.statSync(output).size,embeddedImages:Object.keys(assets).length,externalRuntimeDependencies:0}));
