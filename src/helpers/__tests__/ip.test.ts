import { describe, expect, it } from '@jest/globals';
import { Address4, Address6 } from 'ip-address';

import { parseIpOrRange } from 'src/helpers/ip';

describe('parseIpOrRange', () => {
    it('should parse a valid IPv4 address', () => {
        const ip = '192.168.0.1';
        const result = parseIpOrRange(ip);
        expect(result).toBeInstanceOf(Address4);
        expect(result.address).toBe(ip);
    });

    it('should parse a valid IPv6 address', () => {
        const ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        const result = parseIpOrRange(ip);
        expect(result).toBeInstanceOf(Address6);
        expect(result.address).toBe(ip);
    });

    it('should throw an error for an invalid IP format', () => {
        const ip = 'invalid-ip';
        expect(() => parseIpOrRange(ip)).toThrowError('Input IP format: invalid-ip is invalid');
    });
});
