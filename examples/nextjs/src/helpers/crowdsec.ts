'use server';

import { CrowdSecBouncer, CrowdSecBouncerConfigurations } from '@crowdsec/nodejs-bouncer';
import { NextRequest, NextResponse } from 'next/server';
import { loadEnv } from '.';
import { getIpFromRequest } from './ip';

// Load and validate environment variables
loadEnv();

const config: CrowdSecBouncerConfigurations = {
    url: process.env.LAPI_URL ?? 'http://localhost:8080',
    bouncerApiToken: process.env.BOUNCER_KEY ?? '',
    wallsOptions: {
        captcha: {
            captchaAction: '/api/crowdsec/captcha',
        },
    },
};

export const getCrowdSecBouncer = async () => new CrowdSecBouncer(config);

export const checkIpRemediation = async (req: NextRequest) => {
    const ip = await getIpFromRequest(req);

    const checkUrl = `${req.nextUrl.origin}/api/crowdsec/remediation/${ip}`;
    try {
        const res = await fetch(checkUrl, { method: 'GET' });

        if (res.status !== 200) {
            const html = await res.text();
            return new NextResponse(html, {
                status: res.status,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }
    } catch (err) {
        console.error('CrowdSec check failed in middleware:', err);
    }
};
