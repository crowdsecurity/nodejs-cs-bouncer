import { NextResponse } from 'next/server';
import { CrowdSecBouncer, CrowdSecBouncerConfigurations } from '@crowdsec/nodejs-bouncer';
import { loadEnv } from '../../app/api/crowdsec/helpers';

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

export async function POST(req: Request) {
    const form = await req.formData();
    const ip = process.env.BOUNCED_IP!;
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
