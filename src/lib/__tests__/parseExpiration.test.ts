import { describe, expect, it, jest } from '@jest/globals';

import parseExpiration from 'src/lib/parseExpiration';

jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));

describe('⏳ Parse expiration', () => {
    it('should parse a positive duration', () => {
        const duration = '1h30m';
        const expectedExpiration = new Date();
        expectedExpiration.setTime(expectedExpiration.getTime() + 5400000); // 1 hour 30 minutes in milliseconds

        const result = parseExpiration(duration);

        expect(result).toEqual(expectedExpiration);
    });
    it('should parse a complex duration', () => {
        const duration = '3h59m49.481837158s';
        const expectedExpiration = new Date();
        expectedExpiration.setTime(expectedExpiration.getTime() + 14389481); // 3 hours 59 minutes 49.481837158 seconds in milliseconds

        const result = parseExpiration(duration);

        expect(result).toEqual(expectedExpiration);
    });

    it('should parse a negative duration', () => {
        const duration = '-30s';
        const expectedExpiration = new Date();
        expectedExpiration.setTime(expectedExpiration.getTime() - 30000); // 30 seconds in milliseconds

        const result = parseExpiration(duration);

        expect(result).toEqual(expectedExpiration);
    });

    it('should throw an error for an invalid duration', () => {
        const duration = 'invalid';

        expect(() => {
            parseExpiration(duration);
        }).toThrowError('Unable to parse the following duration: invalid.');
    });
});
