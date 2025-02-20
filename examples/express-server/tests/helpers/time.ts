export const wait = async (ms: number) =>
    new Promise((resolve) => {
        console.log(`⏳ Waiting for ${Math.trunc(ms / 1000)} seconds ...`);
        return setTimeout(resolve, ms);
    });
