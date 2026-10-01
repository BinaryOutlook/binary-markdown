'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const core = require('./core.cjs');

// No shell, account secrets, repository chat history, source tree, or inherited
// project instructions are copied into the evaluator's working directory.
async function evaluateGroup(root, packet, directory, index, options) {
    // Preserve the complete sealed packet for the builder and public history,
    // but keep earlier reviewers' prose out of the fresh visual judgment.
    // The digest identifies that original packet, not this context projection.
    const evaluationPacket = { ...packet, priorFailures: packet.priorFailures.map(({ id, caseId, criterionId, regionId }) => ({ id, caseId, criterionId, regionId })) };
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-markdown-section-review-'));
    fs.chmodSync(stage, 0o700);
    try {
        fs.writeFileSync(path.join(stage, 'packet.json'), JSON.stringify(evaluationPacket, null, 2), { mode: 0o600 });
        const attachments = [], mapping = [];
        for (const [index, image] of [...packet.references, ...packet.cases.flatMap(c => c.images)].entries()) {
            const name = 'image-' + String(index + 1).padStart(2, '0') + '.png';
            fs.copyFileSync(core.safePath(root, image.path), path.join(stage, name));
            attachments.push(path.join(stage, name));
            mapping.push({ attachment: name, repositoryPath: image.path, sha256: image.sha256 });
        }
        fs.copyFileSync(core.safePath(root, 'scripts/visual-review/verdict.schema.json'), path.join(stage, 'verdict.schema.json'));
        const prompt = fs.readFileSync(core.safePath(root, 'scripts/visual-review/evaluator-prompt.txt'), 'utf8')
            + '\n\nThis invocation contains only the listed case group of one section. Assess every supplied case and no omitted cases. The parent packet digest stays unchanged. New discrepancy IDs must begin with the uppercase case ID followed by a hyphen; retain any existing prior ID for that case.\n'
            + '\n\nAttached images in order:\n' + JSON.stringify(mapping, null, 2) + '\n\nSection evaluation context (packetDigest identifies the original sealed builder packet):\n' + JSON.stringify(evaluationPacket, null, 2);
        const args = ['exec', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only', '--skip-git-repo-check',
            '--cd', stage, '--output-schema', path.join(stage, 'verdict.schema.json'), '--output-last-message', path.join(stage, 'verdict.json')];
        for (const attachment of attachments) args.push('--image', attachment);
        args.push('-');
        const stem = directory + '/group-' + String(index + 1).padStart(3, '0');
        const log = core.safePath(root, stem + '.log');
        let logBytes = 0;
        const stream = fs.createWriteStream(log, { flags: 'wx', mode: 0o600 });
        const result = await new Promise(resolve => {
            const child = (options.spawn || spawn)(options.executable || process.env.VISUAL_REVIEW_CODEX || 'codex', args,
                { cwd: stage, stdio: ['pipe','pipe','pipe'], shell: false });
            let stopped = false;
            let forceTimer;
            const stop = () => { stopped = true; child.kill('SIGTERM'); forceTimer = setTimeout(() => child.kill('SIGKILL'), 2000); forceTimer.unref(); };
            const timer = setTimeout(stop, options.timeoutMs || 12 * 60 * 1000);
            timer.unref();
            const collect = chunk => {
                logBytes += chunk.length;
                if (logBytes > 4 * 1024 * 1024) { if (!stopped) stop(); }
                else stream.write(chunk);
            };
            child.stdout.on('data', collect); child.stderr.on('data', collect);
            child.on('error', () => { clearTimeout(timer); clearTimeout(forceTimer); resolve({ error: 'Evaluator executable could not start; inspect the ignored evaluator log' }); });
            child.on('close', code => { clearTimeout(timer); clearTimeout(forceTimer); resolve(code === 0 && !stopped ? {} : { error: stopped ? 'Evaluator exceeded time or output limit' : 'Evaluator process failed; inspect the ignored evaluator log' }); });
            child.stdin.on('error', () => {}); child.stdin.end(prompt);
        });
        await new Promise(resolve => stream.end(resolve));
        if (result.error) return { evaluation: null, error: result.error };
        const output = path.join(stage, 'verdict.json');
        let evaluation;
        try {
            if (!fs.existsSync(output) || fs.statSync(output).size > core.MAX_JSON) throw new Error('Missing or oversized evaluator output');
            fs.copyFileSync(output, core.safePath(root, stem + '-output.json'));
            evaluation = JSON.parse(fs.readFileSync(output, 'utf8'));
            core.validateVerdict(packet, evaluation);
            core.validateGroups(packet, { schemaVersion: 2, parentPacketDigest: packet.packetDigest,
                groups: [{ caseIds: packet.cases.map(c => c.id), evaluation, error: null }] });
        } catch (error) {
            return { evaluation: null, error: 'Evaluator output rejected: ' + error.message };
        }
        return { evaluation, error: null };
    } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
async function review(root, relative, options = {}) {
    const packet = core.loadPacket(root, relative), directory = path.posix.dirname(relative);
    if (fs.existsSync(core.safePath(root, directory + '/receipt.json')) || fs.existsSync(core.safePath(root, directory + '/groups.json'))) throw new Error('Iteration already evaluated; capture a new iteration');
    const records = { schemaVersion: 2, parentPacketDigest: packet.packetDigest, groups: [] };
    // Bound context as well as scope: at most two real states per fresh call.
    // Every state remains required; no score averaging or partial PASS occurs.
    for (const [index, group] of core.caseGroups(packet).entries()) {
        records.groups.push({ caseIds: group.cases.map(c => c.id), ...await evaluateGroup(root, group, directory, index, options) });
    }
    core.writeJson(root, directory + '/groups.json', records, true);
    try {
        return core.saveVerdict(root, relative, core.aggregateGroups(packet, records));
    } catch (error) {
        return core.saveVerdict(root, relative, null, 'Case-group review blocked: ' + error.message);
    }
}
module.exports = { review };
