import { describe, expect, it } from '@jest/globals';
import { Address4, Address6 } from 'ip-address';

import { getIpToRemediate } from 'src/helpers/ip';

describe('getIpToRemediate', () => {
    it('should parse a valid IPv4 address', () => {
        const ip = '192.168.0.1';
        const result = getIpToRemediate(ip);
        expect(result).toBe(ip);
    });

    it('should parse a valid IPv4 address range', () => {
        const ip = '192.168.0.0/24';
        const result = getIpToRemediate(ip);
        expect(result).toBe('192.168.0.0');
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
