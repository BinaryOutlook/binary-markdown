import { Page } from '@playwright/test';

/** Exercise the explicit view controls while retaining older toggle scenarios. */
export async function toggleEditorView(page: Page) {
    const mode = await page.locator('#sourceEditor').isVisible() ? 'visual' : 'source';
    await page.locator(`button[data-editor-mode="${mode}"]`).click();
}
