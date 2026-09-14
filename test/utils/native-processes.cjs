'use strict';
const { execFileSync } = require('node:child_process');

function matchesOwnedProcess(command, owner, windows = process.platform === 'win32') {
    const argument = (name, value) => {
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(?:^|\\s)"?--' + name + '(?:=|"?\\s+)"?' + escaped + '"?(?=\\s|$)', windows ? 'i' : '');
    };
    return argument('user-data-dir', owner.profile).test(command) &&
        argument('extensionDevelopmentPath', owner.driver).test(command);
}

function processes() {
    if (process.platform === 'win32') {
        const json = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine)'],
        { encoding: 'utf8', timeout: 20000 });
        return JSON.parse(json).map(item => ({ pid: item.ProcessId, command: item.CommandLine || '' }));
    }
    return execFileSync('ps', ['-ax', '-o', 'pid=,command='], { encoding: 'utf8' }).split('\n').flatMap(line => {
        const match = line.trim().match(/^(\d+)\s+(.*)$/);
        return match ? [{ pid: Number(match[1]), command: match[2] }] : [];
    });
}

function stopOwnedProcesses(owner) {
    for (const processInfo of processes().filter(item => matchesOwnedProcess(item.command, owner))) {
        const pid = processInfo.pid;
        if (process.platform === 'win32') {
            // Taskkill owns only this verified test root and its descendants.
            try { execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'pipe', timeout: 20000 }); }
            catch (error) {
                if (processes().some(item => item.pid === pid && matchesOwnedProcess(item.command, owner))) throw error;
            }
            continue;
        }
        try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        const deadline = Date.now() + 5000;
        const delay = new Int32Array(new SharedArrayBuffer(4));
        while (Date.now() < deadline) {
            try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') break; throw error; }
            Atomics.wait(delay, 0, 0, 100);
        }
        if (processes().some(item => item.pid === pid && matchesOwnedProcess(item.command, owner))) {
            try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        }
    }
}

module.exports = { matchesOwnedProcess, stopOwnedProcesses };
