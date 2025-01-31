import { max } from 'lodash';

import { getIpV4Range, IpV4Range, getIpOrRangeType, getIpV4RangeIntForIp, isIpV4InRange } from 'src/helpers/ip';
import { CONFIG, WARMUP, IPV4_BUCKET_KEY, ORIGINS_COUNT_KEY } from 'src/lib/cache/constants';
import { updateDecisionItem } from 'src/lib/cache/decisions';
import { getCacheKey } from 'src/lib/cache/helpers';
import InMemory from 'src/lib/cache/in-memory';
import { CacheAdapter } from 'src/lib/cache/interfaces';
import { CachableDecisionContent, CachableDecisionItem, CacheConfigurations, CachableOriginsCount, OriginCount } from 'src/lib/cache/types';
import { SCOPE_IP, SCOPE_RANGE, IP_TYPE_V4 } from 'src/lib/constants';
import logger from 'src/lib/logger';
import { CachableDecision, CachableIdentifier, Value, Remediation, CachableOrigin } from 'src/lib/types';

type UpsertMetricsOriginsCountParams = {
    origin: CachableOrigin;
    remediation: Remediation;
    delta?: number;
    ttl?: number;
};

type GetUpdatedOriginsCountParams = {
    content: OriginCount[];
    origin: CachableOrigin;
    remediation: Remediation;
    delta?: number;
};

class CacheStorage {
    public adapter: CacheAdapter;

