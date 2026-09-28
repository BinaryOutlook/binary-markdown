'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const unitDirectory = path.resolve(__dirname, '../test/unit');

// Enumerate in Node so cmd.exe, PowerShell and POSIX shells select the same files.
function unitTestFiles(directory = unitDirectory) {
    const files = fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.test.js'))
        .map(entry => path.join(directory, entry.name)).sort();
    if (!files.length) throw new Error('No unit test files were discovered.');
    return files;
}

function runUnitTests({ directory = unitDirectory, args = [], stdio = 'inherit', env = process.env } = {}) {
    return spawnSync(process.execPath, ['--test', ...args, ...unitTestFiles(directory)], {
        stdio, encoding: 'utf8', env
    });
}

if (require.main === module) {
    try {
        const result = runUnitTests({ args: process.argv.slice(2) });
        if (result.error) console.error('Unable to start the unit test runner:', result.error.message);
        process.exitCode = result.status ?? 1;
    } catch (error) {
        console.error('Unable to discover unit tests:', error.message);
        process.exitCode = 1;
    }
}

module.exports = { unitTestFiles, runUnitTests };
