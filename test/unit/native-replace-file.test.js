'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { replaceFile } = require('../native/replace-file.cjs');

test('native mailbox keeps atomic replacement across a transient Windows file lock', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-mailbox-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.join(root, 'receipt.tmp');
    const destination = path.join(root, 'receipt.json');
    fs.writeFileSync(source, '{"complete":true}');
    fs.writeFileSync(destination, '{"previous":true}');
    const rename = fs.renameSync;
    let attempts = 0;
    t.mock.method(fs, 'renameSync', (...args) => {
        if (++attempts < 3) throw Object.assign(new Error('temporary sharing violation'), { code: 'EPERM' });
        return rename(...args);
    });
    replaceFile(source, destination, 'win32');
    assert.equal(fs.readFileSync(destination, 'utf8'), '{"complete":true}');
    assert.equal(fs.existsSync(source), false);
});

test('native mailbox preserves permanent errors and bounds persistent Windows locks', t => {
    let attempts = 0;
    const missing = Object.assign(new Error('missing fixture'), { code: 'ENOENT' });
    t.mock.method(fs, 'renameSync', () => { attempts++; throw missing; });
    assert.throws(() => replaceFile('source', 'destination', 'win32'), error => error === missing);
    assert.equal(attempts, 1);
    const locked = Object.assign(new Error('persistent sharing violation'), { code: 'EPERM' });
    t.mock.method(fs, 'renameSync', () => { attempts++; throw locked; });
    assert.throws(() => replaceFile('source', 'destination', 'win32'), error => error === locked);
    assert.ok(attempts > 2);
});
