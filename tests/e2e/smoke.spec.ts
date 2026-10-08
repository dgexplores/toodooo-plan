import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

test('app launches with a window', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', '..', 'out', 'main', 'index.js')],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await expect(window.locator('body')).toBeVisible();
  await window.screenshot({ path: 'tests/e2e/smoke.png' });
  await app.close();
});
