'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { maintainedFiles, markdownReferences, checkDocumentation } = require('../../scripts/doc-checks.cjs');

function fixture(t, files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'documentation-check-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const [file, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), text);
    }
    return root;
}

test('Markdown links accept Setext headings, balanced destinations, references and URL encoding', t => {
    const root = fixture(t, {
        'README.md': '[Balanced](docs/target(1).md#setext-title)\n\n[Encoded](docs/target%281%29.md?view=1#setext-title)\n\n[Spaced][target]\n\n[target]: <docs/target space.md#title--code> "Example"\n',
        'docs/target(1).md': 'Setext *title*\n===\n',
        'docs/target space.md': '# Title & `code`\n'
    });
    const result = checkDocumentation(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.links, 3);
});

test('heading suffixes avoid collisions with literal numbered headings', () => {
    const result = markdownReferences('# Topic\n\n# Topic-1\n\n# Topic\n\n# Topic-1\n\n# Topic\n');
    assert.deepEqual([...result.anchors], ['topic', 'topic-1', 'topic-2', 'topic-1-1', 'topic-3']);
});

test('code examples and HTML comments do not become live links or anchors', t => {
    const root = fixture(t, {
        'README.md': [
            '`[inline](missing-inline.md)`', '',
            '```md', '[fenced](missing-fenced.md)', '# Fake heading', '<a id="fake-html" href="missing.md">Example</a>', '```', '',
            '    [indented](missing-indented.md)', '    [ref]: missing-ref.md', '',
            '<!-- <a href="missing-comment.md" id="comment-anchor">Example</a> -->', '',
            '[Active](docs/target.md#real)', '',
            '[Unused]: docs/target.md#real', ''
        ].join('\n'),
        'docs/target.md': '# Real\n'
    });
    assert.deepEqual(checkDocumentation(root).errors, []);
    assert.equal(checkDocumentation(root).links, 1);
    assert.deepEqual([...markdownReferences(fs.readFileSync(path.join(root, 'README.md'), 'utf8')).anchors], []);
});

test('HTML fragments check real IDs and named anchors, including raw HTML in Markdown', t => {
    const root = fixture(t, {
        'README.md': '[HTML](docs/index.html#section)\n\n[Legacy](docs/index.html#legacy)\n\n[Markdown HTML](docs/target.md#raw)\n',
        'docs/index.html': '<!doctype html><h1 id="section">Section</h1><a name="legacy"></a><a href="target.md#raw">Target</a><pre>&lt;a href="missing.md"&gt;</pre><!-- <i id="fake"></i> -->',
        'docs/target.md': '<table><tr><td id="raw">Cell</td></tr></table>\n'
    });
    assert.deepEqual(checkDocumentation(root).errors, []);
    fs.appendFileSync(path.join(root, 'README.md'), '\n[Broken](docs/index.html#fake)\n');
    assert.deepEqual(checkDocumentation(root).errors, ['README.md:7: missing local anchor']);
    fs.appendFileSync(path.join(root, 'docs/target.md'), '<a data-doc-link="markdown" href="missing.md">Raw HTML remains checked</a>\n');
    assert.ok(checkDocumentation(root).errors.includes('docs/target.md: missing local target'));
});

test('missing targets, missing headings, unused references and malformed encodings fail', t => {
    const root = fixture(t, {
        'AGENTS.md': '[Missing](docs/missing.md)\n\n[Anchor](docs/target.md#missing)\n\n[Bad encoding](docs/%E0%A4.md)\n\n[unused]: missing-reference.md\n',
        'docs/target.md': '# Present\n'
    });
    const result = checkDocumentation(root);
    assert.equal(result.errors.length, 4);
    assert.ok(result.errors.every(error => error.startsWith('AGENTS.md')));
    assert.ok(result.errors.some(error => error.endsWith('malformed local link encoding')));
    assert.equal(result.errors.filter(error => error.endsWith('missing local target')).length, 2);
    assert.equal(result.errors.filter(error => error.endsWith('missing local anchor')).length, 1);
});

test('the maintained-file policy includes AGENTS and curated records while excluding archives and arbitrary fixtures', t => {
    const included = ['AGENTS.md', 'README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'media/export-help.md',
        'archive/README.md', 'archive/development/plan.md', 'docs/nested/guide.html', 'reports/evidence/check.json',
        'release-notes/1.0.md', 'test/native/procedure.md', 'test/fixtures/manual/copy-paste.md'];
    const excluded = ['OTHER.md', 'archive/upstream/guide.md', 'test/fixtures/input.md', 'test/native/nested/example.md',
        'src/code.js', 'docs/image.svg', 'node_modules/package/README.md'];
    const root = fixture(t, Object.fromEntries([...included, ...excluded].map(file => [file, file.endsWith('.json') ? '{}' : 'Example'])));
    assert.deepEqual(maintainedFiles(root), included.sort());
});

test('privacy diagnostics cover included code examples without echoing suspected values', t => {
    const syntheticToken = 'ghp_' + 'A'.repeat(24);
    const root = fixture(t, {
        'AGENTS.md': '```text\n' + syntheticToken + '\n```\n',
        'archive/upstream/ignored.md': syntheticToken,
        'reports/invalid.json': '{'
    });
    const result = checkDocumentation(root);
    assert.deepEqual(result.errors, ['AGENTS.md:2: possible credential token', 'reports/invalid.json: invalid JSON']);
    assert.ok(!result.errors.join('\n').includes(syntheticToken));
});
