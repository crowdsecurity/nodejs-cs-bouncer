/**
 * Jest transformer for *.ejs files.
 * Reads the file contents and turns it into a string export that works
 * in CommonJS *or* ESM test files because Jest always evaluates the
 * transform output in a CJS wrapper.
 */
module.exports = {
    process(src) {
        // CJS export is safe: `module.exports = '…';`
        return { code: `module.exports = ${JSON.stringify(src)};` };
    },
};
