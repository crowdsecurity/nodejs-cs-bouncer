import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals';
import nock, { cleanAll as nockCleanAll } from 'nock';

import LapiClient from '../lapi-client';
import { LapiClientConfigurations } from '../lapi-client/types';
import logger from '../logger';
import { Decision } from '../types';

const configs: LapiClientConfigurations & {
    userAgent: string;
} = {
    url: 'http://example.com/api',
    bouncerApiToken: 'test-api-key',
    userAgent: 'test-user-agent',
};

describe('👩🏻‍⚖️ LAPI Client', () => {
    const client = new LapiClient(configs);

    afterEach(() => {
        nockCleanAll();
        jest.restoreAllMocks();
    });
    afterAll(() => {
        nockCleanAll();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should throw an error if `url` does not start with http:// or https://', () => {
            const invalidOptions: LapiClientConfigurations = {
                ...configs,
                url: 'ftp://example.com/api',
            };
            expect(() => new LapiClient(invalidOptions)).toThrow('`lapiUrl` seems invalid. It should start with "http://" or "https://"');
        });

        it('should throw an error if `bouncerApiToken` is empty', () => {
            const invalidOptions = { ...configs, bouncerApiToken: '' };
            expect(() => new LapiClient(invalidOptions)).toThrow('`bouncerApiToken` is required and must be non-empty');
        });

        it('should use default userAgent if not provided', () => {
            const defaultUserAgentOptions = {
                ...configs,
                userAgent: undefined,
            };
            const clientWithDefaultUserAgent = new LapiClient(defaultUserAgentOptions);
            expect(clientWithDefaultUserAgent).toBeDefined();
            expect(
                (
                    clientWithDefaultUserAgent as unknown as {
                        userAgent: string;
                    }
                ).userAgent,
            ).toMatch(/nodejs-cs-bouncer\/v\d+\.\d+\.\d+/);
        });

        it('should log error if connection is unhealthy', async () => {
            const spyOnError = jest.spyOn(logger, 'error');
            const nockScope = nock(configs.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(500);

            const tempClient = new LapiClient(configs);
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(spyOnError).toHaveBeenCalled();
            expect(nockScope.isDone()).toBe(true);
            expect(tempClient).toBeDefined();
        });
    });

    describe('getDecisionStream', () => {
        it('should properly handle query parameters for the decision stream', async () => {
            const nockScope = nock(configs.url)
                .get('/v1/decisions/stream')
                .query({
                    startup: 'true',
                    origins: 'cscli',
                    scopes: 'ip,range',
                    scenarios_containing: 'ssh,login',
                    scenarios_not_containing: 'ignore',
                })
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    { new: [], deleted: [] },
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const response = await client.getDecisionStream({
                isFirstFetch: true,
                origins: ['cscli'],
                scopes: ['ip', 'range'],
                scenariosContaining: ['ssh', 'login'],
                scenariosNotContaining: ['ignore'],
            });
            expect(nockScope.isDone()).toBe(true);
            expect(response).toEqual({ new: [], deleted: [] });
        });

        it('should throw an error with an explicit error message if the decision stream response is not ok', async () => {
            nock(configs.url).get('/v1/decisions/stream').query(true).reply(500);

            await expect(client.getDecisionStream()).rejects.toThrow('Call to v1/decisions/stream?startup=false failed');
        });
    });

    describe('getDecisionsMatchingIp', () => {
        const ip = '192.168.1.1';

        const decisions: Decision[] = [
            {
                type: 'ban',
                value: ip,
                duration: '1h',
                origin: 'cscli',
                scope: 'ip',
                scenario: "manual 'ban' from 'localhost'",
            },
            {
                type: 'captcha',
                value: ip,
                duration: '2h',
                origin: 'cscli',
                scope: 'ip',
                scenario: "manual 'ban' from 'localhost'",
            },
        ];

        it('should return decisions matching a given IP', async () => {
            const nockScope = nock(configs.url)
                .get('/v1/decisions')
                .query({ ip })
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(200, decisions, {
                    'Content-Type': 'application/json',
                });

            const response = await client.getDecisionsMatchingIp(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(response).toEqual(decisions);
        });

        it('should throw an error with an explicit error message if the response is not ok', async () => {
            nock(configs.url).get(`/v1/decisions?ip=${ip}`).reply(500);

            await expect(client.getDecisionsMatchingIp(ip)).rejects.toThrow('Call to v1/decisions?ip=192.168.1.1 failed');
        });
    });

    describe('pushUsageMetrics', () => {
        const metrics = {
            remediation_components: [
                {
                    name: 'test-node-bouncer',
                    type: 'nodejs-bouncer',
                    version: '0.0.0',
                    feature_flags: [],
                    utc_startup_timestamp: 0,
                    os: {
                        name: 'Linux',
                        version: 'Ubuntu 20.04.2 LTS',
                    },
                    metrics: [
                        {
                            meta: {
                                window_size_seconds: 600,
                                utc_now_timestamp: 0,
                            },
                            items: [
                                {
                                    name: 'dropped',
                                    value: 7,
                                    unit: 'requests',
                                    labels: {
                                        origin: 'CAPI',
                                        remediation: 'ban',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        it('should push usage metrics', async () => {
            const nockScope = nock(configs.url)
                .post('/v1/usage-metrics', (body) => {
                    return JSON.stringify(body) === JSON.stringify(metrics); // Validate request body
                })
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(201, 'ok', {
                    'Content-Type': 'application/json',
                });

            const response = await client.pushUsageMetrics(metrics);
            expect(nockScope.isDone()).toBe(true);
            expect(response).toEqual(201);
        });
    });

    describe('checkConnectionHealth', () => {
        it('should return an OK status when the connection is healthy', async () => {
            const nockScope = nock(configs.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(
                    200,
                    { status: 'ok' },
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const { status, error } = await client.checkConnectionHealth();
            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('OK');
            expect(error).toEqual(null);
        });

        it('should return an ERROR status with a INVALID_BOUNCER_API_TOKEN error when the API token is invalid', async () => {
            const nockScope = nock(configs.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(403);

            const { status, error } = await client.checkConnectionHealth();

            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('ERROR');
            expect(error).toEqual('INVALID_API_TOKEN');
        });

        it('should return an ERROR status with a SECURITY_ENGINE_SERVER_ERROR error when the status is 500', async () => {
            const nockScope = nock(configs.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(500);

            const { status, error } = await client.checkConnectionHealth();

            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('ERROR');
            expect(error).toEqual('SECURITY_ENGINE_SERVER_ERROR');
        });

        it('should return an ERROR status with a UNEXPECTED_STATUS error when the HTTP status is unexpected', async () => {
            const nockScope = nock(configs.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(400);

            const { status, error } = await client.checkConnectionHealth();

            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('ERROR');
            expect(error).toEqual('UNEXPECTED_STATUS');
        });

        it('should return an ERROR status with a SECURITY_ENGINE_UNREACHABLE error when the URL is unreachable', async () => {
            const nockScope = nock(configs.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', configs.bouncerApiToken)
                .matchHeader('User-Agent', configs.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .replyWithError({
                    code: 'ENOTFOUND',
                    errno: 'ENOTFOUND',
                    syscall: 'getaddrinfo',
                    hostname: 'www.example.com',
                });

            const { status, error } = await client.checkConnectionHealth();

            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('ERROR');
            expect(error).toEqual('SECURITY_ENGINE_UNREACHABLE');
        });
    });
});
