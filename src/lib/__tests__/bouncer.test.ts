import { afterEach, beforeEach, beforeAll, describe, expect, it, jest, afterAll } from '@jest/globals';
import nock, { cleanAll as nockCleanAll } from 'nock';

import os from 'os';
import CrowdSecBouncer from 'src/lib/bouncer';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import CacheStorage from 'src/lib/cache';
import { ORIGINS_COUNT_KEY } from 'src/lib/cache/constants';
import { getCacheKey } from 'src/lib/cache/helpers';
import InMemory from 'src/lib/cache/in-memory';
import { CachableDecisionContent, CachableDecisionItem } from 'src/lib/cache/types';
import { BOUNCER_KEYS, REFRESH_KEYS, REMEDIATION_BAN, REMEDIATION_BYPASS, REMEDIATION_CAPTCHA, SCOPE_IP } from 'src/lib/constants';
import logger from 'src/lib/logger';
import * as rendered from 'src/lib/rendered';
import { Remediation } from 'src/lib/types';

const configs: CrowdSecBouncerConfigurations = {
    url: 'http://example.com/api',
    bouncerApiToken: 'test-api-key',
};

describe('🛡️ Bouncer', () => {
    let bouncer: CrowdSecBouncer;
    let cacheAdapter: InMemory;

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
        cacheAdapter = new InMemory();
    });

    afterEach(() => {
        nockCleanAll();
        jest.restoreAllMocks();
        cacheAdapter.clear();
    });

    afterAll(() => {
        nock.cleanAll();
        jest.restoreAllMocks();
        cacheAdapter.clear();
    });

    describe('constructor', () => {
        it('should be a class', () => {
            expect(bouncer).toBeInstanceOf(CrowdSecBouncer);
        });

        it('should have fallback remediation customizable', () => {
            const customBouncer = new CrowdSecBouncer({ ...configs, fallbackRemediation: 'ban' });
            expect(customBouncer.configs.fallbackRemediation).toBe('ban');
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

            expect(captchaFlow.mustBeResolved).toBe(true);
            expect(captchaFlow.phraseToGuess).toBeDefined();
            expect(captchaFlow.inlineImage).toBeDefined();
            expect(captchaFlow.resolutionFailed).toBe(false);
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
            const captchaFlow = await customBouncer.refreshCaptchaFlow(ip);
            expect(captchaFlow.mustBeResolved).toBe(true);
            expect(captchaFlow.phraseToGuess).toBe('custom-phrase');
            expect(captchaFlow.inlineImage).toBe('<svg>custom-captcha</svg>');
            expect(captchaFlow.resolutionFailed).toBe(false);
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

        it('should return bypass if there is no decision at all', async () => {
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

        it('should return bypass if no decision has been cached', async () => {
            const ip = '1.2.3.4';

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
                            type: 'ban',
                            value: ip,
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            jest.spyOn(bouncer['cacheStorage'], 'storeDecisions').mockResolvedValue([]);

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

        it('should return custom fallback remediation if decisions remediation types are unknown', async () => {
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

            const customConfigs = { ...configs, fallbackRemediation: 'ban' };
            const bouncer = new CrowdSecBouncer(customConfigs);

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            // Fallback remediation is ban
            expect(responseRemediation['remediation']).toEqual('ban');
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

            expect(nockScope.isDone()).toBe(true);
            expect(logSpy).toHaveBeenCalledWith('Bouncing level is disabled');

            expect(remediationData.remediation).toBe('bypass');

            bouncer = new CrowdSecBouncer({ ...configs, bouncingLevel: 'flex_bouncing' });

            remediationData = await bouncer.getIpRemediation(ip);

            expect(nockScope.isDone()).toBe(true);
            expect(logSpy).toHaveBeenCalledWith('Bouncing level is flex');

            expect(remediationData.remediation).toBe('captcha');
        });
    });

    describe('getIpRemediation - additional cases', () => {
        let getAllDecisionsSpy: jest.SpiedFunction<(typeof bouncer)['cacheStorage']['getAllCachableDecisionContents']>;

        beforeEach(() => {
            getAllDecisionsSpy = jest.spyOn(bouncer['cacheStorage'], 'getAllCachableDecisionContents').mockResolvedValue([]);
        });

        it('should return "bypass" if streamMode is enabled and cache is empty', async () => {
            const ip = '8.8.8.8';
            const bouncer = new CrowdSecBouncer({ ...configs, streamMode: true });

            getAllDecisionsSpy.mockResolvedValue([]); // Empty cache

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('bypass');
        });

        it('should return "bypass" if captcha has been solved', async () => {
            const ip = '8.8.8.8';

            getAllDecisionsSpy.mockResolvedValue([
                {
                    id: 'csli-captcha-ip-8.8.8.8',
                    origin: 'cscli',
                    expiresAt: Date.now() + 10000000,
                    value: 'captcha',
                },
            ]);
            const cachedCaptchaFlow = {
                key: 'captcha_flow_8.8.8.8',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: false },
            };
            jest.spyOn(bouncer.cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_8.8.8.8') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('bypass');
        });

        it('should return "captcha" if captcha must be solved', async () => {
            const ip = '8.8.8.8';

            getAllDecisionsSpy.mockResolvedValue([
                {
                    id: 'csli-captcha-ip-8.8.8.8',
                    origin: 'cscli',
                    expiresAt: Date.now() + 10000000,
                    value: 'captcha',
                },
            ]);
            const cachedCaptchaFlow = {
                key: 'captcha_flow_8.8.8.8',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: true },
            };
            jest.spyOn(bouncer.cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_8.8.8.8') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('captcha');
        });

        it('should return "captcha" if captcha flow is not found in cache', async () => {
            const ip = '8.8.8.8';

            getAllDecisionsSpy.mockResolvedValue([
                {
                    id: 'csli-captcha-ip-8.8.8.8',
                    origin: 'cscli',
                    expiresAt: Date.now() + 10000000,
                    value: 'captcha',
                },
            ]);
            const cachedCaptchaFlow = null;
            jest.spyOn(bouncer.cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_8.8.8.8') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('captcha');
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

        it('should prune expired decision', async () => {
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
                { id: 'csli-ban-ip-192.168.1.1', origin: 'stream', expiresAt: now - 10000000, value: 'ban' },
            ];
            getAllDecisionsSpy.mockResolvedValue(decisions);

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('captcha'); // Highest remediation as ban is expired
        });

        it('should return a bypass if no decision ', async () => {
            const ip = '192.168.1.1';
            const customConfigs = { ...configs, cleanIpCacheDuration: 60 };
            const bouncer = new CrowdSecBouncer(customConfigs);

            const decisions: CachableDecisionContent[] = [];
            getAllDecisionsSpy.mockResolvedValue(decisions);
            jest.spyOn(bouncer.lapiClient, 'getDecisionsMatchingIp').mockResolvedValue([]);

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('bypass'); // Highest remediation
        });

        it('should return a ban for ipv6 range decision in live mode', async () => {
            const ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
            const range = '2001:0db8:85a3::/64';

            const decisions: CachableDecisionContent[] = [];
            getAllDecisionsSpy.mockResolvedValue(decisions);
            jest.spyOn(bouncer.lapiClient, 'getDecisionsMatchingIp').mockResolvedValue([
                {
                    duration: '3h59m56.919518073s',
                    origin: 'cscli',
                    scenario: "manual 'ban' from 'localhost'",
                    scope: 'range',
                    type: 'ban',
                    value: range,
                },
            ]);

            const response = await bouncer.getIpRemediation(ip);
            expect(response.remediation).toBe('ban'); // Highest remediation

            const cacheKey = getCacheKey(SCOPE_IP, '2001:0db8:85a3:0000:0000:0000:0000:0000'); // First IP of the range
            const cachedItem = (await bouncer.cacheStorage.adapter.getItem(cacheKey)) as unknown as CachableDecisionItem;

            expect(cachedItem.content[0].id).toBe('cscli-ban-range-2001:0db8:85a3::/64');
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
            const origin = 'cscli';
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
            jest.spyOn(bouncer, 'refreshCaptchaFlow').mockResolvedValue(newCaptcha);

            const result = await bouncer.handleCaptchaSubmission({ ip, origin, userPhrase, refresh });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'new-captcha',
            });
        });

        it('should return bypass when captcha is resolved', async () => {
            const ip = '192.168.0.1';
            const userPhrase = 'correct-phrase';
            const refresh = '0';
            const cachedCaptchaFlow = {
                key: 'captcha_flow_192.168.0.1',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: false },
            };
            const cacheStorage = new CacheStorage({ cacheAdapter });
            jest.spyOn(cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_192.168.0.1') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });

            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };

            const bouncer = new CrowdSecBouncer(configs);
            const origin = 'cscli';
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh, origin });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_BYPASS,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'correct-phrase',
            });
        });

        it('should return captcha when user phrase is incorrect', async () => {
            const ip = '192.168.0.1';
            const userPhrase = 'wrong-phrase';
            const refresh = '0';
            const cachedCaptchaFlow = {
                key: 'captcha-192.168.0.1',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: true },
            };
            const cacheStorage = new CacheStorage({ cacheAdapter });
            jest.spyOn(cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_192.168.0.1') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });
            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };
            const bouncer = new CrowdSecBouncer(configs);
            const origin = 'cscli';
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh, origin });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'correct-phrase',
            });
        });

        it('should return captcha when captcha flow is not resolved and user phrase is empty', async () => {
            const ip = '192.168.0.1';
            const userPhrase = '';
            const refresh = '0';
            const cachedCaptchaFlow = {
                key: 'captcha-192.168.0.1',
                content: { phraseToGuess: 'correct-phrase', mustBeResolved: true },
            };
            const cacheStorage = new CacheStorage({ cacheAdapter });
            jest.spyOn(cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_192.168.0.1') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });
            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };
            const bouncer = new CrowdSecBouncer(configs);
            const origin = 'cscli';
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh, origin });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: 'correct-phrase',
            });
        });

        it('should return captcha when no cached captcha flow is found', async () => {
            const ip = '192.168.0.1';
            const userPhrase = 'any-phrase';
            const refresh = '0';
            const cacheStorage = new CacheStorage({ cacheAdapter });
            jest.spyOn(cacheStorage.adapter, 'getItem').mockResolvedValue(null);
            const configs: CrowdSecBouncerConfigurations = {
                url: 'http://example.com/api',
                bouncerApiToken: 'test-api-key',
                cacheAdapter: cacheStorage.adapter,
            };
            const bouncer = new CrowdSecBouncer(configs);
            const origin = 'cscli';
            const result = await bouncer.handleCaptchaSubmission({ ip, userPhrase, refresh, origin });

            expect(result).toEqual({
                [BOUNCER_KEYS.REMEDIATION]: REMEDIATION_CAPTCHA,
                [BOUNCER_KEYS.CAPTCHA_PHRASE]: expect.any(String),
            });
        });
    });

    describe('refreshDecisions', () => {
        it('should return new and deleted decisions when cache is warm', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(true);
            jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
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
                [REFRESH_KEYS.DELETED]: [
                    {
                        id: 'capi-ban-ip-1.2.3.5',
                        origin: 'capi',
                        expiresAt: expect.any(Number),
                        value: 'ban',
                    },
                ],
            });
        });

        it('should log info when cache is not warm', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(false);
            jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });
            jest.spyOn(bouncer['cacheStorage'], 'storeDecisions').mockResolvedValue([]);
            jest.spyOn(bouncer['cacheStorage'], 'removeDecisions').mockResolvedValue([]);
            const mockLoggerInfo = jest.spyOn(logger, 'info').mockImplementation(() => {});

            await bouncer.refreshDecisions();

            expect(mockLoggerInfo).toHaveBeenCalledWith('Decisions cache is not warmed up yet');
        });

        it('should not log info when cache is not warm', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(true);
            jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });
            jest.spyOn(bouncer['cacheStorage'], 'storeDecisions').mockResolvedValue([]);
            jest.spyOn(bouncer['cacheStorage'], 'removeDecisions').mockResolvedValue([]);
            const mockLoggerInfo = jest.spyOn(logger, 'info').mockImplementation(() => {});

            await bouncer.refreshDecisions();

            expect(mockLoggerInfo).not.toHaveBeenCalledWith('Decisions cache is not warmed up yet');
        });

        it('should handle empty decision streams', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(true);
            jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });
            jest.spyOn(bouncer['cacheStorage'], 'storeDecisions').mockResolvedValue([]);
            jest.spyOn(bouncer['cacheStorage'], 'removeDecisions').mockResolvedValue([]);

            const result = await bouncer.refreshDecisions();

            expect(result).toEqual({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });
        });

        it('should handle empty decision streams', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            jest.spyOn(bouncer['cacheStorage'], 'isWarm').mockResolvedValue(true);
            jest.spyOn(bouncer['lapiClient'], 'getDecisionStream').mockResolvedValue({
                [REFRESH_KEYS.NEW]: null,
                [REFRESH_KEYS.DELETED]: null,
            });
            jest.spyOn(bouncer['cacheStorage'], 'storeDecisions').mockResolvedValue([]);
            jest.spyOn(bouncer['cacheStorage'], 'removeDecisions').mockResolvedValue([]);

            const result = await bouncer.refreshDecisions();

            expect(result).toEqual({
                [REFRESH_KEYS.NEW]: [],
                [REFRESH_KEYS.DELETED]: [],
            });
        });
    });

    describe('pushUsageMetrics', () => {
        it('should push usage metrics', async () => {
            const lastSent = 1741166923; // in seconds
            const firstCall = 1741166111; // in seconds
            const bouncer = new CrowdSecBouncer(configs);
            const originalGetItem = bouncer['cacheStorage'].adapter.getItem; // Store the real method
            jest.spyOn(os, 'type').mockImplementation(() => 'LinuxTest');
            jest.spyOn(os, 'release').mockImplementation(() => 'test-release');
            jest.spyOn(bouncer['cacheStorage'], 'getFirstLapiCall').mockResolvedValue(firstCall * 1000);
            jest.spyOn(bouncer['cacheStorage'], 'getLastMetricsSent').mockResolvedValue(lastSent * 1000);
            jest.spyOn(bouncer['cacheStorage'].adapter, 'getItem').mockImplementation(async (key) => {
                if (key === ORIGINS_COUNT_KEY) {
                    return {
                        key: ORIGINS_COUNT_KEY,
                        content: [
                            {
                                origin: 'CAPI',
                                remediation: { ban: 2, captcha: 1 },
                            },
                            {
                                origin: 'cscli',
                                remediation: { ban: 3 },
                            },
                            {
                                origin: 'clean',
                                remediation: { bypass: 8 },
                            },
                        ],
                    }; // Mocked value when key matches
                }
                return originalGetItem.call(bouncer['cacheStorage'].adapter, key); // Call the real method otherwise
            });
            const mockPushUsageMetrics = jest.spyOn(bouncer.lapiClient, 'pushUsageMetrics').mockResolvedValue(null);

            const now = Math.floor(Date.now() / 1000);

            await bouncer.pushUsageMetrics('test-bouncer', '1.0.0');

            expect(mockPushUsageMetrics).toHaveBeenCalledTimes(1);

            const metricsArray = mockPushUsageMetrics.mock.calls[0][0]; // Capture the first argument

            expect(metricsArray).toEqual({
                remediation_components: [
                    {
                        feature_flags: [],
                        metrics: [
                            {
                                items: [
                                    {
                                        labels: { origin: 'CAPI', remediation: 'ban' },
                                        name: 'dropped',
                                        unit: 'request',
                                        value: 2,
                                    },
                                    {
                                        labels: { origin: 'CAPI', remediation: 'captcha' },
                                        name: 'dropped',
                                        unit: 'request',
                                        value: 1,
                                    },
                                    {
                                        labels: { origin: 'cscli', remediation: 'ban' },
                                        name: 'dropped',
                                        unit: 'request',
                                        value: 3,
                                    },
                                    { name: 'processed', unit: 'request', value: 14 },
                                ],
                                meta: {
                                    utc_now_timestamp: now,
                                    window_size_seconds: now - lastSent,
                                },
                            },
                        ],
                        name: 'test-bouncer',
                        os: { name: 'LinuxTest', version: 'test-release' },
                        type: 'crowdsec-nodejs-bouncer',
                        utc_startup_timestamp: firstCall,
                        version: '1.0.0',
                    },
                ],
            });
        });
        it('should not push usage empty metrics', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const originalGetItem = bouncer['cacheStorage'].adapter.getItem; // Store the real method
            jest.spyOn(bouncer['cacheStorage'].adapter, 'getItem').mockImplementation(async (key) => {
                if (key === ORIGINS_COUNT_KEY) {
                    return null;
                }
                return originalGetItem.call(bouncer['cacheStorage'].adapter, key); // Call the real method otherwise
            });
            const mockPushUsageMetrics = jest.spyOn(bouncer.lapiClient, 'pushUsageMetrics').mockResolvedValue(null);

            await bouncer.pushUsageMetrics('test-bouncer', '1.0.0');

            expect(mockPushUsageMetrics).toHaveBeenCalledTimes(0);
        });
        it('should not push negative count', async () => {
            const lastSent = 1741166923; // in seconds
            const firstCall = 1741166111; // in seconds
            const bouncer = new CrowdSecBouncer(configs);
            const originalGetItem = bouncer['cacheStorage'].adapter.getItem; // Store the real method
            jest.spyOn(os, 'type').mockImplementation(() => 'LinuxTest');
            jest.spyOn(os, 'release').mockImplementation(() => 'test-release');
            jest.spyOn(bouncer['cacheStorage'], 'getFirstLapiCall').mockResolvedValue(firstCall * 1000);
            jest.spyOn(bouncer['cacheStorage'], 'getLastMetricsSent').mockResolvedValue(lastSent * 1000);
            jest.spyOn(bouncer['cacheStorage'].adapter, 'getItem').mockImplementation(async (key) => {
                if (key === ORIGINS_COUNT_KEY) {
                    return {
                        key: ORIGINS_COUNT_KEY,
                        content: [
                            {
                                origin: 'CAPI',
                                remediation: { ban: 2, captcha: -1 },
                            },
                            {
                                origin: 'cscli',
                                remediation: { ban: 3 },
                            },
                            {
                                origin: 'clean',
                                remediation: { bypass: 8 },
                            },
                        ],
                    }; // Mocked value when key matches
                }
                return originalGetItem.call(bouncer['cacheStorage'].adapter, key); // Call the real method otherwise
            });
            const mockPushUsageMetrics = jest.spyOn(bouncer.lapiClient, 'pushUsageMetrics').mockResolvedValue(null);

            const now = Math.floor(Date.now() / 1000);

            await bouncer.pushUsageMetrics('test-bouncer', '1.0.0');

            expect(mockPushUsageMetrics).toHaveBeenCalledTimes(1);

            const metricsArray = mockPushUsageMetrics.mock.calls[0][0]; // Capture the first argument

            expect(metricsArray).toEqual({
                remediation_components: [
                    {
                        feature_flags: [],
                        metrics: [
                            {
                                items: [
                                    {
                                        labels: { origin: 'CAPI', remediation: 'ban' },
                                        name: 'dropped',
                                        unit: 'request',
                                        value: 2,
                                    },
                                    {
                                        labels: { origin: 'cscli', remediation: 'ban' },
                                        name: 'dropped',
                                        unit: 'request',
                                        value: 3,
                                    },
                                    { name: 'processed', unit: 'request', value: 13 },
                                ],
                                meta: {
                                    utc_now_timestamp: now,
                                    window_size_seconds: now - lastSent,
                                },
                            },
                        ],
                        name: 'test-bouncer',
                        os: { name: 'LinuxTest', version: 'test-release' },
                        type: 'crowdsec-nodejs-bouncer',
                        utc_startup_timestamp: firstCall,
                        version: '1.0.0',
                    },
                ],
            });
        });
    });

    describe('getResponse', () => {
        it('should return 403 and ban wall for REMEDIATION_BAN', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const params = { ip: '192.168.0.1', remediation: REMEDIATION_BAN, origin: 'test-origin' };
            jest.spyOn(rendered, 'renderBanWall').mockResolvedValue('<ban-wall></ban-wall>');

            const result = await bouncer.getResponse(params);

            const origins_count = await bouncer.cacheStorage.adapter.getItem('origins_count');

            expect(result).toEqual({ status: 403, html: '<ban-wall></ban-wall>' });

            expect(origins_count?.content).toEqual([
                {
                    origin: 'test-origin',
                    remediation: { ban: 1 },
                },
            ]);
        });

        it('should return 401 and captcha wall for REMEDIATION_CAPTCHA', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const params = { ip: '192.168.0.1', remediation: REMEDIATION_CAPTCHA, origin: 'test-origin' };
            jest.spyOn(rendered, 'renderCaptchaWall').mockResolvedValue('<captcha-wall></captcha-wall>');

            const result = await bouncer.getResponse(params);

            expect(result).toEqual({ status: 401, html: '<captcha-wall></captcha-wall>' });

            const origins_count = await bouncer.cacheStorage.adapter.getItem('origins_count');

            expect(result).toEqual({ status: 401, html: '<captcha-wall></captcha-wall>' });

            expect(origins_count?.content).toEqual([
                {
                    origin: 'test-origin',
                    remediation: { captcha: 1 },
                },
            ]);
        });

        it('should return 401 and captcha wall with custom error message', async () => {
            const bouncer = new CrowdSecBouncer({
                ...configs,
                wallsOptions: { captcha: { texts: { error: 'Wrong phrase' } } },
            });
            const params = { ip: '192.168.0.1', remediation: REMEDIATION_CAPTCHA, origin: 'test-origin' };
            const mockRenderCaptcha = jest.spyOn(rendered, 'renderCaptchaWall').mockResolvedValue('<captcha-wall></captcha-wall>');
            const cachedCaptchaFlow = {
                key: 'captcha_flow_192.168.0.1',
                content: {
                    phraseToGuess: 'correct-phrase',
                    inlineImage: '<svg>test</svg>',
                    resolutionFailed: true,
                    mustBeResolved: true,
                },
            };
            jest.spyOn(bouncer.cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_192.168.0.1') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });

            const result = await bouncer.getResponse(params);

            expect(mockRenderCaptcha).toHaveBeenCalledWith({
                captchaImageTag: '<svg>test</svg>',
                texts: { error: 'Wrong phrase' },
            });

            expect(result).toEqual({ status: 401, html: '<captcha-wall></captcha-wall>' });
        });

        it('should return 401 and captcha wall with default error message', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const params = { ip: '192.168.0.1', remediation: REMEDIATION_CAPTCHA, origin: 'test-origin' };
            const mockRenderCaptcha = jest.spyOn(rendered, 'renderCaptchaWall').mockResolvedValue('<captcha-wall></captcha-wall>');
            const cachedCaptchaFlow = {
                key: 'captcha_flow_192.168.0.1',
                content: {
                    phraseToGuess: 'correct-phrase',
                    inlineImage: '<svg>test</svg>',
                    resolutionFailed: true,
                    mustBeResolved: true,
                },
            };
            jest.spyOn(bouncer.cacheStorage.adapter, 'getItem').mockImplementation((key) => {
                if (key === 'captcha_flow_192.168.0.1') {
                    return Promise.resolve(cachedCaptchaFlow);
                }
                if (key === 'origins_count') {
                    return Promise.resolve({
                        key: 'origins_count',
                        content: null,
                    });
                }

                return Promise.resolve(null); // Default case if needed
            });

            const result = await bouncer.getResponse(params);

            expect(mockRenderCaptcha).toHaveBeenCalledWith({
                captchaImageTag: '<svg>test</svg>',
                texts: { error: 'Please try again' },
            });

            expect(result).toEqual({ status: 401, html: '<captcha-wall></captcha-wall>' });
        });

        it('should return 200 and empty html for REMEDIATION_BYPASS', async () => {
            const bouncer = new CrowdSecBouncer(configs);
            const params = { ip: '192.168.0.1', remediation: REMEDIATION_BYPASS, origin: 'test-origin' };

            const result = await bouncer.getResponse(params);

            expect(result).toEqual({ status: 200, html: '' });

            const origins_count = await bouncer.cacheStorage.adapter.getItem('origins_count');

            expect(origins_count?.content).toEqual([
                {
                    origin: 'clean',
                    remediation: { bypass: 1 },
                },
            ]);
        });
    });
});
