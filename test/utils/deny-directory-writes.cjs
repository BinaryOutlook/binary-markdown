'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Only use on a newly owned test directory. Return a restoration operation so
// assertion failures cannot leave a fixture inaccessible to cleanup.
function denyDirectoryWrites(directory) {
    if (process.platform !== 'win32') {
        const mode = fs.statSync(directory).mode & 0o777;
        fs.chmodSync(directory, mode & ~0o222);
        return () => fs.chmodSync(directory, mode);
    }
    const acl = args => execFileSync('icacls.exe', [directory, ...args], { stdio: 'pipe', timeout: 10000 });
    // Match Node's Windows mkdir permission fixture, using the language-neutral
    // Everyone SID so the denial also covers the installed extension host.
    // https://github.com/nodejs/node/blob/main/test/parallel/test-fs-mkdir-recursive-eaccess.js
    const principal = '*S-1-1-0';
    acl(['/deny', principal + ':(OI)(CI)(DE,DC,AD,WD)']);
    const restore = () => acl(['/remove:d', principal]);
    // A successful ACL command is insufficient evidence that writes are denied.
    // Check the same kind of directory creation that the export finalizer uses.
    let probe;
    try {
        probe = fs.mkdtempSync(path.join(directory, '.permission-probe-'));
    } catch (error) {
        if (['EACCES', 'EPERM'].includes(error.code)) return restore;
        restore();
        throw error;
    }
    restore();
    fs.rmSync(probe, { recursive: true, force: true });
    throw new Error('The Windows permission fixture still allows directory creation. ' +
        'Use native PowerShell without backup/restore privileges; elevated Git Bash can bypass ACLs.');
}

module.exports = { denyDirectoryWrites };
