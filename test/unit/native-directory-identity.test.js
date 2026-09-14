'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { sameDirectory } = require('../native/directory-identity.cjs');

test('native directory identity accepts filesystem aliases and rejects different directories', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-directory-id-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const workspace = path.join(root, 'workspace');
    const other = path.join(root, 'other');
    const alias = path.join(root, 'alias');
    fs.mkdirSync(workspace);
    fs.mkdirSync(other);
    fs.symlinkSync(workspace, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(sameDirectory(workspace, alias), true);
    assert.equal(sameDirectory(workspace, other), false);
    assert.equal(sameDirectory(workspace, path.join(root, 'missing')), false);
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'fixture');
    assert.equal(sameDirectory(file, file), false);
    if (process.platform === 'win32') {
        const alternateDrive = workspace[0] === workspace[0].toUpperCase()
            ? workspace[0].toLowerCase() : workspace[0].toUpperCase();
        assert.equal(sameDirectory(workspace, alternateDrive + workspace.slice(1)), true);
    }
});
