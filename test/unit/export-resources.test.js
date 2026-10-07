const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { gzipSync, deflateSync, brotliCompressSync } = require('node:zlib');
const { createResourceLoader } = require('../../out/export/resources');

async function serverFixture(t, handler) {
    const sockets = new Set();
    const server = http.createServer(handler);
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => server.close(resolve));
    });
    return 'http://127.0.0.1:' + server.address().port;
}

test('remote resources follow redirects, decode compressed bytes and retain the job cache', async t => {
    const bytes = Buffer.from('synthetic image bytes');
    const encoders = { gzip: gzipSync, deflate: deflateSync, br: brotliCompressSync };
    const requests = [];
    const address = await serverFixture(t, (request, response) => {
        requests.push(request.url);
        assert.equal(request.headers.cookie, undefined);
        assert.equal(request.headers.authorization, undefined);
        if (request.url.startsWith('/redirect/')) {
            response.writeHead(302, { Location: request.url.replace('/redirect/', '/image/') }); response.end(); return;
        }
        const encoding = request.url.split('/').pop();
        response.writeHead(200, { 'Content-Type': 'image/png; charset=binary', 'Content-Encoding': encoding });
        response.end(encoders[encoding](bytes));
    });
    const load = createResourceLoader(new AbortController().signal);
    for (const encoding of Object.keys(encoders)) {
        const url = address + '/redirect/' + encoding;
        const resource = await load(url, '/synthetic/report.md');
        assert.deepEqual(resource.bytes, bytes);
        assert.equal(resource.mime, 'image/png');
        assert.equal(await load(url, '/synthetic/report.md'), resource);
    }
    assert.equal(requests.length, 6);
});

test('remote failures reject invalid redirects, redirect loops, credentials and HTTP errors', async t => {
    let requests = 0;
    const address = await serverFixture(t, (request, response) => {
        requests++;
        if (request.url === '/scheme') response.writeHead(302, { Location: 'file:///synthetic/image.png' });
        else if (request.url === '/loop') response.writeHead(302, { Location: '/loop' });
        else if (request.url === '/credentials') response.writeHead(302, { Location: address.replace('http://', 'http://synthetic:example@') + '/image' });
        else if (request.url === '/encoding') response.writeHead(200, { 'Content-Encoding': 'constructor' });
        else response.writeHead(404);
        response.end();
    });
    const load = createResourceLoader(new AbortController().signal);
    await assert.rejects(load(address + '/scheme', '/synthetic/report.md'), /Unsupported resource redirect scheme/);
    await assert.rejects(load(address + '/loop', '/synthetic/report.md'), /Too many resource redirects/);
    await assert.rejects(load(address + '/credentials', '/synthetic/report.md'), /must not contain credentials/);
    await assert.rejects(load(address + '/missing', '/synthetic/report.md'), /Resource request failed \(404\)/);
    await assert.rejects(load(address + '/encoding', '/synthetic/report.md'), /Unsupported resource content encoding/);
    const before = requests;
    await assert.rejects(load(address.replace('http://', 'http://synthetic:example@') + '/image', '/synthetic/report.md'), /must not contain credentials/);
    assert.equal(requests, before, 'Credential-bearing URLs make no request');
});

for (const headersSent of [false, true]) {
    test('cancelling a held resource closes its request ' + (headersSent ? 'during body loading' : 'before response headers'), { timeout: 10000 }, async t => {
        let received, closed;
        const started = new Promise(resolve => { received = resolve; });
        const ended = new Promise(resolve => { closed = resolve; });
        const address = await serverFixture(t, (request, response) => {
            request.on('close', closed);
            if (headersSent) { response.writeHead(200, { 'Content-Type': 'image/png' }); response.write('partial'); }
            received();
        });
        const abort = new AbortController();
        const pending = createResourceLoader(abort.signal)(address + '/image', '/synthetic/report.md');
        await started;
        await new Promise(resolve => setTimeout(resolve, 50));
        abort.abort();
        await assert.rejects(pending, error => error.name === 'AbortError');
        await ended;
    });
}

test('pending resource cancellation survives garbage collection in the host runtime', { timeout: 10000 }, async () => {
    const script = `
        const assert = require('node:assert/strict');
        const http = require('node:http');
        const { createResourceLoader } = require(${JSON.stringify(require.resolve('../../out/export/resources'))});
        (async () => {
            const sockets = new Set();
            let received, closed;
            const started = new Promise(resolve => { received = resolve; });
            const ended = new Promise(resolve => { closed = resolve; });
            const server = http.createServer(request => { request.on('close', closed); received(); });
            server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const watchdog = setTimeout(() => { console.error('Resource cancellation stayed pending'); process.exit(1); }, 5000);
            try {
                const abort = new AbortController();
                const pending = createResourceLoader(abort.signal)('http://127.0.0.1:' + server.address().port + '/image.png', '/synthetic/report.md');
                await started;
                await new Promise(resolve => setTimeout(resolve, 50)); global.gc();
                await new Promise(resolve => setTimeout(resolve, 50)); global.gc();
                abort.abort();
                await assert.rejects(pending, error => error.name === 'AbortError');
                await ended;
            } finally {
                clearTimeout(watchdog);
                for (const socket of sockets) socket.destroy();
                await new Promise(resolve => server.close(resolve));
            }
        })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    await promisify(execFile)(process.execPath, ['--expose-gc', '-e', script], { timeout: 8000 });
});
