import { describe, expect, it } from '@jest/globals';

import logger from 'src/lib/logger';

describe('Logger', () => {
    it('should create a logger instance', () => {
        expect(logger).toBeDefined();
    });

    it('should have the correct log level', () => {
        expect(logger.level).toBe('debug');
    });
});
