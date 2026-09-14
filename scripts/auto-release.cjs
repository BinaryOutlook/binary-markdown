'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { planRelease, latestOfficialRelease, patchFiles, assertSameReleasePlan } = require('./release-policy.cjs');
const { verifyValidationJobs } = require('./release-candidate');
const { REPOSITORY, api, optionalApi, pages, git, currentMain, assertMain, assertRepository } = require('./release-github.cjs');
const { promote } = require('./promote-vsix.cjs');

const MANIFESTS = ['package.json', 'package-lock.json', 'electron/package.json', 'electron/package-lock.json'];
const VERSION_FILES = [...MANIFESTS, 'CHANGELOG.md', 'release-notes/README.md'];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const fileAt = (source, file) => git('show', `${source}:${file}`) + '\n';

function onlyVersionChanged(before, after) {
    const normalize = text => {
        const value = JSON.parse(text);
        delete value.version;
        if (value.packages?.['']) delete value.packages[''].version;
        return JSON.stringify(value);
    };
    return normalize(before) === normalize(after);
}

function inspect(config) {
    git('fetch', 'origin', 'main', '--tags');
    const source = currentMain();
    assert.equal(git('rev-parse', 'origin/main'), source, 'main moved while fetching; retry the check');
    const releases = pages('releases?per_page=100');
    const latest = latestOfficialRelease(releases);
    const version = JSON.parse(fileAt(source, 'package.json')).version;
    const changes = [];
    if (latest) {
        const base = git('rev-parse', `refs/tags/${latest.tag_name}^{commit}`);
        git('merge-base', '--is-ancestor', base, source);
        const commits = git('rev-list', '--first-parent', `${base}..${source}`).split('\n').filter(Boolean);
        for (const sha of commits) {
            const parent = git('rev-parse', `${sha}^1`);
            const files = git('diff', '--name-only', parent, sha).split('\n').filter(Boolean).filter(file => {
                if (!MANIFESTS.includes(file)) return true;
                return !onlyVersionChanged(fileAt(parent, file), fileAt(sha, file));
            });
            changes.push({ sha, files, message: git('show', '-s', '--format=%B', sha) });
        }
    }
    let hasNotes = false;
    try { hasNotes = fileAt(source, `release-notes/${version}.md`).trim().length > 0; } catch { /* A missing note blocks promotion. */ }
    return { ...planRelease({ config, releases, version, hasNotes, changes }), source };
}

