import { CachableOrigin, CachableIdentifier, Remediation, CachableExpiresAt } from '../types';
import { CacheAdapter } from './interfaces';
import { CaptchaObj } from '../bouncer/captcha';

export type CachableDecisionContent = {
    id: CachableIdentifier;
    origin: CachableOrigin;
    expiresAt: CachableExpiresAt;
    value: Remediation;
};

export type OriginCount = {
    origin: CachableOrigin;
    remediation: Record<Remediation, number>;
};

export type CachableItem<T = unknown> = {
    key: string;
    content: T;
    ttl?: number; // Time to live in milliseconds
};

export type CaptchaFlow = CaptchaObj & {
    mustBeResolved: boolean;
    resolutionFailed: boolean;
};

export type CachableDecisionItem = CachableItem<CachableDecisionContent[]>;

export type CachableOriginsCount = CachableItem<OriginCount[]>;

export type CachableCaptchaFlow = CachableItem<CaptchaFlow>;

export type CacheConfigurations = {
    cacheAdapter?: CacheAdapter;
};
