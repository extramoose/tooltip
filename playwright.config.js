/**
 * Playwright config for the secondary DOM suite (`e2e/tooltip.spec.js`).
 *
 * The primary suite is `test/place.test.js`, which runs on the built-in Node
 * runner with nothing installed - this config exists only so the browser-level
 * spec has somewhere to live. `testMatch` keeps the two runners out of each
 * other's way: Playwright owns e2e/, `node --test` owns test/.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
