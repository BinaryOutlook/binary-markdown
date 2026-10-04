'use strict';
const assert = require('node:assert/strict');

const nativePlatforms = ['ubuntu', 'macos', 'windows', 'vscode-minimum'];
const browserPlatforms = ['ubuntu', 'macos', 'windows'];
const browserShards = [1, 2, 3];
const browserJobs = browserPlatforms.flatMap(platform => browserShards.map(shard => `Browser (${platform}, ${shard}/3)`));
const fullValidationJobs = ['Classify change', 'Build candidate',
    ...nativePlatforms.map(platform => `Validate (${platform})`), ...browserJobs, 'VSIX validation'];

function evidenceNames(source, attempt) {
    return [...nativePlatforms.map(platform => `validation-${platform}-${source}-${attempt}`),
        ...browserPlatforms.flatMap(platform => browserShards.map(shard => `browser-${platform}-${shard}-${source}-${attempt}`))];
}

// Only prose outside runtime/test inputs can take the fast path. Unknown paths,
// empty diffs and unavailable comparisons require full validation.
function documentationOnly(files) {
    return files.length > 0 && files.every(file =>
        !file.split('/').some(part => part === '..' || part === '.') &&
        /^(?:README\.md|CONTRIBUTING\.md|AGENTS\.md|CHANGELOG\.md|(?:docs|reports|release-notes)\/.+\.md)$/.test(file));
}

function validationMode(eventName, ref, files) {
    if (eventName === 'push' && ref.startsWith('refs/heads/') && ref !== 'refs/heads/main') return 'build';
    if (eventName === 'pull_request' && Array.isArray(files) && documentationOnly(files)) return 'docs';
    return 'full';
}

function verifyGate({ mode, scope, package: packaged, native, browser }) {
    assert.equal(scope, 'success', 'Change classification must succeed');
    assert.equal(packaged, 'success', 'Candidate build and source checks must succeed');
    assert.ok(['full', 'docs'].includes(mode), 'Only PR/main validation can satisfy the merge gate');
    for (const [name, result] of Object.entries({ native, browser })) {
        assert.equal(result, mode === 'full' ? 'success' : 'skipped', `${name} validation has an unexpected result`);
    }
}

module.exports = { nativePlatforms, browserPlatforms, browserShards, browserJobs, fullValidationJobs,
    evidenceNames, documentationOnly, validationMode, verifyGate };
