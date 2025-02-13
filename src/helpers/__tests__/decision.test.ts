import { describe, expect, it } from '@jest/globals';

import { convertRawDecisionsToDecisions } from 'src/helpers/decision';

const configs = {
    url: 'http://example.com/api',
    bouncerApiToken: 'test-api-key',
};

describe('convertRawDecisionsToDecisions', () => {
    it('should convert raw decisions to cachable decisions', () => {
        const rawDecisions = [
            {
                origin: 'cscli',
                type: 'ban',
                scope: 'ip',
                value: '1.2.3.4',
                duration: '1h',
                scenario: '',
            },
        ];
        const currentTimestamp = Date.now();
        const decisions = convertRawDecisionsToDecisions(rawDecisions, configs);

        const expected = [
            {
                identifier: 'cscli-ban-ip-1.2.3.4',
                origin: 'cscli',
                scope: 'ip',
                value: '1.2.3.4',
                type: 'ban',
                expiresAt: expect.any(Number),
            },
        ];
        expect(decisions).toEqual(expected);
        expect(decisions[0].expiresAt).toBeCloseTo(currentTimestamp + 3600000, -2); // Allows some flexibility;
    });
    it('should convert raw lists decisions to cachable decisions', () => {
        const rawDecisions = [
            {
                origin: 'lists',
                type: 'ban',
                scope: 'ip',
                value: '1.2.3.4',
                duration: '1h',
                scenario: 'tor',
            },
        ];
        const currentTimestamp = Date.now();
        const decisions = convertRawDecisionsToDecisions(rawDecisions, configs);

        const expected = [
            {
                identifier: 'lists:tor-ban-ip-1.2.3.4',
                origin: 'lists:tor',
                scope: 'ip',
                value: '1.2.3.4',
                type: 'ban',
                expiresAt: expect.any(Number),
            },
        ];
        expect(decisions).toEqual(expected);
        expect(decisions[0].expiresAt).toBeCloseTo(currentTimestamp + 3600 * 1000, -2); // Allows some flexibility;
    });
    it('should return empty for invalid decision', () => {
        const rawDecisions = [
            {
                origin: 'lists',
                type: 'ban',
                scope: 'ip',
                value: '1.2.3.4',
                duration: '1h',
                scenario: '',
            },
        ];
        const decisions = convertRawDecisionsToDecisions(rawDecisions, configs);
        const expected: unknown = [];

        expect(decisions).toEqual(expected);
    });
    it('should create decision with correct expires_at in stream mode', () => {
        const streamConfigs = {
            url: 'http://example.com/api',
            bouncerApiToken: 'test-api-key',
            streamMode: true,
            badIpCacheDuration: 120,
        };
        const rawDecisions = [
            {
                origin: 'CAPI',
                type: 'ban',
                scope: 'ip',
                value: '1.2.3.4',
                duration: '1h',
                scenario: '',
            },
        ];
        const currentTimestamp = Date.now();
        const decisions = convertRawDecisionsToDecisions(rawDecisions, streamConfigs);
        const expected = [
            {
                identifier: 'capi-ban-ip-1.2.3.4',
                origin: 'capi',
                scope: 'ip',
                value: '1.2.3.4',
                type: 'ban',
                expiresAt: expect.any(Number),
            },
        ];
        expect(decisions).toEqual(expected);
        // The expiration time should be the minimum between the decision duration and the badIpCacheDuration
        expect(decisions[0].expiresAt).toBeCloseTo(currentTimestamp + 120 * 1000, -2); // Allows some flexibility;

        expect(decisions).toEqual(expected);
    });
});
