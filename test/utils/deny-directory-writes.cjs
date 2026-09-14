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
    // Keep diagnostics to access masks and inheritance flags, without printing
    // usernames, SIDs, machine names or the generated fixture path.
    let state;
    try {
        state = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            '$a = Get-Acl -LiteralPath $env:BINARY_TEST_ACL_DIRECTORY; ' +
            '$rules = @($a.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { ' +
            '[pscustomobject]@{ Everyone = ($_.IdentityReference.Value -eq "S-1-1-0"); ' +
            'Type = [string]$_.AccessControlType; Rights = [string]$_.FileSystemRights; ' +
            'Inherited = $_.IsInherited; Inheritance = [string]$_.InheritanceFlags; Propagation = [string]$_.PropagationFlags } }); ' +
            'ConvertTo-Json -Compress -InputObject $rules'], {
            encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, BINARY_TEST_ACL_DIRECTORY: directory }
        }).trim();
    } finally {
        restore();
        fs.rmSync(probe, { recursive: true, force: true });
    }
    throw new Error('The Windows permission fixture still allows directory creation; ACL=' + state);
}

module.exports = { denyDirectoryWrites };
