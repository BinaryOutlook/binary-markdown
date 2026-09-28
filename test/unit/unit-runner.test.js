'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { unitTestFiles, runUnitTests } = require('../../scripts/run-unit-tests.cjs');

// Fixture runners are independent of this test worker's internal IPC context.
const fixtureEnvironment = { ...process.env };
delete fixtureEnvironment.NODE_TEST_CONTEXT;

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unit runner '));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

test('unit discovery includes new suites and excludes helpers and directories', t => {
    const directory = fixture(t);
    fs.writeFileSync(path.join(directory, 'existing.test.js'), "require('node:test')('existing suite', () => {});\n");
    fs.writeFileSync(path.join(directory, 'helper.js'), "throw new Error('helper must not execute');\n");
    fs.mkdirSync(path.join(directory, 'nested.test.js'));
    fs.writeFileSync(path.join(directory, 'new suite.test.js'), "require('node:test')('newly discovered suite', () => {});\n");
    assert.deepEqual(unitTestFiles(directory).map(file => path.basename(file)), ['existing.test.js', 'new suite.test.js']);
    const result = runUnitTests({ directory, stdio: 'pipe', env: fixtureEnvironment });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /newly discovered suite/);
    assert.match(result.stdout, /existing suite/);
});

test('unit entry point reports failed suites and empty discovery as failures', t => {
    const directory = fixture(t);
    assert.throws(() => unitTestFiles(directory), /No unit test files/);
    fs.writeFileSync(path.join(directory, 'failure.test.js'), "require('node:test')('intentional failure', () => { throw new Error('fixture failure'); });\n");
    const result = runUnitTests({ directory, stdio: 'pipe', env: fixtureEnvironment });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /fixture failure/);
});
