'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// Only use on a newly owned test directory. Return a restoration operation so
// assertion failures cannot leave a fixture inaccessible to cleanup.
function denyDirectoryWrites(directory) {
    if (process.platform !== 'win32') {
        const mode = fs.statSync(directory).mode & 0o777;
        fs.chmodSync(directory, mode & ~0o222);
        return () => fs.chmodSync(directory, mode);
    }
    const sid = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { encoding: 'utf8', timeout: 10000 }).trim();
    if (!/^S-1-[\d-]+$/.test(sid)) throw new Error('Cannot identify the test user for a temporary directory ACL');
    const acl = args => execFileSync('icacls.exe', [directory, ...args], { stdio: 'pipe', timeout: 10000 });
    // Specify add-file and add-subdirectory rights explicitly. The export
    // finalizer first creates a staging directory beside the source file.
    acl(['/deny', '*' + sid + ':(OI)(CI)(WD,AD,WEA,WA)']);
    return () => acl(['/remove:d', '*' + sid]);
}

module.exports = { denyDirectoryWrites };
