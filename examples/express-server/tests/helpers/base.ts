/* eslint-disable @typescript-eslint/no-explicit-any */
import { E2E_ENDPOINT } from 'examples/express-server/tests/constants';
import fs from 'fs';
import path from 'path';

export const getBouncedIp = (): string => {
    const bouncedIp = process.env.BOUNCED_IP ?? '';
    if (bouncedIp !== '') {
        return bouncedIp;
    }
    throw new Error('BOUNCER_IP env is not defined.');
};

export const getCaptchaPhrase = async (page: any) => {
    await page.goto(`${E2E_ENDPOINT}?action=get-captcha-phrase`);
    return page.evaluate(() => {
        return JSON.parse(document.body.innerText).phrase;
    });
};

export const getE2ETestConfig = (): JSON | object => {
    if (process.env.E2E_TEST_NAME) {
        const testName = process.env.E2E_TEST_NAME;
        console.log('Running End to End test:', testName);
        try {
            const configFilePath = path.resolve(__dirname, `../configs/${testName}.json`); // Adjust the path as needed
            const fileContents = fs.readFileSync(configFilePath, 'utf-8');
            return JSON.parse(fileContents);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            console.error('Failed to load config from file');
            process.exit(1); // Exit if config file is required and cannot be loaded
        }
    }
    return {};
};

export const getE2EExcludedPaths = () => {
    if (process.env.E2E_TEST_NAME) {
        // We need to exclude this endpoint only for end-to-end tests purposes
        return [E2E_ENDPOINT];
    }
    return [];
};

export const addE2ERoutes = (app: any, bouncer: any) => {
    if (process.env.E2E_TEST_NAME) {
        app.get(E2E_ENDPOINT, async (req: any, res: any) => {
            // Retrieve "action" get param
            const action = req.query.action;
            if (action === 'get-captcha-phrase') {
                // Get the captcha phrase
                const item = await bouncer.cacheStorage.adapter.getItem(`captcha_flow_${getBouncedIp()}`);
                return res.json({ phrase: item?.content?.phraseToGuess || null });
            }
            if (action === 'clear-cache') {
                // Get the captcha phrase
                await bouncer.cacheStorage.adapter.clear();
                return res.send('Cache cleared');
            }
            if (action === 'refresh') {
                // Refresh decisions
                await bouncer.refreshDecisions({
                    origins: ['cscli'],
                    scopes: ['ip', 'range'],
                });
                return res.send('Decisions refreshed');
            }
            if (action === 'push-metrics') {
                // Push usage metrics
                await bouncer.pushUsageMetrics('crowdsec-express-e2e-bouncer', 'v0.0.0');
                return res.send('Usage metrics pushed');
            }
            return res.send('Unknown action');
        });
    }
};
