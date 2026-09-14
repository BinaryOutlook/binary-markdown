const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { windowsCli } = require('../utils/vscode-cli.cjs');

test('Windows CLI follows both flat and versioned official archive layouts', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-code-layout-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'bin'));
    const executable = path.join(root, 'Code.exe');
    fs.writeFileSync(executable, 'fixture');
    for (const prefix of ['', '0123456789/']) {
        const relative = prefix + 'resources/app/out/cli.js';
        const cli = path.join(root, relative);
        fs.mkdirSync(path.dirname(cli), { recursive: true });
        fs.writeFileSync(cli, 'fixture');
        fs.writeFileSync(path.join(root, 'bin/code.cmd'),
            '"%~dp0..\\Code.exe" "%~dp0..\\' + relative.replaceAll('/', '\\') + '" %*');
        assert.equal(windowsCli(executable), cli);
    }
    fs.writeFileSync(path.join(root, 'bin/code.cmd'), 'unrecognized launcher');
    assert.throws(() => windowsCli(executable), /Cannot locate/);
});
