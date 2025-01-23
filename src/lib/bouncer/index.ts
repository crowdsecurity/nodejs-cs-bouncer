import { last, sortBy } from 'lodash';

import { getConfig } from 'src/helpers/config';
import { buildCachableDecision, convertRawDecisionsToDecisions } from 'src/helpers/decision';
import { getIpToRemediate, getIpOrRangeType, getFirstIpFromRange } from 'src/helpers/ip';
import { ORDERED_REMEDIATIONS } from 'src/lib/bouncer/constants';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import CacheStorage from 'src/lib/cache';
import { CachableDecisionContent, CachableOriginsCount } from 'src/lib/cache/types';
import {
    CACHE_EXPIRATION_FOR_CLEAN_IP,
    IP_TYPE_V6,
    ORIGIN_CLEAN,
    REMEDIATION_BYPASS,
    SCOPE_IP,
    SCOPE_RANGE,
    REFRESH_KEYS,
} from 'src/lib/constants';
import LapiClient from 'src/lib/lapi-client';
import { GetDecisionsOptions } from 'src/lib/lapi-client/types';
import logger from 'src/lib/logger';
import { CachableDecision, Remediation, CachableOrigin } from 'src/lib/types';

class CrowdSecBouncer {
    private cacheStorage: CacheStorage;
    private lapiClient: LapiClient;

    public fallbackRemediation: Remediation = REMEDIATION_BYPASS;

    constructor(private configs: CrowdSecBouncerConfigurations) {
        logger.debug('Bouncer initialized.');
        // fallback in case of unknown remediation
        this.fallbackRemediation = getConfig('fallbackRemediation', configs) ?? REMEDIATION_BYPASS;
        this.cacheStorage = new CacheStorage(configs);
        this.lapiClient = new LapiClient(configs);
    }

    private getIpHighestRemediationWithOrigin = (
        ip: string,
        contents: CachableDecisionContent[] | null,
    ): { remediation: Remediation; origin: CachableOrigin } => {
        if (!contents || contents.length === 0) {
            logger.debug('No cached contents found');
            return { remediation: REMEDIATION_BYPASS, origin: ORIGIN_CLEAN };
        }

        // Map the remediation values with their associated origins
        const remediationWithOrigins = contents.map(({ value, origin }) => ({
            remediation: ORDERED_REMEDIATIONS.includes(value) ? value : this.fallbackRemediation,
            origin,
        }));

        // Sort the remediationWithOrigins array by remediation priority
        const orderedRemediationsWithOrigins = sortBy(remediationWithOrigins, (entry) => ORDERED_REMEDIATIONS.indexOf(entry.remediation));

        // The last element contains the highest-priority remediation and its origin
        const { remediation, origin } = last(orderedRemediationsWithOrigins) ?? {
            remediation: REMEDIATION_BYPASS,
            origin: ORIGIN_CLEAN,
        };

        logger.debug(`Higher priority remediation for IP ${ip} is ${remediation} with origin ${origin}`);
        return { remediation, origin };
    };

    /**
     * Convert IPV6 range scoped decisions to IP scoped decisions.
     * @param decisions
     * @private
     */
    private handleIpV6RangeDecisions(decisions: CachableDecision[]): CachableDecision[] {
        return decisions.map((decision) => {
            if (SCOPE_RANGE === decision.scope && IP_TYPE_V6 === getIpOrRangeType(decision.value)) {
                return {
                    ...decision,
                    value: getFirstIpFromRange(decision.value),
                    scope: SCOPE_IP,
                };
            }
            return decision;
        });
    }

    /**
     * Get the remediation for an IP address.
     * Depending on cache results and streamMode config, ask the LAPI for the decisions matching the IP address.
     * @param ip - The IP address to get the remediation for.
     * @returns The remediation for the IP address.
     */
    public getIpRemediation = async (ip: string): Promise<Remediation> => {
        const ipToRemediate = getIpToRemediate(ip);

        // Check cached decisions for current IP
        const allCachedDecisionContents = await this.cacheStorage.getAllCachableDecisionContents(ipToRemediate);

        let cachedDecisionContents = this.cacheStorage.pruneCachedDecisionContents(allCachedDecisionContents);

        logger.debug(`Cache found for IP ${ip}: ${JSON.stringify(cachedDecisionContents)}`);

        if (!cachedDecisionContents || cachedDecisionContents.length === 0) {
            // In stream_mode, we do not store this bypass, and we do not call LAPI directly
            if (getConfig('streamMode', this.configs)) {
                await this.updateRemediationOriginCount(ORIGIN_CLEAN, REMEDIATION_BYPASS);
                return REMEDIATION_BYPASS;
            }

            const rawIpDecisions = await this.lapiClient.getDecisionsMatchingIp(ipToRemediate);

            const ipDecisions = convertRawDecisionsToDecisions(rawIpDecisions ?? [], this.configs);
            // IPV6 range scoped decisions are not yet stored in cache, so we store it as IP scoped decisions
            const finalIpDecisions = this.handleIpV6RangeDecisions(ipDecisions);

            const cachableDecisions =
                finalIpDecisions && finalIpDecisions.length > 0
                    ? finalIpDecisions
                    : [
                          buildCachableDecision({
                              type: REMEDIATION_BYPASS,
                              scope: SCOPE_IP,
                              value: ip,
                              origin: ORIGIN_CLEAN,
                              expiresAt:
                                  Date.now() + (getConfig('cleanIpCacheDuration', this.configs) ?? CACHE_EXPIRATION_FOR_CLEAN_IP) * 1000,
                          }),
                      ];

            cachedDecisionContents = await this.cacheStorage.storeDecisions(cachableDecisions);
        }
        const { remediation, origin } = this.getIpHighestRemediationWithOrigin(ipToRemediate, cachedDecisionContents);
        logger.debug(`Remediation for IP ${ip} is ${remediation} with origin ${origin}`);
        if (remediation !== REMEDIATION_BYPASS) {
            logger.info(`Remediation for IP ${ip} is ${remediation}`);
        }
        await this.updateRemediationOriginCount(origin, remediation);

        return remediation;
    };

    private updateRemediationOriginCount = async (origin: CachableOrigin, remediation: Remediation): Promise<CachableOriginsCount> => {
        logger.debug(`Increment count for origin ${origin} with remediation ${remediation}`);
        return this.cacheStorage.upsertMetricsOriginsCount({ origin, remediation });
    };

    public refreshDecisions = async ({ origins, scopes, scenariosContaining, scenariosNotContaining }: GetDecisionsOptions = {}): Promise<
        Record<REFRESH_KEYS, CachableDecisionContent[]>
    > => {
        const isWarm = await this.cacheStorage.isWarm();
        if (!isWarm) {
            logger.info('Decisions cache is not warmed up yet');
        }

        const rawDecisions = await this.lapiClient.getDecisionStream({
            isFirstFetch: !isWarm,
            origins,
            scopes,
            scenariosContaining,
            scenariosNotContaining,
        });

        const newDecisions = convertRawDecisionsToDecisions(rawDecisions[REFRESH_KEYS.NEW] ?? [], this.configs);
        const deletedDecisions = convertRawDecisionsToDecisions(rawDecisions[REFRESH_KEYS.DELETED] ?? [], this.configs);

        const storedDecisions = await this.cacheStorage.storeDecisions(newDecisions);
        const removedDecisions = await this.cacheStorage.removeDecisions(deletedDecisions);

        return {
            [REFRESH_KEYS.NEW]: storedDecisions,
            [REFRESH_KEYS.DELETED]: removedDecisions,
        };
    };
}

export default CrowdSecBouncer;
