import { expect, test } from '@playwright/test';
import { spawnSync } from 'child_process';

export const setupBeforeAll = (testName: string) => {
    test.beforeAll(async ({}, testInfo) => {
        // testName is required as we use it to load the related bouncer configs
        const currentTestName = process.env.E2E_TEST_NAME;
        expect(currentTestName).toBe(testName);
        // Remove all cscli decisions
        const command = ['exec', '-i', 'nodejs-cs-crowdsec', 'sh', '-c', `cscli decisions delete --origin cscli`];
        const result = spawnSync('docker', command, { encoding: 'utf-8' });
        expect(result.stderr).toContain('decision(s) deleted');
    });
};
