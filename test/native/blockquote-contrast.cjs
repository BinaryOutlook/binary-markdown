'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const themes = ['github', 'sepia', 'minimal', 'things', 'perplexity', 'night', 'dark'];
const source = '> Ordinary quote with **strong**, *emphasis*, [a link](https://example.invalid), and `inline code`.\n>\n> > Nested quote.\n>\n> ```\n> plain code\n> ```\n>\n> ```javascript\n> const value = "hello";\n> ```\n\nAfter\n';

// Runs inside the real renderer, using its computed production CSS.
function measureQuotes() {
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return Array.from(document.querySelectorAll('.editor blockquote p, .editor blockquote strong, .editor blockquote em, .editor blockquote a, .editor blockquote p code')).map(element => {
        let background = element;
        while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
        const foreground = getComputedStyle(element).color;
        const backgroundColor = getComputedStyle(background).backgroundColor;
        const levels = [luminance(foreground), luminance(backgroundColor)].sort((a, b) => a - b);
        return { foreground, background: backgroundColor, contrast: (levels[1] + 0.05) / (levels[0] + 0.05) };
    });
}

async function blockquoteCases(h, owner, record) {
    const file = 'blockquote-contrast-' + Date.now() + '.md';
    const filePath = path.join(owner.workspace, file);
    fs.writeFileSync(filePath, source);
    const connection = await h.open(file);
    try {
        await connection.evaluate(`(() => { window.__quoteBeforeTheme = document.querySelector('#editor blockquote'); document.getElementById('editor').focus(); const r = document.createRange(); r.setStart(window.__quoteBeforeTheme.querySelector('p').firstChild, 3); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
        for (const theme of themes) {
            await h.driver({ action: 'config', key: 'theme', value: theme });
            await h.until(() => connection.evaluate(`document.documentElement.dataset.theme === ${JSON.stringify(theme)}`));
            assert.equal(await connection.evaluate(`window.__quoteBeforeTheme === document.querySelector('#editor blockquote') && getSelection().anchorOffset === 3`), true);
            const colors = await connection.evaluate(`(${measureQuotes.toString()})()`);
            assert.ok(colors.length >= 6 && colors.every(color => color.contrast >= 4.5), JSON.stringify({ theme, colors }));
            assert.equal(fs.readFileSync(filePath, 'utf8'), source);
            assert.ok(!(await h.driver({ action: 'inspect' })).documents.some(document => document.path === filePath && document.dirty));
            const html = await h.exportFile(connection, file, 'html');
            assert.ok(fs.readFileSync(html.outputPath, 'utf8').includes('.export-root{--blockquote-color:var(--text-color)}'));
            await h.workbench(page => page.screenshot({ path: path.join(owner.base, 'evidence', `quotes-${theme}.png`) }));
            record('blockquote-theme', { theme, colors, noReload: true, selectionPreserved: true, cleanSourcePreserved: true, html: html.outputPath });
        }
        for (const white of [true, false]) {
            await h.driver({ action: 'config', key: 'export.pdfWhiteBackground', value: white });
            const pdf = await h.exportFile(connection, file, 'pdf');
            const text = execFileSync(process.env.EXPORT_PDFTOTEXT_PATH || 'pdftotext', [pdf.outputPath, '-'], { encoding: 'utf8' });
            assert.ok(text.includes('Ordinary quote') && text.includes('Nested quote'));
            record('blockquote-pdf', { white, output: pdf.outputPath, quoteTextPresent: true });
        }
        const before = await connection.evaluate('window.htmlToMarkdown()');
        await connection.evaluate(`(() => { document.getElementById('editor').focus(); const r = document.createRange(); r.selectNodeContents(document.querySelector('#editor > p:last-child')); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
        await connection.send('Input.insertText', { text: ' edited' });
        await h.until(async () => (await h.driver({ action: 'inspect' })).documents.some(document => document.path === filePath && document.text.includes('edited')), 'typed edit reaches the host');
        await h.driver({ action: 'config', key: 'theme', value: 'github' });
        await h.until(() => connection.evaluate('document.documentElement.dataset.theme === "github"'));
        await connection.evaluate(`document.querySelector('[data-action="undo"]').click()`);
        assert.equal(await connection.evaluate('window.htmlToMarkdown()'), before);
        record('blockquote-theme-undo', { undoRestoresPreviousEdit: true, sourceDiskUnchanged: fs.readFileSync(filePath, 'utf8') === source });
    } finally { connection.close(); }
}

module.exports = { themes, source, measureQuotes, blockquoteCases };
