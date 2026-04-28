import { test, expect } from './fixtures.js';

test.describe('REX Search Mirror', () => {
  test('Validate extension loaded.', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await expect(page).toHaveTitle(/REX Search Mirror Testing Extension/);
  });
});
