import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    if (pathname === '/crowdsec-captcha') {
        return NextResponse.next();
    }

    const acceptHeader = req.headers.get('accept') || '';

    // Only run middleware for full HTML page requests
    if (!acceptHeader.includes('text/html')) {
        return NextResponse.next();
    }
    const checkUrl = `${req.nextUrl.origin}/api/crowdsec`;

    try {
        const res = await fetch(checkUrl, {
            method: 'POST',
        });

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

    return NextResponse.next();
}
