// Messaging release gate: the messaging product-screen specs on Chromium and
// WebKit with no retries, so an intermittent failure fails CI instead of being
// hidden by the regular shards' single retry. Synthetic local backends only.
import base from './playwright.config.mjs';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...base,
  testMatch: /origin-messaging-.*\.spec\.mjs$/,
  retries: 0,
  workers: 1,
  projects: [
    { name: 'chromium', use: { ...base.use, browserName: 'chromium' } },
    { name: 'webkit', use: { ...base.use, browserName: 'webkit' } }
  ]
});
