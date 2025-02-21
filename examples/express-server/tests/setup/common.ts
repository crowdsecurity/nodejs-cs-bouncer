import { expect, test } from '@playwright/test';
import { spawnSync } from 'child_process';

import { e2eEndpoint, logPath } from '../constants';
import { getFileContent, deleteFileContent } from '../helpers/log';

const removeCscliDecisions = () => {
    const command = ['exec', '-i', 'nodejs-cs-crowdsec', 'sh', '-c', `cscli decisions delete --origin cscli`];
    const result = spawnSync('docker', command, { encoding: 'utf-8' });
    expect(result.stderr).toContain('decision(s) deleted');
};

const setupBeforeAll = (testName: string) => {
    test.beforeAll(() => {
        // testName is required as we use it to load the related bouncer configs
        const currentTestName = process.env.E2E_TEST_NAME;
        expect(currentTestName).toBe(testName);
        // Remove all cscli decisions
        removeCscliDecisions();
    });
};

const setupAfterAll = () => {
    test.afterAll(() => {
        // Remove all cscli decisions
        removeCscliDecisions();
    });
};

export const setupCommon = (testName: string) => {
    setupBeforeAll(testName);
    setupAfterAll();

    test('Should clear the cache and logs', async ({ page }) => {
        await page.goto(`${e2eEndpoint}?action=clear-cache`);
        const locator = page.locator('body');
        await expect(locator).toHaveText('Cache cleared');

        // Clear logs
        await deleteFileContent(logPath);
        const logContent = await getFileContent(logPath);
        expect(logContent).toBe('');
    });
};
