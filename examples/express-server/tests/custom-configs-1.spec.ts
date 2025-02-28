import { test, expect } from '@playwright/test';

import { E2E_ENDPOINT, LOG_PATH } from 'examples/express-server/tests/constants';
import { getBouncedIp } from 'examples/express-server/tests/helpers/base';
import { addIpDecision } from 'examples/express-server/tests/helpers/cscli';
import { getFileContent } from 'examples/express-server/tests/helpers/log';
import { wait } from 'examples/express-server/tests/helpers/time';
import { removeCscliDecisions, setupCommon } from 'examples/express-server/tests/setup/common';

const TEST_NAME = 'custom-configs-1';
const bouncedIp = getBouncedIp();

setupCommon(TEST_NAME);

test('Should fallback to configured fallback in case of unknown ', async ({ page }) => {
    // Add unknown decision IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'mfa', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a ban because fallback is configured to ban
    await expect(page).toHaveTitle('Custom Ban'); // Custom ban title as defined in the config
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getFileContent(LOG_PATH);
    expect(logContent).toContain(`Cache found for IP ${bouncedIp}: []`); // No cache for this IP as we just cleared it
    expect(logContent).toMatch(
        new RegExp(`Stored decisions: \\[{"id":"cscli-mfa-ip-${bouncedIp}","origin":"cscli","expiresAt":\\d+,"value":"mfa"}\\]`),
    );
    expect(logContent).toContain(`Final remediation for IP ${bouncedIp} is ban`);
});

test('Should display a custom captcha ', async ({ page }) => {
    // Remove all cscli decisions
    removeCscliDecisions();
    // Clear cache
    await page.goto(`${E2E_ENDPOINT}?action=clear-cache`);
    const locator = page.locator('body');
    await expect(locator).toHaveText('Cache cleared');
    // Add captcha decision IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'captcha', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a custom captcha as defined in the config
    await expect(page).toHaveTitle('Custom Captcha');
});
