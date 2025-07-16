'use server';

import { CrowdSecBouncer } from '@crowdsec/nodejs-bouncer';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

const CROWDSEC_BOUNCER_API_KEY = process.env.CROWDSEC_BOUNCER_API_KEY;
const CROWDSEC_BOUNCER_API_URL = process.env.CROWDSEC_BOUNCER_API_URL;

if (!CROWDSEC_BOUNCER_API_KEY || !CROWDSEC_BOUNCER_API_URL) {
    throw new Error('Missing CrowdSec Bouncer API key or URL');
}

const bouncer = new CrowdSecBouncer({
    apiKey: process.env.CROWDSEC_BOUNCER_API_KEY,
    apiUrl: process.env.CROWDSEC_BOUNCER_API_URL,
});

export const validateRequestWithCrowdSec = async () => {
    const headersList = await headers();
    // Extract the IP address from the request headers
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';

    try {
        const decision = await bouncer.getIpRemediation(ip as string);
        if (decision) {
            // If the decision is to block, return a 403 response
            return new NextResponse('Forbidden by CrowdSec', { status: 403 });

            // We could redirect the user to a custom page or handle the decision differently
        }
    } catch (err) {
        // Log the error for debugging purposes
        console.error('CrowdSec check failed:', err);
    }
};
