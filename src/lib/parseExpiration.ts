const parseExpiration = (duration: string): Date => {
    const re = /^(-?)(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?$/;
    const matches = re.exec(duration);
    if (!matches) {
        throw new Error(`Unable to parse the following duration: ${duration}.`);
    }

    const isNegative = matches[1] === '-';
    const hours = parseInt(matches[2] || '0', 10);
    const minutes = parseInt(matches[3] || '0', 10);
    const seconds = parseInt(matches[4] || '0', 10);
    const milliseconds = parseInt(matches[5] || '0', 10);

    // Calculate total duration in milliseconds
    let totalMilliseconds =
        (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;

    if (isNegative) {
        totalMilliseconds *= -1;
    }

    const expiration = new Date();
    expiration.setTime(expiration.getTime() + totalMilliseconds);

    return expiration;
};

export default parseExpiration;
