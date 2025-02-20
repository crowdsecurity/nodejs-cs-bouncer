export const wait = async (ms: number) =>
    new Promise((resolve) => {
        console.log(`⏳ Waiting for ${Math.fround(ms / 1000)} second(s) ...`);
        return setTimeout(resolve, ms);
    });
