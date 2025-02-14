import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals';

import { convertRawDecisionsToDecisions } from 'src/helpers/decision';
import * as decisionModule from 'src/helpers/decision';
import logger from 'src/lib/logger';

const configs = {
    url: 'http://example.com/api',
    bouncerApiToken: 'test-api-key',
};

afterEach(() => {
    jest.restoreAllMocks();
});

afterAll(() => {
    jest.restoreAllMocks();
});

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
        const badIpCacheDuration = 3600;
        const streamConfigs = {
            url: 'http://example.com/api',
            bouncerApiToken: 'test-api-key',
            streamMode: true,
            badIpCacheDuration,
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
        expect(decisions[0].expiresAt).toBeCloseTo(currentTimestamp + badIpCacheDuration * 1000, -2); // Allows some flexibility;

        expect(decisions).toEqual(expected);
    });
    it('should create decision with correct default expires_at in stream mode', () => {
        const streamConfigs = {
            url: 'http://example.com/api',
            bouncerApiToken: 'test-api-key',
            streamMode: true,
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
        // The default badIpCacheDuration is 120 seconds
        expect(decisions[0].expiresAt).toBeCloseTo(currentTimestamp + 120 * 1000, -2); // Allows some flexibility;

        expect(decisions).toEqual(expected);
    });
    describe('convertRawDecisionsToDecisions - Error Handling', () => {
        it('should log an error when convertRawDecisionToCachableDecision throws an error', () => {
            const error = new Error('Test error');
            const mockFn = jest.spyOn(decisionModule, 'buildCachableDecision').mockImplementation(() => {
                throw error; // Force an error inside convertRawDecisionToCachableDecision
            });

            const loggerErrorSpy = jest.spyOn(logger, 'error');

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

            const decisions = convertRawDecisionsToDecisions(rawDecisions, configs);

            expect(decisions).toEqual([]);

            expect(loggerErrorSpy).toHaveBeenCalledWith(`Error converting raw decision to cachable decision: ${error.message}`);

            // Cleanup: Restore original implementation
            mockFn.mockRestore();
            loggerErrorSpy.mockRestore();
        });
    });
    describe('convertRawDecisionsToDecisions - Non-Error Exception Handling', () => {
        it('should log a generic error message when the thrown error is not an instance of Error', () => {
            // Arrange: Mock buildCachableDecision to throw a string instead of an Error object
            const errorString = 'Unexpected failure';
            const mockFn = jest.spyOn(decisionModule, 'buildCachableDecision').mockImplementation(() => {
                throw errorString; // Throwing a string instead of an Error object
            });

            const loggerErrorSpy = jest.spyOn(logger, 'error');

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

            // Act: Call the function that should catch the error
            const decisions = convertRawDecisionsToDecisions(rawDecisions, configs);

            // Assert: Ensure decisions is empty due to the caught error
            expect(decisions).toEqual([]);

            // Assert: Ensure logger.error was called with the generic message
            expect(loggerErrorSpy).toHaveBeenCalledWith('An unexpected error occurred');

            // Cleanup: Restore original implementation
            mockFn.mockRestore();
            loggerErrorSpy.mockRestore();
        });
    });
});
