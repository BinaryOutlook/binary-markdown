'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { formatPackageSummary, verifiedArtifactUrl } = require('../../scripts/ci-vsix-summary.cjs');
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
    for (const value of [info.sourceCommit, info.sha256, info.sourceTree, '123', '42', '2']) assert.ok(summary.includes('<code>' + value + '</code>'));
    assert.match(summary, /expire seven days/);
    assert.match(summary, /does not change the package version/);
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
test('a download link must identify this run rather than another artifact or arbitrary URL', () => {
    assert.equal(verifiedArtifactUrl(info, url), url);
    for (const value of ['https://evil.invalid/artifacts/456', url.replace('/123/', '/999/'),
        url + '?redirect=elsewhere', url + '#fragment', url.replace('https:', 'http:'),
        url.replace('github.com', 'user@github.com'), info.ci.runUrl, url + '/extra']) {
        assert.throws(() => verifiedArtifactUrl(info, value));
    }
});
