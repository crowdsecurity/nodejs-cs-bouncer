import dotenv from 'dotenv';
import dotenvSafe from 'dotenv-safe';
import express from 'express';
import nodeCron from 'node-cron';
import pino from 'pino';
import { ORIGIN_CLEAN, REMEDIATION_BYPASS, BOUNCER_KEYS } from 'src/lib/constants';
import path from 'path';
import 'examples/express-server/crowdsec-alias';
// In a real project, you would have to install the package from npm: "npm install @crowdsec/nodejs-bouncer"
// Here, for development and test purpose, we use the alias to load the package from the dist folder (@see ./crowdsec-alias.ts)
// eslint-disable-next-line import/order
import {
    CrowdSecBouncer,
    CrowdSecBouncerConfiguration,
    // @ts-expect-error We load the CrowdSecBouncer from the dist folder
    // eslint-disable-next-line import/no-unresolved
} from '@crowdsec/nodejs-bouncer';

// Load and validate environment variables from .env file
dotenvSafe.config({
    path: path.resolve(__dirname, '.env'),
    example: path.resolve(__dirname, '.env.example'),
});
dotenv.config();
// Load and validate the .env file in the crowdsec folder (will override any duplicate values from the main .env)
dotenvSafe.config({
    path: path.resolve(__dirname, 'crowdsec/.env'),
    example: path.resolve(__dirname, 'crowdsec/.env.example'),
});
dotenv.config({ path: path.resolve(__dirname, 'crowdsec/.env') });
// Create an Express app
const app = express();
const PORT = 3000;
// Middleware to parse URL-encoded form data (we are posting data to solve the captcha)
app.use(express.urlencoded({ extended: true }));
// Set up the logger for this example
const logger = pino({
    level: process.env.TEST_LOG_LEVEL ?? 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: false,
        },
    },
});
/**
 * Configuration for the CrowdSec Bouncer.
 * For more details, see src/lib/bouncer/types.ts
 */
const config: CrowdSecBouncerConfiguration = {
    url: process.env.LAPI_URL ?? 'http://localhost:8080',
    bouncerApiToken: process.env.BOUNCER_KEY,
};
// Create an instance of the CrowdSec Bouncer
const bouncer = new CrowdSecBouncer(config);

// CrowdSec Middleware to apply remediation
app.use(async (req, res, next) => {
    if (req.path === '/favicon.ico') {
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
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// This cron job will fetch the decisions from the CrowdSec API every 60 seconds
let counter = 0;
const DECISIONS_REFRESH_INTERVAL = 60; // seconds
// Retrieve decisions from the CrowdSec API
nodeCron.schedule('* * * * * *', async () => {
    if (counter % DECISIONS_REFRESH_INTERVAL === 0) {
        logger.info('Running refreshDecisions cron task');
        try {
            const decisionStream = await bouncer.refreshDecisions({
                origins: ['cscli'], // CAPI, lists, cscli, etc
                scopes: ['ip'],
            });

            logger.info(`New decisions: ${JSON.stringify(decisionStream.new ?? '[]')}`);
            logger.info(`Deleted decisions: ${JSON.stringify(decisionStream.deleted ?? '[]')}`);
        } catch (error) {
            logger.error(`Error fetching decision stream: ${(error as Error).message}`);
        }
    }
    counter++;
});

// Start the server
app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});
