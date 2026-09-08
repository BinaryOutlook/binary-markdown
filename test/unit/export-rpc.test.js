const assert = require('node:assert/strict');
const test = require('node:test');
const { ExportWebviewChannel } = require('../../out/export/webview-rpc');

test('export replies stay correlated to request and operation, including image validation', async () => {
    const messages = [];
    const channel = new ExportWebviewChannel(message => { messages.push(message); return Promise.resolve(true); });
    const snapshot = channel.request('captureExportSnapshot');
    const image = channel.request('validateExportImage', { dataUri: 'data:image/png;base64,fixture' });
    channel.receive({ type: 'exportSnapshot', requestId: messages[0].requestId, content: '# Saved', pending: false });
    channel.receive({ type: 'exportImageValidated', requestId: messages[1].requestId, valid: true });
    assert.equal((await snapshot).content, '# Saved');
    assert.equal((await image).valid, true);
    assert.equal(channel.pending.size, 0);
    channel.dispose();
});

test('wrong reply type and malformed image validation cannot satisfy an export request', async () => {
    const messages = [];
    const channel = new ExportWebviewChannel(message => { messages.push(message); return Promise.resolve(true); });
    const snapshot = channel.request('captureExportSnapshot');
    channel.receive({ type: 'exportPrepared', requestId: messages[0].requestId, html: '<p>Wrong operation</p>', warnings: [] });
    await assert.rejects(snapshot, /wrong export operation/);
    const image = channel.request('validateExportImage');
    channel.receive({ type: 'exportImageValidated', requestId: messages[1].requestId, valid: 'yes' });
    await assert.rejects(image, /invalid export response/);
    assert.equal(channel.pending.size, 0);
    channel.dispose();
});

test('synchronous, rejected and unavailable post results dispose request bookkeeping', async () => {
    for (const post of [
        () => { throw new Error('Synchronous close'); },
        () => Promise.reject(new Error('Rejected close')),
        () => Promise.resolve(false)
    ]) {
        const channel = new ExportWebviewChannel(post);
        await assert.rejects(channel.request('captureExportSnapshot'), /close|unavailable/);
        assert.equal(channel.pending.size, 0);
        channel.dispose();
    }
});

test('failed cancellation notifications do not escape or replace cancellation', async () => {
    for (const synchronous of [false, true]) {
        const channel = new ExportWebviewChannel(message => {
            if (message.type === 'cancelExportPreparation') {
                if (synchronous) { throw new Error('Panel closed'); }
                return Promise.reject(new Error('Panel closed'));
            }
            return Promise.resolve(true);
        });
        const controller = new AbortController();
        const pending = channel.request('prepareExport', {}, controller.signal);
        controller.abort();
        await assert.rejects(pending, { name: 'AbortError' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(channel.pending.size, 0);
        channel.dispose();
    }
});

test('disposing a panel rejects pending work and subsequent requests', async () => {
    const channel = new ExportWebviewChannel(() => Promise.resolve(true));
    const pending = channel.request('prepareExport');
    channel.dispose();
    await assert.rejects(pending, /closed/);
    await assert.rejects(channel.request('prepareExport'), /closed/);
    assert.equal(channel.pending.size, 0);
});
