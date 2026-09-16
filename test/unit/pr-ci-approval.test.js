'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { WORKFLOW, approvePending } = require('../../.github/scripts/approve-pr-ci.cjs');

const repository = { id: 1, full_name: 'BinaryOutlook/binary-markdown' };
const fork = { id: 2, full_name: 'contributor/binary-markdown' };
const source = 'a'.repeat(40);
const pull = (overrides = {}) => ({ number: 12, state: 'open', author_association: 'FIRST_TIME_CONTRIBUTOR',
    base: { repo: repository, ref: 'main' }, head: { sha: source, ref: 'feature', repo: fork }, ...overrides });
const run = (overrides = {}) => ({ id: 100, workflow_id: 10, path: WORKFLOW, event: 'pull_request',
    repository, head_repository: fork, head_branch: 'feature', head_sha: source,
    status: 'completed', conclusion: 'action_required', pull_requests: [], ...overrides });

function setup(options = {}) {
    const writes = [], waits = [], reads = [];
    let pullReads = 0, runReads = 0, listReads = 0;
    const client = {
        api(endpoint, body, method) {
            reads.push(endpoint);
            if (method) {
                assert.equal(method, 'POST');
                assert.equal(endpoint, 'actions/runs/100/approve');
                assert.equal(body, undefined);
                writes.push(endpoint);
                if (options.approvalError) throw options.approvalError;
                return null;
            }
            if (endpoint === 'actions/workflows/ci-vsix.yml') return { id: 10, path: WORKFLOW, state: 'active' };
            if (endpoint === 'pulls/12') return options.pulls?.[pullReads++] ?? options.pull ?? pull();
            if (endpoint === 'actions/runs/100') return options.freshRuns?.[runReads++] ?? options.run ?? run();
            assert.fail(`Unexpected API request: ${endpoint}`);
        },
        pages(endpoint, key) {
            if (endpoint === 'pulls?state=open&per_page=100') return [options.pull ?? pull()];
            assert.equal(endpoint, `actions/workflows/10/runs?event=pull_request&head_sha=${source}&per_page=100`);
            assert.equal(key, 'workflow_runs');
            return options.lists?.[listReads++] ?? [options.run ?? run()];
        },
        pause: async delay => { waits.push(delay); },
        log: () => {},
    };
    return { client, writes, waits, reads };
}

test('first-time fork contributors run CI without approving a PR or merging', async () => {
    const state = setup();
    assert.equal(await approvePending('pull_request_target', { number: 12 }, state.client), 1);
    assert.deepEqual(state.writes, ['actions/runs/100/approve']);
});

test('contributor history and draft status do not gate CI', async () => {
    for (const association of ['NONE', 'FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR', 'CONTRIBUTOR', 'OWNER']) {
        const state = setup({ pull: pull({ author_association: association, draft: true }) });
        assert.equal(await approvePending('pull_request_target', { number: 12 }, state.client), 1);
    }
});

test('only this repository workflow and exact current fork revision can be approved', async () => {
    for (const change of [{ workflow_id: 11 }, { path: '.github/workflows/release-vsix.yml' },
        { event: 'workflow_dispatch' }, { head_sha: 'b'.repeat(40) }, { head_branch: 'other' },
        { head_repository: { id: 3 } }, { repository: fork }]) {
        const state = setup({ run: run(change) });
        assert.equal(await approvePending('workflow_dispatch', {}, state.client), 0);
        assert.deepEqual(state.writes, []);
    }
});

test('a closed PR or changed head immediately before approval cancels the write', async () => {
    for (const changed of [pull({ state: 'closed' }), pull({ head: { sha: 'b'.repeat(40), ref: 'feature', repo: fork } })]) {
        const state = setup({ pulls: [pull(), changed] });
        assert.equal(await approvePending('pull_request_target', { number: 12 }, state.client), 0);
        assert.deepEqual(state.writes, []);
    }
});

test('closed PRs and deleted forks are left alone', async () => {
    for (const changed of [pull({ state: 'closed' }), pull({ head: { sha: source, ref: 'feature', repo: null } })]) {
        const state = setup({ pull: changed });
        assert.equal(await approvePending('workflow_dispatch', {}, state.client), 0);
        assert.deepEqual(state.writes, []);
    }
});

test('failed tests, completed checks and deployment waits are never retried or approved', async () => {
    for (const change of [{ conclusion: 'failure' }, { conclusion: 'success' }, { conclusion: 'cancelled' },
        { status: 'waiting', conclusion: null }, { status: 'queued', conclusion: null },
        { status: 'in_progress', conclusion: null }]) {
        const state = setup({ run: run(change) });
        assert.equal(await approvePending('workflow_dispatch', {}, state.client), 0);
        assert.deepEqual(state.writes, []);
    }
});

test('the PR handler waits for a delayed workflow run', async () => {
    const state = setup({ lists: [[], [], [run()]] });
    assert.equal(await approvePending('pull_request_target', { number: 12 }, state.client), 1);
    assert.deepEqual(state.waits, [5000, 5000]);
});

test('missing CI has a bounded wait, and merge conflicts do not keep the controller waiting', async () => {
    const absent = setup({ lists: Array.from({ length: 13 }, () => []) });
    assert.equal(await approvePending('pull_request_target', { number: 12 }, absent.client), 0);
    assert.equal(absent.waits.length, 12);
    const conflict = setup({ pull: pull({ mergeable: false }), lists: [[]] });
    assert.equal(await approvePending('pull_request_target', { number: 12 }, conflict.client), 0);
    assert.deepEqual(conflict.waits, []);
});

test('workflow_run handles a late approval gate even when the run has no PR association', async () => {
    const state = setup();
    assert.equal(await approvePending('workflow_run', { workflow_run: { id: 100 } }, state.client), 1);
    assert.deepEqual(state.writes, ['actions/runs/100/approve']);
});

test('successful workflow_run events cannot start additional CI', async () => {
    const state = setup({ run: run({ conclusion: 'success' }) });
    assert.equal(await approvePending('workflow_run', { workflow_run: { id: 100 } }, state.client), 0);
    assert.deepEqual(state.writes, []);
});

test('concurrent approval is harmless but persistent permission failures are reported', async () => {
    const error = new Error('Approval rejected');
    const state = setup({ approvalError: error, freshRuns: [run(), run({ status: 'queued', conclusion: null })] });
    assert.equal(await approvePending('workflow_dispatch', {}, state.client), 0);
    const denied = setup({ approvalError: error });
    await assert.rejects(approvePending('workflow_dispatch', {}, denied.client), error);
});

test('unrecognized events and untrusted PR numbers cannot select API endpoints', async () => {
    const state = setup();
    await assert.rejects(approvePending('pull_request', {}, state.client), /Unexpected controller event/);
    await assert.rejects(approvePending('pull_request_target', { number: '../reviews' }, state.client), /Invalid PR number/);
    assert.deepEqual(state.writes, []);
});
