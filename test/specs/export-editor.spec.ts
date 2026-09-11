import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { prepareStandaloneHtml } from '../../src/export/html';
import { createResourceLoader } from '../../src/export/resources';

type ExportTestWindow = Window & {
    __testApi: { ready: boolean; setMarkdown(markdown: string): void; messages: Array<Record<string, any>> };
    __hostMessageHandler(message: Record<string, unknown>): void;
    __exportIdleCallbacks?: Array<() => void>;
};

async function sendHost(page: Page, message: Record<string, unknown>) {
    await page.evaluate(message => (window as unknown as ExportTestWindow).__hostMessageHandler(message), message);
}
async function messages(page: Page, type: string) {
    return page.evaluate(type => (window as unknown as ExportTestWindow).__testApi.messages.filter(message => message.type === type), type);
}
async function setMarkdown(page: Page, markdown: string) {
    await page.evaluate(markdown => (window as unknown as ExportTestWindow).__testApi.setMarkdown(markdown), markdown);
}
async function save(page: Page) {
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })));
}
async function sourceInput(page: Page, content: string) {
    // The legacy standalone fixture uses a div for sourceEditor. Its value/input
    // boundary still exercises the production source-mode handler; native tests
    // separately exercise the real textarea and VS Code save lifecycle.
    await page.evaluate(content => {
        const source = document.getElementById('sourceEditor') as HTMLTextAreaElement;
        source.value = content;
        source.dispatchEvent(new Event('input', { bubbles: true }));
    }, content);
}

test.describe('Export saved snapshot agreement', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForFunction(() => (window as unknown as ExportTestWindow).__testApi?.ready);
    });

    test('captures untouched Markdown exactly without source, selection or undo mutation', async ({ page }) => {
        const original = '1. original numbering\n3. preserved numbering\n\n\n';
        await setMarkdown(page, original);
        const html = await page.locator('#editor').innerHTML();
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'untouched' });
        expect(await messages(page, 'exportSnapshot')).toEqual([{ type: 'exportSnapshot', requestId: 'untouched', content: original, pending: false }]);
        expect(await messages(page, 'edit')).toEqual([]);
        expect(await messages(page, 'save')).toEqual([]);
        expect(await page.locator('#editor').innerHTML()).toBe(html);
    });

    test('save in source mode sends latest textarea content and preserves it until acknowledged', async ({ page }) => {
        await setMarkdown(page, 'Old visual content\n');
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, 'Latest source content\n');
        await save(page);
        const [request] = await messages(page, 'save');
        expect(request.content).toBe('Latest source content\n');
        expect(request.revision).toBeGreaterThan(0);
        expect(await messages(page, 'edit')).toEqual([]);
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'saving' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Latest source content\n', pending: true });
        await sendHost(page, { type: 'saveResult', revision: request.revision, success: true });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'saved' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Latest source content\n', pending: false });
    });

    test('an older successful save cannot clear a newer edit', async ({ page }) => {
        await setMarkdown(page, 'Initial\n');
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, 'First revision\n');
        await save(page);
        const [firstSave] = await messages(page, 'save');
        await sourceInput(page, 'Second revision\n');
        await sendHost(page, { type: 'saveResult', revision: firstSave.revision, success: true });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'newer' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Second revision\n', pending: true });
        await save(page);
        expect((await messages(page, 'save')).at(-1)).toMatchObject({ content: 'Second revision\n' });
        expect((await messages(page, 'save')).at(-1)?.revision).toBeGreaterThan(firstSave.revision);
    });

    test('native documentSaved clears only the matching current source revision', async ({ page }) => {
        await setMarkdown(page, 'Initial\n');
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, 'Saved natively\n');
        await sendHost(page, { type: 'documentSaved', content: 'Saved natively\r\n' });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'native-saved' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Saved natively\n', pending: false });
        await sourceInput(page, 'Newer unsaved source\n');
        await sendHost(page, { type: 'documentSaved', content: 'Saved natively\n' });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'native-stale' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Newer unsaved source\n', pending: true });
    });

    test('failed save retains the current edit for a retry', async ({ page }) => {
        await setMarkdown(page, 'Initial\n');
        await page.locator('#editor').fill('Unsaved visual text');
        await save(page);
        const [request] = await messages(page, 'save');
        await sendHost(page, { type: 'saveResult', revision: request.revision, success: false });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'failed' });
        expect((await messages(page, 'exportSnapshot')).at(-1)?.content).toContain('Unsaved visual text');
        await save(page);
        expect((await messages(page, 'save')).at(-1)?.content).toBe(request.content);
    });

    test('save invalidates an already queued idle serialization callback', async ({ page }) => {
        await page.clock.install();
        await page.evaluate(() => {
            const testWindow = window as unknown as ExportTestWindow;
            testWindow.__exportIdleCallbacks = [];
            window.requestIdleCallback = callback => {
                testWindow.__exportIdleCallbacks!.push(() => callback({ didTimeout: false, timeRemaining: () => 20 }));
                return testWindow.__exportIdleCallbacks!.length;
            };
        });
        await setMarkdown(page, 'Initial\n');
        await page.locator('#editor').fill('Saved visual revision');
        await page.clock.runFor(1001);
        expect(await page.evaluate(() => (window as unknown as ExportTestWindow).__exportIdleCallbacks!.length)).toBeGreaterThan(0);
        await save(page);
        const [request] = await messages(page, 'save');
        await sendHost(page, { type: 'saveResult', revision: request.revision, success: true });
        const editCount = (await messages(page, 'edit')).length;
        await page.evaluate(() => (window as unknown as ExportTestWindow).__exportIdleCallbacks!.forEach(callback => callback()));
        expect((await messages(page, 'edit')).length).toBe(editCount);
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'after-idle' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: request.content, pending: false });
    });
});

