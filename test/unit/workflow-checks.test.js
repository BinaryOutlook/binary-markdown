'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { verifyDownload } = require('../../scripts/check-workflows.cjs');

test('workflow checker archives are rejected when bytes or expected digests change', () => {
    const bytes = Buffer.from('verified checker archive fixture');
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.doesNotThrow(() => verifyDownload(bytes, digest, 'fixture'));
    assert.throws(() => verifyDownload(Buffer.concat([bytes, Buffer.from('tampered')]), digest, 'fixture'), /checksum mismatch/);
    assert.throws(() => verifyDownload(bytes, '0'.repeat(64), 'fixture'), /checksum mismatch/);
    assert.throws(() => verifyDownload(bytes, 'not a digest', 'fixture'));
});
