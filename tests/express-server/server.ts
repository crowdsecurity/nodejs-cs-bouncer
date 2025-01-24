// @ts-ignore
import dotenv from 'dotenv';
// @ts-ignore
import dotenvSafe from 'dotenv-safe';
// @ts-ignore
import express from 'express';
// @ts-ignore
import session from 'express-session';
import pino from 'pino';
import nodeCron from 'node-cron';
import { create as createCaptcha } from 'svg-captcha-fixed';
import 'tests/express-server/crowdsec-alias';

// @ts-ignore
import path from 'path';

// In a real project, you would have to install the package from npm: "npm install @crowdsec/nodejs-bouncer"
// Here, for development and test purpose, we use the alias to load the package from the dist folder (@see ./crowdsec-alias.ts)
import {
    CrowdSecBouncer,
    CrowdSecBouncerConfiguration,
    renderBanWall,
    renderCaptchaWall, // @ts-expect-error We load the CrowdSecBouncer from the dist folder
} from '@crowdsec/nodejs-bouncer';
import { ORIGIN_CLEAN, REMEDIATION_BYPASS, BOUNCER_KEYS, REMEDIATION_CAPTCHA } from '../../src/lib/constants';

declare module 'express-session' {
    interface SessionData {
        captchaText?: string;
        captchaSolved?: boolean;
    }
}
const CAPTCHA_VERIFICATION_URI = '/verify-captcha';
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

const app = express();
const PORT = 3000;

// Middleware to parse URL-encoded form data (we are posting data to solve the captcha)
app.use(express.urlencoded({ extended: true }));
// Initialize session middleware at the top
// We use session to store the captcha text and if the captcha has been solved
app.use(
    session({
        secret: 'your-secret-key',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Server is launched with HTTP
    }),
);
// Set up the logger
const logger = pino({
    level: process.env.TEST_LOG_LEVEL ?? 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: false,
        },
    },
});

const config: CrowdSecBouncerConfiguration = {
    url: process.env.LAPI_URL ?? 'http://localhost:8080',
    bouncerApiToken: process.env.BOUNCER_KEY,
    cleanIpCacheDuration: process.env.CLEAN_IP_CACHE_DURATION ?? 120,
};
const bouncer = new CrowdSecBouncer(config);

// Middleware to retrieve IP and apply remediation
app.use(async (req, res, next) => {
    const ip = process.env.BOUNCED_IP || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (typeof ip === 'string') {
        try {
            const remediationData = await bouncer.getIpRemediation(ip);
            const remediation = remediationData[BOUNCER_KEYS.REMEDIATION];
            const origin = remediationData[BOUNCER_KEYS.ORIGIN];
            // In case of a ban, render the ban wall
            if (remediation === 'ban') {
                const banWall = await renderBanWall();
                await bouncer.updateRemediationOriginCount(origin, remediation);
                return res.status(403).send(banWall);
            }
            // In case of a captcha (unresolved) , render the captcha wall
            if (remediation === 'captcha') {
                const mustSolve = await bouncer.mustSolveCaptcha(ip, remediation);
                if (!mustSolve) {
                    await bouncer.updateRemediationOriginCount(ORIGIN_CLEAN, REMEDIATION_BYPASS);
                    next();
                    return;
                }

                if (req.method === 'POST' && req.path === CAPTCHA_VERIFICATION_URI) {
                    const { phrase, refresh } = req.body;

                    // TODO: use the redirect uri stored in the captcha flow
                    const redirectUri = '/'; // We could redirect to the referer with more complex logic

                    const captchaResolution = await bouncer.handleCaptchaResolution({
                        ip,
                        userPhrase: phrase,
                        refresh,
                    });

                    if (captchaResolution[BOUNCER_KEYS.REMEDIATION] === REMEDIATION_BYPASS) {
                        await bouncer.saveCaptchaFlow(ip, {
                            mustBeResolved: false,
                            resolutionFailed: false,
                        });
                        await bouncer.updateRemediationOriginCount(ORIGIN_CLEAN, REMEDIATION_BYPASS);
                        return res.redirect(redirectUri);
                    }

                    // Verify the CAPTCHA
                    const isCaptchaCorrect = phrase === captchaResolution[BOUNCER_KEYS.CAPTCHA_PHRASE];
                    if (isCaptchaCorrect) {
                        await bouncer.saveCaptchaFlow(ip, {
                            mustBeResolved: false,
                            resolutionFailed: false,
                        });
                        await bouncer.updateRemediationOriginCount(ORIGIN_CLEAN, REMEDIATION_BYPASS);
                        return res.redirect(redirectUri);
                    } else {
                        await bouncer.saveCaptchaFlow(ip, {
                            mustBeResolved: true,
                            resolutionFailed: true,
                        });
                        await bouncer.updateRemediationOriginCount(origin, remediation);
                        if (refresh === '1') {
                            logger.debug(`Captcha has been refreshed`);
                        } else {
                            logger.debug(`Captcha is incorrect: ${phrase} != ${req.session.captchaText}`);
                        }
                    }

                    return res.redirect(redirectUri);
                }

                // TODO: create captcha if not already created

                const captcha = await bouncer.saveCaptchaFlow(ip);
                req.session.captchaText = captcha.phraseToGuess; // Store captcha text in session

                const captchaWall = await renderCaptchaWall({
                    captchaImageTag: captcha.inlineImage,
                    redirectUrl: CAPTCHA_VERIFICATION_URI,
                });
                await bouncer.updateRemediationOriginCount(origin, remediation);
                return res.status(401).send(captchaWall);
            }
            await bouncer.updateRemediationOriginCount(ORIGIN_CLEAN, REMEDIATION_BYPASS);
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

// Serve a simple webpage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let counter = 0;
const DECISIONS_REFRESH_INTERVAL = 60; // seconds
// Retrieve decisions from the CrowdSec API
nodeCron.schedule('* * * * * *', async () => {
    if (counter % DECISIONS_REFRESH_INTERVAL === 0) {
        logger.info('Running getDecisions');
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