    constructor(configs: CacheConfigurations) {
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

    public async isWarm(): Promise<boolean> {
        const cacheKey = getCacheKey(CONFIG, WARMUP);
        return (await this.adapter.getItem(cacheKey)) !== null;
    }

    public async getAllCachableDecisionContents(ip: string): Promise<CachableDecisionContent[]> {
        // Ask cache for Ip scoped decision
        const ipContents = await this.retrieveDecisionContentsForIp(SCOPE_IP, ip);
        // Ask cache for Range scoped decision (Only for IPV4)
        const rangeContents = getIpOrRangeType(ip) === IP_TYPE_V4 ? await this.retrieveDecisionContentsForIp(SCOPE_RANGE, ip) : [];
        return [...ipContents, ...rangeContents];
    }

    /**
     * Check if some identifier is already cached.
     */
    private getCachedIndex(identifier: CachableIdentifier, cachedValues: CachableDecisionContent[]): number | null {
        const result = cachedValues.findIndex((item) => item.id === identifier);

        return result === -1 ? null : result;
    }

    public pruneCachedDecisionContents(cachedValues: CachableDecisionContent[]): CachableDecisionContent[] {
        const currentTime = Date.now();

        return cachedValues.filter((cachedValue) => {
            return !(cachedValue.expiresAt !== undefined && currentTime > cachedValue.expiresAt);
        });
    }

    private formatDecision(decision: CachableDecision, mainValue: Remediation | Value): CachableDecisionContent {
        return {
            id: decision.identifier,
            origin: decision.origin,
            expiresAt: decision.expiresAt,
            value: mainValue,
        };
    }

    private async remove({
        decision,
        cacheKey,
    }: {
        decision: CachableDecision;
        cacheKey: string;
    }): Promise<CachableDecisionContent | null> {
        const item = (await this.adapter.getItem(cacheKey)) as CachableDecisionItem;
        const cachedValues = item?.content || [];
        const indexToRemove = this.getCachedIndex(decision.identifier, cachedValues);

        // Early return if not in cache
        if (indexToRemove === null) {
            logger.debug(`Decision to remove is not in cache: ${decision.identifier}`);
            return null;
        }

        const removed = cachedValues.splice(indexToRemove, 1)[0] as CachableDecisionContent;

        // Remove expired decisions if any
        const decisionsToCache = this.pruneCachedDecisionContents(cachedValues);

        // Rebuild cache item
        const itemToSave = updateDecisionItem(item, decisionsToCache);
        logger.debug(`Removing decision: ${JSON.stringify(removed)}`);
        await this.adapter.setItem(itemToSave, itemToSave.ttl);

        return removed;
    }

    private async store({
        decision,
        cacheKey,
        mainValue,
    }: {
        decision: CachableDecision;
        cacheKey: string;
        mainValue: Remediation | Value; // Value when storing range scoped decisions using bucket, Remediation otherwise
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

    private async removeIpBucketDecision(decision: CachableDecision, bucketInt: number): Promise<CachableDecisionContent | null> {
        const cacheKey = getCacheKey(IPV4_BUCKET_KEY, bucketInt.toString());
        return this.remove({ decision, cacheKey });
    }

    private async storeIpDecision(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const cacheKey = getCacheKey(decision.scope, decision.value);
        return this.store({ decision, cacheKey, mainValue: decision.type });
    }

    private async removeIpDecision(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const cacheKey = getCacheKey(decision.scope, decision.value);
        return this.remove({ decision, cacheKey });
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

    private async storeRangeScoped(decision: CachableDecision): Promise<CachableDecisionContent | null> {
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

    private async removeRangeScoped(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const range = this.manageRange(decision);
        if (!range) {
            return null;
        }
        const { start, end } = range;
        for (let i = start; i <= end; i++) {
            await this.removeIpBucketDecision(decision, i);
        }

        return await this.removeIpDecision(decision);
    }

    private async storeDecision(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const scope = decision.scope;
        switch (scope) {
            case SCOPE_IP:
                logger.debug(`Storing IP decision: ${decision.value}`);
                return this.storeIpDecision(decision);
            case SCOPE_RANGE:
                return this.storeRangeScoped(decision);
            default:
                logger.warn(`Unsupported scope: ${scope}`);
                return null;
        }
    }

    private async removeDecision(decision: CachableDecision): Promise<CachableDecisionContent | null> {
        const scope = decision.scope;
        switch (scope) {
            case SCOPE_IP:
                logger.debug(`Removing IP decision: ${decision.value}`);
                return this.removeIpDecision(decision);
            case SCOPE_RANGE:
                return this.removeRangeScoped(decision);
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

    public async removeDecisions(decisions: CachableDecision[]): Promise<CachableDecisionContent[]> {
        // Remove decisions from cache
        const results = await Promise.all(decisions.map((decision) => this.removeDecision(decision)));
        logger.debug(`Removed decisions: ${JSON.stringify(results)}`);
        return results.filter((item): item is CachableDecisionContent => item !== null);
    }

    public async upsertMetricsOriginsCount(params: UpsertMetricsOriginsCountParams): Promise<CachableOriginsCount> {
        const { origin, remediation, delta } = params;
        const cacheItem = (await this.adapter.getItem(ORIGINS_COUNT_KEY)) as CachableOriginsCount | null;
        const itemContent = cacheItem?.content ?? [];
        const updatedContent = this.getUpdatedOriginsCount({ content: itemContent, origin, remediation, delta });
        logger.debug(`Updated origins count: ${JSON.stringify(updatedContent)}`);

        const itemToCache = {
            key: ORIGINS_COUNT_KEY,
            content: updatedContent,
        };

        return (await this.adapter.setItem(itemToCache)) as CachableOriginsCount;
    }

    private getUpdatedOriginsCount(params: GetUpdatedOriginsCountParams): OriginCount[] {
        const { content, origin, remediation, delta } = params;
        const existingOrigin = content.find((item) => item.origin === origin);

        if (existingOrigin) {
            // Return a new array with the updated remediation count for the existing origin
            // By default, we increment the count by 1
            return content.map((item) => {
                const currentCount = item.remediation[remediation] || 0;
                const finalCount = max([0, currentCount + (delta || 1)]) as number;

                return item.origin === origin
                    ? {
                          ...item,
                          remediation: {
                              ...item.remediation,
                              [remediation]: finalCount,
                          },
                      }
                    : item;
            });
        }

        // Return a new array with the added origin and initial remediation count
        return [
            ...content,
            {
                origin,
                remediation: {
                    [remediation]: max([0, delta || 1]) as number, // Set the initial count for the provided remediation type
                },
            },
        ];
    }
}

export default CacheStorage;
