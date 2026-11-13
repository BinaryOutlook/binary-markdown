'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const REPOSITORY = 'BinaryOutlook/binary-markdown';
function command(executable, args, input) {
    return execFileSync(executable, args, { encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function api(endpoint, body, method) {
    const args = ['api', `repos/${REPOSITORY}/${endpoint}`];
    if (method) args.push('--method', method);
    if (body !== undefined) args.push('--input', '-');
    const output = command('gh', args, body === undefined ? undefined : JSON.stringify(body));
    return output ? JSON.parse(output) : null;
}
function optionalApi(endpoint) {
    try { return api(endpoint); } catch (error) {
        if (String(error.stderr).includes('(HTTP 404)')) return null;
        throw error;
    }
}
function pages(endpoint, key) {
    const result = JSON.parse(command('gh', ['api', '--paginate', '--slurp', `repos/${REPOSITORY}/${endpoint}`]));
    return result.flatMap(page => key ? page[key] : page);
}
// GET releases/tags/{tag} omits drafts, which have no Git tag until they are
// published. The authenticated release list includes drafts for workflows
// with contents write permission, so release identity checks search it.
function findRelease(tag, client = { pages }) {
    const matches = client.pages('releases?per_page=100').filter(release => release.tag_name === tag);
    assert.ok(matches.length <= 1, `${matches.length} releases or drafts use ${tag}; inspect them before continuing`);
    return matches[0] || null;
}
function git(...args) { return command('git', args); }
function currentMain() {
    const sha = api('git/ref/heads/main').object.sha;
    assert.match(sha, /^[0-9a-f]{40}$/);
    return sha;
}
function assertMain(source) {
    assert.equal(currentMain(), source, 'main changed during release preparation; the next run must validate the new revision');
}
function assertRepository() {
    assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
}
module.exports = { REPOSITORY, command, api, optionalApi, pages, findRelease, git, currentMain, assertMain, assertRepository };
