import { afterAll, afterEach, describe, expect, it } from '@jest/globals';

import logger from 'src/lib/logger';

describe('Logger', () => {
    afterAll(async () => {
        logger.flush();
    });

    afterEach(async () => {
        logger.flush();
    });

    it('should create a logger instance', () => {
        expect(logger).toBeDefined();
    });

    it('should have the correct log level', () => {
        const logLevel = process?.env?.LOG_LEVEL || 'debug';
        expect(logger.level).toBe(logLevel);
    });
});
