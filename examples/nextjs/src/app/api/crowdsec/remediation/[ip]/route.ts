'use server';

import { getLogger } from '@/helpers';
import { getCrowdSecBouncer } from '@/helpers/crowdsec';
import { NextResponse } from 'next/server';

// Set up the logger for this example
const logger = getLogger();

export async function GET(_req: Request) {
    const bouncer = await getCrowdSecBouncer();
    const ip = _req.url.split('/').pop(); // Get the IP from the request URL

    if (!ip) {
        logger.warn('CrowdSec API route called without IP');
        return new NextResponse('IP not found', { status: 400 });
    }

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
