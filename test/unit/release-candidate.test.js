const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { verifyRun, verifyCandidate } = require('../../scripts/release-candidate');
const { assertArtifactAudit } = require('../native/assert-artifact-audit.cjs');

const repository = 'BinaryOutlook/binary-markdown';
const commit = 'a'.repeat(40);
const run = () => ({ path: '.github/workflows/ci-vsix.yml', repository: { full_name: repository }, head_repository: { full_name: repository },
    head_branch: 'main', head_sha: commit, event: 'push', status: 'completed', conclusion: 'success', id: 123, run_attempt: 2 });
test('release promotion binds a successful main push to its exact artifact attempt', () => {
    assert.deepEqual(verifyRun(run(), repository, commit), { source: commit, artifact: `vsix-candidate-${commit}-2`, attempt: 2 });
    for (const [key, value] of Object.entries({ path: '.github/workflows/unrelated.yml', head_branch: 'experiment', head_sha: 'b'.repeat(40),
        event: 'pull_request', status: 'in_progress', conclusion: 'failure', run_attempt: 0,
        repository: { full_name: 'other/repo' }, head_repository: { full_name: 'other/fork' } })) {
        assert.throws(() => verifyRun({ ...run(), [key]: value }, repository, commit), key);
    }
});
test('release candidate rejects changed bytes, dirty source and mismatched identities', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-release-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const manifest = { name: 'binary-markdown', publisher: 'BinaryOutlook', version: '0.2.0', license: 'AGPL-3.0-or-later' };
    const name = 'binary-markdown-0.2.0.vsix';
    const bytes = Buffer.from('test package bytes');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const identity = { ...manifest, sourceCommit: commit, sourceKind: 'git', dirty: false, repository: 'https://github.com/' + repository, artifact: name, sha256 };
    fs.writeFileSync(path.join(directory, name), bytes);
    fs.writeFileSync(path.join(directory, name + '.sha256'), sha256 + '  ' + name + '\n');
    const stamp = value => fs.writeFileSync(path.join(directory, name + '.build-info.json'), JSON.stringify(value));
    stamp(identity);
    assert.equal(verifyCandidate(directory, manifest, commit).sha256, sha256);
    for (const [key, value] of Object.entries({ dirty: true, sourceCommit: 'b'.repeat(40), sourceKind: 'provided', version: '0.1.0',
        license: 'MIT', repository: 'https://example.com/fork', artifact: '../other.vsix', sha256: '0'.repeat(64) })) {
        stamp({ ...identity, [key]: value });
        assert.throws(() => verifyCandidate(directory, manifest, commit), key);
    }
    stamp(identity);
    fs.appendFileSync(path.join(directory, name), 'tampered');
    assert.throws(() => verifyCandidate(directory, manifest, commit));
});
test('artifact observations cannot pass CI with dropped markers or original images', () => {
    const manifest = { files: [{ path: 'report.md', kind: 'markdown', sha256: commit, required_markers: ['FIRST', 'LAST'], inventory: { image_references: ['image.png'] } }, { path: 'image.png', kind: 'png' }] };
    const make = () => ({ results: ['html', 'pdf', 'docx', 'epub'].map(format => ({ source: 'report.md', format, receipt_state: 'complete', workspace_source_matches_frozen: true,
        source_sha256: commit, markers_checked: 2, missing_text_markers: ['LAST'], markers_present_in_image_alternatives: ['LAST'],
        trailing_editor_directive_visible: false, active_script_elements: 0, zip_crc: 'pass', media: [{ original_matches: ['image.png'] }] })) });
    assertArtifactAudit(make(), manifest);
    for (const [key, value] of Object.entries({ receipt_state: 'failed', workspace_source_matches_frozen: false,
        markers_present_in_image_alternatives: [], media: [], active_script_elements: 1 })) {
        const audit = make(); audit.results[0][key] = value;
        assert.throws(() => assertArtifactAudit(audit, manifest), key);
    }
    const duplicate = make(); duplicate.results[1] = duplicate.results[0];
    assert.throws(() => assertArtifactAudit(duplicate, manifest));
});
