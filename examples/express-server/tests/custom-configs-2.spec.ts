import { test, expect } from '@playwright/test';

import { captchaTitle } from 'examples/express-server/tests/constants';
import { getBouncedIp } from 'examples/express-server/tests/helpers/base';
import { addIpDecision } from 'examples/express-server/tests/helpers/cscli';
import { wait } from 'examples/express-server/tests/helpers/time';
import { setupCommon } from 'examples/express-server/tests/setup/common';

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
    await expect(page).toHaveTitle(captchaTitle); // Custom ban title as defined in the config
});
