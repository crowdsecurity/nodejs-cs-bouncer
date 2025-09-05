'use server';

import { NextRequest } from 'next/server';

export const getIpFromRequest = async (req: NextRequest): Promise<string> => {
    if (process.env.BOUNCED_IP) {
        return process.env.BOUNCED_IP;
    }

    let ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for'))?.split(',')[0].trim();

    // Normalize localhost IP
    if (ip === '::1') {
        ip = '127.0.0.1';
    }

    return ip ?? '0.0.0.1';
};
