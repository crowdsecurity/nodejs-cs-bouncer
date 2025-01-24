import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import nock, { cleanAll as nockCleanAll } from 'nock';

import CrowdSecBouncer from 'src/lib/bouncer';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import logger from 'src/lib/logger';
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

    describe('constructor', () => {
        it('should be a class', () => {
            expect(bouncer).toBeInstanceOf(CrowdSecBouncer);
        });

        it('should have a fallback remediation of "bypass"', () => {
            expect(bouncer.fallbackRemediation).toBe('bypass');
        });

        it('should have fallback remediation customizable', () => {
            const customBouncer = new CrowdSecBouncer({ ...configs, fallbackRemediation: 'ban' });
            expect(customBouncer.fallbackRemediation).toBe('ban');
        });

        it('should have a method called "getIpRemediation"', () => {
            expect(bouncer.getIpRemediation).toBeInstanceOf(Function);
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
            expect(responseRemediation['remediation']).toEqual('bypass');
        });

        it('should return fallback remediation if decisions are not related to the IP', async () => {
            const ip = '1.2.3.9';

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
                            value: '1.2.3.5',
                        },
                    ],
                    {
                        'Content-Type': 'application/json',
                    },
                );

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation['remediation']).toEqual('bypass');
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
    });
});
