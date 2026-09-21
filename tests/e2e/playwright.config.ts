import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    testDir: './specs', fullyParallel: false, workers: 1,
    forbidOnly: Boolean(process.env.CI), retries: process.env.CI ? 1 : 0,
    timeout: 30_000, expect: { timeout: 10_000 },
    reporter: [['list'], ['html', { open: 'never', outputFolder: fileURLToPath(new URL('./playwright-report', import.meta.url)) }]],
    outputDir: './test-results',
    webServer: process.env.BASE_URL ? undefined : {
        command: 'node ../scripts/e2e-server.mjs', cwd: import.meta.dirname, url: 'http://127.0.0.1:5180/api/health', reuseExistingServer: false,
    },
    use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:5180',
        trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure',
        launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
    projects: [
        { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
        { name: 'mobile-webkit', use: { ...devices['iPhone 13'], launchOptions: { args: [] } } },
    ],
});
