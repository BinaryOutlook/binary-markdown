'use strict';
// A fresh, sentinel-bound installation; no normal profile or arbitrary VS Code commands.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const workdir = path.join(root, '.vscode-test', 'ci-native-' + Date.now());
const results = path.join(root, 'ci-results');
fs.mkdirSync(results, { recursive: true });
assert.ok(process.env.EXPORT_VSIX_PATH && process.env.VALIDATION_CODE, 'Explicit candidate and isolated VS Code executable required');
const args = ['--workdir', workdir, '--package', path.resolve(process.env.EXPORT_VSIX_PATH),
    '--code', process.env.VALIDATION_CODE, '--pandoc', process.env.EXPORT_PANDOC_PATH,
    '--browser', process.env.EXPORT_BROWSER_PATH];
const run = command => execFileSync(process.execPath, ['test/native/export-smoke.cjs', command, ...args], { cwd: root, stdio: 'inherit' });
run('init');
const owner = JSON.parse(fs.readFileSync(path.join(workdir, '.binary-markdown-native-export.json'), 'utf8'));
const settingsFile = path.join(owner.profile, 'User/settings.json');
const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
// Only this newly created fixture profile skips interactive Workspace Trust.
settings['security.workspace.trust.enabled'] = false;
fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
try {
    run('install');
    run('launch');
    run('check');
    run('run');
    const reports = fs.readdirSync(path.join(workdir, 'evidence')).filter(name => /^native-\d+\.json$/.test(name));
    assert.equal(reports.length, 1);
    const report = JSON.parse(fs.readFileSync(path.join(workdir, 'evidence', reports[0]), 'utf8'));
    const formats = report.receipts.filter(receipt => receipt.name === 'format');
    assert.equal(formats.length, 16, 'All four frozen fixtures must export to every format');
    const receipts = path.join(results, 'formats.json');
    fs.writeFileSync(receipts, JSON.stringify(formats, null, 2));
    execFileSync(process.env.VALIDATION_PYTHON || 'python3', ['test/native/export-artifact-audit.py',
        '--receipts', receipts, '--output', path.join(results, 'artifact-audit.json')], { cwd: root, stdio: 'inherit' });
    require('../../test/native/assert-artifact-audit.cjs').assertArtifactAudit(
        JSON.parse(fs.readFileSync(path.join(results, 'artifact-audit.json'), 'utf8')),
        require('../../test/fixtures/exports/manifest.json'));
} finally {
    if (fs.existsSync(path.join(workdir, 'evidence'))) fs.cpSync(path.join(workdir, 'evidence'), path.join(results, 'native'), { recursive: true });
    // Match the exact newly owned profile argument, never a process name alone.
    const escaped = owner.profile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ownedArgument = new RegExp('(?:^|\\s)--user-data-dir(?:=|\\s+)' + escaped + '(?:\\s|$)');
    const processes = execFileSync('ps', ['-ax', '-o', 'pid=,command='], { encoding: 'utf8' });
    for (const line of processes.split('\n')) {
        const match = line.trim().match(/^(\d+)\s+(.*)$/);
        if (match && ownedArgument.test(match[2])) {
            try { process.kill(Number(match[1]), 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        }
    }
}
