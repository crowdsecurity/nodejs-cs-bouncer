import { test, expect } from '@playwright/test';

import { BAN_TITLE, E2E_ENDPOINT, HOME_TITLE, LOG_PATH } from './constants';
import { getBouncedIp } from './helpers/base';
import { addIpDecision } from './helpers/cscli';
import { getLogMessages } from './helpers/log';
import { wait } from './helpers/time';
import { setupCommon } from './setup/common';

const TEST_NAME = 'stream-mode';
const bouncedIp = getBouncedIp();

setupCommon(TEST_NAME);

test('Should access Home Page', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(HOME_TITLE);
    // Verify expected log messages
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getLogMessages(LOG_PATH);
    expect(logContent).toContain(`Cache found for IP ${bouncedIp}: []`); // No cache for this IP as we just cleared it
    expect(logContent).not.toMatch(
        new RegExp(`Stored decisions: \\[{"id":"clean-bypass-ip-${bouncedIp}","origin":"clean","expiresAt":\\d+,"value":"bypass"}\\]`),
    ); // We don't store bypass decisions in stream mode
    expect(logContent).toContain('Updated origins count: [{"origin":"clean","remediation":{"bypass":1}}]');
});

test('Should not be banned before refresh', async ({ page }) => {
    // Ban IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'ban', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a bypass
    await expect(page).toHaveTitle(HOME_TITLE);
    // Verify expected log messages
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getLogMessages(LOG_PATH);
    expect(logContent).toContain('Updated origins count: [{"origin":"clean","remediation":{"bypass":2}}]');
});

test('Should not be banned after refresh', async ({ page }) => {
    await page.goto(`${E2E_ENDPOINT}?action=refresh`);
    const locator = page.locator('body');
    await expect(locator).toHaveText('Decisions refreshed');
    await page.goto('/');
    // Remediation should be a ban
    await expect(page).toHaveTitle(BAN_TITLE);
});
