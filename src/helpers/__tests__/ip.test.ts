import { describe, expect, it } from '@jest/globals';

import { getIpToRemediate, getFirstIpFromRange, getIpOrRangeType, getIpV4BucketRange } from 'src/helpers/ip';
import { IP_TYPE_V4, IP_TYPE_V6 } from 'src/lib/constants';

describe('getIpToRemediate', () => {
    it('should parse a valid IPv4 address', () => {
        const ip = '192.168.0.1';
        const result = getIpToRemediate(ip);
        expect(result).toBe(ip);
    });

    it('should throw an error for range', () => {
        const ip = '192.168.0.0/24';
        expect(() => getIpToRemediate(ip)).toThrowError('Input IP (192.168.0.0/24): range is not supported');
    });

    it('should parse a valid IPv6 address', () => {
        const ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        const result = getIpToRemediate(ip);
        expect(result).toBe(ip);
    });

    it('should throw an error for an invalid IP format', () => {
        const ip = 'invalid-ip';
        expect(() => getIpToRemediate(ip)).toThrowError('Input IP format: invalid-ip is invalid');
    });
});

describe('getFirstIpFromRange', () => {
    it('should return the first IP from a valid IPv4 range', () => {
        const range = '192.168.0.0/24';
        const result = getFirstIpFromRange(range);
        expect(result).toBe('192.168.0.0');
    });

    it('should return the first IP from a valid IPv6 range', () => {
        const range = '2001:0db8:85a3::/64';
        const result = getFirstIpFromRange(range);
        expect(result).toBe('2001:0db8:85a3:0000:0000:0000:0000:0000');
    });

    it('should throw an error for an invalid range format', () => {
        const range = 'invalid-range';
        expect(() => getFirstIpFromRange(range)).toThrowError('Input (invalid-range) is not a range.');
    });

    it('should throw an error for a single IP address', () => {
        const range = '192.168.0.1';
        expect(() => getFirstIpFromRange(range)).toThrowError('Input (192.168.0.1) is not a range.');
    });
});

describe('getIpOrRangeType', () => {
    it('should return IP_TYPE_V4 for a valid IPv4 address', () => {
        const ip = '192.168.0.1';
        const result = getIpOrRangeType(ip);
        expect(result).toBe(IP_TYPE_V4);
    });

    it('should return IP_TYPE_V6 for a valid IPv6 address', () => {
        const ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        const result = getIpOrRangeType(ip);
        expect(result).toBe(IP_TYPE_V6);
    });

    it('should return IP_TYPE_V4 for a valid IPv4 range', () => {
        const range = '192.168.0.0/24';
        const result = getIpOrRangeType(range);
        expect(result).toBe(IP_TYPE_V4);
    });

    it('should return IP_TYPE_V6 for a valid IPv6 range', () => {
        const range = '2001:0db8:85a3::/64';
        const result = getIpOrRangeType(range);
        expect(result).toBe(IP_TYPE_V6);
    });

    it('should throw an error for an invalid IP or range format', () => {
        const invalidInput = 'invalid-ip';
        expect(() => getIpOrRangeType(invalidInput)).toThrowError('Input IP format: invalid-ip is invalid');
    });
});

describe('getIpV4BucketRange', () => {
    it('should return different start and end when range spans multiple buckets', () => {
        const range = '192.168.0.0/23'; // Covers two buckets: 192.168.0.0 - 192.168.1.255
        const result = getIpV4BucketRange(range);
        expect(result).toEqual({
            start: 12625920, // 192.168.0.0 => Math.trunc(3232235520/256)
            end: 12625921, // 192.168.1.255 Math.trunc(3232236031 / 256),
        });
    });

    it('should throw an error for an invalid range format', () => {
        const range = 'invalid-range';
        expect(() => getIpV4BucketRange(range)).toThrowError('Input Range format (invalid-range).');
    });

    it('should throw an error for a single IP address', () => {
        const range = '192.168.0.1';
        expect(() => getIpV4BucketRange(range)).toThrowError('Input Range format (192.168.0.1).');
    });

    it('should throw an error for an IPv6 range', () => {
        const range = '2001:0db8:85a3::/64';
        expect(() => getIpV4BucketRange(range)).toThrowError('Only Ip V4 Range format is supported.');
    });

    it('should throw an error for an empty string', () => {
        const range = '';
        expect(() => getIpV4BucketRange(range)).toThrowError('Input Range format ().');
    });
});
