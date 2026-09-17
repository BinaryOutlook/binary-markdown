import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
});

test('links in the initial document are wired before any later render', async ({ page }) => {
    const href = '/fixtures/03 Labs/Lab2';
    const initial = Buffer.from(`[Target](${href})\n`).toString('base64');
    await page.route('**/standalone-editor.html?initial-link', async route => {
        const response = await route.fetch();
        const html = await response.text();
        expect(html).toContain('atob(``)');
        await route.fulfill({ status: 200, contentType: 'text/html', body: html.replace('atob(``)', `atob(${JSON.stringify(initial)})`) });
    });
    await page.goto('/standalone-editor.html?initial-link');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    const messages = await page.evaluate(() => {
        (document.querySelector('#editor a') as HTMLAnchorElement).click();
        return (window as any).__testApi.messages.filter((m: any) => m.type === 'openLink');
    });
    expect(messages).toEqual([{ type: 'openLink', href }]);
});

for (const href of ['/fixtures/03 Labs/Lab2', 'file:///fixtures/03%20Labs/Lab2', 'notes.md', 'https://example.com/path', '#heading']) {
    test('hover and click preserve destination: ' + href, async ({ page }) => {
        const markdown = `[Target](${href})\n`;
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), markdown);
        const link = page.locator('#editor a');
        await expect(link).toHaveAttribute('title', href);
        await expect(link).toHaveAttribute('href', href);
        await link.hover();
        await link.click();
        const result = await page.evaluate(() => ({
            markdown: (window as any).__testApi.getMarkdown(),
            messages: (window as any).__testApi.messages.filter((m: any) => m.type === 'openLink')
        }));
        expect(result.markdown).toBe(markdown);
        expect(result.messages).toEqual([{ type: 'openLink', href }]);
    });
}

test('preserves authored titles and treats destination markup as plain attribute text', async ({ page }) => {
    const result = await page.evaluate(() => {
        const editor = document.getElementById('editor')!;
        editor.innerHTML = '<p><a title="Authored description">Target</a></p>';
        const a = editor.querySelector('a')!;
        const href = '/fixtures/"quoted" & <folder>';
        a.setAttribute('href', href);
        (window as any).__testApi.setupInteractiveElements();
        const authored = a.title;
        a.removeAttribute('title');
        (window as any).__testApi.setupInteractiveElements();
        a.click();
        const clicks = (window as any).__testApi.messages.filter((m: any) => m.type === 'openLink').length;
        return { authored, title: a.title, href: a.getAttribute('href'), children: a.childElementCount, clicks };
    });
    expect(result).toEqual({ authored: 'Authored description', title: '/fixtures/"quoted" & <folder>', href: '/fixtures/"quoted" & <folder>', children: 0, clicks: 1 });
});

for (const kind of ['insert', 'paste']) {
    test(kind + ' wires destination details and opens once without a reload', async ({ page }) => {
        const href = kind === 'insert' ? '/fixtures/03 Labs/Lab2' : 'https://example.com/path';
        await page.evaluate(({ kind, href }) => {
            (window as any).__testApi.setMarkdown('Before\n');
            const editor = document.getElementById('editor')!;
            editor.focus();
            const range = document.createRange();
            range.selectNodeContents(editor.querySelector('p')!);
            range.collapse(false);
            const selection = window.getSelection()!;
            selection.removeAllRanges(); selection.addRange(range);
            if (kind === 'insert') {
                (window as any).__hostMessageHandler({ type: 'insertLinkHtml', url: href, text: 'Target' });
            } else {
                const data = new DataTransfer(); data.setData('text/plain', href);
                editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
            }
        }, { kind, href });
        await expect(page.locator('#editor a')).toHaveAttribute('title', href);
        const before = await page.evaluate(() => (window as any).__testApi.getMarkdown());
        await page.locator('#editor a').click();
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(before);
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'openLink')))
            .toEqual([{ type: 'openLink', href }]);
    });
}
