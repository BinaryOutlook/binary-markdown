const { test } = require('node:test');
const assert = require('node:assert/strict');
const aux = require('../../src/shared/document-aux');

test('front matter preserves raw quotes, comments, order, BOM and CRLF', () => {
    const raw = '\uFEFF---\r\ntitle: "A: B"\r\ntags: [a, b] # keep me\r\ncustom:\r\n  key: value\r\n...\r\n';
    assert.deepEqual(aux.splitFrontMatter(raw + '\r\n# Body'), { raw, body: '\r\n# Body' });
    assert.equal(aux.splitFrontMatter('---\n# Comment only\n---\n').raw, '---\n# Comment only\n---\n');
});
test('ordinary rules and incomplete delimiters do not swallow body content', () => {
    for (const source of ['---\nAn introduction\n---\n# Body', '# Body\n---\ntitle: A\n---', '---\ntitle: Incomplete\n# Body']) {
        assert.deepEqual(aux.splitFrontMatter(source), { raw: '', body: source });
    }
});
test('TOC uses headings outside metadata, fences and generated regions', () => {
    const source = '---\ntitle: A\n# Hidden\n---\n\n[TOC]\n\n# **Overview**\n### Scope\n## Plan\n```md\n# Example\n[TOC]\n```\n~~~\n# Example 2\n~~~\n> # Quote\n    # Indented\n# 中文\n';
    const result = aux.refreshTocs(source);
    assert.ok(result.includes('- [Overview](#overview)\n  - [Scope](#scope)\n  - [Plan](#plan)\n- [中文](#中文)'));
    assert.ok(!result.includes('[Example](#example)'));
    assert.ok(result.includes('```md\n# Example\n[TOC]\n```'));
    assert.equal(aux.refreshTocs(result), result);
});
test('duplicate heading ids avoid collisions, including numbered source headings', () => {
    assert.deepEqual(aux.scan('# Results\n# Results\n# Results-1\n# Results\n# !!!').headings.map(h => h.id),
        ['results', 'results-1', 'results-1-1', 'results-2', 'section']);
});
test('refresh touches only explicit TOC regions and retains CRLF', () => {
    const source = '---\r\ntitle: "Report"\r\n---\r\n\r\n[toc]\r\n\r\n# One\r\n\r\n- [Manual](#one)\r\n';
    const refreshed = aux.refreshTocs(source);
    assert.ok(refreshed.startsWith('---\r\ntitle: "Report"\r\n---\r\n\r\n'));
    assert.ok(refreshed.endsWith('# One\r\n\r\n- [Manual](#one)\r\n'));
    assert.ok(!/(?<!\r)\n/.test(refreshed));
    assert.equal(aux.refreshTocs(refreshed), refreshed);
    const renamed = refreshed.replace('# One', '# Two');
    assert.throws(() => aux.assertFreshToc(renamed), /out of date/);
    assert.doesNotThrow(() => aux.assertFreshToc(aux.refreshTocs(renamed)));
});
test('incomplete or nested markers are rejected without guessing what to replace', () => {
    for (const source of [aux.START + '\n# Body', aux.END, aux.START + '\n' + aux.START + '\n' + aux.END]) {
        assert.throws(() => aux.refreshTocs(source), /TOC/);
    }
    assert.equal(aux.refreshTocs('```\n' + aux.START + '\n```'), '```\n' + aux.START + '\n```');
});
