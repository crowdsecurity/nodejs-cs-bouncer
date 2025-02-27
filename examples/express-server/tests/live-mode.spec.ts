import { test, expect } from '@playwright/test';

import { homeTitle, banTitle, captchaTitle, e2eEndpoint, logPath } from 'examples/express-server/tests/constants';
import { getBouncedIp, getCaptchaPhrase } from 'examples/express-server/tests/helpers/base';
import { addIpDecision, removeIpDecision } from 'examples/express-server/tests/helpers/cscli';
import { getFileContent, deleteFileContent } from 'examples/express-server/tests/helpers/log';
import { wait } from 'examples/express-server/tests/helpers/time';
import { setupCommon, removeCscliDecisions } from 'examples/express-server/tests/setup/common';

const TEST_NAME = 'live-mode';
const bouncedIp = getBouncedIp();

setupCommon(TEST_NAME);

test('Should access Home Page', async ({ page }) => {
    await page.goto('/');
    // Remediation should be a bypass
    await expect(page).toHaveTitle(homeTitle);
    // Verify expected log messages
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getFileContent(logPath);
    expect(logContent).toContain(`Cache found for IP ${bouncedIp}: []`); // No cache for this IP as we just cleared it
    expect(logContent).toMatch(
        new RegExp(`Stored decisions: \\[{"id":"clean-bypass-ip-${bouncedIp}","origin":"clean","expiresAt":\\d+,"value":"bypass"}\\]`),
    );
    expect(logContent).toContain('Updated origins count: [{"origin":"clean","remediation":{"bypass":1}}]');
});

test('Should be banned', async ({ page }) => {
    // Ban IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'ban', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a ban
    await expect(page).toHaveTitle(banTitle);
    // Verify expected log messages
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getFileContent(logPath);
    expect(logContent).toContain(`Cache found for IP ${bouncedIp}: []`); // No cache for this IP as cache is 1 second for clean IP (see configs/live-mode.json)
    expect(logContent).toMatch(
        new RegExp(`Stored decisions: \\[{"id":"cscli-ban-ip-${bouncedIp}","origin":"cscli","expiresAt":\\d+,"value":"ban"}\\]`),
    );
    expect(logContent).toContain(
        'Updated origins count: [{"origin":"clean","remediation":{"bypass":1}},{"origin":"cscli","remediation":{"ban":1}}]\n',
    );
});

test('Should be banned the time of cached decision', async ({ page }) => {
    // Unban IP
    const result = await removeIpDecision(bouncedIp);
    expect(result.stderr).toContain('1 decision(s) deleted');
    // bad ip is cached for 5 seconds (because this is the decision duration we set above) but we wait a bit for LAPI to be up to date
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be still a ban because of cached decision
    await expect(page).toHaveTitle(banTitle);
    // Verify expected log messages
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getFileContent(logPath);
    expect(logContent).toMatch(
        new RegExp(
            `Cache found for IP ${bouncedIp}: \\[{"id":"cscli-ban-ip-${bouncedIp}","origin":"cscli","expiresAt":\\d+,"value":"ban"}\\]`,
        ),
    );
    expect(logContent).toContain(
        'Updated origins count: [{"origin":"clean","remediation":{"bypass":1}},{"origin":"cscli","remediation":{"ban":2}}]',
    );
    await wait(2000, 'Wait for cached decision to expire');
    await page.goto('/');
    // Remediation should be a bypass as the decision has been deleted and cache has expired
    await expect(page).toHaveTitle(homeTitle);
});

test('Should retrieve the highest remediation', async ({ page }) => {
    // Clean logs
    await deleteFileContent(logPath);
    // Ban IP
    const ban = await addIpDecision({ ip: bouncedIp, type: 'ban', duration: 5 });
    expect(ban.stderr).toContain('Decision successfully added');
    // Captcha IP
    const captcha = await addIpDecision({ ip: bouncedIp, type: 'captcha', duration: 5 });
    expect(captcha.stderr).toContain('Decision successfully added');
    await wait(1000, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a ban because ban > captcha
    await expect(page).toHaveTitle(banTitle);
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getFileContent(logPath);
    expect(logContent).toMatch(
        new RegExp(
            `Stored decisions: \\[{"id":"cscli-ban-ip-${bouncedIp}","origin":"cscli","expiresAt":\\d+,"value":"ban"},{"id":"cscli-captcha-ip-${bouncedIp}","origin":"cscli","expiresAt":\\d+,"value":"captcha"}\\]`,
        ),
    );
});

test('Should show a captcha', async ({ page }) => {
    // Unban IP
    let result = await removeIpDecision(bouncedIp);
    expect(result.stderr).toContain('decision(s) deleted'); // 1 or 2 decisions deleted
    // Add captcha decision
    result = await addIpDecision({ ip: bouncedIp, type: 'captcha', duration: 600 });
    expect(result.stderr).toContain('Decision successfully added');
    // captcha ip is cached for 600 seconds (because this is the decision duration we set above) but we wait a bit for LAPI to be up to date
    await wait(1000, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a captcha
    await expect(page).toHaveTitle(captchaTitle);
});

test('Should refresh captcha', async ({ page }) => {
    const initialPhrase = await getCaptchaPhrase(page);
    expect(initialPhrase).toHaveLength(4);
    await page.goto('/');
    await page.click('button[id="refresh_link"]');
    await wait(500, 'Wait for new captcha phrase to be generated');
    const newPhrase = await getCaptchaPhrase(page);
    expect(newPhrase).toHaveLength(4);
    expect(newPhrase).not.toEqual(initialPhrase);
});

test('Should show captcha error', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(captchaTitle);
    const input = page.locator('input[name="phrase"]');
    await input.fill('wrong-phrase');
    await page.click('button[type="submit"]');
    const locator = page.locator('.error');
    await expect(locator).toHaveText('Please try again');
});

test('Should solve a captcha', async ({ page }) => {
    const phrase = await getCaptchaPhrase(page);
    expect(phrase).toHaveLength(4);
    await page.goto('/');
    await expect(page).toHaveTitle(captchaTitle);
    const input = page.locator('input[name="phrase"]');
    await input.fill(phrase);
    await page.click('button[type="submit"]');
    // Remediation should be a bypass as we have solved the captcha
    await expect(page).toHaveTitle(homeTitle);
});

test('Should fallback to default fallback in case of unknown ', async ({ page }) => {
    // Remove all cscli decisions
    removeCscliDecisions();
    // Clear cache
    await page.goto(`${e2eEndpoint}?action=clear-cache`);
    const locator = page.locator('body');
    await expect(locator).toHaveText('Cache cleared');
    // Add unknown decision IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'mfa', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    await wait(500, 'Wait for LAPI to be up to date');
    await page.goto('/');
    // Remediation should be a captcha (default)
    await expect(page).toHaveTitle(captchaTitle);
    await wait(1000, 'Wait for logs to be written');
    const logContent = await getFileContent(logPath);
    expect(logContent).toMatch(
        new RegExp(`Stored decisions: \\[{"id":"cscli-mfa-ip-${bouncedIp}","origin":"cscli","expiresAt":\\d+,"value":"mfa"}\\]`),
    );
    expect(logContent).toContain(`Final remediation for IP ${bouncedIp} is captcha`);
});
