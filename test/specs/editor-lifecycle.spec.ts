import { test, expect, Page } from '@playwright/test';

type RenderCall = {
    source: string;
    resolve(value: { svg: string }): void;
    reject(reason: Error): void;
};
type LifecycleWindow = Window & {
    __testApi: {
        ready: boolean;
        messages: Array<Record<string, any>>;
        getMarkdown(): string;
        getHtml(): string;
        setMarkdown(source: string): void;
        renderFromMarkdown(): void;
        setupInteractiveElements(): void;
    };
    __hostMessageHandler(message: object): void;
    mermaid: { render(id: string, source: string): Promise<{ svg: string }> };
    lifecycleRenderCalls: RenderCall[];
    lifecycleWrapper: Element;
};

const original = '# Lifecycle\n\nBefore target after.\n';
const changed = '# Lifecycle\n\nBefore **target** after.\n';

async function host(page: Page, message: object) {
    await page.evaluate(message => (window as unknown as LifecycleWindow).__hostMessageHandler(message), message);
}
async function markdown(page: Page) {
    return page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.getMarkdown());
}
async function snapshot(page: Page, requestId: string) {
    await host(page, { type: 'captureExportSnapshot', requestId });
    return page.evaluate(requestId => (window as unknown as LifecycleWindow).__testApi.messages
        .findLast(message => message.type === 'exportSnapshot' && message.requestId === requestId), requestId);
}
async function setup(page: Page, source = original) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as unknown as LifecycleWindow).__testApi?.ready);
    await host(page, { type: 'update', content: source });
}
async function selectTarget(page: Page) {
    await page.locator('#editor > p').evaluate(paragraph => {
        document.getElementById('editor')!.focus();
        const node = paragraph.firstChild!;
        const start = node.textContent!.indexOf('target');
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 'target'.length);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
}

for (const route of ['toolbar', 'shortcut']) {
    test(`repeated renders and view switches leave one ${route} action and one history entry`, async ({ page }) => {
        await setup(page);
        for (let cycle = 0; cycle < 3; cycle++) {
            await page.evaluate(() => {
                const api = (window as unknown as LifecycleWindow).__testApi;
                api.renderFromMarkdown();
                api.setupInteractiveElements();
            });
            for (const mode of ['source', 'split', 'visual']) {
                await page.locator(`button[data-editor-mode="${mode}"]`).click();
            }
        }
        expect(await snapshot(page, 'before-command')).toMatchObject({ content: original, pending: false });
        expect(await page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.messages
            .filter(message => message.type === 'edit'))).toEqual([]);
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();

        await selectTarget(page);
        expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
        if (route === 'toolbar') await page.locator('#toolbar [data-action="bold"]').click();
        else await page.keyboard.press('ControlOrMeta+b');
        expect(await markdown(page)).toBe(changed);
        await expect(page.locator('#editor :is(strong, b)')).toHaveText('target');
        await page.locator('#toolbar [data-action="undo"]').click();
        expect(await markdown(page)).toBe(original);
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
        await page.locator('#toolbar [data-action="redo"]').click();
        expect(await markdown(page)).toBe(changed);

        // One keyboard Save must produce one message even after repeated setup.
        const savesBefore = await page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.messages
            .filter(message => message.type === 'save').length);
        await page.keyboard.press('ControlOrMeta+s');
        const saves = await page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.messages
            .filter(message => message.type === 'save'));
        expect(saves).toHaveLength(savesBefore + 1);
        expect(saves.at(-1)?.content).toBe(changed);
    });
}

test('fixture readiness exposes usable helpers, a formatting command and export snapshots', async ({ page }) => {
    await setup(page);
    expect(await page.evaluate(() => {
        const current = window as unknown as LifecycleWindow;
        return ['getMarkdown', 'getHtml', 'setMarkdown', 'renderFromMarkdown', 'setupInteractiveElements']
            .every(name => typeof (current.__testApi as any)[name] === 'function')
            && typeof current.__hostMessageHandler === 'function';
    })).toBe(true);
    await selectTarget(page);
    await page.locator('#toolbar [data-action="bold"]').click();
    expect(await markdown(page)).toBe(changed);
    await page.locator('#toolbar [data-action="undo"]').click();
    expect(await snapshot(page, 'ready-snapshot')).toMatchObject({ content: original });
    await host(page, { type: 'prepareExport', requestId: 'ready-export', markdown: original, theme: 'github', fontSize: 16 });
    await expect.poll(() => page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.messages
        .filter(message => message.type === 'exportPrepared' && message.requestId === 'ready-export').length)).toBe(1);
    const prepared = await page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.messages
        .find(message => message.type === 'exportPrepared' && message.requestId === 'ready-export'));
    expect(prepared?.html).toContain('Lifecycle');
    expect(await markdown(page)).toBe(original);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

