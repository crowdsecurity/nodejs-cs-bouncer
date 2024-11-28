import { updateDecisionItem } from 'src/lib/cache/libs/decisions';
import { getCacheKey } from 'src/lib/cache/libs/helpers';
import InMemory from 'src/lib/cache/libs/in-memory';
import { CacheAdapter } from 'src/lib/cache/libs/interfaces';
import { CachableDecisionContent, CachableDecisionItem, CacheConfigurations } from 'src/lib/cache/libs/types';
import { SCOPE_IP } from 'src/lib/constants';
import logger from 'src/lib/logger';
import { CachableDecision, CachableDecisionIdentifier } from 'src/lib/types';

class CacheStorage {
    private adapter: CacheAdapter;

    constructor(private configs: CacheConfigurations) {
        this.adapter = configs.cacheAdapter || new InMemory();
    }

    public async getAllCachableDecisions(ip: string): Promise<CachableDecisionItem> {
        // Ask cache for Ip scoped decision
        //const ipDecisions = await this.retrieveDecisionsForIp(SCOPE_IP, ip);

        const cacheKey = getCacheKey(SCOPE_IP, ip);
        return (await this.adapter.getItem(cacheKey)) as CachableDecisionItem;
    }

    /**
     * Check if some identifier is already cached.
     */
    private getCachedIndex(identifier: CachableDecisionIdentifier, cachedValues: CachableDecisionContent[]): number | null {
        const result = cachedValues.findIndex((item) => item.id === identifier);

        return result === -1 ? null : result;
    }

    private pruneCachedDecisions(cachedValues: CachableDecisionContent[]): CachableDecisionContent[] {
        const currentTime = Date.now();

        return cachedValues.filter((cachedValue) => {
            return !(cachedValue.expiresAt !== undefined && currentTime > cachedValue.expiresAt);
        });
    }

    private formatDecision(decision: CachableDecision): CachableDecisionContent {
        return {
            id: decision.identifier,
            origin: decision.origin,
            expiresAt: decision.expiresAt,
            value: decision.type,
        };
    }

    private async storeIpDecision(decision: CachableDecision): Promise<CachableDecisionItem | null> {
        const cacheKey = getCacheKey(decision.scope, decision.value);
        const item = (await this.adapter.getItem(cacheKey)) as CachableDecisionItem;
        const cachedValues = item?.content || [];
        const indexToStore = this.getCachedIndex(decision.identifier, cachedValues);
        // Early return if already in cache;
        if (null !== indexToStore) {
            logger.debug(`Decision already in cache: ${decision.identifier}`);
            return null;
        }
        // Remove expired decisions if any
        const cleanedValues = this.pruneCachedDecisions(cachedValues);
        // Merge current value with cached values (if any).
        const decisionsToCache = [...cleanedValues, ...[this.formatDecision(decision)]];
        // Rebuild cache item
        const itemToSave = updateDecisionItem(item, decisionsToCache);
        logger.debug(`Storing decision item: ${JSON.stringify(itemToSave)}`);

        return (await this.adapter.setItem(itemToSave, itemToSave.ttl)) as CachableDecisionItem;
    }

    private async storeDecision(decision: CachableDecision): Promise<CachableDecisionItem | null> {
        const scope = decision.scope;
        switch (scope) {
            case SCOPE_IP:
                logger.debug(`Storing IP decision: ${decision.value}`);
                return this.storeIpDecision(decision);
            default:
                // @TODO SCOPE_RANGE
                logger.warn(`Unsupported scope: ${scope}`);
                return null;
        }
    }

    public async storeDecisions(decisions: CachableDecision[]): Promise<CachableDecisionItem[]> {
        // Store decisions in cache
        const results = await Promise.all(decisions.map((decision) => this.storeDecision(decision)));
        logger.debug(`Stored decisions: ${JSON.stringify(results)}`);
        return results.filter((item): item is CachableDecisionItem => item !== null);
    }
}

export default CacheStorage;
