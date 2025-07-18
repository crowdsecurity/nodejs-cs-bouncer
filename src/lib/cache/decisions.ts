import { CachableDecisionItem, CachableDecisionContent } from './types';

const getMaxExpiration = (valuesToCache: CachableDecisionContent[]): number => {
    return valuesToCache.reduce((maxExpiration, value) => {
        return Math.max(maxExpiration, value.expiresAt);
    }, 0);
};

export const updateDecisionItem = (item: CachableDecisionItem, valuesToCache: CachableDecisionContent[]): CachableDecisionItem => {
    const maxExpiration = getMaxExpiration(valuesToCache);
    item.content = valuesToCache;
    item.ttl = Math.max(maxExpiration - Date.now(), 0);

    return item;
};
