import { Page } from '@playwright/test';

export async function openInsertWorkspace(page: Page) {
    await page.locator('#toolbarMore').click();
    await page.locator('#toolbarCommandSearch').fill('viewInsert');
    await page.locator('[data-menu-command="viewInsert"]').click();
}

export async function openActionPalette(page: Page) {
    await page.locator('#editor').focus();
    await page.keyboard.press('ControlOrMeta+/');
}
