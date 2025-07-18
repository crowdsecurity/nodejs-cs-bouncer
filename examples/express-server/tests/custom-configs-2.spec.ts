import { test, expect } from '@playwright/test';

import { CAPTCHA_TITLE } from './constants';
import { getBouncedIp } from './helpers/base';
import { addIpDecision } from './helpers/cscli';
import { wait } from './helpers/time';
import { setupCommon } from './setup/common';

const TEST_NAME = 'custom-configs-2';
const bouncedIp = getBouncedIp();

setupCommon(TEST_NAME);

test('Should display a captcha even if banned', async ({ page }) => {
    // Add ban decision IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'ban', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a ban because fallback is configured to ban
    await expect(page).toHaveTitle(CAPTCHA_TITLE); // Custom ban title as defined in the config
});
