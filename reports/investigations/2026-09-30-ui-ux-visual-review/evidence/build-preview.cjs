/** Reproduce unchanged editor visuals with synthetic input and a mock host. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const output = path.join(root, '.vscode-test/ui-ux-visual-review/web');
const evidence = __dirname;
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(fs.readFileSync(path.join(evidence, 'fixtures.json'), 'utf8'));
const locale = require(path.join(root, 'src/i18n/locales/en.ts')).webviewMessages;
const { generateEditorBodyHtml } = require(path.join(root, 'src/shared/editor-body-html.js'));
const exportSource = fs.readFileSync(path.join(root, 'src/export/messages.ts'), 'utf8');
const exportMessages = require('node:vm').runInNewContext('(' + exportSource.match(/const en = (\{[\s\S]*?\n\});/)[1] + ')');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sourceFiles = ['src/webview/styles.css', 'src/shared/editor-body-html.js', 'src/shared/test-host-bridge.js', 'src/shared/table-format.js', 'src/shared/editor-layout.js', 'src/shared/table-placement.js', 'src/webview/table-toolbar.js', 'src/shared/math-syntax.js', 'src/shared/document-aux.js', 'src/webview/editor.js', 'src/webview/export-ui.js', 'src/i18n/locales/en.ts', 'src/export/messages.ts', 'package-lock.json', 'vendor/markdown-blocks.js', 'vendor/turndown.js', 'vendor/turndown-plugin-gfm.js', 'vendor/mermaid.min.js', 'vendor/katex.min.js', 'vendor/katex.min.css'];
const styles = read('src/webview/styles.css').replace('__FONT_SIZE__', '16').replace('__OUTLINE_ACTIVE_COLOR__', 'var(--link-color)');
const scripts = sourceFiles.slice(3, 10).map(read).join('\n');
fs.mkdirSync(path.join(output, 'vendor'), { recursive: true });
for (const file of ['markdown-blocks.js', 'turndown.js', 'turndown-plugin-gfm.js', 'mermaid.min.js', 'katex.min.js', 'katex.min.css']) fs.copyFileSync(path.join(root, 'vendor', file), path.join(output, 'vendor', file));
fs.cpSync(path.join(root, 'vendor/fonts'), path.join(output, 'vendor/fonts'), { recursive: true });
for (const [name, fixture] of Object.entries(fixtures)) {
 const editor = scripts.replace('__MATH_BACKSLASH__', 'true').replace('__DEBUG_MODE__', 'false').replace('__I18N__', JSON.stringify(locale)).replace('__DOCUMENT_BASE_URI__', '').replace('__CONTENT__', JSON.stringify(Buffer.from(fixture.markdown).toString('base64')));
 const capabilities = {type:'exportCapabilities',host:{available:true},pandoc:{kind:'pandoc',available:false,error:'Pandoc is not configured.'},browser:{kind:'browser',available:true}};
 const hostStates = 'window.hostBridge.requestExportCapabilities = () => window.dispatchEvent(new MessageEvent("message", {data:' + JSON.stringify(capabilities) + '}));';
 const status = fixture.exportStatus ? 'window.dispatchEvent(new MessageEvent("message",{data:' + JSON.stringify(fixture.exportStatus) + '}));' : '';
 const html = '<!doctype html><html lang="en" data-theme="' + (fixture.theme || 'things') + '" data-toolbar-mode="full" data-table-toolbar-position="auto" data-editor-width-mode="default" data-editor-alignment="center" data-editor-max-width="860" data-editor-width-indicators="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Binary Markdown — ' + name + ' — current source</title><style>' + styles + '</style><link rel="stylesheet" href="vendor/katex.min.css"></head><body>' + generateEditorBodyHtml(locale, 'darwin', {exportEnabled:true,settingsEnabled:true}) + '<script src="vendor/markdown-blocks.js"></script><script src="vendor/turndown.js"></script><script src="vendor/turndown-plugin-gfm.js"></script><script src="vendor/mermaid.min.js"></script><script src="vendor/katex.min.js"></script><script>' + read('src/shared/test-host-bridge.js') + '</script><script>' + editor + '</script><script>window.exportMessages=' + JSON.stringify(exportMessages) + ';</script><script>' + read('src/webview/export-ui.js') + '</script><script>' + hostStates + status + '</script></body></html>';
 fs.writeFileSync(path.join(output, name + '.html'), html);
}
const manifest = {sourceCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),nodeVersion:process.version,method:'Current shared editor markup, styles and scripts; synthetic Markdown; test HostBridge; simulated export capabilities and status; no installed-host or output-reader claim.',sourceFiles:Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')])),pages:Object.keys(fixtures).map(name=>name+'.html')};
fs.writeFileSync(path.join(evidence,'capture-source.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Generated '+manifest.pages.length+' source review pages in the ignored preview directory.');
