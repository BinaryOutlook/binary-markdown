'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateDemonstrator } = require('../../scripts/validate-manual-review.cjs');

const script = path.resolve(__dirname, '../../scripts/validate-manual-review.cjs');
function validFixture() {
    const examples = {
        36: '### Empty code (0 lines)\n\n```text\n```\n\n' +
            '### One blank line (1 line)\n\n```text\n\n```\n\n' +
            '### Trailing blank line (2 lines)\n\n```text\nalpha\n\n```\n',
        37: '### Wrapped code (1 line)\n\n```text\n' + 'long '.repeat(50) + '\n```\n',
        39: '### Multi-page code (150 lines)\n\n```text\n' +
            Array.from({ length: 150 }, (_, index) => `line ${index + 1}`).join('\n') + '\n```\n',
    };
    return Array.from({ length: 23 }, (_, index) => {
        const number = index + 19;
        return `## D${number} — Example\n\nSample content.\n\n${examples[number] || ''}`;
    }).join('\n');
}
function directory(t) {
    const result = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-manual-validator-'));
    t.after(() => fs.rmSync(result, { recursive: true, force: true }));
    return result;
}
function run(...args) {
    return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('checked-in demonstrator retains every review section and declared code sample', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../fixtures/manual/editor-export-demonstrator.md'), 'utf8');
    assert.deepEqual(validateDemonstrator(source), []);
});

test('complete fixture distinguishes empty, blank, trailing, wrapped, and long code samples', () => {
    assert.deepEqual(validateDemonstrator(validFixture()), []);
    assert.deepEqual(validateDemonstrator(validFixture().replaceAll('\n', '\r\n')), []);
});

test('missing, duplicate, unexpected, and empty demonstrators fail integrity validation', () => {
    assert.match(validateDemonstrator(validFixture().replace('## D23 — Example', '## Other section')).join('\n'), /D23: missing/);
    assert.match(validateDemonstrator(validFixture() + '\n## D19 — Duplicate\n\nSample.\n').join('\n'), /D19: duplicate/);
    assert.match(validateDemonstrator(validFixture() + '\n## D42 — Extra\n\nSample.\n').join('\n'), /unexpected demonstrator/);
    assert.match(validateDemonstrator(validFixture().replace('## D19 — Example\n\nSample content.', '## D19 — Example')).join('\n'), /D19: section has no demonstrator/);
});

test('headings inside backtick and tilde fences are content, and shorter fences do not close longer fences', () => {
    const appended = '\n````markdown\n## D19 — Not a section\n```\n````\n\n~~~text\n## D42 — Not a section\n~~~\n';
    assert.deepEqual(validateDemonstrator(validFixture() + appended), []);
    const missing = validFixture().replace('## D23 — Example', '## Other section') + '\n```markdown\n## D23 — Still missing\n```\n';
    assert.match(validateDemonstrator(missing).join('\n'), /D23: missing/);
});

test('unclosed fences, absent sample fences, duplicate subsections, and line-count drift are rejected', () => {
    assert.match(validateDemonstrator(validFixture() + '\n```text\nunfinished\n').join('\n'), /unclosed code fence/);
    assert.match(validateDemonstrator(validFixture().replace('```text\n```', 'No sample.')).join('\n'), /requires exactly one fenced sample/);
    assert.match(validateDemonstrator(validFixture().replace('### Empty code (0 lines)', '### Empty code (0 lines)\n\n### Empty code (0 lines)')).join('\n'), /expected one "Empty code/);
    assert.match(validateDemonstrator(validFixture().replace('```text\nalpha\n\n```', '```text\nalpha\n```')).join('\n'), /must contain 2 logical code lines; found 1/);
    assert.match(validateDemonstrator(validFixture().replace('line 149\nline 150', 'line 149')).join('\n'), /must contain 150 logical code lines; found 149/);
});

test('CLI validates a supplied fixture and reports errors without printing its path or content', t => {
    const root = directory(t);
    const input = path.join(root, 'private-example.md');
    fs.writeFileSync(input, validFixture());
    assert.equal(run(input).status, 0);
    fs.writeFileSync(input, 'private contents\n');
    const invalid = run(input);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /D19: missing/);
    assert.ok(!invalid.stderr.includes(root));
    assert.ok(!invalid.stderr.includes('private contents'));
});

test('comparison detects exact byte changes including line endings without modifying either file', t => {
    const root = directory(t);
    const before = path.join(root, 'before.md');
    const after = path.join(root, 'after.md');
    const original = Buffer.from('private content\n');
    fs.writeFileSync(before, original);
    fs.writeFileSync(after, original);
    const unchanged = run('--compare', before, after);
    assert.equal(unchanged.status, 0);
    assert.match(unchanged.stdout, /bytes unchanged/);
    fs.writeFileSync(after, 'private content\r\n');
    const changed = run('--compare', before, after);
    assert.equal(changed.status, 1);
    assert.match(changed.stdout, /bytes changed/);
    assert.ok(!changed.stdout.includes(root));
    assert.ok(!changed.stdout.includes('private content'));
    assert.deepEqual(fs.readFileSync(before), original);
    assert.equal(fs.readFileSync(after, 'utf8'), 'private content\r\n');
});

test('CLI handles usage and read failures privately, and explains its limited scope', t => {
    const root = directory(t);
    const missing = path.join(root, 'missing.md');
    const readFailure = run('--compare', missing, missing);
    assert.equal(readFailure.status, 2);
    assert.ok(!readFailure.stderr.includes(root));
    assert.equal(run(missing).status, 2);
    assert.equal(run('--compare', missing).status, 2);
    assert.equal(run('--unknown').status, 2);
    const help = run('--help');
    assert.equal(help.status, 0);
    assert.match(help.stdout, /does not establish editor, export, accessibility, or reader acceptance/);
});
