import { Address4, Address6 } from 'ip-address';

import { IP_TYPE_V4, IP_TYPE_V6, IPV4_BUCKET_SIZE } from 'src/lib/constants';

export type IpType = typeof IP_TYPE_V4 | typeof IP_TYPE_V6;

export type IpV4Range = {
    start: number; // Start of the range converted in integer
    end: number; // End of the range converted in integer
};

export const isRange = (ip: string): boolean => {
    return ip.includes('/');
};

const parseIpOrRange = (ipOrRange: string): Address4 | Address6 => {
    try {
        return new Address4(ipOrRange);
    } catch {
        try {
            return new Address6(ipOrRange);
        } catch {
            throw new Error(`Input IP format: ${ipOrRange} is invalid`);
        }
    }
};

const getStartAddress = (ipOrRange: string): string => {
    const validated = parseIpOrRange(ipOrRange);
    return validated.startAddress().address;
};

export const getIpToRemediate = (ip: string): string => {
    if (isRange(ip)) {
        throw new Error(`Input IP (${ip}): range is not supported.`);
    }
    return getStartAddress(ip);
};

export const getFirstIpFromRange = (range: string): string => {
    if (!isRange(range)) {
        throw new Error(`Input (${range}) is not a range.`);
    }
    return getStartAddress(range);
};

/**
 * Converts an IPv4 address to its corresponding bucket index for efficient storage.
 * Instead of storing individual IP addresses, this method groups IPs into buckets
 * based on `IPV4_BUCKET_SIZE`, allowing a single decision to cover multiple addresses.
 *
 * @param ip - The IPv4 address to convert.
 * @returns The bucket index representing the IP.
 */
const getIpV4BucketIndex = (ip: Address4): number => {
    // Convert the parsed address (array of octets) to an unsigned integer
    const ipInt = ip.parsedAddress.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
    return Math.trunc(ipInt / IPV4_BUCKET_SIZE);
};

export const isIpV4InRange = (ip: string, range: string): boolean => {
    try {
        // Validate the range and IP
        const [rangeBase, prefixLength] = range.split('/');
        if (!Address4.isValid(rangeBase) || !Address4.isValid(ip)) {
            return false; // Invalid IP or range
        }

        // Check if the IP is in the subnet
        return new Address4(ip).isInSubnet(new Address4(`${rangeBase}/${prefixLength}`));
    } catch (error) {
        throw new Error(`Error checking IP in range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Validates an IPv4 address and converts it to its corresponding bucket index.
 * @param ip
 */
export const getIpV4BucketIndexForIp = (ip: string): number => {
    const validated = parseIpOrRange(ip);
    const type = getIpType(validated);
    if (type !== IP_TYPE_V4) {
        throw new Error(`Only Ip V4 format is supported.`);
    }
    return getIpV4BucketIndex(validated as Address4);
};

/**
 * Converts an IPv4 range into its corresponding bucket indices.
 * @param range
 */
export const getIpV4BucketRange = (range: string): IpV4Range => {
    if (!isRange(range)) {
        throw new Error(`Input Range format (${range}).`);
    }
    const validated = parseIpOrRange(range);
    const type = getIpType(validated);
    if (type !== IP_TYPE_V4) {
        throw new Error(`Only Ip V4 Range format is supported.`);
    }
    const startAddress = validated.startAddress();
    const endAddress = validated.endAddress();

    return {
        start: getIpV4BucketIndex(startAddress as Address4),
        end: getIpV4BucketIndex(endAddress as Address4),
    };
};

const getIpType = (ip: Address4 | Address6): IpType => {
    return ip instanceof Address6 ? IP_TYPE_V6 : IP_TYPE_V4;
};

export const getIpOrRangeType = (ipOrRange: string): IpType => {
    const validated = parseIpOrRange(ipOrRange);
    return getIpType(validated);
};
