'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesOwnedProcess } = require('../utils/native-processes.cjs');

test('Windows cleanup requires the exact isolated profile and driver, including quoted paths', () => {
    const owner = { profile: String.raw`C:\Temp\owned profile`, driver: String.raw`D:\work\driver` };
    assert.equal(matchesOwnedProcess(String.raw`Code.exe --user-data-dir="C:\Temp\owned profile" --extensionDevelopmentPath=D:\work\driver`, owner, true), true);
    assert.equal(matchesOwnedProcess(String.raw`Code.exe "--user-data-dir" "c:\temp\owned profile" "--extensionDevelopmentPath=D:\work\driver"`, owner, true), true);
    for (const command of [
        String.raw`Code.exe --user-data-dir="C:\Temp\owned profile-other" --extensionDevelopmentPath=D:\work\driver`,
        String.raw`Code.exe --user-data-dir="C:\Temp\owned profile" --extensionDevelopmentPath=D:\work\driver-other`,
        String.raw`Code.exe --user-data-dir="C:\Temp\owned profile"`,
        String.raw`Code.exe --extensionDevelopmentPath=D:\work\driver`
    ]) assert.equal(matchesOwnedProcess(command, owner, true), false);
});

test('POSIX cleanup keeps exact argument boundaries and treats path metacharacters literally', () => {
    const owner = { profile: '/tmp/bm-native-a.b', driver: '/tmp/work/driver' };
    assert.equal(matchesOwnedProcess('code --user-data-dir /tmp/bm-native-a.b --extensionDevelopmentPath=/tmp/work/driver', owner, false), true);
    assert.equal(matchesOwnedProcess('code --user-data-dir /tmp/bm-native-aXb --extensionDevelopmentPath=/tmp/work/driver', owner, false), false);
});
