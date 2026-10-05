'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
if (!process.env.GITHUB_ENV || !process.env.RUNNER_TEMP) throw new Error('Use a disposable Actions runner');
let browser;
if (process.platform === 'darwin') browser = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (process.platform === 'linux') {
    for (const name of ['google-chrome', 'chromium']) {
        try { browser = execFileSync('which', [name], { encoding: 'utf8' }).trim(); break; } catch { /* Try the next browser. */ }
    }
}
if (!browser || !fs.existsSync(browser)) {
    // Invoke the JS CLI directly so Windows needs neither cmd quoting nor a shell.
    execFileSync(process.execPath, [path.resolve('node_modules/playwright/cli.js'), 'install',
        ...(process.platform === 'linux' ? ['--with-deps'] : []), 'chromium'], { stdio: 'inherit' });
    browser = require('playwright-core').chromium.executablePath();
}
if (!fs.existsSync(browser)) throw new Error('Chromium browser is unavailable');
// Chromium's Windows GUI executable does not implement the POSIX --version
// exit path. Probing it synchronously there can hang before any tests run.
if (process.platform !== 'win32') execFileSync(browser, ['--version'], { stdio: 'inherit', timeout: 10000 });
fs.appendFileSync(process.env.GITHUB_ENV, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=${browser}\n`);
