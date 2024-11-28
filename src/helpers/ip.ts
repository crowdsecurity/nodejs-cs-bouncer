import { Address4, Address6 } from 'ip-address';

import { IP_TYPE_V4, IP_TYPE_V6 } from 'src/lib/constants';

export type IpType = typeof IP_TYPE_V4 | typeof IP_TYPE_V6;

const parseIpOrRange = (ipOrRange: string) => {
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

export const getIpToRemediate = (ipOrRange: string): string => {
    const validated = parseIpOrRange(ipOrRange);
    return validated.startAddress().address;
};

export const getIpType = (ipOrRange: string): IpType => {
    const validated = parseIpOrRange(ipOrRange);
    return validated instanceof Address6 ? IP_TYPE_V6 : IP_TYPE_V4;
};
