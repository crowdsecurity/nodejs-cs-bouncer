import { test, expect } from '@playwright/test';
import { setupCommon } from './setup/common';
import { homeTitle, banTitle, captchaTitle, e2eEndpoint, logPath } from './constants';
import { wait } from './helpers/time';
import { addIpDecision, removeIpDecision } from './helpers/cscli';
import { getBouncedIp, getCaptchaPhrase } from './helpers/base';
import { getFileContent, deleteFileContent } from './helpers/log';

const TEST_NAME = 'custom-configs';
const bouncedIp = getBouncedIp();

setupCommon(TEST_NAME);

test('Should fallback to configured fallback in case of unknown ', async ({ page }) => {
    // Add unknown decision IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'mfa', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a ban
    await expect(page).toHaveTitle(banTitle);
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getFileContent(logPath);
    expect(logContent).toContain(`Cache found for IP ${bouncedIp}: []`); // No cache for this IP as we just cleared it
    expect(logContent).toMatch(
        new RegExp(`Stored decisions: \\[{"id":"cscli-mfa-ip-${bouncedIp}","origin":"cscli","expiresAt":\\d+,"value":"mfa"}\\]`),
    );
    expect(logContent).toContain(`Final remediation for IP ${bouncedIp} is ban`);
});
