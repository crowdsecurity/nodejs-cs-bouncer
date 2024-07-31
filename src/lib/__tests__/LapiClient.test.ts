import { afterEach, describe, expect, it, jest } from '@jest/globals';
import nock, { cleanAll as nockCleanAll } from 'nock';

import LapiClient from 'src/lib/lapi-client';
import { LapiClientConfigurations } from 'src/lib/lapi-client/libs/types';
import logger from 'src/lib/logger';
import { Decision } from 'src/lib/types';

const options: LapiClientConfigurations & {
    userAgent: string;
} = {
    url: 'http://example.com/api',
    bouncerApiToken: 'test-api-key',
    userAgent: 'test-user-agent',
};

describe('👩🏻‍⚖️ LAPI Client', () => {
    const client = new LapiClient(options);

    afterEach(() => {
        nockCleanAll();
    });

    describe('constructor', () => {
        it('should throw an error if `url` does not start with http:// or https://', () => {
            const invalidOptions: LapiClientConfigurations = {
                ...options,
                url: 'ftp://example.com/api',
            };
            expect(() => new LapiClient(invalidOptions)).toThrow('`lapiUrl` seems invalid. It should start with "http://" or "https://"');
        });

        it('should throw an error if `bouncerApiToken` is empty', () => {
            const invalidOptions = { ...options, bouncerApiToken: '' };
            expect(() => new LapiClient(invalidOptions)).toThrow('`bouncerApiToken` is required and must be non-empty');
        });

        it('should use default userAgent if not provided', () => {
            const defaultUserAgentOptions = {
                ...options,
                userAgent: undefined,
            };
            const clientWithDefaultUserAgent = new LapiClient(defaultUserAgentOptions);
            expect(clientWithDefaultUserAgent).toBeDefined();
            expect((clientWithDefaultUserAgent as unknown as { userAgent: string }).userAgent).toBe('nodejs-cs-bouncer');
        });

        it('should log error if connection is unhealthy', async () => {
            const spyOnError = jest.spyOn(logger, 'error');
            const nockScope = nock(options.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(500);

            const tempClient = new LapiClient(options);
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(spyOnError).toHaveBeenCalled();
            expect(nockScope.isDone()).toBe(true);
            expect(tempClient).toBeDefined();
        });
    });

    describe('getDecisionStream', () => {
        it('should properly handle query parameters for the decision stream', async () => {
            const nockScope = nock(options.url)
                .get('/v1/decisions/stream')
                .query({
                    startup: 'true',
                    origins: 'cscli',
                    scopes: 'ip,range',
                    scenarios_containing: 'ssh,login',
                    scenarios_not_containing: 'ignore',
                })
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
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
            nock(options.url).get('/v1/decisions/stream').query(true).reply(500);

            await expect(client.getDecisionStream()).rejects.toThrow('Call to v1/decisions/stream?startup=false failed');
        });
    });

    describe('getDecisionsMatchingIp', () => {
        const ip = '192.168.1.1';

        const decisions: Decision[] = [
            {
                id: 1,
                type: 'ban',
                value: ip,
                duration: '1h',
                origin: 'cscli',
                scope: 'ip',
                simulated: false,
                until: '2022-01-01T00:00:00Z',
            },
            {
                id: 2,
                type: 'captcha',
                value: ip,
                duration: '2h',
                origin: 'cscli',
                scope: 'ip',
                simulated: false,
                until: '2022-01-01T00:00:00Z',
            },
        ];

        it('should return decisions matching a given IP', async () => {
            const nockScope = nock(options.url)
                .get('/v1/decisions')
                .query({ ip })
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(200, decisions, {
                    'Content-Type': 'application/json',
                });

            const response = await client.getDecisionsMatchingIp(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(response).toEqual(decisions);
        });

        it('should throw an error with an explicit error message if the response is not ok', async () => {
            nock(options.url).get(`/v1/decisions?ip=${ip}`).reply(500);

            await expect(client.getDecisionsMatchingIp(ip)).rejects.toThrow('Call to v1/decisions?ip=192.168.1.1 failed');
        });
    });

    describe('checkConnectionHealth', () => {
        it('should return an OK status when the connection is healthy', async () => {
            const nockScope = nock(options.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
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
            const nockScope = nock(options.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(403);

            const { status, error } = await client.checkConnectionHealth();

            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('ERROR');
            expect(error).toEqual('INVALID_API_TOKEN');
        });

        it('should return an ERROR status with a SECURITY_ENGINE_SERVER_ERROR error when the status is 500', async () => {
            const nockScope = nock(options.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(500);

            const { status, error } = await client.checkConnectionHealth();

            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('ERROR');
            expect(error).toEqual('SECURITY_ENGINE_SERVER_ERROR');
        });

        it('should return an ERROR status with a UNEXPECTED_STATUS error when the HTTP status is unexpected', async () => {
            const nockScope = nock(options.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
                .matchHeader('Content-Type', 'application/json')
                .reply(400);

            const { status, error } = await client.checkConnectionHealth();

            expect(nockScope.isDone()).toBe(true);
            expect(status).toEqual('ERROR');
            expect(error).toEqual('UNEXPECTED_STATUS');
        });

        it('should return an ERROR status with a SECURITY_ENGINE_UNREACHABLE error when the URL is unreachable', async () => {
            const nockScope = nock(options.url)
                .head('/v1/decisions')
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('User-Agent', options.userAgent)
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
