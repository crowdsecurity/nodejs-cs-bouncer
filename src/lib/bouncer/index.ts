import { last, sortBy } from 'lodash';
import svgCaptcha from 'svg-captcha-fixed';

import { buildCachableDecision, convertRawDecisionsToDecisions } from 'src/helpers/decision';
import { getFirstIpFromRange, getIpOrRangeType, getIpToRemediate } from 'src/helpers/ip';
import { CaptchaGenerator } from 'src/lib/bouncer/captcha';
import {
    BOUNCING_LEVEL_DISABLED,
    BOUNCING_LEVEL_FLEX,
    BOUNCING_LEVEL_NORMAL,
    ORDERED_REMEDIATIONS,
    CAPTCHA_ERROR,
} from 'src/lib/bouncer/constants';
import { CaptchaSubmission, CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import CacheStorage from 'src/lib/cache';
import { CAPTCHA_FLOW, ORIGINS_COUNT_KEY } from 'src/lib/cache/constants';
import { getCacheKey } from 'src/lib/cache/helpers';
import { CachableCaptchaFlow, CachableDecisionContent, CachableOriginsCount, CaptchaFlow, OriginCount } from 'src/lib/cache/types';
import {
    BOUNCER_KEYS,
    CACHE_EXPIRATION_FOR_CAPTCHA_FLOW,
    CACHE_EXPIRATION_FOR_CLEAN_IP,
    IP_TYPE_V6,
    METRICS_TYPE,
    ORIGIN_CLEAN,
    REFRESH_KEYS,
    REMEDIATION_BAN,
    REMEDIATION_BYPASS,
    REMEDIATION_CAPTCHA,
    SCOPE_IP,
    SCOPE_RANGE,
} from 'src/lib/constants';
import LapiClient from 'src/lib/lapi-client';
import { MetricsBuilder, MetricItem } from 'src/lib/lapi-client/metrics';
import { GetDecisionsOptions } from 'src/lib/lapi-client/types';
import logger from 'src/lib/logger';
import { renderBanWall, renderCaptchaWall } from 'src/lib/rendered';
import { BanWallOptions, CaptchaWallOptions, WallsOptions } from 'src/lib/rendered/types';
import { CachableDecision, CachableOrigin, Remediation } from 'src/lib/types';

type CaptchaCreation = {
    cacheKey: string;
    ttl: number;
};

type RemediationResult = {
    status: number;
    html: string;
};

type GetResponseParams = {
    ip: string;
    remediation: Remediation;
    origin: CachableOrigin;
};

class CrowdSecBouncer {
    public readonly cacheStorage: CacheStorage;
    private readonly captcha: CaptchaGenerator;
    public readonly configs: CrowdSecBouncerConfigurations;
    public readonly lapiClient: LapiClient;

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
            if (this.configs.streamMode) {
                return {
                    [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_BYPASS,
                    [BOUNCER_KEYS.ORIGIN]: ORIGIN_CLEAN,
                };
            }
            // In live mode, ask LAPI
            await this.cacheStorage.storeFirstCall(Date.now());
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
                              expiresAt: Date.now() + (this.configs.cleanIpCacheDuration ?? CACHE_EXPIRATION_FOR_CLEAN_IP) * 1000,
                          }),
                      ];
            cachedDecisionContents = await this.cacheStorage.storeDecisions(cachableDecisions);
        }
        const { remediation: initialRemediation, origin } = this.getIpHighestRemediationWithOrigin(ipToRemediate, cachedDecisionContents);
        let remediation = initialRemediation;
        if (remediation !== REMEDIATION_BYPASS) {
            logger.debug(`LAPI remediation for IP ${ip} is ${remediation} with origin ${origin}`);
        }
        // Initial remediation can be modified depending on the captcha flow
        if (remediation === REMEDIATION_CAPTCHA && !(await this.mustSolveCaptcha(ip))) {
            remediation = REMEDIATION_BYPASS;
        }
        // Initial remediation can be modified depending on the bouncingLevel config
        remediation = this.enforceMaxRemediation(remediation);
        logger.info(`Final remediation for IP ${ip} is ${remediation}`);

        return {
            [BOUNCER_KEYS.REMEDIATION]: remediation,
            [BOUNCER_KEYS.ORIGIN]: origin,
        };
    };

    public getResponse = async (params: GetResponseParams): Promise<RemediationResult> => {
        const { ip, remediation, origin } = params;
        switch (remediation) {
            case REMEDIATION_BAN: {
                const banWall = await this.renderWall('ban');
                await this.updateRemediationOriginCount(origin, remediation);
                return {
                    status: 403,
                    html: banWall,
                };
            }
            case REMEDIATION_CAPTCHA: {
                // We display the captcha wall
                const captcha = await this.saveCaptchaFlow(ip);
                // If failed, we add an error message
                const texts = captcha.resolutionFailed
                    ? {
                          texts: {
                              error: this.configs.wallsOptions?.captcha?.texts?.error ?? CAPTCHA_ERROR,
                          },
                      }
                    : {};
                const captchaWall = await this.renderWall('captcha', {
                    captchaImageTag: captcha.inlineImage,
                    ...texts,
                });
                await this.updateRemediationOriginCount(origin, remediation);
                return {
                    status: 401,
                    html: captchaWall,
                };
            }
            default: {
                await this.updateRemediationOriginCount(ORIGIN_CLEAN, REMEDIATION_BYPASS);
                return {
                    status: 200,
                    html: '',
                };
            }
        }
    };

    public handleCaptchaSubmission = async ({
        ip,
        origin,
        userPhrase,
        refresh,
    }: CaptchaSubmission): Promise<{
        [BOUNCER_KEYS.REMEDIATION]: Remediation;
        [BOUNCER_KEYS.CAPTCHA_PHRASE]: string;
    }> => {
        if (refresh === '1') {
            const newCaptcha = await this.refreshCaptchaFlow(ip);
            await this.updateRemediationOriginCount(origin, REMEDIATION_CAPTCHA);
            return {
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: newCaptcha.phraseToGuess,
            };
        }

        const cacheKey = getCacheKey(CAPTCHA_FLOW, ip);
        const cachedCaptchaFlow = (await this.cacheStorage.adapter.getItem(cacheKey)) as CachableCaptchaFlow | null;

        const captchaFlow = cachedCaptchaFlow?.content;

        const remediation =
            (captchaFlow && !captchaFlow.mustBeResolved) || (userPhrase && captchaFlow?.phraseToGuess === userPhrase)
                ? REMEDIATION_BYPASS
                : REMEDIATION_CAPTCHA;

        if (remediation === REMEDIATION_BYPASS) {
            logger.debug(`Captcha has been resolved by IP ${ip}`);
        }
        const mustBeResolved = remediation === REMEDIATION_CAPTCHA;
        const updatedCaptchaFlow = await this.saveCaptchaFlow(ip, {
            mustBeResolved,
            resolutionFailed: mustBeResolved,
        });

        await this.updateRemediationOriginCount(origin, remediation);

        return {
            [BOUNCER_KEYS.REMEDIATION]: remediation,
            [BOUNCER_KEYS.CAPTCHA_PHRASE]: updatedCaptchaFlow.phraseToGuess,
        };
    };

    public pushUsageMetrics = async (bouncerName: string, bouncerVersion: string): Promise<void> => {
        const start = Math.floor((await this.cacheStorage.getFirstLapiCall()) / 1000);
        const now = Math.floor(Date.now() / 1000);
        const lastSent = Math.floor((await this.cacheStorage.getLastMetricsSent()) / 1000) || start;
        const cacheItem = (await this.cacheStorage.adapter.getItem(ORIGINS_COUNT_KEY)) as CachableOriginsCount | null;
        const originsCount = cacheItem?.content ?? [];
        const { items, origins } = this.buildMetricsItems(originsCount);

        if (items.length === 0) {
            logger.info('No metrics to send');
            return;
        }

        const metricsBuilder = new MetricsBuilder();

        const metrics = metricsBuilder.buildUsageMetrics({
            properties: {
                name: bouncerName,
                type: METRICS_TYPE,
                version: bouncerVersion,
                utc_startup_timestamp: start,
            },
            meta: {
                window_size_seconds: Math.max(now - lastSent, 0),
            },
            items,
        });
        const metricsArray = metrics.toArray();
        await this.lapiClient.pushUsageMetrics(metricsArray);

        // Decrement the count of each origin/remediation
        for (const [origin, remediationCount] of Object.entries(origins)) {
            for (const [remediation, delta] of Object.entries(remediationCount as Record<string, number>)) {
                await this.cacheStorage.upsertMetricsOriginsCount({ origin, remediation, delta });
            }
        }

        await this.cacheStorage.storeLastMetricsSent(Date.now());
    };

    public refreshCaptchaFlow = async (ip: string): Promise<CaptchaFlow> => {
        const newCaptcha = await this.captcha.create();

        const content = {
            ...newCaptcha,
            mustBeResolved: true,
            resolutionFailed: false,
        };

        return await this.saveCaptchaFlow(ip, content);
    };

    public refreshDecisions = async ({ origins, scopes, scenariosContaining, scenariosNotContaining }: GetDecisionsOptions = {}): Promise<
        Record<REFRESH_KEYS, CachableDecisionContent[]>
    > => {
        const isWarm = await this.cacheStorage.isWarm();
        if (!isWarm) {
            logger.info('Decisions cache is not warmed up yet');
        }

        await this.cacheStorage.storeFirstCall(Date.now());

        const rawDecisions = await this.lapiClient.getDecisionStream({
            isFirstFetch: !isWarm,
            origins,
            scopes,
            scenariosContaining,
            scenariosNotContaining,
        });
        // Flag the cache as warm after the first fetch
        if (!isWarm) {
            await this.cacheStorage.setWarm();
        }

        const newDecisions = convertRawDecisionsToDecisions(rawDecisions[REFRESH_KEYS.NEW] || [], this.configs);
        const deletedDecisions = convertRawDecisionsToDecisions(rawDecisions[REFRESH_KEYS.DELETED] || [], this.configs);

        const storedDecisions = await this.cacheStorage.storeDecisions(newDecisions);
        const removedDecisions = await this.cacheStorage.removeDecisions(deletedDecisions);

        return {
            [REFRESH_KEYS.NEW]: storedDecisions,
            [REFRESH_KEYS.DELETED]: removedDecisions,
        };
    };

    private buildMetricsItems(originsCount: OriginCount[]): {
        items: MetricItem[];
        origins: Record<CachableOrigin, Record<Remediation, number>>;
    } {
        const metricsItems: MetricItem[] = [];
        let processed = 0;
        const originsToUpdate: Record<CachableOrigin, Record<Remediation, number>> = {};

        for (const { origin, remediation } of originsCount) {
            for (const [remediationType, count] of Object.entries(remediation) as [Remediation, number][]) {
                if (count <= 0) {
                    continue;
                }

                // Count all processed metrics, even bypass ones
                processed += count;

                // Prepare data to update origins count item after processing
                if (!originsToUpdate[origin]) {
                    originsToUpdate[origin] = {} as Record<Remediation, number>;
                }
                originsToUpdate[origin][remediationType] = -count;

                if (REMEDIATION_BYPASS === remediationType) {
                    continue;
                }

                // Create "dropped" metrics (all that is not a bypass)
                metricsItems.push({
                    name: 'dropped',
                    value: count,
                    unit: 'request',
                    labels: {
                        origin,
                        remediation: remediationType,
                    },
                });
            }
        }

        if (processed > 0) {
            metricsItems.push({
                name: 'processed',
                value: processed,
                unit: 'request',
            });
        }

        return { items: metricsItems, origins: originsToUpdate };
    }

    private createCaptcha = async (params: CaptchaCreation): Promise<CaptchaFlow> => {
        const captcha = await this.captcha.create();

        const content = {
            ...captcha,
            mustBeResolved: true,
            resolutionFailed: false,
        };

        const itemToCache = {
            key: params.cacheKey,
            content: content,
        };

        const captchaFlowItem = (await this.cacheStorage.adapter.setItem(itemToCache, params.ttl)) as CachableCaptchaFlow;

        return captchaFlowItem.content;
    };

    private enforceMaxRemediation = (remediation: Remediation): Remediation => {
        const bouncingLevel = this.configs.bouncingLevel ?? BOUNCING_LEVEL_NORMAL;
        if (bouncingLevel === BOUNCING_LEVEL_DISABLED) {
            logger.debug('Bouncing level is disabled');
            return REMEDIATION_BYPASS;
        }
        if (remediation === REMEDIATION_BAN && bouncingLevel === BOUNCING_LEVEL_FLEX) {
            logger.debug('Bouncing level is flex');
            return REMEDIATION_CAPTCHA;
        }

        return remediation;
    };

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
            remediation: ORDERED_REMEDIATIONS.includes(value) ? value : (this.configs.fallbackRemediation ?? REMEDIATION_CAPTCHA),
            origin,
        }));

        // Sort the remediationWithOrigins array by remediation priority
        const orderedRemediationsWithOrigins = sortBy(remediationWithOrigins, (entry) => ORDERED_REMEDIATIONS.indexOf(entry.remediation));

        // The last element contains the highest-priority remediation and its origin
        const { remediation, origin } = last(orderedRemediationsWithOrigins) as {
            remediation: Remediation;
            origin: CachableOrigin;
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

    private mustSolveCaptcha = async (ip: string): Promise<boolean> => {
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

    private renderWall = async <T extends 'ban' | 'captcha'>(
        type: T,
        options?: T extends 'ban' ? BanWallOptions : CaptchaWallOptions,
    ): Promise<string> => {
        const bouncerOptions = (this.configs.wallsOptions as WallsOptions) || { ban: {}, captcha: {} };
        const finalOptions = { ...bouncerOptions[type], ...(options ?? {}) };

        return type === 'captcha' ? renderCaptchaWall(finalOptions as CaptchaWallOptions) : renderBanWall(finalOptions as BanWallOptions);
    };

    private saveCaptchaFlow = async (ip: string, content?: Partial<CaptchaFlow>): Promise<CaptchaFlow> => {
        const cacheKey = getCacheKey(CAPTCHA_FLOW, ip);

        const duration = (this.configs.captchaFlowCacheDuration ?? CACHE_EXPIRATION_FOR_CAPTCHA_FLOW) * 1000;

        // Retrieve the existing captcha flow from the cache; if it doesn't exist, create a new one
        const existingItem = (await this.cacheStorage.adapter.getItem(cacheKey)) as CachableCaptchaFlow | null;

        const existingContent: CaptchaFlow =
            existingItem?.content ??
            (await this.createCaptcha({
                cacheKey,
                ttl: duration,
            }));

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

    private updateRemediationOriginCount = async (origin: CachableOrigin, remediation: Remediation): Promise<CachableOriginsCount> => {
        return this.cacheStorage.upsertMetricsOriginsCount({ origin, remediation });
    };

    constructor(configs: CrowdSecBouncerConfigurations, captcha?: CaptchaGenerator) {
        this.configs = configs;
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
        logger.debug('Bouncer initialized.');
    }
}

export default CrowdSecBouncer;
