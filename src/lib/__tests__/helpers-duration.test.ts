import { describe, expect, it, jest } from '@jest/globals';

import { convertDurationToMilliseconds } from 'src/helpers/duration';

jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));

describe('⏳ Parse duration', () => {
    it('should parse a positive duration', () => {
        const duration = '1h30m';
        const expectedTTL = 5400000; // 1 hour 30 minutes in milliseconds
        const result = convertDurationToMilliseconds(duration);

        expect(result).toEqual(expectedTTL);
    });
    it('should parse a complex duration', () => {
        const duration = '3h59m49.481837158s';
        const expectedTTL = 14389481.837158; // 3 hours 59 minutes 49.481837158 seconds in milliseconds

        const result = convertDurationToMilliseconds(duration);

        expect(result).toEqual(expectedTTL);
    });

    it('should parse a negative duration', () => {
        const duration = '-30s';
        const expectedTTL = -30000; // 30 seconds in milliseconds

        const result = convertDurationToMilliseconds(duration);

        expect(result).toEqual(expectedTTL);
    });

    it('should throw an error for an invalid duration', () => {
        const duration = 'invalid';

        expect(() => {
            convertDurationToMilliseconds(duration);
        }).toThrowError('Unable to parse the following duration: invalid.');
    });
});
