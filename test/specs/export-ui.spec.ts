import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getExportMessages } from '../../src/export/messages';

const root = path.resolve(__dirname, '../..');
const { generateEditorBodyHtml } = require('../../src/shared/editor-body-html');
const original = '# Original document\n\nSelection remains intact.\n';

type UiWindow = Window & {
    __testApi: { ready: boolean; messages: Array<Record<string, unknown>> };
    __hostMessageHandler(message: Record<string, unknown>): void;
};

async function setup(page: Page, exportEnabled = true) {
    await page.goto('/standalone-editor.html');
    await page.setContent('<!DOCTYPE html><html data-theme="github" data-toolbar-mode="full"><head></head><body>' + generateEditorBodyHtml({}, 'darwin', { exportEnabled }) + '</body></html>');
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'src/webview/styles.css'), 'utf8').replace('__FONT_SIZE__', '16') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'src/shared/test-host-bridge.js'), 'utf8') });
    const editor = fs.readFileSync(path.join(root, 'src/webview/editor.js'), 'utf8')
        .replace('__DEBUG_MODE__', 'false').replace('__I18N__', '{}')
        .replace('__DOCUMENT_BASE_URI__', '').replace('__CONTENT__', JSON.stringify(Buffer.from(original).toString('base64')));
    await page.addScriptTag({ content: editor });
    await page.evaluate(messages => { (window as Window & { exportMessages?: unknown }).exportMessages = messages; }, getExportMessages());
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'src/webview/export-ui.js'), 'utf8') });
}
async function hostMessage(page: Page, message: Record<string, unknown>) {
    await page.evaluate(message => window.dispatchEvent(new MessageEvent('message', { data: message })), message);
}
async function outbound(page: Page, type: string) {
    return page.evaluate(type => (window as unknown as UiWindow).__testApi.messages.filter(message => message.type === type), type);
}

test.describe('Export toolbar and job status', () => {
    test('button is immediately after VS Code, preserves source/selection, and lists four formats', async ({ page }, testInfo) => {
        await setup(page);
        await page.getByText('Selection remains intact.', { exact: true }).click();
        const before = await page.evaluate(() => {
            const selection = window.getSelection()!;
            return { text: selection.anchorNode?.textContent, offset: selection.anchorOffset };
        });
        expect(await page.locator('#exportButton').evaluate(element => element.previousElementSibling?.getAttribute('data-action'))).toBe('openInTextEditor');
        await page.getByRole('button', { name: 'Export', exact: true }).click();
        await expect(page.getByRole('menu', { name: 'Export', exact: true })).toBeVisible();
        await expect(page.locator('[data-export-format]')).toHaveCount(4);
        expect(await outbound(page, 'exportCapabilities')).toHaveLength(1);
        await page.screenshot({ path: testInfo.outputPath('export-menu.png') });
        expect(await outbound(page, 'edit')).toEqual([]);
        await page.evaluate(() => (window as unknown as UiWindow).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'ui-snapshot' }));
        expect((await outbound(page, 'exportSnapshot')).at(-1)?.content).toBe(original);
        await page.keyboard.press('Escape');
        await expect(page.locator('#exportMenu')).toBeHidden();
        expect(await page.evaluate(() => { const selection = window.getSelection()!; return { text: selection.anchorNode?.textContent, offset: selection.anchorOffset }; })).toEqual(before);
    });

    test('keyboard navigation and missing-tool setup remain accessible', async ({ page }) => {
        await setup(page);
        await page.locator('#exportButton').focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('[data-export-format="html"]')).toBeFocused();
        await hostMessage(page, { type: 'exportCapabilities', pandoc: { kind: 'pandoc', available: false }, browser: { kind: 'browser', available: true } });
        await expect(page.locator('[data-export-format="docx"]')).toHaveAttribute('aria-disabled', 'true');
        await expect(page.locator('#exportPandocSetup')).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('[data-export-format="pdf"]')).toBeFocused();
        await page.keyboard.press('Enter');
        expect(await outbound(page, 'export')).toEqual([{ type: 'export', format: 'pdf' }]);
        await page.locator('#exportButton').click();
        await page.locator('#exportPandocSetup').click();
        expect(await outbound(page, 'exportSettings')).toEqual([{ type: 'exportSettings', tool: 'pandoc' }]);
    });

    test('real stages show activity, cancellation and a safe warning summary', async ({ page }) => {
        await setup(page);
        await hostMessage(page, { type: 'exportStatus', state: 'running', stage: 'resources', message: 'Preparing referenced resources…' });
        await expect(page.locator('#exportSpinner')).toBeVisible();
        await expect(page.locator('#exportStatus')).toHaveAttribute('data-state', 'running');
        await expect(page.getByRole('progressbar', { name: 'Export', exact: true })).toBeVisible();
        await expect(page.locator('#exportStatusMessage')).toHaveText('Preparing referenced resources…');
        await page.getByRole('button', { name: 'Cancel export', exact: true }).click();
        expect(await outbound(page, 'cancelExport')).toHaveLength(1);
        await hostMessage(page, { type: 'exportStatus', state: 'complete', message: 'Export complete', outputPath: '/documents/report.html', warnings: [{ code: 'asset-missing', message: '<script>bad()</script> image unavailable' }] });
        await expect(page.locator('#exportSpinner')).toBeHidden();
        await expect(page.locator('#exportCancel')).toBeHidden();
        await expect(page.locator('#exportOutputPath')).toHaveText('/documents/report.html');
        await expect(page.locator('#exportWarningsSummary')).toHaveText('Export warnings (1)');
        await page.locator('#exportWarningsSummary').click();
        await expect(page.locator('#exportWarningsList li')).toHaveText('<script>bad()</script> image unavailable');
        expect(await page.locator('#exportWarningsList script').count()).toBe(0);
    });

    test('Electron default does not expose export controls', async ({ page }) => {
        await setup(page, false);
        await expect(page.locator('#exportButton')).toHaveCount(0);
        await expect(page.locator('#exportMenu')).toHaveCount(0);
        await expect(page.locator('#exportStatus')).toHaveCount(0);
    });
});
