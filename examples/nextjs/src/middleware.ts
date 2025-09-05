import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkIpRemediation as checkRequestRemediation } from './helpers/crowdsec';

export async function middleware(req: NextRequest) {
    // Check CrowdSec remediation, and redirect if necessary using the given response
    const res = await checkRequestRemediation(req);
    if (res) return res;

    return NextResponse.next();
}

export const config = {
    matcher: [
        // match all routes except static files and APIs
        '/((?!api|_next/static|_next/image|fonts/|favicon.ico).*)',
    ],
    runtime: 'nodejs', // Mandatory for CrowdSec to work properly
};
