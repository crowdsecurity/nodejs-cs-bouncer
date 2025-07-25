'use server';

import { CrowdSecBouncer, CrowdSecBouncerConfigurations } from '@crowdsec/nodejs-bouncer';
import { NextResponse } from 'next/server';

import { loadEnv, getLogger } from './helpers';

// Load and validate environment variables
loadEnv();

const config: CrowdSecBouncerConfigurations = {
    url: process.env.LAPI_URL ?? 'http://localhost:8080',
    bouncerApiToken: process.env.BOUNCER_KEY ?? '',
    wallsOptions: {
        captcha: {
            captchaAction: '/crowdsec-captcha',
        },
    },
};

const bouncer = new CrowdSecBouncer(config);

// Set up the logger for this example
const logger = getLogger();

export async function POST(req: Request) {
    const ip = process.env.BOUNCED_IP as string; // In a production scenario, the user's real IP should be retrieved.

    logger.info(`CrowdSec API route called with IP: ${ip}`);

    try {
        const { remediation, origin } = await bouncer.getIpRemediation(ip);
        const bouncerResponse = await bouncer.getResponse({ ip, origin, remediation });

        if (remediation === 'ban' || remediation === 'captcha') {
            return new NextResponse(bouncerResponse.html, {
                status: bouncerResponse.status,
            });
        }

        return new NextResponse(null, { status: 200 });
    } catch (err) {
        logger.error(`CrowdSec API route error: ${err}`);
        // If an error occurs, don't block the user
        return new NextResponse(null, { status: 200 });
    }
}
