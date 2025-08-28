import { NextRequest, NextResponse } from 'next/server';
import { getCrowdSecBouncer } from '@/helpers/crowdsec';
import { getIpFromRequest } from '@/helpers/ip';

export async function POST(req: NextRequest) {
    const bouncer = await getCrowdSecBouncer();

    const ip = await getIpFromRequest(req);
    const form = await req.formData();
    const phrase = form.get('phrase')?.toString() || '';
    const refresh = (form.get('crowdsec_captcha_refresh')?.toString() as '1') || '0';

    try {
        const remediationData = await bouncer.getIpRemediation(ip);
        const { origin } = remediationData;
        await bouncer.handleCaptchaSubmission({ ip, userPhrase: phrase, refresh, origin });
        const captchaSuccessUrl = '/';
        return NextResponse.redirect(new URL(captchaSuccessUrl, req.url));
    } catch (err) {
        console.error('[CrowdSec] captcha submission failed:', err);
        return new NextResponse('Captcha verification failed.', { status: 400 });
    }
}
