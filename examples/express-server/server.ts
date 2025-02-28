import { CrowdSecBouncer, CrowdSecBouncerConfigurations } from '@crowdsec/nodejs-bouncer';
import express from 'express';
import nodeCron from 'node-cron';

import { getExcludedPaths, getLogger, loadEnv } from 'examples/express-server/helpers';
import { getE2ETestConfig, getE2EExcludedPaths, addE2ERoutes } from 'examples/express-server/tests/helpers/base';
import path from 'path';

// Load and validate environment variables
loadEnv();
// Create an Express app
const app = express();
// Middleware to parse URL-encoded form data (we are posting data to solve the captcha)
app.use(express.urlencoded({ extended: true }));
// Set up the logger for this example
const logger = getLogger();
/**
 * Configuration for the CrowdSec Bouncer.
 * For more details, see src/lib/bouncer/types.ts
 */
const config: CrowdSecBouncerConfigurations = {
    url: process.env.LAPI_URL ?? 'http://localhost:8080',
    bouncerApiToken: process.env.BOUNCER_KEY ?? '',
    ...getE2ETestConfig(), // Only for End-to-End tests
};

// Create an instance of the CrowdSec Bouncer
const bouncer = new CrowdSecBouncer(config);

// CrowdSec Middleware to apply remediation
app.use(async (req, res, next) => {
    // Exclude some paths from the bouncing middleware
    if ([...getExcludedPaths(), ...getE2EExcludedPaths()].includes(req.path)) {
        return next();
    }

    const ip = process.env.BOUNCED_IP; // In a production scenario, the user's real IP should be retrieved.

    if (typeof ip === 'string') {
        try {
            // Retrieve known remediation for the user's IP
            const remediationData = await bouncer.getIpRemediation(ip);
            const { origin, remediation } = remediationData;
            // In case of a captcha (unsolved), render the captcha wall
            if (remediation === 'captcha') {
                // URL to redirect the user to after solving the captcha
                // If possible, you would redirect the user to the page they were trying to access
                const captchaSuccessUrl = '/';
                // User is trying to submit the captcha
                if (req.method === 'POST' && req?.body?.crowdsec_captcha_submit) {
                    const { phrase, crowdsec_captcha_refresh: refresh } = req.body;
                    // User can refresh captcha image or submit a phrase to solve the captcha
                    await bouncer.handleCaptchaSubmission({
                        ip,
                        origin,
                        userPhrase: phrase ?? '',
                        refresh: refresh ?? '0',
                    });
                    return res.redirect(captchaSuccessUrl);
                }
            }
            const bouncerResponse = await bouncer.getResponse({
                ip,
                origin,
                remediation,
            });
            // Display Ban or Captcha wall
            if (bouncerResponse.status !== 200) {
                return res.status(bouncerResponse.status).send(bouncerResponse.html);
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error(`Error while getting remediation for IP ${ip}: ${error.message}`);
            } else {
                logger.error(`Unexpected error while getting remediation for IP ${ip}`);
            }
        }
        next();
    } else {
        next();
    }
});

// Serve a simple webpage ("home" page)
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// This cron job will fetch the decisions from the CrowdSec API every 120 seconds
let counter = 0;
const DECISIONS_REFRESH_INTERVAL = 120; // seconds
// Retrieve decisions from the CrowdSec API
nodeCron.schedule('* * * * * *', async () => {
    if (counter % DECISIONS_REFRESH_INTERVAL === 0) {
        logger.info('Running refreshDecisions cron task');
        try {
            const decisionStream = await bouncer.refreshDecisions({
                origins: ['cscli'], // CAPI, lists, cscli, etc
                scopes: ['ip', 'range'],
            });

            logger.info(`New decisions: ${decisionStream?.new?.length || 0}`);
            logger.info(`Deleted decisions: ${decisionStream?.deleted?.length || 0}`);
        } catch (error) {
            logger.error(`Error fetching decision stream: ${(error as Error).message}`);
        }
    }
    counter++;
});

// For End-to-End tests only
addE2ERoutes(app, bouncer);

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});
