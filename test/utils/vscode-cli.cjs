'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function windowsCli(executable) {
    assert.ok(path.isAbsolute(executable) && fs.existsSync(executable), 'Use an absolute isolated Code.exe path');
    const root = path.dirname(executable);
    // Follow the resource path declared by the official archive's launcher,
    // including newer versioned layouts, without executing a command shell.
    const launcher = fs.readFileSync(path.join(root, 'bin/code.cmd'), 'utf8');
    const match = /"%~dp0\.\.\\([^"\r\n]*resources\\app\\out\\cli\.js)"/i.exec(launcher);
    assert.ok(match, 'Cannot locate the CLI declared by this VS Code archive');
    const cli = path.resolve(root, ...match[1].split('\\'));
    const relative = path.relative(fs.realpathSync(root), fs.realpathSync(cli));
    assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
        'VS Code CLI must remain inside its isolated archive');
    assert.ok(fs.statSync(cli).isFile(), 'VS Code CLI is missing');
    return cli;
}

module.exports = { windowsCli };
if (require.main === module) process.stdout.write(windowsCli(process.argv[2]));
