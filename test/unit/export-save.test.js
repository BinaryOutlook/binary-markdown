const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EditQueue } = require('../../out/export/edit-queue');

test('save barrier applies the final debounced revision before saving', async () => {
    const events = [];
    const queue = new EditQueue(async content => { events.push(content); }, 1000);
    queue.schedule('old');
    queue.schedule('last typed revision');
    await queue.flush();
    events.push('save');
    assert.deepEqual(events, ['last typed revision', 'save']);
    queue.dispose();
});

test('save barrier waits for an in-flight edit then applies the newest content', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const events = [];
    const queue = new EditQueue(async content => {
        if (content === 'first') { await gate; }
        events.push(content);
    });
    queue.schedule('first');
    const first = queue.flush();
    queue.schedule('second');
    const saved = queue.flush().then(() => events.push('save'));
    await Promise.resolve();
    assert.deepEqual(events, []);
    release();
    await Promise.all([first, saved]);
    assert.deepEqual(events, ['first', 'second', 'save']);
    queue.dispose();
});

test('failed apply prevents save success and a successful retry recovers', async () => {
    const queue = new EditQueue(async content => {
        if (content === 'fail') { throw new Error('apply refused'); }
    });
    queue.schedule('fail');
    await assert.rejects(queue.flush(), /apply refused/);
    queue.schedule('retry');
    await queue.flush();
    queue.dispose();
});
