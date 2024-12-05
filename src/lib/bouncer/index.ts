import { last, sortBy } from 'lodash';

import { getConfig } from 'src/helpers/config';
import { buildCachableDecision, convertRawDecisionsToDecisions } from 'src/helpers/decision';
import { getIpToRemediate, getIpOrRangeType, getFirstIpFromRange } from 'src/helpers/ip';
import { ORDERED_REMEDIATIONS } from 'src/lib/bouncer/constants';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import CacheStorage from 'src/lib/cache';
import { CachableDecisionContent } from 'src/lib/cache/types';
import { CACHE_EXPIRATION_FOR_CLEAN_IP, IP_TYPE_V6, ORIGIN_CLEAN, REMEDIATION_BYPASS, SCOPE_IP, SCOPE_RANGE } from 'src/lib/constants';
import LapiClient from 'src/lib/lapi-client';
import { GetDecisionsOptions } from 'src/lib/lapi-client/types';
import logger from 'src/lib/logger';
import { CachableDecision, Decision, Remediation } from 'src/lib/types';

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

    /**
     * Found decisions for an IP address and get the highest remediation found if there is multiple decisions about it.
     * @param ip The IP address to get the remediation for.
     * @param contents The decisions to filter.
     * @returns The highest remediation found, else the fallback remediation.
     */
    private getIpHighestRemediation = (ip: string, contents: CachableDecisionContent[] | null): Remediation => {
        if (!contents || contents.length === 0) {
            logger.debug('No cached contents found');
            return REMEDIATION_BYPASS;
        }
        // Get all known remediation types from decision contents
        const remediationTypes: Remediation[] = contents.map(({ value }) => {
            // If we don't know the remediation type, we fall back to the fallback remediation.
            if (ORDERED_REMEDIATIONS.indexOf(value) === -1) {
                return this.fallbackRemediation;
            }
            return value;
        });

        // Sort remediation types by priority
        const orderedRemediations = sortBy(remediationTypes, [(d) => ORDERED_REMEDIATIONS.indexOf(d)]);

        // The last remediation type is the higher priority remediation, could never be empty with previous checks
        const higherPriorityRemediation = last(orderedRemediations) as Remediation;

        logger.debug(`Higher priority remediation for IP ${ip} is ${higherPriorityRemediation}`);
        return higherPriorityRemediation ?? REMEDIATION_BYPASS;
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
        logger.debug(`Checking cache for IP ${ip}`);
        const allCachedDecisionContents = await this.cacheStorage.getAllCachableDecisionContents(ipToRemediate);

        let cachedDecisionContents = this.cacheStorage.pruneCachedDecisionContents(allCachedDecisionContents);

        logger.debug(`Cache found for IP ${ip}: ${JSON.stringify(cachedDecisionContents)}`);

        if (!cachedDecisionContents || cachedDecisionContents.length === 0) {
            // In stream_mode, we do not store this bypass, and we do not call LAPI directly
            if (getConfig('streamMode', this.configs)) {
                // @TODO updateRemediationOriginCount
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
        const remediation = this.getIpHighestRemediation(ipToRemediate, cachedDecisionContents);
        if (remediation !== REMEDIATION_BYPASS) {
            logger.info(`Remediation for IP ${ip} is ${remediation}`);
        }
        // @TODO updateRemediationOriginCount

        return remediation;
    };

    public refreshDecisions = async ({
        isFirstFetch = false,
        origins,
        scopes,
        scenariosContaining,
        scenariosNotContaining,
    }: GetDecisionsOptions = {}): Promise<{
        new: Decision[];
        deleted: Decision[];
    }> => {
        // @TODO store retrieved decisions in a cache
        return this.lapiClient.getDecisionStream({
            isFirstFetch,
            origins,
            scopes,
            scenariosContaining,
            scenariosNotContaining,
        });
    };
}

export default CrowdSecBouncer;
