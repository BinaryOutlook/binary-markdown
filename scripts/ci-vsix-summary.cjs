'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { verifyCandidate } = require('./release-candidate');
const { githubActionsIdentity } = require('./build-identity');
const { developmentBuildLabel } = require('./candidate-names.cjs');

function code(value) {
    // HTML entities keep both Markdown syntax and table delimiters inert, even
    // when a contributor chooses a ref containing punctuation.
    return '<code>' + String(value).replace(/[&<>"'|\r\n[\]()*_`~\\]/g,
        character => character === '\r' || character === '\n' ? ' ' : '&#' + character.charCodeAt(0) + ';') + '</code>';
}

function verifiedArtifactUrl(info, value) {
    const url = new URL(value);
    const run = new URL(info.ci.runUrl);
    const prefix = run.pathname + '/artifacts/';
    assert.ok(url.protocol === 'https:' && url.origin === run.origin && !url.username && !url.password && !url.search && !url.hash &&
        url.pathname.startsWith(prefix) && /^[1-9]\d*$/.test(url.pathname.slice(prefix.length)), 'Expected an artifact URL belonging to this CI run');
    return url.href;
}

function formatPackageSummary(info, artifactUrl, mode = 'full') {
    assert.match(info.sourceCommit, /^[0-9a-f]{40}$/);
    assert.match(info.sha256, /^[0-9a-f]{64}$/);
    assert.ok(info.ci, 'Package summary requires recorded CI identity');
    assert.ok(['full', 'build', 'docs'].includes(mode), 'Unknown validation mode');
    const link = verifiedArtifactUrl(info, artifactUrl);
    const status = {
        full: '**Packaged — validation pending.** This download is an unreleased development snapshot. Check the overall run and the final **VSIX validation** result before describing it as validated.',
        build: '**Packaged — build-only checks passed.** This download is an unreleased development snapshot. This branch build does not report the protected **VSIX validation** gate or run native and browser validation.',
        docs: '**Packaged — documentation, unit and package checks passed.** This download is an unreleased development snapshot. This documentation-only path does not run native or browser validation and is not full validation. Check the final **VSIX validation** result for the documentation-only gate.',
    }[mode];
    return [
        '## Development VSIX', '',
        '**Build:** ' + code(info.version + '-dev-' + developmentBuildLabel(info.ci)), '',
        status, '',
        '[Download the VSIX, checksum and build-information sidecar](' + link + ')', '',
        '| Identity | Value |', '| --- | --- |',
        '| Package | ' + code(info.artifact) + ' |',
        '| Package version | ' + code(info.version) + ' |',
        '| Source commit | ' + code(info.sourceCommit) + ' |',
        '| Source tree | ' + code(info.sourceTree || 'unknown') + ' |',
        '| CI build number | ' + code(info.ci.runNumber) + ' |',
        '| CI run ID / attempt | ' + code(info.ci.runId) + ' / ' + code(info.ci.runAttempt) + ' |',
        '| CI event / ref | ' + code(info.ci.event) + ' / ' + code(info.ci.ref) + ' |',
        '| VSIX SHA-256 | ' + code(info.sha256) + ' |', '',
        'Artifacts expire seven days after upload and normal downloads require GitHub sign-in. Extract and retain all three files together. Install with **Extensions: Install from VSIX**, reload, then compare **Binary Markdown: Copy Build Information** with this identity. The CI build number does not change the package version or automatically update an installed extension.', '',
        'Full validation requires four native lanes to test these same package bytes and nine browser shards to test this source revision. Official release eligibility requires full validation and is checked separately against the current canonical main revision.', '',
    ].join('\n');
}

function main() {
    const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const { info } = verifyCandidate('dist', require('../package.json'), source);
    assert.deepEqual(info.ci, githubActionsIdentity(process.env), 'Candidate must identify this CI run and attempt');
    const artifactUrl = verifiedArtifactUrl(info, process.env.CANDIDATE_URL);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatPackageSummary(info, artifactUrl, process.env.VALIDATION_MODE));
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'sha256=' + info.sha256 + '\nartifact_url=' + artifactUrl +
        '\nfilename=' + info.artifact + '\n');
}
if (require.main === module) {
    try { main(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { code, formatPackageSummary, verifiedArtifactUrl };
