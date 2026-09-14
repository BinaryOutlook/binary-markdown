'use strict';
const fs = require('node:fs');

// A VS Code file URI can change a Windows drive letter's casing. Compare
// actual directories, including short/long aliases, without broadly folding
// case-sensitive paths or accepting an unrelated workspace/profile.
function sameDirectory(left, right) {
    try {
        const a = fs.statSync(left, { bigint: true });
        const b = fs.statSync(right, { bigint: true });
        return a.isDirectory() && b.isDirectory() && a.dev === b.dev && a.ino === b.ino;
    } catch { return false; }
}

module.exports = { sameDirectory };
