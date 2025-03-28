export const SCOPE_IP = 'ip';

export const SCOPE_RANGE = 'range';

export const REMEDIATION_BAN = 'ban';

export const REMEDIATION_CAPTCHA = 'captcha';

export const REMEDIATION_BYPASS = 'bypass';

export const ORIGIN_LISTS = 'lists';

export const ORIGIN_LISTS_SEPARATOR = ':';

export const ORIGIN_CLEAN = 'clean';

export const ID_SEPARATOR = '-';

export const CACHE_SEPARATOR = '_';

export const CACHE_EXPIRATION_FOR_BAD_IP = 120;

export const CACHE_EXPIRATION_FOR_CLEAN_IP = 60;

export const CACHE_EXPIRATION_FOR_CAPTCHA_FLOW = 86400;

export const IP_TYPE_V4 = 'ipv4';

export const IPV4_BUCKET_SIZE = 256;

export const IP_TYPE_V6 = 'ipv6';

export const USER_AGENT_PREFIX = 'nodejs-cs-bouncer';

export enum REFRESH_KEYS {
    NEW = 'new',
    DELETED = 'deleted',
}

export enum BOUNCER_KEYS {
    REMEDIATION = 'remediation',
    ORIGIN = 'origin',
    CAPTCHA_PHRASE = 'captchaPhrase',
}

export const METRICS_TYPE = 'crowdsec-nodejs-bouncer';

export const VERSION = 'v0.1.0';
