'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { REPOSITORY, api, pages, assertRepository } = require('../../scripts/release-github.cjs');

const WORKFLOW = '.github/workflows/ci-vsix.yml';
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const defaultClient = { api, pages, pause, log: console.log };

function matchesPull(run, pull, workflowId) {
    return pull.state === 'open' && pull.base.repo.full_name === REPOSITORY &&
        run.repository?.full_name === REPOSITORY && run.workflow_id === workflowId &&
        run.path === WORKFLOW && run.event === 'pull_request' &&
        run.head_sha === pull.head.sha && run.head_branch === pull.head.ref &&
        run.head_repository?.id === pull.head.repo?.id;
}

function needsApproval(run) {
    // Do not approve environment deployments or retry failed tests.
    return run.conclusion === 'action_required' || run.status === 'action_required';
}

async function approveRun(candidate, pull, workflowId, client) {
    // Re-read both objects immediately before writing. Fork runs can have an
    // empty pull_requests array, so verify the live PR, SHA and repository IDs.
    const currentPull = client.api(`pulls/${pull.number}`);
    const run = client.api(`actions/runs/${candidate.id}`);
    if (!matchesPull(run, currentPull, workflowId) || !needsApproval(run)) return false;
    try {
        client.api(`actions/runs/${run.id}/approve`, undefined, 'POST');
    } catch (error) {
        // A maintainer or another controller event may have approved it first.
        // Only suppress the error when the run has actually left the gate.
        const fresh = client.api(`actions/runs/${run.id}`);
        if (needsApproval(fresh)) throw error;
        client.log(`CI run ${run.id} no longer needs approval.`);
        return false;
    }
    client.log(`Approved CI run ${run.id} for PR #${pull.number} at ${run.head_sha}.`);
    return true;
}

async function approvePull(number, workflowId, client, attempts = 1) {
    let approved = 0;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const pull = client.api(`pulls/${number}`);
        if (pull.state !== 'open' || pull.base.repo.full_name !== REPOSITORY || !pull.head.repo) return approved;
        assert.match(pull.head.sha, /^[0-9a-f]{40}$/);
        const runs = client.pages(`actions/workflows/${workflowId}/runs?event=pull_request&head_sha=${pull.head.sha}&per_page=100`, 'workflow_runs')
            .filter(run => matchesPull(run, pull, workflowId));
        for (const run of runs.filter(needsApproval)) {
            if (await approveRun(run, pull, workflowId, client)) approved++;
        }
        if (runs.length || attempt === attempts - 1) {
            if (!runs.length) client.log(`No CI run found yet for PR #${number}; the workflow_run event handles later arrivals.`);
            return approved;
        }
        // The PR event can arrive before GitHub creates its validation run.
        await client.pause(5000);
    }
    return approved;
}

async function approvePending(eventName, event, client = defaultClient) {
    assert.ok(['pull_request_target', 'workflow_run', 'workflow_dispatch'].includes(eventName), 'Unexpected controller event');
    const workflow = client.api('actions/workflows/ci-vsix.yml');
    assert.equal(workflow.path, WORKFLOW);
    assert.equal(workflow.state, 'active', 'Validate VSIX must be enabled');
    let approved = 0;
    if (eventName === 'pull_request_target') {
        assert.ok(Number.isSafeInteger(event.number) && event.number > 0, 'Invalid PR number');
        approved = await approvePull(event.number, workflow.id, client, 13);
    } else if (eventName === 'workflow_run') {
        assert.ok(Number.isSafeInteger(event.workflow_run?.id), 'Invalid workflow run');
        const run = client.api(`actions/runs/${event.workflow_run.id}`);
        if (run.workflow_id !== workflow.id || run.path !== WORKFLOW ||
            run.event !== 'pull_request' || !needsApproval(run)) return 0;
        for (const pull of client.pages('pulls?state=open&per_page=100')) {
            if (matchesPull(run, pull, workflow.id) && await approveRun(run, pull, workflow.id, client)) approved++;
        }
    } else {
        // Manual recovery also handles PRs that predate installation.
        for (const pull of client.pages('pulls?state=open&per_page=100')) {
            approved += await approvePull(pull.number, workflow.id, client);
        }
    }
    client.log(`CI approvals: ${approved}. PR reviews and merge decisions are unchanged.`);
    return approved;
}

async function main(eventName = process.env.GITHUB_EVENT_NAME, event) {
    assertRepository();
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run this controller in GitHub Actions');
    return approvePending(eventName, event ?? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
}

if (require.main === module) main().catch(error => {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr));
    process.exitCode = 1;
});

module.exports = { WORKFLOW, matchesPull, needsApproval, approvePending, main };
