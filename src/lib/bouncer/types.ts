import { CaptchaObj } from 'src/lib/bouncer/captcha';
import { CacheConfigurations } from 'src/lib/cache/types';
import { LapiClientConfigurations } from 'src/lib/lapi-client/types';
import { Remediation } from 'src/lib/types';

export type CrowdSecBouncerConfigurations = {
    fallbackRemediation?: Remediation; // fallback in case of unknown remediation
    badIpCacheDuration?: number; // duration in seconds to cache bad IPs
    cleanIpCacheDuration?: number; // duration in seconds to cache clean IPs
    captchaFlowCacheDuration?: number; // duration in seconds to cache captcha flow
    streamMode?: boolean; // stream mode
} & LapiClientConfigurations &
    CacheConfigurations;

export type CaptchaResolution = {
    userPhrase: string;
    ip: string;
    refresh: string;
};
