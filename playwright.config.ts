import { defineConfig } from '@playwright/test';

// Electron-app template (electron-vite). Run `npm run build` first,
// then `npm run test:e2e`. Launches the built app, screenshots first window.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
