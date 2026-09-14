'use strict';
const fs = require('node:fs');

// The native test's reader and Windows file scanners can briefly hold a receipt
// open. Preserve atomic replacement, with a short bound for sharing violations.
// This retries only the test mailbox operation, never a scenario or an export.
function replaceFile(source, destination, platform = process.platform) {
    const deadline = Date.now() + 2000;
    const delay = new Int32Array(new SharedArrayBuffer(4));
    while (true) {
        try { fs.renameSync(source, destination); return; }
        catch (error) {
            if (platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || Date.now() >= deadline) throw error;
            Atomics.wait(delay, 0, 0, 20);
        }
    }
}

module.exports = { replaceFile };
