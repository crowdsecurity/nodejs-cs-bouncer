import { afterEach, describe, expect, it } from '@jest/globals';
import nock, { cleanAll as nockCleanAll } from 'nock';

import CrowdSecBouncer from 'src/lib/bouncer';
import { CrowdSecBouncerConfiguration } from 'src/lib/bouncer/libs/types';
import { RemediationType } from 'src/lib/types';

const options: CrowdSecBouncerConfiguration = {
    url: 'http://example.com/api',
    bouncerApiToken: 'test-api-key',
};

describe('🛡️ Bouncer', () => {
    const bouncer = new CrowdSecBouncer(options);

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
            const customBouncer = new CrowdSecBouncer({ ...options, fallbackRemediation: 'ban' });
            expect(customBouncer.fallbackRemediation).toBe('ban');
        });

        it('should have a method called "getIpRemediation"', () => {
            expect(bouncer.getIpRemediation).toBeInstanceOf(Function);
        });
    });

    describe('getIpRemediation', () => {
        it('should compute the correct remediation for the IP 3.4.5.6', async () => {
            const ipV4 = '3.4.5.6';
            const remediation: RemediationType = 'ban';
            const nockScope = nock(options.url)
                .get('/v1/decisions')
                .query({ ip: ipV4 })
                .matchHeader('X-Api-Key', options.bouncerApiToken)
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
            expect(responseRemediation).toEqual(remediation);
        });

        it('should compute the correct remediation for the IPv6 2001:0000:130F:0000:0000:09C0:876A:130B', async () => {
            const ipV6 = '2001:0000:130F:0000:0000:09C0:876A:130B';
            const remediation: RemediationType = 'ban';

            const nockScope = nock(options.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', options.bouncerApiToken)
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
            expect(responseRemediation).toEqual(remediation);
        });

        it('should return fallback remediation if there is no decision at all', async () => {
            const ip = '1.2.3.4';

            const nockScope = nock(options.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(200, 'null', {
                    'Content-Type': 'application/json',
                });

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation).toEqual('bypass');
        });

        it('should return fallback remediation if the IP is unknown', async () => {
            const ip = '1.2.3.4';

            const nockScope = nock(options.url)
                .get('/v1/decisions')
                .query(true)
                .matchHeader('X-Api-Key', options.bouncerApiToken)
                .matchHeader('Content-Type', 'application/json')
                .reply(200, [], {
                    'Content-Type': 'application/json',
                });

            const responseRemediation = await bouncer.getIpRemediation(ip);
            expect(nockScope.isDone()).toBe(true);
            expect(responseRemediation).toEqual('bypass');
        });
    });
});
