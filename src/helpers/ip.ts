import { Address4, Address6 } from 'ip-address';

export const parseIpOrRange = (ip: string) => {
    try {
        return new Address4(ip);
    } catch {
        try {
            return new Address6(ip);
        } catch {
            throw new Error(`Input IP format: ${ip} is invalid`);
        }
    }
};
