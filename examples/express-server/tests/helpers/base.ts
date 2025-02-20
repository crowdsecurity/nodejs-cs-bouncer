export const getBouncedIp = (): string => {
    const bouncedIp = process.env.BOUNCED_IP ?? '';
    if (bouncedIp !== '') {
        return bouncedIp;
    }
    throw new Error('BOUNCER_IP env is not defined.');
};
