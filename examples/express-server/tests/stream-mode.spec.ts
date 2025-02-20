import { test, expect } from '@playwright/test';
import { setupBeforeAll } from './setup/before-all';

const TEST_NAME = 'stream-mode';

setupBeforeAll(TEST_NAME);

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/CrowdSec Node.js bouncer test page/);
});
