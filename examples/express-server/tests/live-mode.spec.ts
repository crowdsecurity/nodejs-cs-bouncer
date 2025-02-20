import { test, expect, ConsoleMessage } from '@playwright/test';
import { setupBeforeAll } from './setup/before-all';
import { homeTitle, banTitle, captchaTitle } from './constants';
import { wait } from './helpers/time';
import { addIpDecision, removeIpDecision } from './helpers/cscli';
import { getBouncedIp } from './helpers/base';

const TEST_NAME = 'live-mode';
const bouncedIp = getBouncedIp();

setupBeforeAll(TEST_NAME);

test('Should access Home Page', async ({ page }) => {
    await page.goto('/end-to-end-tools?action=clear-cache');
    await page.goto('/');
    // Remediation should be a bypass
    await expect(page).toHaveTitle(homeTitle);
});

test('Should be banned', async ({ page }) => {
    // Ban IP
    const result = await addIpDecision({ ip: bouncedIp, type: 'ban', duration: 5 });
    expect(result.stderr).toContain('Decision successfully added');
    // clean ip is cached for 1 second (see configs/live-mode.json) and we wait a bit for LAPI to be up to date
    await wait(1500);
    await page.goto('/');
    // Remediation should be a ban
    await expect(page).toHaveTitle(banTitle);
});

test('Should be banned the time of cached decision', async ({ page }) => {
    // Unban IP
    const result = await removeIpDecision(bouncedIp);
    expect(result.stderr).toContain('1 decision(s) deleted');
    // bad ip is cached for 5 seconds (because this is the decision duration we set above) but we wait a bit for LAPI to be up to date
    await wait(1000);
    await page.goto('/');
    // Remediation should be still a ban because of cached decision
    await expect(page).toHaveTitle(banTitle);
    await wait(3000);
    await page.goto('/');
    // Remediation should be a bypass as the decision has been deleted and cache has expired
    await expect(page).toHaveTitle(homeTitle);
});

test('Should show a captcha', async ({ page }) => {
    // Add captcha decision
    const result = await addIpDecision({ ip: bouncedIp, type: 'captcha', duration: 600 });
    expect(result.stderr).toContain('Decision successfully added');
    // captcha ip is cached for 600 seconds (because this is the decision duration we set above) but we wait a bit for LAPI to be up to date
    await wait(1000);
    await page.goto('/');
    // Remediation should be a captcha
    await expect(page).toHaveTitle(captchaTitle);
});

test('Should solve a captcha', async ({ page }) => {
    await page.goto('/end-to-end-tools?action=get-captcha-phrase');

    const phrase = await page.evaluate(() => {
        return JSON.parse(document.body.innerText).phrase;
    });

    console.log('Captcha phrase:', phrase);
    expect(phrase).toHaveLength(4);
    await page.goto('/');
    await page.fill('input[name="phrase"]', phrase);
    await page.click('button[type="submit"]');

    // Remediation should be a bypass as we have solved the captcha
    await expect(page).toHaveTitle(homeTitle);
});
