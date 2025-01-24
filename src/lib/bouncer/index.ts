import { last, sortBy } from 'lodash';
import svgCaptcha from 'svg-captcha-fixed';

import { getConfig } from 'src/helpers/config';
import { buildCachableDecision, convertRawDecisionsToDecisions } from 'src/helpers/decision';
import { getFirstIpFromRange, getIpOrRangeType, getIpToRemediate } from 'src/helpers/ip';
import { CaptchaGenerator } from 'src/lib/bouncer/captcha';
import { CAPTCHA_REDIRECT, ORDERED_REMEDIATIONS } from 'src/lib/bouncer/constants';
import { CaptchaResolution, CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import CacheStorage from 'src/lib/cache';
import { CAPTCHA_FLOW } from 'src/lib/cache/constants';
import { getCacheKey } from 'src/lib/cache/helpers';
import { CachableCaptchaFlow, CachableDecisionContent, CachableOriginsCount, CaptchaFlow } from 'src/lib/cache/types';
import {
    BOUNCER_KEYS,
    CACHE_EXPIRATION_FOR_CAPTCHA_FLOW,
    CACHE_EXPIRATION_FOR_CLEAN_IP,
    IP_TYPE_V6,
    ORIGIN_CLEAN,
    REFRESH_KEYS,
    REMEDIATION_BYPASS,
    REMEDIATION_CAPTCHA,
    SCOPE_IP,
    SCOPE_RANGE,
} from 'src/lib/constants';
import LapiClient from 'src/lib/lapi-client';
import { GetDecisionsOptions } from 'src/lib/lapi-client/types';
import logger from 'src/lib/logger';
import { CachableDecision, CachableOrigin, Remediation } from 'src/lib/types';

class CrowdSecBouncer {
    private cacheStorage: CacheStorage;
    private lapiClient: LapiClient;
    private captcha: CaptchaGenerator;

    public fallbackRemediation: Remediation = REMEDIATION_BYPASS;

    constructor(
        private configs: CrowdSecBouncerConfigurations,
        captcha?: CaptchaGenerator,
    ) {
        logger.debug('Bouncer initialized.');
        this.fallbackRemediation = getConfig('fallbackRemediation', configs) ?? REMEDIATION_BYPASS;
        this.cacheStorage = new CacheStorage(configs);
        this.lapiClient = new LapiClient(configs);
        this.captcha = captcha ?? {
            create: () => {
                const result = svgCaptcha.create();
                return {
                    phraseToGuess: result.text,
                    inlineImage: result.data,
                };
            },
        };
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

    private createCaptcha = async (cacheKey: string, ttl: number): Promise<CaptchaFlow> => {
        const captcha = this.captcha.create();

        const content = {
            ...captcha,
            mustBeResolved: true,
            resolutionFailed: false,
            resolutionRedirect: CAPTCHA_REDIRECT,
        };

        const itemToCache = {
            key: cacheKey,
            content: content,
        };

        const captchaFlowItem = (await this.cacheStorage.adapter.setItem(itemToCache, ttl)) as CachableCaptchaFlow;

        return captchaFlowItem.content;
    };

    /**
     * Get the remediation for an IP address.
     * Depending on cache results and streamMode config, ask the LAPI for the decisions matching the IP address.
     * @param ip - The IP address to get the remediation for.
     * @returns The remediation and its origin for the IP address.
     */
    public getIpRemediation = async (
        ip: string,
    ): Promise<{
        [BOUNCER_KEYS.REMEDIATION]: Remediation;
        [BOUNCER_KEYS.ORIGIN]: CachableOrigin;
    }> => {
        const ipToRemediate = getIpToRemediate(ip);
        logger.debug(`Getting remediation for IP ${ip}`);

        // Check cached decisions for current IP
        const allCachedDecisionContents = await this.cacheStorage.getAllCachableDecisionContents(ipToRemediate);

        let cachedDecisionContents = this.cacheStorage.pruneCachedDecisionContents(allCachedDecisionContents);

        logger.debug(`Cache found for IP ${ip}: ${JSON.stringify(cachedDecisionContents)}`);

        if (!cachedDecisionContents || cachedDecisionContents.length === 0) {
            // In stream_mode, we do not store this bypass, and we do not call LAPI directly
            if (getConfig('streamMode', this.configs)) {
                return {
                    [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_BYPASS,
                    [BOUNCER_KEYS.ORIGIN]: ORIGIN_CLEAN,
                };
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
        const { remediation: initialRemediation, origin } = this.getIpHighestRemediationWithOrigin(ipToRemediate, cachedDecisionContents);
        let remediation = initialRemediation;
        if (remediation !== REMEDIATION_BYPASS) {
            logger.debug(`LAPI Remediation for IP ${ip} is ${remediation} with origin ${origin}`);
        }

        if (remediation === REMEDIATION_CAPTCHA && !(await this.mustSolveCaptcha(ip, remediation))) {
            remediation = REMEDIATION_BYPASS;
        }
        logger.info(`Final remediation for IP ${ip} is ${remediation}`);

        return {
            [BOUNCER_KEYS.REMEDIATION]: remediation,
            [BOUNCER_KEYS.ORIGIN]: origin,
        };
    };

    public updateRemediationOriginCount = async (origin: CachableOrigin, remediation: Remediation): Promise<CachableOriginsCount> => {
        logger.debug(`Increment count for origin ${origin} with remediation ${remediation}`);
        return this.cacheStorage.upsertMetricsOriginsCount({ origin, remediation });
    };

    public saveCaptchaFlow = async (ip: string, content?: Partial<CaptchaFlow>): Promise<CaptchaFlow> => {
        const cacheKey = getCacheKey(CAPTCHA_FLOW, ip);

        const duration = (getConfig('captchaFlowCacheDuration', this.configs) ?? CACHE_EXPIRATION_FOR_CAPTCHA_FLOW) * 1000;

        // Retrieve the existing captcha flow from the cache; if it doesn't exist, create a new one
        const existingItem = (await this.cacheStorage.adapter.getItem(cacheKey)) as CachableCaptchaFlow;
        const existingContent: CaptchaFlow = existingItem?.content || (await this.createCaptcha(cacheKey, duration));

        const updatedContent: CaptchaFlow = content
            ? {
                  ...existingContent,
                  ...content,
              }
            : existingContent;

        const itemToCache = {
            key: cacheKey,
            content: updatedContent,
        };

        const item = (await this.cacheStorage.adapter.setItem(itemToCache, duration)) as CachableCaptchaFlow;

        return item.content;
    };

    public refreshCaptchaFlow = async (ip: string): Promise<CaptchaFlow> => {
        const newCaptcha = this.captcha.create();

        const content = {
            ...newCaptcha,
            mustBeResolved: true,
            resolutionFailed: false,
        };

        return await this.saveCaptchaFlow(ip, content);
    };

    public getCaptchaFlow = async (ip: string): Promise<CaptchaFlow> => {
        const cacheKey = getCacheKey(CAPTCHA_FLOW, ip);

        const cachedCaptchaFlow = (await this.cacheStorage.adapter.getItem(cacheKey)) as CachableCaptchaFlow;

        return cachedCaptchaFlow.content;
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

    public handleCaptchaResolution = async ({
        ip,
        userPhrase,
        refresh,
    }: CaptchaResolution): Promise<{
        [BOUNCER_KEYS.REMEDIATION]: Remediation;
        [BOUNCER_KEYS.CAPTCHA_PHRASE]: string;
    }> => {
        if (refresh === '1') {
            const newCaptcha = await this.refreshCaptchaFlow(ip);
            return {
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: newCaptcha.phraseToGuess,
            };
        }

        const cacheKey = getCacheKey(CAPTCHA_FLOW, ip);
        const cachedCaptchaFlow = (await this.cacheStorage.adapter.getItem(cacheKey)) as CachableCaptchaFlow;

        const captchaFlow = cachedCaptchaFlow?.content;

        const remediation =
            (captchaFlow && !captchaFlow.mustBeResolved) || captchaFlow.phraseToGuess === userPhrase
                ? REMEDIATION_BYPASS
                : REMEDIATION_CAPTCHA;

        if (remediation === REMEDIATION_BYPASS) {
            logger.debug(`Captcha has been resolved by IP ${ip}`);
        }

        return { [BOUNCER_KEYS.REMEDIATION]: remediation, [BOUNCER_KEYS.CAPTCHA_PHRASE]: captchaFlow?.phraseToGuess };
    };

    public mustSolveCaptcha = async (ip: string, remediation: Remediation): Promise<boolean> => {
        if (remediation !== REMEDIATION_CAPTCHA) {
            return false;
        }

        const cacheKey = getCacheKey(CAPTCHA_FLOW, ip);
        const cachedCaptchaFlow = (await this.cacheStorage.adapter.getItem(cacheKey)) as CachableCaptchaFlow | null;

        const captchaFlow = cachedCaptchaFlow?.content;
        if (!captchaFlow) {
            return true;
        }
        if (!captchaFlow.mustBeResolved) {
            logger.debug(`Captcha has already been resolved by IP ${ip}`);
            return false;
        }

        return true;
    };
}

export default CrowdSecBouncer;
