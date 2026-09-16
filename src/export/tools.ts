import { spawn } from 'child_process';
import { constants } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { checkCancelled, ToolStatus } from './types';

interface ProcessResult {
    stdout: Buffer;
    stderr: string;
}

/** All converter invocations use argument arrays; document text is only stdin. */
export function runTool(executable: string, args: string[], options: {
    input?: string | Buffer;
    cwd?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
} = {}): Promise<ProcessResult> {
    if (options.signal) { checkCancelled(options.signal); }
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, {
            cwd: options.cwd,
            shell: false,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let outputSize = 0;
        let failure: Error | undefined;
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const stop = (error: Error): void => {
            if (failure) { return; }
            failure = error;
            child.kill('SIGTERM');
            // A converter may ignore SIGTERM; cancellation must still own its cleanup.
            killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
            killTimer.unref();
        };
        const abort = (): void => {
            const error = new Error('Export cancelled');
            error.name = 'AbortError';
            stop(error);
        };
        const collect = (chunks: Buffer[], chunk: Buffer): void => {
            outputSize += chunk.length;
            if (outputSize > 128 * 1024 * 1024) {
                stop(new Error('The export tool returned more diagnostic or intermediate data than can be handled safely.'));
            } else {
                chunks.push(chunk);
            }
        };
        child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
        child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
        child.stdin.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code !== 'EPIPE') { stop(error); }
        });
        child.on('error', error => { failure = failure || error; });
        child.on('close', (code, signal) => {
            if (killTimer) { clearTimeout(killTimer); }
            if (timeout) { clearTimeout(timeout); }
            options.signal?.removeEventListener('abort', abort);
            const diagnostic = Buffer.concat(stderr).toString('utf8').trim();
            if (failure) { reject(failure); }
            else if (code !== 0) {
                reject(new Error(`Export tool failed (${code ?? signal ?? 'unknown'}): ${diagnostic || 'no diagnostic was returned'}`));
            } else { resolve({ stdout: Buffer.concat(stdout), stderr: diagnostic }); }
        });
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) { abort(); }
        // Probe deadlines protect discovery from unrelated executables; exports have no duration target.
        if (options.timeoutMs) {
            timeout = setTimeout(() => stop(new Error('The executable did not respond to its capability check.')), options.timeoutMs);
            timeout.unref();
        }
        child.stdin.end(options.input);
    });
}

function expandPath(value: string): string {
    return value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;
}

