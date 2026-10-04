'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { code, formatPackageSummary, verifiedArtifactUrl } = require('../../scripts/ci-vsix-summary.cjs');
const { candidateVSIXName } = require('../../scripts/candidate-names.cjs');
const info = {
    artifact: 'binary-markdown-0.4.1.vsix', version: '0.4.1',
    sourceCommit: 'a'.repeat(40), sourceTree: 'b'.repeat(40), sha256: 'c'.repeat(64),
    ci: { runId: 123, runNumber: 42, runAttempt: 2, event: 'push', ref: 'refs/heads/feature',
        runUrl: 'https://github.com/BinaryOutlook/binary-markdown/actions/runs/123' },
};
const url = info.ci.runUrl + '/artifacts/456';
test('package summaries link the exact run artifact and do not claim completed validation', () => {
    const summary = formatPackageSummary(info, url);
    assert.ok(summary.includes('](' + url + ')'));
    assert.match(summary, /Packaged — validation pending/);
    assert.ok(summary.includes('<code>0.4.1-dev-feature-build42-attempt2</code>'));
    for (const value of [info.sourceCommit, info.sha256, info.sourceTree, '123', '42', '2']) assert.ok(summary.includes('<code>' + value + '</code>'));
    assert.match(summary, /expire seven days/);
    assert.match(summary, /does not change the package version/);
    assert.match(summary, /four native lanes to test these same package bytes and nine browser shards to test this source revision/);
    assert.equal(summary, formatPackageSummary(info, url, 'full'));
});
test('branch package summaries distinguish build-only checks from the protected validation gate', () => {
    const summary = formatPackageSummary(info, url, 'build');
    assert.match(summary, /build-only checks passed/);
    assert.match(summary, /does not report the protected \*\*VSIX validation\*\* gate/);
    assert.match(summary, /or run native and browser validation/);
    assert.doesNotMatch(summary, /validation pending/);
    assert.ok(summary.includes('](' + url + ')'));
});
test('documentation package summaries report only the checks actually run', () => {
    const summary = formatPackageSummary(info, url, 'docs');
    assert.match(summary, /documentation, unit and package checks passed/);
    assert.match(summary, /does not run native or browser validation and is not full validation/);
    assert.match(summary, /final \*\*VSIX validation\*\* result for the documentation-only gate/);
    assert.doesNotMatch(summary, /validation pending/);
    assert.ok(summary.includes('](' + url + ')'));
});
test('unknown validation modes cannot produce a misleading package summary', () => {
    for (const mode of ['', 'partial', 'success', null]) {
        assert.throws(() => formatPackageSummary(info, url, mode), /Unknown validation mode/);
    }
});
test('the exported code formatter escapes identity fields for reuse in the final gate', () => {
    assert.equal(code('<tag>|[link](target)\nnext'), '<code>&#60;tag&#62;&#124;&#91;link&#93;&#40;target&#41; next</code>');
});
test('untrusted ref characters cannot create summary links, HTML or table cells', () => {
    const summary = formatPackageSummary({...info, ci: {...info.ci, ref: 'refs/heads/<img src=x>|[link](https://evil.invalid)\nInjected row'}}, url);
    assert.doesNotMatch(summary, /<img/);
    assert.ok(summary.includes('&#60;img src=x&#62;&#124;'));
    const html = require('markdown-it')({html: true}).render(summary);
    assert.equal((html.match(/<a /g) || []).length, 1);
    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(summary, /\nInjected row/);
});
test('PR downloads show their readable filename and build label together', () => {
    const pr = {...info, ci: {...info.ci, ref: 'refs/pull/98/merge'}};
    pr.artifact = candidateVSIXName({name: 'binary-markdown', version: pr.version}, pr.ci);
    const summary = formatPackageSummary(pr, url);
    assert.ok(summary.includes('<code>binary-markdown-0.4.1-dev-pr98-build42-attempt2.vsix</code>'));
    assert.ok(summary.includes('<code>0.4.1-dev-pr98-build42-attempt2</code>'));
    assert.match(summary, /Packaged — validation pending/);
});
test('a download link must identify this run rather than another artifact or arbitrary URL', () => {
    assert.equal(verifiedArtifactUrl(info, url), url);
    for (const value of ['https://evil.invalid/artifacts/456', url.replace('/123/', '/999/'),
        url + '?redirect=elsewhere', url + '#fragment', url.replace('https:', 'http:'),
        url.replace('github.com', 'user@github.com'), info.ci.runUrl, url + '/extra']) {
        assert.throws(() => verifiedArtifactUrl(info, value));
    }
});
