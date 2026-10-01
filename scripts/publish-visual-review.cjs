#!/usr/bin/env node
'use strict';

// Curate only sealed, current, complete PASS packets. Logs/account paths remain ignored.
const fs = require('node:fs');
const path = require('node:path');
const core = require('./visual-review/core.cjs');
const MarkdownIt = require('markdown-it');
const root = path.resolve(__dirname, '..');
const output = 'reports/validation/2026-10-02-ui-ux-visual-fidelity';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const slug = value => value.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
const { registry, manifest } = core.contract(root);
const records = registry.sections.map(section => {
    const name = core.iterations(root, section.id).at(-1);
    if (!name) throw new Error('No capture: ' + section.id);
    const original = core.OUTPUT + '/' + section.id + '/' + name + '/packet.json';
    const packet = core.loadPacket(root, original);
    const receipt = core.readJson(root, path.posix.dirname(original) + '/receipt.json');
    core.validateReceipt(packet, receipt);
    if (receipt.verdict !== 'PASS' || section.cases.some(c => !packet.cases.some(actual => actual.id === c.id))) throw new Error('Incomplete visual acceptance: ' + section.id);
    return { section, packet, receipt, original };
});
if (new Set(records.map(r => r.packet.source.productHash)).size !== 1 || new Set(records.map(r => r.packet.contractHash)).size !== 1 || new Set(records.map(r => r.packet.source.commit)).size !== 1) throw new Error('Mixed source or contract evidence');
const mapping = new Map();
function copy(from, to) {
    const source = core.safePath(root, from), target = core.safePath(root, output + '/' + to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    mapping.set(from, { publishedPath: to, sha256: core.hash(fs.readFileSync(target)) });
    return to;
}
function write(relative, text) {
    const target = core.safePath(root, output + '/' + relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text);
}
const before = {
    '01-canvas': '01-canvas-outline', '02-toolbar': '08-contextual-toolbar', '03-commands': '02-insert-workspace',
    '04-outline': '05-split-document-rail', '05-tables': '03-spatial-table-tools', '06-code': '04-code-equation-diagram',
    '07-equations': '04-code-equation-diagram', '08-diagrams': '04-code-equation-diagram', '09-find': '06-find-replace',
    '10-metadata': '10-front-matter', '11-source': '05-split-document-rail', '12-export': '07-export-submenu',
};
const representative = { '01-canvas': 'focused', '02-toolbar': 'selection', '03-commands': 'all', '04-outline': 'nested', '05-tables': 'body', '06-code': 'dark', '07-equations': 'unsupported', '08-diagrams': 'invalid', '09-find': 'filled', '10-metadata': 'expanded', '11-source': 'split', '12-export': 'complete' };
const rationale = {
    '01-canvas': 'Quiet heading hierarchy and focused width guidance retain the configured reading measure. Small narrow tables use compact cell padding; larger tables expose explicit scrolling without changing their content.',
    '02-toolbar': 'Permanent essentials, optional near-selection formatting, searchable categories and one label per overflow command keep actions discoverable in small panes.',
    '03-commands': 'Rendered previews, distinct icons, descriptions and shortcuts communicate insertion outcomes. Categories and clear-search recovery support discovery; whole-card navigation supports narrow panes.',
    '04-outline': 'Explicit Outline/Document tabs and a shared title, counts and section-position footer keep navigation and reading context visible without duplicate statistics.',
    '05-tables': 'External coordinates associate cells with rows and columns. Grouped controls retain the owner-requested insertion diamond and all eight saved placements. Reserved inspector lanes and scroll controls protect authored content.',
    '06-code': 'A stationary labeled header exposes language, view-only wrap, exact copying and host editing while syntax remains readable during scrolling and in dark themes.',
    '07-equations': 'Separate Source/Preview panes, concise unsupported-command feedback and reliable local source cues explain editing state while preserving authored TeX.',
    '08-diagrams': 'Explicit source/preview states, restrained local diagnostics and expandable details let the writer recover from invalid Mermaid without displacing the rest of the document.',
    '09-find': 'Persistent field labels, scope-sensitive replacement actions, selected-target counts and contextual result rows keep the operation clear after values have been entered.',
    '10-metadata': 'Authored raw YAML remains authoritative. Generated contents have a compact ownership label, a visible Refresh action and an explanation of when entries change.',
    '11-source': 'Selected Visual/Source/Split modes and distinct pane headers explain the single editable source and read-only preview. VS Code identifies its separate host-editor action explicitly.',
    '12-export': 'Format/setup, actual job stages and results/warnings have separate hierarchy. Configuration, pending cancellation, retry and output actions describe real host events without invented percentage completion.',
};
let md = '# Scoped AI visual fidelity review\n\nRecorded 2026-10-02. This report compares the twelve authorized concepts with fresh production-browser renders and retains independent section verdicts. It is a development review for owner testing; no merge, release or owner acceptance is claimed.\n\n';
md += 'The first task commit, `a00646ab23ffe1693d65918d082c3930d3eb39d6`, contains the system design. The chosen artwork is unchanged from design commit `' + manifest.designCommit + '`. The [workflow guide](../../../docs/testing/visual-review.md) explains builder inspection, fresh one-section evaluation, FAIL corrections and stale-evidence rejection. The [implementation adaptations](../../plans/2026-10-01-ui-ux-visual-fidelity/implementation-notes.md) record placement and host boundaries.\n\n';
md += '## Evidence identity\n\n| Field | Value |\n| --- | --- |\n| Reviewed source | `' + records[0].packet.source.commit + '` |\n| Recorded local-change status | `' + records[0].packet.source.dirty + '` |\n| Product input SHA-256 | `' + records[0].packet.source.productHash + '` |\n| Review contract SHA-256 | `' + records[0].packet.contractHash + '` |\n| Renderer | ' + core.escapeMd(records[0].packet.capture.browser) + '; Node ' + core.escapeMd(records[0].packet.capture.node) + ' |\n| Captures | Synthetic notes; en-US; explicit Minimal theme, separate dark-code state; scale 1 |\n| AI boundary | Fresh ephemeral read-only Codex CLI invocation per section, existing authenticated OpenAI account; no builder chat or source tree supplied |\n\n';
md += 'The recorded local-change flag is true because capture rebuilds the tracked standalone test fixture. The reviewed product inputs are committed at the source revision above; the regenerated fixture is separately identified by its capture hash. This flag is retained verbatim in each sealed packet rather than rewritten after capture.\n\n';
md += 'Each fresh evaluator receives prior discrepancy IDs and their case/criterion/region, with earlier reviewers\' descriptions withheld. The complete earlier FAIL findings stay in the builder packet and public history. This avoids using an earlier claim as evidence while still requiring a current-image resolution for each ID.\n\nFull application images establish placement and obstruction. Target images provide legibility. Each verdict grades only its declared target regions; surrounding UI is excluded unless it obstructs that target. Narrow/error/theme cases use explicit derived-state criteria. An AI PASS does not guarantee identical pixels or correct behavior across every platform. Functional, installed-host, security and owner results remain separate.\n\n';
md += '## Section verdicts\n\n| Section | Chosen direction | Current verdict | Cases | Required state groups |\n| --- | --- | --- | --- | --- |\n';
for (const { packet } of records) md += '| [' + packet.sectionId + '](#' + packet.sectionId + ') | ' + packet.references.map(r => core.escapeMd(r.level)).join('; ') + ' | PASS | ' + packet.cases.length + ' | ' + packet.requiredStates.length + ' |\n';
md += '\nAll ' + records.reduce((n, r) => n + r.packet.cases.length, 0) + ' required cases have current validated PASS assessments. Per-criterion observations and resolved prior discrepancy IDs are in the unchanged packet/receipt pairs below. Hashes bind bytes and scope; they do not prove model authorship or guarantee that every visible defect was noticed.\n\n';
for (const { packet, receipt, original } of records) {
    const id = packet.sectionId;
    md += '<a id="' + id + '"></a>\n\n## ' + id + ' — ' + packet.title + '\n\n' + rationale[id] + '\n\n';
    md += '**Earlier implementation:** historical synthetic screenshot retained in the prior selected-design report; it is not a new baseline capture.\n\n';
    const baseline = copy('reports/validation/2026-10-01-selected-ui-ux/images/' + before[id] + '.jpg', 'images/before/' + before[id] + '.jpg');
    md += '![' + id + ' earlier implementation](' + baseline + ')\n\n';
    for (const reference of packet.references) {
        const image = copy(reference.path, 'images/generated/' + path.posix.basename(reference.path));
        md += '**Fixed ' + reference.level + ' concept:**\n\n![' + id + ' chosen ' + reference.level + ' concept](' + image + ')\n\n';
        md += reference.annotations.map((text, i) => (i + 1) + '. ' + core.escapeMd(text)).join('\n') + '\n\n';
    }
    md += '**Independent verdict: PASS.** ' + core.escapeMd(receipt.evaluation.summary) + '\n\n';
    const evidence = 'evidence/' + id;
    copy(original, evidence + '/packet.json');
    copy(path.posix.dirname(original) + '/receipt.json', evidence + '/receipt.json');
    md += '[Sealed packet](' + evidence + '/packet.json) · [Full AI assessment and prior resolutions](' + evidence + '/receipt.json)\n\n';
    md += '| Criterion | Scope |\n| --- | --- |\n' + packet.criteria.map(c => '| ' + c.id + ' | ' + core.escapeMd(c.description) + ' |').join('\n') + '\n\n';
    for (const item of packet.cases) {
        md += '<details' + (item.id === representative[id] ? ' open' : '') + '>\n<summary>' + escape(item.id + ' — ' + item.state + ' — PASS') + '</summary>\n\n' + core.escapeMd(item.comparison) + '\n\n';
        for (const [index, image] of item.images.entries()) {
            const published = copy(image.path, 'images/current/' + id + '/' + path.posix.basename(image.path));
            md += '**' + (index ? 'Target region' : 'Full application') + ':**\n\n![' + id + ' ' + item.id + (index ? ' target' : ' full application') + '](' + published + ')\n\n';
        }
        md += '</details>\n\n';
    }
    const history = [];
    for (const iteration of core.iterations(root, id)) {
        const directory = core.OUTPUT + '/' + id + '/' + iteration;
        if (!fs.existsSync(core.safePath(root, directory + '/receipt.json'))) continue;
        const olderPacket = core.readJson(root, directory + '/packet.json');
        const olderReceipt = core.readJson(root, directory + '/receipt.json');
        core.validateReceipt(olderPacket, olderReceipt);
        history.push({ iteration, packet: olderPacket, receipt: olderReceipt });
    }
    write(evidence + '/history.json', JSON.stringify(history, null, 2) + '\n');
    md += '[Retained iteration verdicts](' + evidence + '/history.json) preserve FAIL/BLOCKED/PASS outcomes and exact identities. Earlier image paths describe the original ignored local archive; the curated public images cover the final cases and the historical screenshot above.\n\n';
}
md += '## Verification and security\n\n';
const validation = core.readJson(root, core.OUTPUT + '/delivery-validation.json');
md += validation.markdown + '\n\n';
md += '## Owner review\n\nCompare each chosen concept with its full and target images before trying the package. Test your configured theme/font/width, every saved table placement, narrow panes, keyboard focus, source switching, Undo/Redo, Save/reopen and actual exports. Confirm which development package/source you tested. Record a section-specific acceptance or failure with screenshot and expected correction; an AI PASS does not authorize merge or release.\n\n';
md += '## Portable review and provenance\n\n`report.html` is a static companion using this folder\'s images. The generated standalone HTML embeds all images and JSON evidence for offline sharing; its local output path is printed by the publication script. Neither version runs JavaScript. The original artwork is copied byte-for-byte into `images/generated/`; this task did not regenerate or substitute the selected art. All implementation screenshots use synthetic data.\n\n';
md += 'The [asset map](evidence/asset-map.json) maps original sealed image paths to public copies and SHA-256 values. Packet/receipt bytes remain unchanged. Raw model logs, credentials, private profiles, native paths and account metadata remain ignored.\n';
write('evidence/asset-map.json', JSON.stringify(Object.fromEntries(mapping), null, 2) + '\n');
write('report.md', md);
const renderer = new MarkdownIt({ html: true });
renderer.renderer.rules.heading_open = (tokens, index, options, env, self) => { tokens[index].attrSet('id', slug(tokens[index + 1].content)); return self.renderToken(tokens, index, options); };
const body = renderer.render(md);
const css = 'body{font:16px/1.6 system-ui,sans-serif;color:#242830;background:#fafaf8;max-width:1120px;margin:40px auto;padding:0 24px}h1,h2,h3{line-height:1.25}h2{margin-top:48px;border-bottom:1px solid #d8dce1;padding-bottom:12px}a{color:#4266b0}img{max-width:100%;height:auto;border:1px solid #d8dce1;margin:12px 0}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #d8dce1;padding:8px;text-align:left;vertical-align:top}code,pre{font:12px/1.5 ui-monospace,monospace;overflow-wrap:anywhere}pre{white-space:pre-wrap;background:#f3f4f5;padding:16px}details{padding:12px;border:1px solid #d8dce1;border-radius:6px;margin:12px 0}summary{cursor:pointer;font-weight:600}@media(max-width:640px){body{padding:0 12px}table{font-size:12px}}';
const html = content => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>Binary Markdown visual fidelity review</title><style>' + css + '</style></head><body>' + content + '</body></html>\n';
write('report.html', html(body));
let standalone = body.replace(/src="([^"]+)"/g, (_, relative) => {
    const image = fs.readFileSync(core.safePath(root, output + '/' + relative));
    return 'src="data:image/' + (relative.endsWith('.jpg') ? 'jpeg' : 'png') + ';base64,' + image.toString('base64') + '"';
});
standalone = standalone.replace(/href="(evidence\/[^"#]+\.json)"/g, (_, relative) => 'href="#evidence-' + slug(relative) + '"');
standalone = standalone.replace(/href="(\.\.[^"]+)"/g, (_, relative) => {
    const resolved = path.posix.normalize(output + '/' + relative);
    if (resolved.startsWith('../')) throw new Error('Portable link leaves the repository');
    return 'href="https://github.com/BinaryOutlook/binary-markdown/blob/' + records[0].packet.source.commit + '/' + resolved + '"';
});
standalone += '<p>All report images and assessment records are embedded. Supplemental repository guides link to the reviewed source on GitHub and require a network connection.</p><h2>Embedded evidence</h2>';
for (const relative of [...mapping.values()].map(m => m.publishedPath).filter(p => p.endsWith('.json')).concat('evidence/asset-map.json', ...records.map(r => 'evidence/' + r.packet.sectionId + '/history.json'))) {
    standalone += '<details id="evidence-' + slug(relative) + '"><summary>' + escape(relative) + '</summary><pre>' + escape(fs.readFileSync(core.safePath(root, output + '/' + relative), 'utf8')) + '</pre></details>';
}
const destination = core.safePath(root, core.OUTPUT + '/delivery/ui-ux-visual-fidelity.html');
fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, html(standalone));
console.log(output + '/report.md\n' + path.relative(root, destination) + '\nStandalone HTML bytes: ' + fs.statSync(destination).size);