function record(plan) {
    const { changes, ...summary } = plan;
    console.log(JSON.stringify(summary, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `\n### Automatic release decision\n\n${summary.reason}\n\n` +
        `- Main: \`${summary.source}\`\n- Selected version: \`${summary.version}\`\n` +
        `- Minimum interval: ${summary.minimumDays} days\n- Earliest eligibility: ${summary.eligibleAt || 'No published baseline'}\n` +
        `- Eligible: ${summary.eligible}\n`);
}

async function ensureValidation(branch, source, client = { api, pages, pause }) {
    const workflow = '.github/workflows/ci-vsix.yml';
    const runs = client.api(`actions/runs?head_sha=${source}&per_page=100`).workflow_runs.filter(run =>
        run.path === workflow && run.head_branch === branch && ['push', 'workflow_dispatch'].includes(run.event));
    let run = runs[0];
    const artifactsAvailable = candidate => {
        const artifacts = client.pages(`actions/runs/${candidate.id}/artifacts?per_page=100`, 'artifacts');
        const names = [`vsix-candidate-${source}-${candidate.run_attempt}`,
            ...['ubuntu', 'macos', 'windows', 'vscode-minimum'].map(lane => `validation-${lane}-${source}-${candidate.run_attempt}`)];
        return names.every(name => artifacts.some(artifact => artifact.name === name && !artifact.expired));
    };
    if (!run || (run.status === 'completed' && run.conclusion === 'success' && !artifactsAvailable(run))) {
        // GITHUB_TOKEN merges do not start push CI. An explicit dispatch keeps
        // the resulting main commit on the full validation path.
        const requestId = `release-${process.env.GITHUB_RUN_ID}-${Date.now()}`;
        client.api('actions/workflows/ci-vsix.yml/dispatches', { ref: branch,
            inputs: { request_id: requestId, expected_source: source } });
        const discoveryDeadline = Date.now() + 5 * 60000;
        run = null;
        while (Date.now() < discoveryDeadline) {
            run = client.api(`actions/runs?event=workflow_dispatch&head_sha=${source}&per_page=100`).workflow_runs.find(candidate =>
                candidate.path === workflow && candidate.head_branch === branch && candidate.display_title === `Validate VSIX (${requestId})`);
            if (run) break;
            await client.pause(10000);
        }
        assert.ok(run, 'The requested validation run did not appear');
    }
    console.log(`Waiting for full validation: https://github.com/${REPOSITORY}/actions/runs/${run.id}`);
    const deadline = Date.now() + 60 * 60000;
    while (run.status !== 'completed') {
        assert.ok(Date.now() < deadline, 'Validation did not finish within one hour');
        await client.pause(30000);
        run = client.api(`actions/runs/${run.id}`);
    }
    assert.equal(run.head_sha, source);
    assert.equal(run.head_branch, branch);
    assert.equal(run.conclusion, 'success', 'Validation failed; fix the source instead of automatically retrying failed tests');
    verifyValidationJobs(client.pages(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`, 'jobs'));
    assert.ok(artifactsAvailable(run), 'The successful validation run has incomplete or expired artifacts');
    return run.id;
}

function assertVersionPull(pull, expected) {
    assert.match(expected.branch, /^codex\/auto-release-\d+\.\d+\.\d+-[0-9a-f]{12}$/);
    assert.equal(pull.number, expected.number);
    assert.equal(pull.state, 'open');
    assert.equal(pull.user.login, 'github-actions[bot]', 'Only the scheduler\'s own version PR can run unattended');
    assert.equal(pull.head.repo.full_name, REPOSITORY);
    assert.equal(pull.base.repo.full_name, REPOSITORY);
    assert.equal(pull.head.ref, expected.branch);
    assert.equal(pull.head.sha, expected.source, 'The version PR was changed after its contents were verified');
    assert.equal(pull.base.ref, 'main');
    assert.equal(pull.base.sha, expected.base, 'main moved after the version PR was prepared');
}

async function ensurePullValidation(expected, client = { api, pages, pause }) {
    // workflow_dispatch checks do not satisfy PR protection. Approve the
    // regular PR workflow only after checking this exact generated version PR.
    const verifyPull = () => assertVersionPull(client.api(`pulls/${expected.number}`), expected);
    verifyPull();
    const discoveryDeadline = Date.now() + 5 * 60000;
    let run;
    while (Date.now() < discoveryDeadline) {
        run = client.api(`actions/runs?event=pull_request&head_sha=${expected.source}&per_page=100`).workflow_runs.find(candidate =>
            candidate.path === '.github/workflows/ci-vsix.yml' && candidate.head_branch === expected.branch &&
            candidate.head_sha === expected.source && candidate.head_repository?.full_name === REPOSITORY &&
            candidate.pull_requests.some(pull => pull.number === expected.number));
        if (run) break;
        await client.pause(10000);
    }
    assert.ok(run, 'The version PR validation run did not appear; inspect the PR workflow approval state');
    console.log(`Waiting for version PR validation: https://github.com/${REPOSITORY}/actions/runs/${run.id}`);
    const deadline = Date.now() + 60 * 60000;
    let approved = false;
    while (true) {
        if (run.conclusion === 'action_required' || run.status === 'action_required' || run.status === 'waiting') {
            if (!approved) {
                verifyPull();
                client.api(`actions/runs/${run.id}/approve`, undefined, 'POST');
                approved = true;
            }
        } else if (run.status === 'completed') break;
        assert.ok(Date.now() < deadline, 'Version PR validation did not finish within one hour');
        await client.pause(30000);
        run = client.api(`actions/runs/${run.id}`);
    }
    assert.equal(run.head_sha, expected.source);
    assert.equal(run.event, 'pull_request');
    assert.equal(run.conclusion, 'success', 'The version PR failed validation; inspect the failure instead of automatically retrying');
    verifyValidationJobs(client.pages(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`, 'jobs'));
    verifyPull();
    return run.id;
}

async function preparePatch(plan, config) {
    assertMain(plan.source);
    const fromVersion = JSON.parse(fileAt(plan.source, 'package.json')).version;
    const files = Object.fromEntries(VERSION_FILES.map(file => [file, fileAt(plan.source, file)]));
    const updated = patchFiles(files, fromVersion, plan.version, plan.changes);
    const base = api(`git/commits/${plan.source}`);
    const tree = api('git/trees', { base_tree: base.tree.sha,
        tree: Object.entries(updated).map(([file, content]) => ({ path: file, mode: '100644', type: 'blob', content })) });
    const branch = `codex/auto-release-${plan.version}-${plan.source.slice(0, 12)}`;
    const message = `chore: prepare automatic release v${plan.version}`;
    let reference = optionalApi(`git/ref/heads/${branch}`);
    if (reference) {
        const existing = api(`git/commits/${reference.object.sha}`);
        assert.equal(existing.tree.sha, tree.sha, 'Existing release branch has unexpected edits');
        assert.deepEqual(existing.parents.map(parent => parent.sha), [plan.source]);
        assert.equal(existing.message, message);
    } else {
        const commit = api('git/commits', { message, tree: tree.sha, parents: [plan.source] });
        reference = api('git/refs', { ref: 'refs/heads/' + branch, sha: commit.sha });
    }
    const head = reference.object.sha;
    let pull = api(`pulls?state=open&base=main&head=BinaryOutlook:${encodeURIComponent(branch)}`)[0];
    if (!pull) pull = api('pulls', { title: message, head: branch, base: 'main',
        body: `Prepare patch version **${plan.version}** after at least ${plan.minimumDays} days since the last official VSIX publication.\n\nThis bot PR updates only version metadata, the changelog and release notes. The automatic release workflow runs the full VSIX validation on this commit before merging, then validates the resulting main commit before publication.\n\nSource before the version bump: ${plan.source}.` });
    console.log('Prepared version PR: ' + pull.html_url);
    await ensurePullValidation({ number: pull.number, branch, source: head, base: plan.source });
    assertMain(plan.source);
    assertSameReleasePlan(plan, inspect(config));
    const freshPull = api(`pulls/${pull.number}`);
    assert.equal(freshPull.head.sha, head);
    assert.equal(freshPull.base.ref, 'main');
    const merged = api(`pulls/${pull.number}/merge`, { sha: head, merge_method: 'merge', commit_title: message }, 'PUT');
    assert.equal(merged.merged, true, 'Branch protection must allow the validated release PR');
    // No direct main pushes or branch-protection bypasses are used.
    return merged.sha;
}

async function main(mode) {
    assertRepository();
    assert.ok(['check', 'release'].includes(mode), 'Use check or release');
    const config = JSON.parse(fs.readFileSync('.github/release-policy.json', 'utf8'));
    let plan = inspect(config);
    record(plan);
    if (mode === 'check' || !plan.eligible) return plan;
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Publication runs only in GitHub Actions');
    assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only the main workflow may publish');
    if (plan.action === 'bump') {
        const source = await preparePatch(plan, config);
        plan = inspect(config);
        assert.equal(plan.source, source);
        assert.equal(plan.action, 'publish');
        assert.equal(plan.eligible, true, plan.reason);
    }
    const runId = await ensureValidation('main', plan.source);
    return promote({ runId, publish: true, beforePublish: async () => {
        const fresh = inspect(config);
        assertSameReleasePlan(plan, fresh);
    } });
}

if (require.main === module) main(process.argv[2] || 'check').catch(error => {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr));
    process.exitCode = 1;
});
module.exports = { main, inspect, onlyVersionChanged, ensureValidation, ensurePullValidation, assertVersionPull };
