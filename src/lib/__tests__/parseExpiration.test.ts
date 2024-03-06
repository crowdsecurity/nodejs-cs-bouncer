import { describe, expect, it } from '@jest/globals';

import parseExpiration from 'src/lib/parseExpiration';

describe('⏳ Parse expiration', () => {
    it('should parse a positive duration', () => {
        const duration = '1h30m';
        const expectedExpiration = new Date();
        expectedExpiration.setTime(expectedExpiration.getTime() + 5400000); // 1 hour 30 minutes in milliseconds

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

    it('should parse a duration with milliseconds', () => {
        const duration = '500ms';
        const expectedExpiration = new Date();
        expectedExpiration.setTime(expectedExpiration.getTime() + 500); // 500 milliseconds

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
