'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const core = require('../../scripts/visual-review/core.cjs');
const { review } = require('../../scripts/visual-review/review.cjs');

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=', 'base64');
function fixture(t, count = 1) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-review-unit-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (relative, content) => { const file = core.safePath(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
    write('src/render.js', 'original');
    const cases = Array.from({ length: count }, (_, index) => ({ id: index ? 'state-' + index : 'all', state: 'All', comparison: 'Direct' }));
    write('scripts/visual-review/sections.json', JSON.stringify({ sections: [{ id: '03-commands', targetRegions: [{ id: 'insert', description: 'Insert only' }], excludedRegions: ['toolbar'], cases }] }));
    const reference = { level: 'Experimental', sourcePath: 'design.png', localPath: '.vscode-test/reference.png', sha256: core.hash(pixel), width: 1, height: 1, writtenIntent: 'Rendered previews', annotations: [] };
    write('.vscode-test/reference.png', pixel);
    write(core.PLAN + '/references.json', JSON.stringify({ designCommit: 'a'.repeat(40), designBrief: 'Minimalist', sections: [{ id: '03-commands', title: 'Insert', references: [reference], ownerScopeAdjustments: [], visualRequirements: ['Readable preview'], requiredStates: ['All'] }] }));
    for (const file of ['evaluator-prompt.txt','verdict.schema.json']) write('scripts/visual-review/' + file, file.endsWith('.json') ? '{}' : 'Judge only Insert');
    execFileSync('git', ['init','-q'], { cwd: root });
    execFileSync('git', ['-c','user.name=Test','-c','user.email=test@example.invalid','add','src'], { cwd: root });
    execFileSync('git', ['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture'], { cwd: root });
    const capture = () => {
        const directory = core.newIteration(root, '03-commands');
        for (const item of cases) { write(directory + '/' + item.id + '-full.png', pixel); write(directory + '/' + item.id + '-target.png', pixel); }
        const packet = core.seal(root, directory, { sectionId: '03-commands', capture: { kind: 'unit fixture' }, cases: cases.map(item => ({ ...item, images: [directory + '/' + item.id + '-full.png',directory + '/' + item.id + '-target.png'] })) });
        return { relative: directory + '/packet.json', packet };
    };
    return { root, write, capture };
}
function pass(packet) {
    return { packetDigest: packet.packetDigest, sectionId: packet.sectionId, verdict: 'PASS', summary: 'Preview matches the target.', openedImages: [...packet.references,...packet.cases.flatMap(c => c.images)].map(i => i.sha256),
        caseAssessments: packet.cases.map(c => ({ caseId: c.id, assessable: true, criteria: packet.criteria.map(k => ({ criterionId: k.id, result: 'met', evidence: 'The visible table grid and hierarchy match.' })) })), discrepancies: [], priorResolutions: [], missingEvidence: [] };
}
function fail(packet) {
    const verdict = pass(packet); verdict.verdict = 'FAIL'; verdict.caseAssessments[0].criteria[0].result = 'unmet';
    verdict.discrepancies.push({ id: 'INS-01', caseId: 'all', criterionId: 'C1', regionId: 'insert', severity: 'Major', expected: 'Visual table grid', observed: 'Raw syntax', correction: 'Render a miniature table', nextRender: 'Show a visible table grid, not pipe syntax' });
    return verdict;
}
test('rejects traversal, absolute paths and symlink escapes for reads and new outputs', t => {
    const { root } = fixture(t);
    for (const file of ['../secret','/tmp/file','src/../secret','src\\secret','src//file']) assert.throws(() => core.safePath(root, file));
    fs.symlinkSync(os.tmpdir(), path.join(root, 'redirect'));
    assert.throws(() => core.safePath(root, 'redirect/new.png'), /Symlink/);
});
test('sealed identity rejects changed source, altered images, reference hashes and packet tampering', t => {
    const f = fixture(t), { relative, packet } = f.capture();
    assert.equal(core.loadPacket(f.root, relative).packetDigest, packet.packetDigest);
    f.write('src/render.js', 'changed'); assert.throws(() => core.loadPacket(f.root, relative), /Stale/);
    f.write('src/render.js', 'original');
    f.write(packet.cases[0].images[0].path, Buffer.from('bad')); assert.throws(() => core.loadPacket(f.root, relative), /PNG/);
    f.write(packet.cases[0].images[0].path, pixel);
    const altered = { ...packet, title: 'Altered' }; f.write(relative, JSON.stringify(altered)); assert.throws(() => core.loadPacket(f.root, relative), /digest/);
    f.write(relative, JSON.stringify(packet));
    f.write('.vscode-test/reference.png', Buffer.concat([pixel, Buffer.from('altered')])); assert.throws(() => core.loadPacket(f.root, relative), /Reference/);
});
test('rejects self-consistently rehashed scope and capture-state changes', t => {
    const f = fixture(t), { relative, packet } = f.capture();
    packet.excludedRegions.push('required preview'); packet.packetDigest = core.digest(packet); f.write(relative, JSON.stringify(packet));
    assert.throws(() => core.loadPacket(f.root, relative), /contract changed/);
    packet.excludedRegions.pop(); packet.cases[0].comparison = 'Ignore previews'; packet.packetDigest = core.digest(packet); f.write(relative, JSON.stringify(packet));
    assert.throws(() => core.loadPacket(f.root, relative), /state contract/);
});
test('requires complete image/case/criterion identity and rejects out-of-scope evaluator findings', t => {
    const { packet } = fixture(t).capture();
    for (const mutate of [v => v.openedImages.pop(), v => v.caseAssessments.pop(), v => v.caseAssessments[0].criteria.pop(), v => v.sectionId = '12-export', v => v.discrepancies[0].regionId = 'toolbar', v => v.discrepancies[0].criterionId = 'C999', v => v.extra = 'unknown']) {
        const verdict = fail(packet); mutate(verdict); assert.throws(() => core.validateVerdict(packet, verdict));
    }
});
test('a process or schema success cannot establish unsupported PASS or ungrounded FAIL', t => {
    const { packet } = fixture(t).capture();
    assert.equal(core.validateVerdict(packet, pass(packet)).verdict, 'PASS');
    const mismatch = fail(packet); mismatch.verdict = 'PASS'; assert.throws(() => core.validateVerdict(packet, mismatch), /Unsupported/);
    const missing = pass(packet); missing.caseAssessments[0].assessable = false; assert.throws(() => core.validateVerdict(packet, missing), /Unsupported/);
    const invented = pass(packet); invented.verdict = 'FAIL'; assert.throws(() => core.validateVerdict(packet, invented), /actionable/);
});
test('FAIL routes corrections to the builder, preserves evidence and requires resolution in the next iteration', t => {
    const f = fixture(t), first = f.capture();
    core.saveVerdict(f.root, first.relative, fail(first.packet));
    const handoff = fs.readFileSync(core.safePath(f.root, path.posix.dirname(first.relative) + '/next.md'), 'utf8');
    assert.match(handoff, /INS-01/); assert.match(handoff, /Render a miniature table/);
    assert.throws(() => core.saveVerdict(f.root, first.relative, pass(first.packet)), /EEXIST/);
    const second = f.capture(); assert.equal(second.packet.priorFailures[0].id, 'INS-01');
    const verdict = pass(second.packet); assert.throws(() => core.validateVerdict(second.packet, verdict), /prior failure/);
    verdict.priorResolutions.push({ id: 'INS-01', status: 'fixed', evidence: 'A visible miniature table replaces the raw pipes.' });
    assert.equal(core.saveVerdict(f.root, second.relative, verdict).verdict, 'PASS');
    assert.equal(f.capture().packet.priorFailures.length, 0);
});
test('model text is escaped in Markdown handoffs rather than executed or rendered as HTML', t => {
    const f = fixture(t), current = f.capture(), verdict = fail(current.packet);
    verdict.discrepancies[0].correction = '<img src=x onerror=alert(1)> | [link](javascript:evil)';
    core.saveVerdict(f.root, current.relative, verdict);
    const output = fs.readFileSync(core.safePath(f.root, path.posix.dirname(current.relative) + '/next.md'), 'utf8');
    assert.ok(!output.includes('<img')); assert.ok(!output.includes('[link]')); assert.match(output, /&#60;/);
});
test('receipt tampering cannot turn a retained FAIL or provider failure into PASS', t => {
    const f = fixture(t), current = f.capture();
    const receipt = core.saveVerdict(f.root, current.relative, fail(current.packet));
    receipt.verdict = 'PASS'; assert.throws(() => core.validateReceipt(current.packet, receipt), /verdict mismatch/);
    const second = f.capture(), blocked = core.saveVerdict(f.root, second.relative, null, 'Provider unavailable');
    blocked.verdict = 'PASS'; assert.throws(() => core.validateReceipt(second.packet, blocked), /Unsupported/);
});
test('unavailable evaluator creates BLOCKED, never PASS, using a fresh read-only image invocation', async t => {
    const f = fixture(t), first = f.capture();
    core.saveVerdict(f.root, first.relative, fail(first.packet));
    const current = f.capture();
    const fakeSpawn = (executable, args, options) => {
        assert.equal(options.shell, false); assert.ok(args.includes('--ephemeral')); assert.ok(args.includes('read-only')); assert.ok(args.includes('--ignore-user-config'));
        assert.ok(!options.cwd.startsWith(f.root)); assert.equal(args.filter(a => a === '--image').length, 3);
        assert.ok(!fs.existsSync(path.join(options.cwd, 'src')));
        const context = JSON.parse(fs.readFileSync(path.join(options.cwd, 'packet.json'), 'utf8'));
        assert.deepEqual(context.priorFailures, [{ id: 'INS-01', caseId: 'all', criterionId: 'C1', regionId: 'insert' }]);
        assert.equal(context.packetDigest, current.packet.packetDigest);
        assert.equal(current.packet.priorFailures[0].observed, 'Raw syntax');
        assert.ok(!JSON.stringify(context).includes('Raw syntax'));
        const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
        process.nextTick(() => child.emit('close', 1)); return child;
    };
    const receipt = await review(f.root, current.relative, { spawn: fakeSpawn });
    assert.equal(receipt.verdict, 'BLOCKED'); assert.equal(receipt.evaluation, null);
});
function groupSpawn(inspect) {
    let index = 0;
    return (executable, args, options) => {
        const packet = JSON.parse(fs.readFileSync(path.join(options.cwd, 'packet.json'), 'utf8'));
        assert.ok(packet.cases.length <= 2);
        assert.equal(args.filter(a => a === '--image').length, packet.references.length + packet.cases.length * 2);
        const verdict = inspect(packet, index++);
        if (verdict) fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify(verdict));
        const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
        process.nextTick(() => child.emit('close', verdict ? 0 : 1)); return child;
    };
}
test('bounded fresh groups cover every case and retain a FAIL without averaging it into PASS', async t => {
    const f = fixture(t, 4), current = f.capture(); let calls = 0;
    const receipt = await review(f.root, current.relative, { spawn: groupSpawn((packet, index) => {
        calls++; const verdict = index ? pass(packet) : fail(packet);
        if (!index) verdict.discrepancies[0].id = 'ALL-01';
        return verdict;
    }) });
    assert.equal(calls, 2); assert.equal(receipt.verdict, 'FAIL'); assert.equal(receipt.evaluation.caseAssessments.length, 4);
    assert.equal(receipt.evaluation.openedImages.length, 9);
    const records = core.readJson(f.root, path.posix.dirname(current.relative) + '/groups.json');
    assert.deepEqual(records.groups.map(g => g.caseIds), [['all','state-1'],['state-2','state-3']]);
    assert.deepEqual(core.aggregateGroups(current.packet, records), receipt.evaluation);
    records.groups.pop(); assert.throws(() => core.aggregateGroups(current.packet, records), /identity mismatch/);
});
test('a missing group blocks the section and preserves another group\'s validated failure for correction', async t => {
    const f = fixture(t, 4), current = f.capture();
    const receipt = await review(f.root, current.relative, { spawn: groupSpawn((packet, index) => {
        if (index) return null;
        const verdict = fail(packet); verdict.discrepancies[0].id = 'ALL-01'; return verdict;
    }) });
    assert.equal(receipt.verdict, 'BLOCKED'); assert.equal(receipt.evaluation, null);
    assert.deepEqual(f.capture().packet.priorFailures.map(f => f.id), ['ALL-01']);
});
test('a group cannot borrow omitted cases or image acknowledgements from another group', async t => {
    const f = fixture(t, 4), current = f.capture();
    const receipt = await review(f.root, current.relative, { spawn: groupSpawn(packet => {
        const verdict = pass(packet); verdict.caseAssessments[0].caseId = 'state-3'; return verdict;
    }) });
    assert.equal(receipt.verdict, 'BLOCKED'); assert.equal(receipt.evaluation, null);
});