async function prepare(page: Page, markdown: string, requestId = 'render', appearance: { theme?: string; fontSize?: number } = {}) {
    await sendHost(page, { type: 'prepareExport', requestId, markdown, ...appearance });
    await expect.poll(async () => (await messages(page, 'exportPrepared')).some(message => message.requestId === requestId)).toBe(true);
    return (await messages(page, 'exportPrepared')).find(message => message.requestId === requestId)!;
}

test.describe('Export document-only rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForFunction(() => (window as unknown as ExportTestWindow).__testApi?.ready);
        await page.addScriptTag({ url: '/vendor/katex.min.js' });
    });

    test('renders captured input in source mode without replacing the live document', async ({ page }) => {
        await setMarkdown(page, '# Live editor\n\nKeep this document unchanged.\n');
        const beforeHtml = await page.locator('#editor').innerHTML();
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, '# Continued source edit\n');
        const rendered = await prepare(page, '# Captured revision\n\n| First | Last |\n| --- | --- |\n| complete | content |\n\n```javascript\nconst value = 3;\n```\n');
        expect(rendered.html).toContain('Captured revision');
        expect(rendered.html).toContain('<table>');
        expect(rendered.html).toContain('hljs-');
        expect(rendered.html).not.toContain('Continued source edit');
        expect(rendered.html).not.toMatch(/contenteditable|code-copy-btn|code-block-header|<script/i);
        expect(await page.locator('#editor').innerHTML()).toBe(beforeHtml);
        expect(await page.locator('#editor').isVisible()).toBe(false);
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'after-render' });
        expect((await messages(page, 'exportSnapshot')).at(-1)?.content).toBe('# Continued source edit\n');
        expect(await page.locator('.export-preparation').count()).toBe(0);
    });

    test('waits for real math and Mermaid SVG and returns diagram source', async ({ page }) => {
        const source = 'graph TD\n  A[First] --> B[Last]';
        const rendered = await prepare(page, '# Before diagram\n\n```math\nx^2 + y^2 = z^2\n```\n\n```mermaid\n' + source + '\n```\n\nAfter diagram\n');
        expect(rendered.html).toContain('Before diagram');
        expect(rendered.html).toContain('After diagram');
        expect(rendered.html).toContain('katex');
        expect(rendered.html).toContain('<svg');
        expect(rendered.html).not.toContain('foreignObject');
        expect(rendered.diagrams).toHaveLength(1);
        expect(rendered.diagrams[0].source).toBe(source);
        expect(rendered.diagrams[0].svg).toContain('<svg');
        expect(rendered.warnings).toEqual([]);
        expect(await page.locator('.export-preparation').count()).toBe(0);
    });

    for (const theme of ['github', 'sepia', 'night', 'dark', 'minimal', 'things', 'perplexity']) {
        test(`captured PDF appearance renders readable white output from ${theme} without changing the editor`, async ({ page, context }) => {
            await page.evaluate(theme => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.setProperty('--font-size', '24px');
            }, theme);
            await setMarkdown(page, '# Live document\n\n```mermaid\ngraph LR; A[Live] --> B[Editor]\n```\n');
            await expect(page.locator('#editor .mermaid-diagram svg')).toHaveCount(1);
            const before = await page.locator('#editor').innerHTML();
            const config = () => page.evaluate(() => JSON.stringify((window as any).mermaid.mermaidAPI.getConfig()));
            const previousConfig = await config();
            const source = '# Export heading\n\nReadable body.\n\n> Readable quotation.\n\n[Readable link](https://example.com)\n\n```javascript\nconst value = "readable";\n```\n\n```math\nx^2 + y^2 = z^2\n```\n\n```mermaid\ngraph LR; A[First label] -->|Edge label| B[Last label]\n```\n';
            for (const exportTheme of ['github', theme].filter((value, index, all) => all.indexOf(value) === index)) {
                const rendered = await prepare(page, source, 'appearance-' + exportTheme, { theme: exportTheme, fontSize: 19 });
                expect(rendered).toMatchObject({ theme: exportTheme, fontSize: 19, warnings: [] });
                expect(rendered.diagrams).toHaveLength(1);
                expect(await config()).toBe(previousConfig);
                expect(await page.locator('#editor').innerHTML()).toBe(before);
                expect(await page.locator('html').getAttribute('data-theme')).toBe(theme);
                expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-size'))).toBe('24px');
                const signal = new AbortController().signal;
                const html = await prepareStandaloneHtml({
                    sourcePath: path.resolve(__dirname, '../fixtures/exports/basic.md'), markdown: source, version: 1,
                    theme: exportTheme, fontSize: 19
                }, rendered as any, path.resolve(__dirname, '../..'), {
                    signal, report() {}, warnings: [],
                    loadResource: async () => { throw new Error('Offline fixture uses system fonts'); }
                });
                const exported = await context.newPage();
                try {
                    await exported.setContent(html);
                    await expect(exported.locator('.katex')).toHaveCount(1);
                    const colors = await exported.evaluate(() => {
                        const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
                        return {
                            background: style('body').backgroundColor, fontSize: style('body').fontSize,
                            text: ['h1', 'p', 'blockquote', 'a', '.hljs-keyword', '.hljs-string', '.katex'].map(selector => style(selector).color),
                            node: style('svg .node rect').fill,
                            labels: Array.from(document.querySelectorAll('svg text')).map(text => ({ text: text.textContent, fill: getComputedStyle(text).fill }))
                        };
                    });
                    // Things intentionally renders one pixel below the base
                    // size; white mode uses the captured base size unchanged.
                    expect(colors.fontSize).toBe(exportTheme === 'things' ? '18px' : '19px');
                    expect(colors.labels.map(label => label.text).join(' ')).toMatch(/First label.*Last label|Last label.*First label/);
                    expect(colors.labels.map(label => label.text).join(' ')).toContain('Edge label');
                    expect(colors.node).toBe(['dark', 'night'].includes(exportTheme) ? 'rgb(31, 32, 32)' : 'rgb(236, 236, 255)');
                    if (exportTheme === 'github') {
                        expect(colors.background).toBe('rgb(255, 255, 255)');
                        for (const color of [...colors.text, ...colors.labels.map(label => label.fill)]) {
                            const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
                                const channel = value / 255;
                                return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
                            });
                            const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
                            expect(1.05 / (luminance + 0.05), 'Readable light export foreground: ' + color).toBeGreaterThanOrEqual(4.5);
                        }
                    }
                } finally { await exported.close(); }
            }
        });
    }

    test('discloses dollar math, TOC and footnotes retained as visible renderer source', async ({ page }) => {
        const source = '# Literal notation\n\nInline $x^2$ and $y$.\n\n$$\nE = mc^2\n$$\n\n[TOC]\n\nText with a footnote.[^note]\n\n[^note]: Footnote body.\n';
        await setMarkdown(page, source);
        const originalHtml = await page.locator('#editor').innerHTML();
        const rendered = await prepare(page, source);
        expect(rendered.html).toContain('$x^2$');
        expect(rendered.html).toContain('$y$');
        expect(rendered.html).toContain('$$');
        expect(rendered.html).toContain('[TOC]');
        expect(rendered.html).toContain('[^note]');
        expect(rendered.html).not.toContain('katex');
        expect(rendered.warnings.map((warning: { code: string }) => warning.code)).toEqual([
            'renderer-math-source', 'renderer-toc-source', 'renderer-footnote-source'
        ]);
        expect(await page.locator('#editor').innerHTML()).toBe(originalHtml);
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'literal-source-unchanged' });
        expect((await messages(page, 'exportSnapshot')).at(-1)?.content).toBe(source);
    });

    test('does not label code examples, currency or escaped dollar signs as unsupported mathematics', async ({ page }) => {
        const source = 'Prices are $5 and $10. Escaped \\$x\\$ remains text.\n\n`$x$ [TOC] [^note]`\n\n```text\n$$ x $$\n[TOC]\n[^note]: Example\n```\n';
        const rendered = await prepare(page, source);
        expect(rendered.warnings).toEqual([]);
    });

    test('supplementary native math fixture embeds KaTeX fonts and renders standalone offline', async ({ page, context }) => {
        const fixturePath = path.resolve(__dirname, '../fixtures/exports/renderer-native-math.md');
        const sourceText = fs.readFileSync(fixturePath, 'utf8');
        const rendered = await prepare(page, sourceText);
        expect(rendered.warnings).toEqual([]);
        const signal = new AbortController().signal;
        const operations = { signal, report() {}, warnings: [], loadResource: createResourceLoader(signal) };
        const html = await prepareStandaloneHtml({
            sourcePath: fixturePath, markdown: sourceText, version: 1, theme: 'github', fontSize: 16
        }, {
            html: rendered.html, diagrams: rendered.diagrams, warnings: rendered.warnings, theme: 'github', fontSize: 16
        }, path.resolve(__dirname, '../..'), operations);
        expect(operations.warnings).toEqual([]);
        expect(html).toContain('data:font/woff2;base64,');
        expect(html).not.toMatch(/url\(["']?(?:https?:|fonts\/)/i);
        const standalone = await context.newPage();
        const attemptedRequests: string[] = [];
        await standalone.route('**/*', route => { attemptedRequests.push(route.request().url()); return route.abort(); });
        try {
            await standalone.setContent(html, { waitUntil: 'load' });
            await standalone.evaluate(() => document.fonts.ready);
            await expect(standalone.locator('.katex')).toHaveCount(2);
            await expect(standalone.locator('.katex-error,.math-error')).toHaveCount(0);
            await expect(standalone.locator('body')).toContainText('RENDERER-MATH-FIRST');
            await expect(standalone.locator('body')).toContainText('RENDERER-MATH-LAST');
            expect(await standalone.evaluate(() => Array.from(document.fonts).some(font => font.family.startsWith('KaTeX') && font.status === 'loaded'))).toBe(true);
            expect(attemptedRequests).toEqual([]);
            expect(fs.readFileSync(fixturePath, 'utf8')).toBe(sourceText);
        } finally { await standalone.close(); }
    });

    test('exported blockquotes use readable theme text in GitHub and night output', async ({ page, context }) => {
        const sourceText = '# Quote contrast\n\n> QUOTE-CONTRAST-MARKER: This quotation must remain readable.\n';
        const rendered = await prepare(page, sourceText);
        for (const theme of ['github', 'night']) {
            const signal = new AbortController().signal;
            const html = await prepareStandaloneHtml({
                sourcePath: path.resolve(__dirname, '../fixtures/exports/quote-contrast.md'), markdown: sourceText,
                version: 1, theme, fontSize: 16
            }, {
                html: rendered.html, diagrams: [], warnings: [], theme, fontSize: 16
            }, path.resolve(__dirname, '../..'), { signal, report() {}, warnings: [], loadResource: createResourceLoader(signal) });
            const exported = await context.newPage();
            try {
                await exported.setContent(html, { waitUntil: 'load' });
                await expect(exported.locator('blockquote')).toContainText('QUOTE-CONTRAST-MARKER');
                const colors = await exported.evaluate(() => ({
                    quote: getComputedStyle(document.querySelector('blockquote')!).color,
                    text: getComputedStyle(document.body).color,
                    background: getComputedStyle(document.body).backgroundColor
                }));
                expect(colors.quote, theme + ' quotation inherits readable document text').toBe(colors.text);
                const luminance = (color: string) => {
                    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
                        const channel = value / 255;
                        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
                    });
                    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
                };
                const foreground = luminance(colors.quote);
                const background = luminance(colors.background);
                expect((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05), theme + ' quotation contrast').toBeGreaterThanOrEqual(4.5);
            } finally { await exported.close(); }
        }
    });

    test('document diagram directives cannot enable active HTML labels', async ({ page }) => {
        const source = '%%{init: {"flowchart": {"htmlLabels": true}, "securityLevel": "loose", "theme": "dark", "themeVariables": {"primaryTextColor": "#ffffff"}}}%%\ngraph TD\n A[First] --> B[Last]';
        const rendered = await prepare(page, '```mermaid\n' + source + '\n```\n', 'directives', { theme: 'github', fontSize: 16 });
        expect(rendered.diagrams).toHaveLength(1);
        expect(rendered.diagrams[0].svg).not.toContain('foreignObject');
        expect(rendered.diagrams[0].svg).toContain('fill:#ECECFF');
    });

    test('settings changed during diagram rendering do not replace captured export appearance', async ({ page }) => {
        await page.evaluate(() => {
            document.documentElement.dataset.theme = 'dark';
            const current = window as any;
            const render = current.mermaid.render.bind(current.mermaid);
            current.mermaid.render = async (...args: any[]) => {
                const result = await render(...args);
                await new Promise(resolve => { current.finishAppearanceDiagram = resolve; });
                return result;
            };
        });
        await sendHost(page, { type: 'prepareExport', requestId: 'captured-appearance', theme: 'github', fontSize: 19,
            markdown: '```mermaid\ngraph TD\nA[First] --> B[Last]\n```\n' });
        await page.waitForFunction(() => !!(window as any).finishAppearanceDiagram);
        expect(await page.locator('.export-preparation').evaluate(element => getComputedStyle(element).fontSize)).toBe('19px');
        await page.evaluate(() => {
            document.documentElement.dataset.theme = 'night';
            document.documentElement.style.setProperty('--font-size', '30px');
            (window as any).finishAppearanceDiagram();
        });
        await expect.poll(async () => (await messages(page, 'exportPrepared')).length).toBe(1);
        const [rendered] = await messages(page, 'exportPrepared');
        expect(rendered).toMatchObject({ theme: 'github', fontSize: 19 });
        expect(rendered.diagrams[0].svg).toContain('fill:#ECECFF');
        expect(await page.locator('html').getAttribute('data-theme')).toBe('night');
        expect(await page.evaluate(() => (window as any).mermaid.mermaidAPI.getConfig().theme)).toBe('dark');
    });

    test('provides visible source fallbacks and warnings for failed math and diagrams', async ({ page }) => {
        const rendered = await prepare(page, '```math\n\\notAnExistingMathCommand{x}\n```\n\n```mermaid\nnot a mermaid diagram\n```\n');
        expect(rendered.html).toContain('expression could not be rendered');
        expect(rendered.html).toContain('notAnExistingMathCommand');
        expect(rendered.html).toContain('diagram could not be rendered');
        expect(rendered.html).toContain('not a mermaid diagram');
        expect(rendered.warnings.map((warning: { code: string }) => warning.code)).toEqual(expect.arrayContaining(['math-fallback', 'diagram-fallback']));
        expect(await page.locator('.export-preparation').count()).toBe(0);
        expect(await page.locator('[id^="dbinary-export-diagram-"]').count()).toBe(0);
    });

    test('sanitizes attribute injection and unsafe links before attachment', async ({ page }) => {
        const unsafe = '[bad link](javascript:alert%281%29)\n\n![image](missing.png" onerror="window.exportInjected=true" data-extra=")\n';
        const rendered = await prepare(page, unsafe);
        expect(rendered.html).not.toMatch(/\sonerror=|href="javascript:/i);
        expect(rendered.html).toContain('Unsafe resource or link disabled');
        expect(rendered.warnings.map((warning: { code: string }) => warning.code)).toEqual(expect.arrayContaining(['active-content', 'unsafe-reference']));
        expect(await page.evaluate(() => (window as Window & { exportInjected?: boolean }).exportInjected)).toBeUndefined();
    });

    test('preserves original image references without fetching them during preparation', async ({ page }) => {
        const requests: string[] = [];
        await page.route('https://example.invalid/**', route => { requests.push(route.request().url()); return route.abort(); });
        const rendered = await prepare(page, '![local asset](assets/图片 original.png)\n\n![remote asset](https://example.invalid/original.png)\n');
        expect(rendered.html).toContain('data-markdown-path="assets/图片 original.png"');
        expect(rendered.html).toContain('src="https://example.invalid/original.png"');
        expect(requests).toEqual([]);
    });

    test('excludes metadata without stripping directive-looking fenced content', async ({ page }) => {
        const rendered = await prepare(page, '---\ntitle: Metadata title\n---\n# Visible title\n\n```text\n---\nIMAGE_DIR: example inside code\n```\n\n---\nIMAGE_DIR: ./images\nFORCE_RELATIVE_PATH: true\n');
        expect(rendered.html).not.toContain('Metadata title');
        expect(rendered.html).toContain('Visible title');
        expect(rendered.html).toContain('example inside code');
        expect(rendered.html).not.toContain('./images');
        const unclosed = await prepare(page, '```text\nexample\n---\nIMAGE_DIR: still code', 'unclosed');
        expect(unclosed.html).toContain('still code');
    });

    test('cancellation removes the owned rendering container and ignores late diagram completion', async ({ page }) => {
        await page.evaluate(() => {
            document.documentElement.dataset.theme = 'night';
            const current = window as Window & { mermaid: { render: () => Promise<unknown> }; finishExportDiagram?: () => void };
            current.mermaid.render = () => new Promise(resolve => {
                current.finishExportDiagram = () => resolve({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Late</text></svg>' });
            });
        });
        await sendHost(page, { type: 'prepareExport', requestId: 'cancelled', theme: 'github', fontSize: 19, markdown: '```mermaid\ngraph TD\nA --> B\n```\n' });
        await expect(page.locator('.export-preparation')).toHaveCount(1);
        await sendHost(page, { type: 'cancelExportPreparation', requestId: 'cancelled' });
        await expect.poll(async () => (await messages(page, 'exportError')).some(message => message.requestId === 'cancelled')).toBe(true);
        await expect(page.locator('.export-preparation')).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).mermaid.mermaidAPI.getConfig().theme)).toBe('dark');
        expect(await page.locator('html').getAttribute('data-theme')).toBe('night');
        await page.evaluate(() => (window as Window & { finishExportDiagram?: () => void }).finishExportDiagram?.());
        expect((await messages(page, 'exportPrepared')).filter(message => message.requestId === 'cancelled')).toEqual([]);
    });
});


test('export image validation rejects malformed bytes and external references', async ({ page }) => {
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as unknown as ExportTestWindow).__testApi?.ready);
    const validPng = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 2; canvas.height = 2;
        canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
        return canvas.toDataURL('image/png');
    });
    await sendHost(page, { type: 'validateExportImage', requestId: 'valid', dataUri: validPng });
    await sendHost(page, { type: 'validateExportImage', requestId: 'truncated', dataUri: validPng.slice(0, 45) });
    await sendHost(page, { type: 'validateExportImage', requestId: 'external', dataUri: 'https://example.invalid/image.png' });
    await expect.poll(async () => (await messages(page, 'exportImageValidated')).length).toBe(3);
    const replies = await messages(page, 'exportImageValidated');
    expect(replies.find(reply => reply.requestId === 'valid')?.valid).toBe(true);
    expect(replies.find(reply => reply.requestId === 'truncated')?.valid).toBe(false);
    expect(replies.find(reply => reply.requestId === 'external')?.valid).toBe(false);
});
