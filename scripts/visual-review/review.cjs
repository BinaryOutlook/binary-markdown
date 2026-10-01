'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const core = require('./core.cjs');

// No shell, account secrets, repository chat history, source tree, or inherited
// project instructions are copied into the evaluator's working directory.
async function review(root, relative, options = {}) {
    const packet = core.loadPacket(root, relative);
    const directory = path.posix.dirname(relative);
    if (fs.existsSync(core.safePath(root, directory + '/receipt.json'))) throw new Error('Iteration already evaluated; capture a new iteration');
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-markdown-section-review-'));
    fs.chmodSync(stage, 0o700);
    try {
        fs.writeFileSync(path.join(stage, 'packet.json'), JSON.stringify(packet, null, 2), { mode: 0o600 });
        const attachments = [], mapping = [];
        for (const [index, image] of [...packet.references, ...packet.cases.flatMap(c => c.images)].entries()) {
            const name = 'image-' + String(index + 1).padStart(2, '0') + '.png';
            fs.copyFileSync(core.safePath(root, image.path), path.join(stage, name));
            attachments.push(path.join(stage, name));
            mapping.push({ attachment: name, repositoryPath: image.path, sha256: image.sha256 });
        }
        fs.copyFileSync(core.safePath(root, 'scripts/visual-review/verdict.schema.json'), path.join(stage, 'verdict.schema.json'));
        const prompt = fs.readFileSync(core.safePath(root, 'scripts/visual-review/evaluator-prompt.txt'), 'utf8')
            + '\n\nAttached images in order:\n' + JSON.stringify(mapping, null, 2) + '\n\nSection packet:\n' + JSON.stringify(packet, null, 2);
        const args = ['exec', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only', '--skip-git-repo-check',
            '--cd', stage, '--output-schema', path.join(stage, 'verdict.schema.json'), '--output-last-message', path.join(stage, 'verdict.json')];
        for (const attachment of attachments) args.push('--image', attachment);
        args.push('-');
        const log = core.safePath(root, directory + '/evaluator.log');
        let logBytes = 0;
        const stream = fs.createWriteStream(log, { flags: 'wx', mode: 0o600 });
        const result = await new Promise(resolve => {
            const child = (options.spawn || spawn)(options.executable || process.env.VISUAL_REVIEW_CODEX || 'codex', args,
                { cwd: stage, stdio: ['pipe','pipe','pipe'], shell: false });
            let stopped = false;
            const timer = setTimeout(() => { stopped = true; child.kill('SIGTERM'); }, options.timeoutMs || 12 * 60 * 1000);
            timer.unref();
            const collect = chunk => {
                logBytes += chunk.length;
                if (logBytes > 4 * 1024 * 1024) { stopped = true; child.kill('SIGTERM'); }
                else stream.write(chunk);
            };
            child.stdout.on('data', collect); child.stderr.on('data', collect);
            child.on('error', () => { clearTimeout(timer); resolve({ error: 'Evaluator executable could not start; inspect the ignored evaluator log' }); });
            child.on('close', code => { clearTimeout(timer); resolve(code === 0 && !stopped ? {} : { error: stopped ? 'Evaluator exceeded time or output limit' : 'Evaluator process failed; inspect the ignored evaluator log' }); });
            child.stdin.on('error', () => {}); child.stdin.end(prompt);
        });
        await new Promise(resolve => stream.end(resolve));
        if (result.error) return core.saveVerdict(root, relative, null, result.error);
        const output = path.join(stage, 'verdict.json');
        let evaluation;
        try {
            if (!fs.existsSync(output) || fs.statSync(output).size > core.MAX_JSON) throw new Error('Missing or oversized evaluator output');
            fs.copyFileSync(output, core.safePath(root, directory + '/evaluator-output.json'));
            evaluation = JSON.parse(fs.readFileSync(output, 'utf8'));
            core.validateVerdict(packet, evaluation);
        } catch (error) {
            return core.saveVerdict(root, relative, null, 'Evaluator output rejected: ' + error.message);
        }
        return core.saveVerdict(root, relative, evaluation);
    } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
module.exports = { review };
