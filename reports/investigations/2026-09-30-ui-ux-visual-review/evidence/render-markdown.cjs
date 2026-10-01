'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MarkdownIt=require('markdown-it');
const {JSDOM}=require('jsdom');
const root=process.cwd(),folder=path.join(root,"reports/investigations/2026-09-30-ui-ux-visual-review");
const output=path.join(root,'.vscode-test/ui-ux-visual-review/rendered');
fs.mkdirSync(output,{recursive:true});
const md=new MarkdownIt({html:true,linkify:false});
const style='body{max-width:1050px;margin:40px auto;padding:0 28px 70px;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#242830;background:#fafaf8}h1,h2,h3{line-height:1.3}h2{margin-top:44px;border-top:1px solid #d5d9df;padding-top:24px}h3{margin-top:28px}img{max-width:100%;height:auto;display:block;border:1px solid #d5d9df;margin:18px 0}table{border-collapse:collapse;width:100%;display:block;overflow:auto;font-size:13px}th,td{padding:10px;border:1px solid #d5d9df;text-align:left}th{background:#f3f4f5}td:first-child,th:first-child{white-space:nowrap}a{color:#365b9a;text-underline-offset:3px}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9em}pre{overflow:auto;background:#f3f4f5;padding:18px}li{margin:6px 0}';
for(const [name,input] of [['report-preview.html',path.join(folder,'report.md')],['index-preview.html',path.join(root,'reports/README.md')],['sharing-preview.html',path.join(folder,'SHARING.md')]]){
 const page=new JSDOM('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+'</title><style>'+style+'</style></head><body>'+md.render(fs.readFileSync(input,'utf8'))+'</body></html>');
 const headingIds=new Set([...page.window.document.querySelectorAll('[id]')].map(e=>e.id));
 for(const heading of page.window.document.querySelectorAll('h1,h2,h3')){
  const base=heading.textContent.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s/g,'-');
  let id=base,number=0;while(headingIds.has(id))id=base+'-'+(++number);
  heading.id=id;headingIds.add(id);
 }
 for(const element of page.window.document.querySelectorAll('[href],[src]')){
  for(const attr of ['href','src']){
   const value=element.getAttribute(attr);
   if(!value||/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value))continue;
   const split=value.indexOf('#'),file=split<0?value:value.slice(0,split),fragment=split<0?'':value.slice(split);
   const target=path.resolve(path.dirname(input),file);
   element.setAttribute(attr,path.relative(output,target).split(path.sep).join('/')+fragment);
  }
 }
 fs.writeFileSync(path.join(output,name),page.serialize());
}
console.log('Rendered all three affected Markdown files into ignored preview output.');
