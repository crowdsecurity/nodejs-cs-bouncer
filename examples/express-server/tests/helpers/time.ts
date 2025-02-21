export const wait = async (ms: number, message?: string) =>
    new Promise((resolve) => {
        console.log(`⏳ Waiting for ${Math.fround(ms / 1000)} second(s) ...${message ? ` (${message})` : ''}`);
        return setTimeout(resolve, ms);
    });
