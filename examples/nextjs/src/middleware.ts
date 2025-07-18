import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { validateRequestWithCrowdSec } from '../libs/crowdsec';

// force Node.js runtime for this middleware
export const config = {
    runtime: 'nodejs', // ← switch from Edge to Node.js
    matcher: ['/:path*'], // ← or whatever paths you need
};

export async function middleware(_req: NextRequest) {
    console.log('Middleware triggered: validating request with CrowdSec');
    const crowdsecResponse = await validateRequestWithCrowdSec();

    if (crowdsecResponse) {
        // This returns your CrowdSec response (e.g., Forbidden)
        return crowdsecResponse;
    }

    return NextResponse.next();
}
