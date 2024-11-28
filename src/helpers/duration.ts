/**
 * The function `parseExpiration` takes a duration string and returns the TTL in milliseconds.
 * @param {string} duration - string like "3h59m49.481837158s" (hours, minutes, seconds, milliseconds) and calculate the expiration time.
 * @returns `Number` representing the Time To Live.
 */
export const convertDurationToMilliseconds = (duration: string): number => {
    const re = /^(-?)(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/;
    const matches = re.exec(duration);
    if (!matches) {
        throw new Error(`Unable to parse the following duration: ${duration}.`);
    }

    const isNegative = matches[1] === '-';
    const hours = parseInt(matches[2] || '0', 10);
    const minutes = parseInt(matches[3] || '0', 10);
    const seconds = parseFloat(matches[4] || '0');

    // Calculate total duration in milliseconds
    let totalMilliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000;

    if (isNegative) {
        totalMilliseconds *= -1;
    }

    return totalMilliseconds;
};