async function holdMermaidRenders(page: Page) {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await setup(page, '');
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    await page.evaluate(() => {
        const current = window as unknown as LifecycleWindow;
        current.lifecycleRenderCalls = [];
        current.mermaid.render = (_id, source) => new Promise((resolve, reject) => {
            current.lifecycleRenderCalls.push({ source, resolve, reject });
        });
    });
}

for (const staleOutcome of ['success', 'failure']) {
    test(`a late live Mermaid ${staleOutcome} cannot replace a newer preview`, async ({ page }) => {
        await holdMermaidRenders(page);
        const source = '```mermaid\ngraph TD\nA[Old]\n```\n\nTail\n';
        await host(page, { type: 'update', content: source });
        await page.waitForFunction(() => (window as unknown as LifecycleWindow).lifecycleRenderCalls
            .some(call => call.source.includes('A[Old]')));
        await page.locator('#editor .mermaid-wrapper').dispatchEvent('click');
        await page.locator('#editor .mermaid-wrapper pre code').evaluate(code => {
            const current = window as unknown as LifecycleWindow;
            current.lifecycleWrapper = code.closest('.mermaid-wrapper')!;
            // Keep the code/pre/wrapper nodes intact: multiline contenteditable
            // fill can split code elements and changes the concurrency scenario.
            code.textContent = 'graph TD\nA[New]';
            code.dispatchEvent(new InputEvent('input', {
                bubbles: true, inputType: 'insertText', data: 'graph TD\nA[New]'
            }));
        });
        await page.clock.runFor(501);
        await page.waitForFunction(() => (window as unknown as LifecycleWindow).lifecycleRenderCalls
            .some(call => call.source.includes('A[New]')));
        expect(await page.evaluate(() => (window as unknown as LifecycleWindow).lifecycleWrapper
            === document.querySelector('#editor .mermaid-wrapper'))).toBe(true);
        await page.evaluate(() => {
            const call = (window as unknown as LifecycleWindow).lifecycleRenderCalls
                .findLast(call => call.source.includes('A[New]'))!;
            call.resolve({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Newest preview</text></svg>' });
        });
        await expect(page.locator('#editor .mermaid-diagram')).toHaveText('Newest preview');
        const beforeLateResult = await markdown(page);
        await page.evaluate(outcome => {
            const call = (window as unknown as LifecycleWindow).lifecycleRenderCalls
                .find(call => call.source.includes('A[Old]'))!;
            if (outcome === 'success') call.resolve({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Old preview</text></svg>' });
            else call.reject(new Error('Old render failed'));
        }, staleOutcome);
        await expect(page.locator('#editor .mermaid-diagram')).toHaveText('Newest preview');
        await expect(page.locator('#editor .mermaid-wrapper')).toHaveAttribute('data-render-error', '');
        expect(await markdown(page)).toBe(beforeLateResult);
        expect(beforeLateResult).toContain('A[New]');
        expect(await snapshot(page, 'after-late-diagram')).toMatchObject({ content: beforeLateResult });
    });
}

test('a Mermaid rejection after document replacement leaves the replacement source and messages untouched', async ({ page }) => {
    await holdMermaidRenders(page);
    await host(page, { type: 'update', content: '```mermaid\ngraph TD\nA[Removed]\n```\n' });
    await page.waitForFunction(() => (window as unknown as LifecycleWindow).lifecycleRenderCalls.length > 0);
    const replacement = '# Replacement\n\nUntouched text.\n';
    await host(page, { type: 'update', content: replacement });
    const editsBefore = await page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.messages
        .filter(message => message.type === 'edit'));
    await page.evaluate(() => (window as unknown as LifecycleWindow).lifecycleRenderCalls[0].reject(new Error('Removed diagram failed')));
    expect(await markdown(page)).toBe(replacement);
    await expect(page.locator('#editor .mermaid-wrapper, #editor .block-diagnostic')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as LifecycleWindow).__testApi.messages
        .filter(message => message.type === 'edit'))).toEqual(editsBefore);
    expect(await snapshot(page, 'replacement')).toMatchObject({ content: replacement, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});