function candidates(kind: ToolStatus['kind']): string[] {
    const windows = process.platform === 'win32';
    const names = windows ? (kind === 'pandoc' ? ['pandoc.exe'] : ['chrome.exe', 'msedge.exe', 'chromium.exe'])
        : kind === 'pandoc' ? ['pandoc'] : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'chrome'];
    const directories = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const paths = directories.flatMap(directory => names.map(name => path.resolve(directory, name)));
    if (windows) {
        const roots = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter((value): value is string => !!value);
        for (const root of roots) {
            if (kind === 'pandoc') { paths.push(path.join(root, 'Pandoc', 'pandoc.exe')); }
            else {
                paths.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                    path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                    path.join(root, 'Chromium', 'Application', 'chrome.exe'));
            }
        }
    } else if (kind === 'pandoc') {
        paths.push('/opt/homebrew/bin/pandoc', '/usr/local/bin/pandoc', '/usr/bin/pandoc');
    } else {
        for (const root of ['/Applications', path.join(os.homedir(), 'Applications')]) {
            paths.push(
                path.join(root, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
                path.join(root, 'Chromium.app/Contents/MacOS/Chromium'),
                path.join(root, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
            );
        }
    }
    return [...new Set(paths)];
}

// All editors share the extension host. Coalesce only overlapping Windows
// probes, including cleanup; later requests must recheck the executable.
const windowsBrowserProbes = new Map<string, Promise<string>>();

function probeWindowsBrowser(executable: string): Promise<string> {
    // Windows also supports case-sensitive directories. Do not conflate paths
    // that may name different executables in one of those directories.
    const key = executable;
    const pending = windowsBrowserProbes.get(key);
    if (pending) { return pending; }
    const probe = (async () => {
        const runtime = require(path.resolve(__dirname, '../../vendor/playwright-core')) as typeof import('playwright-core');
        let browser: import('playwright-core').Browser | undefined;
        try {
            browser = await runtime.chromium.launch({ executablePath: executable, headless: true, chromiumSandbox: true,
                timeout: 10000, args: ['--disable-updater-scheduler', '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND'] });
            return 'Chromium ' + browser.version();
        } finally {
            await browser?.close().catch(() => undefined);
        }
    })().finally(() => { windowsBrowserProbes.delete(key); });
    windowsBrowserProbes.set(key, probe);
    return probe;
}

/** Each caller can stop waiting without closing another editor's shared probe. */
function waitForBrowserProbe(probe: Promise<string>, signal?: AbortSignal): Promise<string> {
    if (!signal) { return probe; }
    return new Promise((resolve, reject) => {
        const abort = (): void => {
            try { checkCancelled(signal); } catch (error) { reject(error); }
        };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) { abort(); }
        // The bounded launch owns its cleanup even if every waiter cancels.
        // Handle both outcomes so cancellation cannot leave a rejected promise.
        void probe.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
}

async function probe(kind: ToolStatus['kind'], executable: string, signal?: AbortSignal): Promise<ToolStatus> {
    await fs.access(executable, constants.X_OK);
    if (!(await fs.stat(executable)).isFile()) { throw new Error('The configured path is not an executable file.'); }
    if (signal) { checkCancelled(signal); }
    if (kind === 'browser' && process.platform === 'win32') {
        // Windows GUI browsers do not reliably print --version to stdout.
        // Probe the same sandboxed runtime used by PDF export instead.
        const version = await waitForBrowserProbe(probeWindowsBrowser(executable), signal);
        if (signal) { checkCancelled(signal); }
        return { kind, available: true, path: executable, version };
    }
    const result = await runTool(executable, ['--version'], { signal, timeoutMs: 10000 });
    const version = result.stdout.toString('utf8').split(/\r?\n/)[0].trim();
    if (kind === 'pandoc') {
        if (!/^pandoc\s+\d+\.\d+/i.test(version)) { throw new Error('This executable did not identify itself as Pandoc.'); }
        const readers = await runTool(executable, ['--list-input-formats'], { signal, timeoutMs: 10000 });
        const writers = await runTool(executable, ['--list-output-formats'], { signal, timeoutMs: 10000 });
        const extensions = await runTool(executable, ['--list-extensions=commonmark_x'], { signal, timeoutMs: 10000 });
        const supported = (buffer: Buffer, name: string): boolean => buffer.toString('utf8').split(/\r?\n/).includes(name);
        if (!supported(readers.stdout, 'commonmark_x') || !supported(readers.stdout, 'json') ||
            !supported(writers.stdout, 'json') || !supported(writers.stdout, 'docx') || !supported(writers.stdout, 'epub') ||
            !/^[+-]tex_math_gfm\s*$/m.test(extensions.stdout.toString('utf8'))) {
            throw new Error('Pandoc needs the commonmark_x reader with tex_math_gfm, JSON, DOCX, and EPUB support. Update Pandoc and retry.');
        }
    } else if (!/(?:Google Chrome|Chromium|Microsoft Edge|Chrome for Testing)\s+\d+\./i.test(version)) {
        throw new Error('This executable did not identify itself as a supported Chrome, Chromium, or Edge browser.');
    }
    return { kind, available: true, path: executable, version };
}

export async function discoverTool(kind: ToolStatus['kind'], override: string, signal?: AbortSignal): Promise<ToolStatus> {
    if (signal) { checkCancelled(signal); }
    if (override.trim()) {
        const configured = expandPath(override.trim());
        try {
            if (!path.isAbsolute(configured)) { throw new Error('Use an absolute executable path.'); }
            return await probe(kind, configured, signal);
        } catch (error) {
            if (signal) { checkCancelled(signal); }
            return { kind, available: false, path: configured, error: `Configured ${kind} path is unusable: ${error instanceof Error ? error.message : String(error)}` };
        }
    }
    let lastFailure: string | undefined;
    for (const executable of candidates(kind)) {
        if (signal) { checkCancelled(signal); }
        try { return await probe(kind, executable, signal); }
        catch (error) {
            if (signal) { checkCancelled(signal); }
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                lastFailure = error instanceof Error ? error.message : String(error);
            }
        }
    }
    return { kind, available: false, error: lastFailure || `No usable ${kind === 'pandoc' ? 'Pandoc' : 'Chrome, Chromium, or Edge browser'} was found. Install one or configure its executable path.` };
}
