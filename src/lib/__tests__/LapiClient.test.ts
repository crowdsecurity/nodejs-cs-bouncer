import { afterEach, describe, expect, it } from '@jest/globals';
import nock, { cleanAll as nockCleanAll } from 'nock';

import LapiClient from 'src/lib/LapiClient';
import { Decision } from 'src/lib/types';

describe('LapiClient', () => {
    const options = {
        lapiUrl: 'http://example.com/api',
        bouncerApiToken: 'test-api-key',
        userAgent: 'test-user-agent',
    };

    const client = new LapiClient(options);

    afterEach(() => {
        nockCleanAll();
    });

    describe('constructor', () => {
        it('should throw an error if `lapiUrl` does not start with http:// or https://', () => {
            const invalidOptions = {
                ...options,
                lapiUrl: 'ftp://example.com/api',
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
    });

    describe('getDecisionStream', () => {
        it('should properly handle query parameters for the decision stream', async () => {
            const nockScope = nock(options.lapiUrl)
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
            nock(options.lapiUrl).get('/v1/decisions/stream').query(true).reply(500);

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
            const nockScope = nock(options.lapiUrl)
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
            nock(options.lapiUrl).get(`/v1/decisions?ip=${ip}`).reply(500);

            await expect(client.getDecisionsMatchingIp(ip)).rejects.toThrow('Call to v1/decisions?ip=192.168.1.1 failed');
        });
    });
});
