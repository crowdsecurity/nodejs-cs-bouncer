import { BOUNCING_LEVEL_DISABLED, BOUNCING_LEVEL_FLEX, BOUNCING_LEVEL_NORMAL } from './constants';
import { CacheConfigurations } from '../cache/types';
import { LapiClientConfigurations } from '../lapi-client/types';
import { WallsOptions } from '../rendered/types';
import { CachableOrigin, Remediation } from '../types';

type BouncingLevel = typeof BOUNCING_LEVEL_DISABLED | typeof BOUNCING_LEVEL_FLEX | typeof BOUNCING_LEVEL_NORMAL;

export type CrowdSecBouncerConfigurations = {
    fallbackRemediation?: Remediation; // fallback in case of unknown remediation
    bouncingLevel?: BouncingLevel; // bouncing level
    badIpCacheDuration?: number; // duration in seconds to cache bad IPs
    cleanIpCacheDuration?: number; // duration in seconds to cache clean IPs
    captchaFlowCacheDuration?: number; // duration in seconds to cache captcha flow
    streamMode?: boolean; // stream mode
    wallsOptions?: WallsOptions; // Ban and Captcha walls options
} & LapiClientConfigurations &
    CacheConfigurations;

export type CaptchaSubmission = {
    userPhrase: string;
    ip: string;
    origin: CachableOrigin;
    refresh: '0' | '1';
};
