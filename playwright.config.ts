import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './test/specs',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: process.env.CI ? 1 : 2,
    reporter: 'list',
    timeout: 30000,
    
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'retain-on-failure',
        headless: true,
        // Use an installed Chromium-family browser when Playwright's downloader
        // does not support the host distribution (for example Ubuntu 26.04).
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
            launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
                chromiumSandbox: true,
                args: ['--disable-updater-scheduler'],
            },
        } : {}),
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npx serve test/html -l 3000',
        port: 3000,
        timeout: 30000,
        reuseExistingServer: !process.env.CI,
    },
});
