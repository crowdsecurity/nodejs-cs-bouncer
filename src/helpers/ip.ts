import { Address4, Address6 } from 'ip-address';

export const parseIpOrRange = (ip: string) => {
    try {
        return new Address4(ip);
    } catch (e4) {
        try {
            return new Address6(ip);
        } catch (e6) {
            throw new Error(`Input IP format: ${ip} is invalid`);
        }
    }
};
