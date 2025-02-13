import { afterEach, beforeEach, beforeAll, describe, expect, it, jest, afterAll } from '@jest/globals';
import nock, { cleanAll as nockCleanAll } from 'nock';

import * as configModule from 'src/helpers/config';
import CrowdSecBouncer from 'src/lib/bouncer';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import CacheStorage from 'src/lib/cache';
import InMemory from 'src/lib/cache/in-memory';
import { CachableDecisionContent } from 'src/lib/cache/types';
import { BOUNCER_KEYS, REFRESH_KEYS, REMEDIATION_BYPASS, REMEDIATION_CAPTCHA } from 'src/lib/constants';
import logger from 'src/lib/logger';
import * as rendered from 'src/lib/rendered';
import { Remediation } from 'src/lib/types';

const configs: CrowdSecBouncerConfigurations = {
    url: 'http://example.com/api',
    bouncerApiToken: 'test-api-key',
};

describe('🛡️ Bouncer', () => {
    let bouncer: CrowdSecBouncer;

    beforeAll(() => {
        nock(configs.url)
            .head('/v1/decisions')
            .matchHeader('X-Api-Key', configs.bouncerApiToken)
            .matchHeader('Content-Type', 'application/json')
            .reply(
                200,
                { status: 'ok' },
                {
                    'Content-Type': 'application/json',
                },
            );
        bouncer = new CrowdSecBouncer(configs);
    });

    afterEach(() => {
        nockCleanAll();
    });

    afterAll(() => {
        nock.cleanAll();
    });

    describe('constructor', () => {
        it('should be a class', () => {
            expect(bouncer).toBeInstanceOf(CrowdSecBouncer);
        });

        it('should have a fallback remediation of "captcha"', () => {
            expect(bouncer.fallbackRemediation).toBe('captcha');
        });

        it('should have fallback remediation customizable', () => {
            const customBouncer = new CrowdSecBouncer({ ...configs, fallbackRemediation: 'ban' });
            expect(customBouncer.fallbackRemediation).toBe('ban');
        });

        it('should have a method called "getIpRemediation"', () => {
            expect(bouncer.getIpRemediation).toBeInstanceOf(Function);
        });
    });

    describe('captcha', () => {
        it('should create a captcha flow', async () => {
            const ip = '1.2.3.4';
            const captchaFlow = await bouncer.refreshCaptchaFlow(ip);

            expect(captchaFlow).toBeDefined();

            const cachedCaptchaFlow = await bouncer.getCaptchaFlow(ip);

            expect(cachedCaptchaFlow).toEqual(captchaFlow);

            expect(cachedCaptchaFlow.mustBeResolved).toBe(true);
            expect(cachedCaptchaFlow.phraseToGuess).toBeDefined();
            expect(cachedCaptchaFlow.submitUrl).toBe('/'); // default submit URL
            expect(cachedCaptchaFlow.inlineImage).toBeDefined();
            expect(cachedCaptchaFlow.resolutionFailed).toBe(false);
        });

        it('should be able to pass a custom captcha', async () => {
            const ip = '11.22.33.44';
            const captchaGenerator = {
                create: () => ({
                    phraseToGuess: 'custom-phrase',
                    inlineImage: '<svg>custom-captcha</svg>',
                }),
            };

            const customBouncer = new CrowdSecBouncer({ ...configs, captchaFlowCacheDuration: 60 }, captchaGenerator);

            await customBouncer.refreshCaptchaFlow(ip);

            const cachedCaptchaFlow = await bouncer.getCaptchaFlow(ip);

            expect(cachedCaptchaFlow.mustBeResolved).toBe(true);
            expect(cachedCaptchaFlow.phraseToGuess).toBe('custom-phrase');
            expect(cachedCaptchaFlow.submitUrl).toBe('/'); // default submit URL
            expect(cachedCaptchaFlow.inlineImage).toBe('<svg>custom-captcha</svg>');
            expect(cachedCaptchaFlow.resolutionFailed).toBe(false);

            await customBouncer.saveCaptchaFlow(ip);

            const cachedCaptchaFlow2 = await bouncer.getCaptchaFlow(ip);

            expect(cachedCaptchaFlow2).toEqual(cachedCaptchaFlow);

            await customBouncer.saveCaptchaFlow(ip);

            const cachedCaptchaFlow3 = await bouncer.getCaptchaFlow(ip);

            expect(cachedCaptchaFlow3).toEqual(cachedCaptchaFlow2);
        });

        it('should be able to save a fresh captcha flow', async () => {
            const ip = '11.22.33.45';

            await bouncer.saveCaptchaFlow(ip); // test creation with empty content

            await bouncer.saveCaptchaFlow(ip, {
                mustBeResolved: false,
                phraseToGuess: 'custom-phrase-test',
                inlineImage: '<svg>custom-captcha-test</svg>',
                resolutionFailed: false,
            });
            const cachedCaptchaFlow = await bouncer.getCaptchaFlow(ip);

            expect(cachedCaptchaFlow.mustBeResolved).toBe(false);
            expect(cachedCaptchaFlow.phraseToGuess).toBe('custom-phrase-test');
            expect(cachedCaptchaFlow.submitUrl).toBe('/'); // default submit URL
            expect(cachedCaptchaFlow.inlineImage).toBe('<svg>custom-captcha-test</svg>');
            expect(cachedCaptchaFlow.resolutionFailed).toBe(false);
        });
    });

    describe('getIpRemediation', () => {
        it('should compute the correct remediation for the IP 3.4.5.6', async () => {
            const ipV4 = '3.4.5.6';
            const remediation: Remediation = 'ban';
            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query({ ip: ipV4 })
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    [
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: remediation,
                            value: ipV4,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const responseRemediation = await bouncer.getIpRemediation(ipV4);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation['remediation']).toEqual(remediation);
        });

        it('should compute the correct remediation for the IPv6 2001:0000:130F:0000:0000:09C0:876A:130B', async () => {
            const ipV6 = '2001:0000:130F:0000:0000:09C0:876A:130B';
            const remediation: Remediation = 'ban';

            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    [
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: remediation,
                            value: ipV6,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const responseRemediation = await bouncer.getIpRemediation(ipV6);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation['remediation']).toEqual(remediation);
        });

        it('should return fallback remediation if there is no decision at all', async () => {
            const ip = '1.2.3.4';

            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(200, 'null', {
                    'Content-Type': 'application/json',
                });

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation['remediation']).toEqual('bypass');
        });

        it('should return fallback remediation if the IP is unknown', async () => {
            const ip = '1.2.3.7';

            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(200, [], {
                    'Content-Type': 'application/json',
                });

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation['remediation']).toEqual('bypass');
        });

        it('should return fallback remediation if decisions remediation types are unknown', async () => {
            const ip = '1.2.3.8';

            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    [
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: 'unknown',
                            value: ip,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            // Fallback remediation is captcha by default
            expect(responseRemediation['remediation']).toEqual('captcha');
        });

        it('should return highest remediation if there is multiple decisions about the IP', async () => {
            const ip = '1.2.3.10';

            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    [
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: 'bypass',
                            value: ip,
                        },
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: 'captcha',
                            value: ip,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation['remediation']).toEqual('captcha');
        });

        it('should log the remediation', async () => {
            let ip = '1.2.3.11';
            const remediation = 'ban';

            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    [
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: remediation,
                            value: ip,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const logSpy = jest.spyOn(logger, 'info');

            await bouncer.getIpRemediation(ip);

            expect(nockScope.isDone()).toBe(true);
            expect(logSpy).toHaveBeenCalledWith(`Final remediation for IP ${ip} is ${remediation}`);

            ip = '1.2.3.12'; // Another IP as the first one has been cached
            const nockScopeBypass = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    [
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: 'bypass',
                            value: ip,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            logSpy.mockClear();
            await bouncer.getIpRemediation(ip);

            expect(nockScopeBypass.isDone()).toBe(true);
            expect(logSpy).toHaveBeenCalledWith(`Final remediation for IP ${ip} is bypass`);
        });

        it('should log bouncing level ', async () => {
            const ip = '1.2.3.11';
            const remediation = 'ban';

            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    [
                        {
                            duration: '3h59m56.919518073s',
                            id: 1,
                            origin: 'cscli',
                            scenario: "manual 'ban' from 'localhost'",
                            scope: 'Ip',
                            type: remediation,
                            value: ip,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const logSpy = jest.spyOn(logger, 'debug');

            let bouncer = new CrowdSecBouncer({ ...configs, bouncingLevel: 'disabled_bouncing' });

            let remediationData = await bouncer.getIpRemediation(ip);

            expect(nockScope.isDone()).toBe(false); // decision has been cached => No call
            expect(logSpy).toHaveBeenCalledWith('Bouncing level is disabled');

            expect(remediationData.remediation).toBe('bypass');

            bouncer = new CrowdSecBouncer({ ...configs, bouncingLevel: 'flex_bouncing' });

            remediationData = await bouncer.getIpRemediation(ip);

            expect(nockScope.isDone()).toBe(false); // decision has been cached => No call
            expect(logSpy).toHaveBeenCalledWith('Bouncing level is flex');

            expect(remediationData.remediation).toBe('captcha');
        });
    });

    describe('getIpRemediation - additional cases', () => {
        let getAllDecisionsSpy: jest.SpiedFunction<(typeof bouncer)['cacheStorage']['getAllCachableDecisionContents']>;

        beforeEach(() => {
            getAllDecisionsSpy = jest.spyOn(bouncer['cacheStorage'], 'getAllCachableDecisionContents').mockResolvedValue([]);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should return "bypass" if streamMode is enabled and cache is empty', async () => {
            const ip = '8.8.8.8';

            jest.spyOn(configModule, 'getConfig').mockImplementation((key) => (key === 'streamMode' ? true : null));
            getAllDecisionsSpy.mockResolvedValue([]); // Empty cache

            console.log('Mocked getConfig:', bouncer.getConfig('streamMode')); // Debug log
            console.log('Mocked getAllDecisions:', await bouncer['cacheStorage'].getAllCachableDecisionContents('8.8.8.8')); // Debug log

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('bypass');
        });

        it('should return the highest remediation when multiple exist', async () => {
            const ip = '192.168.1.1';
            const now = Date.now();

            const decisions: CachableDecisionContent[] = [
                {
                    id: 'csli-bypass-ip-192.168.1.1',
                    origin: 'cscli',
                    expiresAt: now + 10000000,
                    value: 'bypass',
                },
                {
                    id: 'csli-captcha-ip-192.168.1.1',
                    origin: 'lapi',
                    expiresAt: now + 10000000,
                    value: 'captcha',
                },
                { id: 'csli-ban-ip-192.168.1.1', origin: 'stream', expiresAt: now + 10000000, value: 'ban' },
            ];
            getAllDecisionsSpy.mockResolvedValue(decisions);

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('ban'); // Highest remediation
        });

        it('should handle unknown remediation types by using fallback', async () => {
            const ip = '1.2.3.4';

            const decisions: CachableDecisionContent[] = [
                {
                    id: 'csli-unknown-ip-1.2.3.4',
                    origin: 'cscli',
                    expiresAt: Date.now() + 1000000,
                    value: 'unknown' as Remediation,
                },
            ];
            getAllDecisionsSpy.mockResolvedValue(decisions);

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('captcha'); // Fallback remediation
        });
    });

    describe('handleCaptchaSubmission', () => {
        it('should return new captcha when refresh is 1', async () => {
            const ip = '192.168.0.1';
            const userPhrase = '';
            const refresh = '1';
            const newCaptcha = {
                phraseToGuess: 'new-captcha',
                inlineImage: '<svg></svg>',
                mustBeResolved: true,
                resolutionFailed: false,
                submitUrl: 'http://example.com/submit',
            };
            const bouncer = new CrowdSecBouncer(configs);
            const mockRefreshCaptchaFlow = jest.spyOn(bouncer, 'refreshCaptchaFlow').mockResolvedValue(newCaptcha);

            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'new-captcha',
                [BOUNCER_KEYS.CAPTCHA_FAILED]: false,
            });
            mockRefreshCaptchaFlow.mockRestore();
        });

        it('should return bypass when captcha is resolved', async () => {
            const ip = '192.168.0.1';
            const userPhrase = 'correct-phrase';
            const refresh = '0';
            const cachedCaptchaFlow = {
                key: 'captcha_flow_192.168.0.1',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: false },
            };
            const cacheStorage = new CacheStorage({ cacheAdapter: new InMemory() });
            const mockGetItem = jest.spyOn(cacheStorage.adapter, 'getItem').mockResolvedValue(cachedCaptchaFlow);

            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };

            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_BYPASS,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'correct-phrase',
                [BOUNCER_KEYS.CAPTCHA_FAILED]: false,
            });
            mockGetItem.mockRestore();
        });

        it('should return captcha when user phrase is incorrect', async () => {
            const ip = '192.168.0.1';
            const userPhrase = 'wrong-phrase';
            const refresh = '0';
            const cachedCaptchaFlow = {
                key: 'captcha-192.168.0.1',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: true },
            };
            const cacheStorage = new CacheStorage({ cacheAdapter: new InMemory() });
            const mockGetItem = jest.spyOn(cacheStorage.adapter, 'getItem').mockResolvedValue(cachedCaptchaFlow);
            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };
            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'correct-phrase',
                [BOUNCER_KEYS.CAPTCHA_FAILED]: true,
            });
            mockGetItem.mockRestore();
        });

        it('should return captcha when captcha flow is not resolved and user phrase is empty', async () => {
            const ip = '192.168.0.1';
            const userPhrase = '';
            const refresh = '0';
            const cachedCaptchaFlow = {
                key: 'captcha-192.168.0.1',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: true },
            };
            const cacheStorage = new CacheStorage({ cacheAdapter: new InMemory() });
            const mockGetItem = jest.spyOn(cacheStorage.adapter, 'getItem').mockResolvedValue(cachedCaptchaFlow);
            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };
            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'correct-phrase',
                [BOUNCER_KEYS.CAPTCHA_FAILED]: true,
            });
            mockGetItem.mockRestore();
        });

        it('should return captcha when no cached captcha flow is found', async () => {
            const ip = '192.168.0.1';
            const userPhrase = 'any-phrase';
            const refresh = '0';
            const cacheStorage = new CacheStorage({ cacheAdapter: new InMemory() });
            const mockGetItem = jest.spyOn(cacheStorage.adapter, 'getItem').mockResolvedValue(null);
            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };
            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: undefined,
                [BOUNCER_KEYS.CAPTCHA_FAILED]: true,
            });
            mockGetItem.mockRestore();
        });
    });

    describe('renderWall', () => {
        it('should render captcha wall with provided options', async () => {
            const type = 'captcha';
            const options = {
                hideCrowdSecMentions: true,
                captchaImageTag: '<img src="captcha-image" alt="captcha" />',
                submitUrl: 'http://example.com/submit',
            };
            const mockRenderCaptchaWall = jest.spyOn(rendered, 'renderCaptchaWall').mockResolvedValue('<captcha-wall></captcha-wall>');

            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.renderWall(type, options);

            expect(result).toBe('<captcha-wall></captcha-wall>');
            expect(mockRenderCaptchaWall).toHaveBeenCalledWith(expect.objectContaining(options));
            mockRenderCaptchaWall.mockRestore();
        });

        it('should render ban wall with provided options', async () => {
            const type = 'ban';
            const options = { hideCrowdSecMentions: true };
            const mockRenderBanWall = jest.spyOn(rendered, 'renderBanWall').mockResolvedValue('<ban-wall></ban-wall>');

            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.renderWall(type, options);

            expect(result).toBe('<ban-wall></ban-wall>');
            expect(mockRenderBanWall).toHaveBeenCalledWith(expect.objectContaining(options));
            mockRenderBanWall.mockRestore();
        });

        it('should render captcha wall with default options when no options are provided', async () => {
            const type = 'captcha';
            const mockRenderCaptchaWall = jest.spyOn(rendered, 'renderCaptchaWall').mockResolvedValue('<captcha-wall></captcha-wall>');

            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.renderWall(type);

            expect(result).toBe('<captcha-wall></captcha-wall>');
            expect(mockRenderCaptchaWall).toHaveBeenCalledWith(expect.any(Object));
            mockRenderCaptchaWall.mockRestore();
        });

        it('should render ban wall with default options when no options are provided', async () => {
            const type = 'ban';
            const mockRenderBanWall = jest.spyOn(rendered, 'renderBanWall').mockResolvedValue('<ban-wall></ban-wall>');

            const bouncer = new CrowdSecBouncer(configs);
            const result = await bouncer.renderWall(type);

            expect(result).toBe('<ban-wall></ban-wall>');
            expect(mockRenderBanWall).toHaveBeenCalledWith(expect.any(Object));
            mockRenderBanWall.mockRestore();
        });
    });

    describe('updateRemediationOriginCount', () => {
        it('should update the count for a given origin and remediation', async () => {
            const origin = 'cscli';
            const remediation = 'ban';
            const expectedCount = {
                key: 'origins_count',
                content: [
                    {
                        origin: 'cscli',
                        remediation: { ban: 1 },
                    },
                ],
            };

            const cacheStorage = new CacheStorage({ cacheAdapter: new InMemory() });
            const mockUpsertMetricsOriginsCount = jest.spyOn(cacheStorage, 'upsertMetricsOriginsCount').mockResolvedValue(expectedCount);
            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };
            const bouncer = new CrowdSecBouncer(configs);

            const result = await bouncer.updateRemediationOriginCount(origin, remediation);

            expect(result).toEqual(expectedCount);
            mockUpsertMetricsOriginsCount.mockRestore();
        });
    });

    describe('refreshDecisions', () => {
        it('should return new and deleted decisions when cache is warm', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const mockIsWarm = jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(true);
            const mockGetDecisionStream = jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
                [REFRESH_KEYS.NEW]: [
                    {
                        origin: 'cscli',
                        type: 'ban',
                        scope: 'ip',
                        value: '1.2.3.4',
                        duration: '1h',
                        scenario: '',
                    },
                ],
                [REFRESH_KEYS.DELETED]: [
                    {
                        origin: 'CAPI',
                        type: 'ban',
                        scope: 'ip',
                        value: '1.2.3.5',
                        duration: '1h',
                        scenario: '',
                    },
                ],
            });

            const result = await bouncer.refreshDecisions();

            expect(result).toEqual({
                [REFRESH_KEYS.NEW]: [
                    {
                        id: 'cscli-ban-ip-1.2.3.4',
                        origin: 'cscli',
                        expiresAt: expect.any(Number),
                        value: 'ban',
                    },
                ],
                [REFRESH_KEYS.DELETED]: [], // No deletion because was not in cache
            });

            mockIsWarm.mockRestore();
            mockGetDecisionStream.mockRestore();
        });

        it('should log info when cache is not warm', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const mockIsWarm = jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(false);
            const mockGetDecisionStream = jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });
            const mockStoreDecisions = jest.spyOn(bouncer['cacheStorage'], 'storeDecisions').mockResolvedValue([]);
            const mockRemoveDecisions = jest.spyOn(bouncer['cacheStorage'], 'removeDecisions').mockResolvedValue([]);
            const mockLoggerInfo = jest.spyOn(logger, 'info').mockImplementation(() => {});

            await bouncer.refreshDecisions();

            expect(mockLoggerInfo).toHaveBeenCalledWith('Decisions cache is not warmed up yet');

            mockIsWarm.mockRestore();
            mockGetDecisionStream.mockRestore();
            mockStoreDecisions.mockRestore();
            mockRemoveDecisions.mockRestore();
            mockLoggerInfo.mockRestore();
        });

        it('should handle empty decision streams', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const mockIsWarm = jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(true);
            const mockGetDecisionStream = jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });
            const mockStoreDecisions = jest.spyOn(bouncer['cacheStorage'], 'storeDecisions').mockResolvedValue([]);
            const mockRemoveDecisions = jest.spyOn(bouncer['cacheStorage'], 'removeDecisions').mockResolvedValue([]);

            const result = await bouncer.refreshDecisions();

            expect(result).toEqual({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });

            mockIsWarm.mockRestore();
            mockGetDecisionStream.mockRestore();
            mockStoreDecisions.mockRestore();
            mockRemoveDecisions.mockRestore();
        });
    });
});
