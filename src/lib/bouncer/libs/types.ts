import { CacheConfigurations } from 'src/lib/cache/libs/types';
import { LapiClientConfigurations } from 'src/lib/lapi-client/libs/types';
import { RemediationType } from 'src/lib/types';

export type CrowdSecBouncerConfigurations = {
    fallbackRemediation?: RemediationType; // fallback in case of unknown remediation
    badIpCacheDuration?: number; // duration in seconds to cache bad IPs
    cleanIpCacheDuration?: number; // duration in seconds to cache clean IPs
    streamMode?: boolean; // stream mode
} & LapiClientConfigurations &
    CacheConfigurations;
