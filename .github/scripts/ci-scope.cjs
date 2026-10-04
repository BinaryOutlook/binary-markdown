'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { validationMode } = require('../../scripts/ci-validation.cjs');

function changedPullFiles(event, source, git = args => execFileSync('git', args, { encoding: 'utf8' })) {
    const base = event.pull_request?.base?.sha;
    if (!/^[a-f0-9]{40}$/.test(base || '') || !/^[a-f0-9]{40}$/.test(source || '')) throw new Error('Missing PR comparison identity');
    if (git(['rev-parse', 'HEAD']).trim() !== source) throw new Error('Checkout differs from the triggering source');
    // Compare the complete checked-out merge result with its base, never just
    // the last commit. Depth 2 normally supplies this parent; otherwise fail full.
    const parents = git(['show', '-s', '--format=%P', 'HEAD']).trim().split(' ');
    if (!parents.includes(base)) throw new Error('The PR base is not a parent of the checked-out merge');
    return git(['diff', '--no-renames', '--name-only', '-z', base, source, '--']).split('\0').filter(Boolean);
}

if (require.main === module) {
    let files;
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
        try {
            files = changedPullFiles(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), process.env.GITHUB_SHA);
        } catch {
            console.log('PR comparison unavailable or ambiguous; requiring full validation.');
        }
    }
    const mode = validationMode(process.env.GITHUB_EVENT_NAME, process.env.GITHUB_REF || '', files);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Validation scope: **${mode}**. Main and explicit dispatches always require every platform and browser shard.\n`);
}
module.exports = { changedPullFiles };
