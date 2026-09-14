'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureValidation, ensurePullValidation } = require('../../scripts/auto-release.cjs');

const source = 'a'.repeat(40);
const jobs = ['Build candidate', 'Validate (ubuntu)', 'Validate (macos)', 'Validate (windows)', 'Validate (vscode-minimum)', 'VSIX validation']
    .map(name => ({ name, status: 'completed', conclusion: 'success' }));
const candidate = (overrides = {}) => ({ id: 10, run_attempt: 1, path: '.github/workflows/ci-vsix.yml',
    head_branch: 'main', head_sha: source, event: 'push', status: 'completed', conclusion: 'success', ...overrides });
const artifacts = (attempt = 1) => [`vsix-candidate-${source}-${attempt}`,
    ...['ubuntu', 'macos', 'windows', 'vscode-minimum'].map(lane => `validation-${lane}-${source}-${attempt}`)]
    .map(name => ({ name, expired: false }));

function fixture(runs = [candidate()], options = {}) {
    const calls = [];
    let request;
    const client = {
        api(endpoint, body) {
            calls.push({ endpoint, body });
            if (endpoint === 'actions/workflows/ci-vsix.yml/dispatches') { request = body; return null; }
            if (endpoint.includes('event=workflow_dispatch')) return { workflow_runs: [candidate({ id: 11,
                event: 'workflow_dispatch', display_title: `Validate VSIX (${request.inputs.request_id})`,
                head_branch: request.ref, ...options.dispatched })] };
            if (endpoint.startsWith('actions/runs?head_sha=')) return { workflow_runs: runs };
            throw new Error('Unexpected request: ' + endpoint);
        },
        pages(endpoint) {
            calls.push({ endpoint });
            if (endpoint.includes('/jobs?')) return options.jobs || jobs;
            if (endpoint.includes('/artifacts?')) return options.expired && endpoint.includes('/10/') ?
                artifacts().map(artifact => ({ ...artifact, expired: true })) : artifacts();
            throw new Error('Unexpected paginated request: ' + endpoint);
        },
        async pause() { throw new Error('This scenario should complete without polling'); },
    };
    return { client, calls };
}

test('reuses a completed exact-source validation with all five available artifacts', async () => {
    const { client, calls } = fixture();
    assert.equal(await ensureValidation('main', source, client), 10);
    assert.equal(calls.some(call => call.body), false);
});
test('failed validation stops without dispatching another attempt', async () => {
    const { client, calls } = fixture([candidate({ conclusion: 'failure' })]);
    await assert.rejects(ensureValidation('main', source, client), /Validation failed/);
    assert.equal(calls.some(call => call.body), false);
});
test('unavailable successful artifacts trigger one full validation bound to the source', async () => {
    const { client, calls } = fixture([candidate()], { expired: true });
    assert.equal(await ensureValidation('main', source, client), 11);
    const writes = calls.filter(call => call.body);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].body.ref, 'main');
    assert.equal(writes[0].body.inputs.expected_source, source);
});
test('PR results cannot substitute for main validation', async () => {
    const { client, calls } = fixture([candidate({ event: 'pull_request' })]);
    assert.equal(await ensureValidation('main', source, client), 11);
    assert.equal(calls.find(call => call.body).body.ref, 'main');
});

function pullFixture(options = {}) {
    const repo = { full_name: 'BinaryOutlook/binary-markdown' };
    const expected = { number: 20, branch: 'codex/auto-release-0.2.2-bbbbbbbbbbbb', source, base: 'b'.repeat(40) };
    const pull = { number: 20, state: 'open', user: { login: 'github-actions[bot]' },
        head: { ref: expected.branch, sha: source, repo }, base: { ref: 'main', sha: expected.base, repo }, ...options.pull };
    const run = candidate({ event: 'pull_request', head_branch: expected.branch, head_repository: repo,
        pull_requests: [{ number: 20 }], conclusion: 'action_required' });
    const writes = [];
    const client = {
        api(endpoint, body, method) {
            if (method) { writes.push({ endpoint, method }); return null; }
            if (endpoint === 'pulls/20') return pull;
            if (endpoint.includes('event=pull_request')) return { workflow_runs: [run] };
            if (endpoint === 'actions/runs/10') return { ...run, conclusion: options.conclusion || 'success' };
            throw new Error('Unexpected endpoint: ' + endpoint);
        },
        pages() { return jobs; },
        async pause() {},
    };
    return { expected, client, writes };
}
test('only the verified bot version PR receives workflow-run approval and regular PR CI', async () => {
    const { expected, client, writes } = pullFixture();
    assert.equal(await ensurePullValidation(expected, client), 10);
    assert.deepEqual(writes, [{ endpoint: 'actions/runs/10/approve', method: 'POST' }]);
});
test('human PRs, changed version commits and moved main receive no automatic approval', async () => {
    const repo = { full_name: 'BinaryOutlook/binary-markdown' };
    for (const pull of [{ user: { login: 'human' } },
        { head: { ref: 'codex/auto-release-0.2.2-bbbbbbbbbbbb', sha: 'c'.repeat(40), repo } },
        { base: { ref: 'main', sha: 'c'.repeat(40), repo } }]) {
        const { expected, client, writes } = pullFixture({ pull });
        await assert.rejects(ensurePullValidation(expected, client));
        assert.deepEqual(writes, []);
    }
});
test('a failed ordinary PR workflow stops before merging and is not retried', async () => {
    const { expected, client, writes } = pullFixture({ conclusion: 'failure' });
    await assert.rejects(ensurePullValidation(expected, client), /version PR failed validation/);
    assert.equal(writes.length, 1);
});
test('wrong-source dispatched results and skipped lanes are rejected', async () => {
    const changed = fixture([], { dispatched: { head_sha: 'b'.repeat(40) } });
    await assert.rejects(ensureValidation('main', source, changed.client));
    const skipped = fixture([candidate()], { jobs: jobs.map(job => job.name === 'Validate (windows)' ?
        { ...job, conclusion: 'skipped' } : job) });
    await assert.rejects(ensureValidation('main', source, skipped.client), /Every required lane/);
});
