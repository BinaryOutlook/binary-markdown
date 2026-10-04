'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const tools = require('../.github/workflow-tools.json');
const root = path.resolve(__dirname, '..');

function verifyDownload(bytes, expected, name) {
    assert.match(expected, /^[0-9a-f]{64}$/);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, 'Checker download checksum mismatch: ' + name);
}

function installTool(name, directory, platform) {
    const tool = tools[name];
    const asset = tool.assets[platform];
    assert.ok(asset, 'Workflow checks support Linux/macOS x64/arm64; use Actions or WSL on Windows.');
    assert.match(tool.repository, /^[\w.-]+\/[\w.-]+$/);
    assert.match(tool.version, /^\d+\.\d+\.\d+$/);
    assert.match(asset.name, /^[\w.-]+\.tar\.gz$/);
    const archive = path.join(directory, asset.name);
    const url = `https://github.com/${tool.repository}/releases/download/v${tool.version}/${asset.name}`;
    execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--proto-redir', '=https', '--connect-timeout', '20', '--max-time', '120', '--output', archive, url], { stdio: 'inherit' });
    // Verify the complete archive before extracting or executing its contents.
    verifyDownload(fs.readFileSync(archive), asset.sha256, name);
    execFileSync('tar', ['-xzf', archive, '-C', directory, name], { stdio: 'inherit' });
    return path.join(directory, name);
}

function main() {
    const platform = process.platform + '-' + process.arch;
    assert.ok(Object.values(tools).every(tool => tool.assets[platform]), 'Workflow checks support Linux/macOS x64/arm64; use Actions or WSL on Windows.');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-workflow-checks-'));
    try {
        const actionlint = installTool('actionlint', directory, platform);
        const zizmor = installTool('zizmor', directory, platform);
        const workflows = fs.readdirSync(path.join(root, '.github/workflows')).filter(file => /\.ya?ml$/.test(file)).sort().map(file => '.github/workflows/' + file);
        // Both tools run even when the other finds a problem. Audits use local
        // files and no GitHub token; only pinned-tool downloads need networking.
        const checks = [
            [actionlint, workflows],
            [zizmor, ['--offline', '--strict-collection', '--no-progress', '.github']],
        ];
        let failed = false;
        for (const [binary, args] of checks) {
            const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit' });
            if (result.error) throw result.error;
            if (result.status !== 0) failed = true;
        }
        return failed ? 1 : 0;
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

if (require.main === module) {
    try { process.exitCode = main(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verifyDownload };
