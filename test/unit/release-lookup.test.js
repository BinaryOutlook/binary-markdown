'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findRelease } = require('../../scripts/release-github.cjs');
const { assertUnreleased, confirmRelease } = require('../../scripts/promote-vsix.cjs');

const release = (overrides = {}) => ({ id: 1, tag_name: 'v0.9.1', draft: false, prerelease: false,
    html_url: 'https://github.com/BinaryOutlook/binary-markdown/releases/tag/v0.9.1', ...overrides });
const draft = overrides => release({ draft: true,
    html_url: 'https://github.com/BinaryOutlook/binary-markdown/releases/tag/untagged-0123456789abcdef', ...overrides });

// GitHub's releases/tags endpoint omits drafts. The fixture exposes only the
// release list and tag refs, so any use of that endpoint fails the test.
function client(releases, tags = []) {
    const calls = [];
    return {
        calls,
        pages(endpoint) {
            calls.push(endpoint);
            assert.equal(endpoint, 'releases?per_page=100');
            return releases;
        },
        optionalApi(endpoint) {
            calls.push(endpoint);
            const tag = endpoint.match(/^git\/ref\/tags\/(.+)$/)?.[1];
            assert.ok(tag, 'Unexpected request: ' + endpoint);
            return tags.includes(tag) ? { ref: `refs/tags/${tag}` } : null;
        },
    };
}

test('finds a draft by tag from the release list', () => {
    const github = client([release({ id: 2, tag_name: 'v0.9.0' }), draft({ id: 3 })]);
    assert.equal(findRelease('v0.9.1', github).id, 3);
    assert.equal(findRelease('v0.9.2', github), null);
});
test('refuses to choose between releases or drafts that share a tag', () => {
    const github = client([draft({ id: 3 }), draft({ id: 4 })]);
    assert.throws(() => findRelease('v0.9.1', github), /2 releases or drafts use v0\.9\.1/);
});
test('a prepared draft confirms the manual draft workflow', () => {
    const prepared = draft({ id: 3 });
    assert.equal(confirmRelease('v0.9.1', false, client([prepared])), prepared);
});
test('automatic publication requires the release to be public', () => {
    const published = release({ id: 3 });
    assert.equal(confirmRelease('v0.9.1', true, client([published])), published);
    assert.throws(() => confirmRelease('v0.9.1', true, client([draft({ id: 3 })])), /v0\.9\.1 is still a draft/);
});
test('a missing, unexpectedly public or prerelease result fails confirmation', () => {
    assert.throws(() => confirmRelease('v0.9.1', false, client([])), /No release or draft for v0\.9\.1/);
    assert.throws(() => confirmRelease('v0.9.1', false, client([release({ id: 3 })])), /v0\.9\.1 is public, not a draft/);
    assert.throws(() => confirmRelease('v0.9.1', false, client([draft({ prerelease: true })])),
        /v0\.9\.1 is marked as a prerelease/);
});
test('a leftover untagged draft blocks a new upload', () => {
    const github = client([draft({ id: 3 })]);
    assert.throws(() => assertUnreleased('v0.9.1', github), /A release or draft already exists/);
});
test('an existing tag blocks a new upload', () => {
    assert.throws(() => assertUnreleased('v0.9.1', client([], ['v0.9.1'])), /A tag already exists/);
});
test('an unused version passes both upload guards', () => {
    const github = client([release({ id: 2, tag_name: 'v0.9.0' })], ['v0.9.0']);
    assertUnreleased('v0.9.1', github);
    assert.deepEqual(github.calls, ['releases?per_page=100', 'git/ref/tags/v0.9.1']);
});
