'use strict';
const assert = require('node:assert/strict');

function canonicalVSIXName(manifest) {
    assert.match(manifest.name, /^[a-z0-9][a-z0-9-]*$/);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    return manifest.name + '-' + manifest.version + '.vsix';
}

function developmentBuildLabel(ci) {
    for (const key of ['runNumber', 'runAttempt']) {
        assert.ok(Number.isSafeInteger(ci[key]) && ci[key] > 0, 'Invalid CI ' + key);
    }
    const slug = value => value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-').slice(0, 48).replace(/^[._-]+|[._-]+$/g, '') || 'branch';
    let ref;
    if (/^refs\/heads\/.+/.test(ci.ref)) ref = slug(ci.ref.slice('refs/heads/'.length));
    else if (/^refs\/pull\/[1-9]\d*\/(merge|head)$/.test(ci.ref)) ref = 'pr' + ci.ref.split('/')[2];
    else if (/^refs\/tags\/.+/.test(ci.ref)) ref = 'tag-' + slug(ci.ref.slice('refs/tags/'.length));
    else throw new Error('Unsupported CI ref for development naming');
    return ref + '-build' + ci.runNumber + '-attempt' + ci.runAttempt;
}

function candidateVSIXName(manifest, ci) {
    const canonical = canonicalVSIXName(manifest);
    return ci ? canonical.slice(0, -5) + '-dev-' + developmentBuildLabel(ci) + '.vsix' : canonical;
}

module.exports = { canonicalVSIXName, candidateVSIXName, developmentBuildLabel };
