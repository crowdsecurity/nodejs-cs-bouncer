'use server';

import { CrowdSecBouncer, CrowdSecBouncerConfigurations } from '@crowdsec/nodejs-bouncer';
import { NextResponse } from 'next/server';

import { loadEnv } from './helpers';

// Load and validate environment variables
loadEnv();

const config: CrowdSecBouncerConfigurations = {
    url: process.env.LAPI_URL ?? 'http://localhost:8080',
    bouncerApiToken: process.env.BOUNCER_KEY ?? '',
};

const bouncer = new CrowdSecBouncer(config);

export const validateRequestWithCrowdSec = async () => {
    const ip = process.env.BOUNCED_IP as string; // In a production scenario, the user's real IP should be retrieved.

    try {
        console.log(`Checking CrowdSec remediation for IP: ${ip}`);
        const remediationData = await bouncer.getIpRemediation(ip);
        const { origin, remediation } = remediationData;
        console.log(`Decision is : ${remediation}`);
        if (remediation === 'ban') {
            const bouncerResponse = await bouncer.getResponse({
                ip,
                origin,
                remediation,
            });
            console.log(`Will show a ban wall`);
            // If the decision is to block, return a 403 response
            return new NextResponse(bouncerResponse.html, {
                status: bouncerResponse.status,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                },
            });
        }
        // @TODO: Handle other remediation types like 'captcha' if needed
    } catch (err) {
        // Log the error for debugging purposes
        console.error('CrowdSec check failed:', err);
    }
};
