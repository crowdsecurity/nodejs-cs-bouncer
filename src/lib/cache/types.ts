import { CacheAdapter } from 'src/lib/cache/interfaces';
import { DecisionOrigin, CachableDecisionIdentifier, RemediationType, CachableDecisionExpiresAt } from 'src/lib/types';

export type CachableDecisionContent = {
    id: CachableDecisionIdentifier;
    origin: DecisionOrigin;
    expiresAt: CachableDecisionExpiresAt;
    value: RemediationType;
};

export type CachedItem<T = unknown> = {
    key: string;
    content: T;
    ttl?: number; // Time to live in milliseconds
};

export type CachableDecisionItem = CachedItem<CachableDecisionContent[]>;

export type CacheConfigurations = {
    cacheAdapter?: CacheAdapter;
};
