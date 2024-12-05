import { getIpV4Range, IpV4Range, getIpOrRangeType, getIpV4RangeIntForIp, isIpV4InRange } from 'src/helpers/ip';
import { updateDecisionItem } from 'src/lib/cache/libs/decisions';
import { getCacheKey } from 'src/lib/cache/libs/helpers';
import InMemory from 'src/lib/cache/libs/in-memory';
import { CacheAdapter } from 'src/lib/cache/libs/interfaces';
import { CachableDecisionContent, CachableDecisionItem, CacheConfigurations } from 'src/lib/cache/libs/types';
import { SCOPE_IP, SCOPE_RANGE, IPV4_BUCKET_KEY, IP_TYPE_V4 } from 'src/lib/constants';
import logger from 'src/lib/logger';
import { CachableDecision, CachableDecisionIdentifier, DecisionValue, RemediationType } from 'src/lib/types';

class CacheStorage {
    private adapter: CacheAdapter;

    constructor(private configs: CacheConfigurations) {
        this.adapter = configs.cacheAdapter || new InMemory();
    }

    private async retrieveDecisionContentsForIp(scope: string, ip: string): Promise<CachableDecisionContent[]> {
        switch (scope) {
            case SCOPE_IP: {
                const cacheKey = getCacheKey(SCOPE_IP, ip);
                const item = (await this.adapter.getItem(cacheKey)) as CachableDecisionItem;
                return item && item.content && item.content.length > 0 ? item.content : [];
            }
            case SCOPE_RANGE: {
                const cachedContents = [];
                const bucketInt = getIpV4RangeIntForIp(ip);
                const bucketCacheKey = getCacheKey(IPV4_BUCKET_KEY, bucketInt.toString());
                const bucketItem = (await this.adapter.getItem(bucketCacheKey)) as CachableDecisionItem;
                const bucketContents = bucketItem && bucketItem.content && bucketItem.content.length > 0 ? bucketItem.content : [];
                for (const content of bucketContents) {
                    const rangeString = content.value;
                    if (isIpV4InRange(ip, rangeString)) {
                        const cacheKey = getCacheKey(SCOPE_RANGE, rangeString);
                        const item = (await this.adapter.getItem(cacheKey)) as CachableDecisionItem;
                        if (item && item.content && item.content.length > 0) {
                            cachedContents.push(...item.content);
                        }
                    }
                }

                return cachedContents;
            }
            default:
                logger.warn(`Unsupported scope: ${scope}`);
                return [];
        }
    }

    public async getAllCachableDecisionContents(ip: string): Promise<CachableDecisionContent[]> {
        // Ask cache for Ip scoped decision
        const ipContents = await this.retrieveDecisionContentsForIp(SCOPE_IP, ip);
        logger.debug(`IP contents: ${JSON.stringify(ipContents)}`);
        // Ask cache for Range scoped decision (Only for IPV4)
        const rangeContents = getIpOrRangeType(ip) === IP_TYPE_V4 ? await this.retrieveDecisionContentsForIp(SCOPE_RANGE, ip) : [];
        logger.debug(`Range contents: ${JSON.stringify(rangeContents)}`);
        return [...ipContents, ...rangeContents];
    }

    /**
     * Check if some identifier is already cached.
     */
    private getCachedIndex(identifier: CachableDecisionIdentifier, cachedValues: CachableDecisionContent[]): number | null {
        const result = cachedValues.findIndex((item) => item.id === identifier);

        return result === -1 ? null : result;
    }

    public pruneCachedDecisionContents(cachedValues: CachableDecisionContent[]): CachableDecisionContent[] {
        const currentTime = Date.now();

        return cachedValues.filter((cachedValue) => {
            return !(cachedValue.expiresAt !== undefined && currentTime > cachedValue.expiresAt);
        });
    }

    private formatDecision(decision: CachableDecision, mainValue: RemediationType | DecisionValue): CachableDecisionContent {
        return {
            id: decision.identifier,
            origin: decision.origin,
            expiresAt: decision.expiresAt,
            value: mainValue,
        };
    }

    private async store({
        decision,
        cacheKey,
        mainValue,
    }: {
        decision: CachableDecision;
        cacheKey: string;
        mainValue: RemediationType | DecisionValue;
    }): Promise<CachableDecisionContent | null> {
        const item = (await this.adapter.getItem(cacheKey)) as CachableDecisionItem;
        const cachedValues = item?.content || [];
        const indexToStore = this.getCachedIndex(decision.identifier, cachedValues);

        // Early return if already in cache
        if (indexToStore !== null) {
            logger.debug(`Decision already in cache: ${decision.identifier}`);
            return null;
        }

        // Remove expired decisions if any
        const cleanedValues = this.pruneCachedDecisionContents(cachedValues);

        // Merge current value with cached values (if any)
        const currentValue = this.formatDecision(decision, mainValue);
        const decisionsToCache = [...cleanedValues, currentValue];

        // Rebuild cache item
        const itemToSave = updateDecisionItem(item, decisionsToCache);
        logger.debug(`Storing decision item: ${JSON.stringify(itemToSave)}`);
        await this.adapter.setItem(itemToSave, itemToSave.ttl);

        return currentValue;
    }

    private async storeIpBucketDecision(decision: CachableDecision, bucketInt: number): Promise<CachableDecisionContent | null> {
        const cacheKey = getCacheKey(IPV4_BUCKET_KEY, bucketInt.toString());
        return this.store({ decision, cacheKey, mainValue: decision.value });
    }

    private async storeIpDecision(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const cacheKey = getCacheKey(decision.scope, decision.value);
        return this.store({ decision, cacheKey, mainValue: decision.type });
    }

    private manageRange(decision: CachableDecision): IpV4Range | null {
        const rangeString = decision.value;
        try {
            return getIpV4Range(rangeString);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Error getting range: ${error.message}`);
            } else {
                logger.error(`An unexpected error occurred while getting range of: ${rangeString}`);
            }
            return null;
        }
    }

    private async handleRangeScoped(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const range = this.manageRange(decision);
        if (!range) {
            return null;
        }
        const { start, end } = range;
        for (let i = start; i <= end; i++) {
            await this.storeIpBucketDecision(decision, i);
        }

        return await this.storeIpDecision(decision);
    }

    private async storeDecision(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const scope = decision.scope;
        switch (scope) {
            case SCOPE_IP:
                logger.debug(`Storing IP decision: ${decision.value}`);
                return this.storeIpDecision(decision);
            case SCOPE_RANGE:
                return this.handleRangeScoped(decision);
            default:
                logger.warn(`Unsupported scope: ${scope}`);
                return null;
        }
    }

    public async storeDecisions(decisions: CachableDecision[]): Promise<CachableDecisionContent[]> {
        // Store decisions in cache
        const results = await Promise.all(decisions.map((decision) => this.storeDecision(decision)));
        logger.debug(`Stored decisions: ${JSON.stringify(results)}`);
        return results.filter((item): item is CachableDecisionContent => item !== null);
    }
}

export default CacheStorage;
