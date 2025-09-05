import dotenv from 'dotenv';
import dotenvSafe from 'dotenv-safe';
import pino from 'pino';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and validate environment variables from .env file
export const loadEnv = () => {
    dotenvSafe.config({
        path: resolve(__dirname, '../../.env'),
        example: resolve(__dirname, '../../.env.example'),
    });
    dotenv.config({ path: resolve(__dirname, '../../.env') });
};

export const getLogger = () => {
    return pino({
        level: process.env.TEST_LOG_LEVEL ?? 'debug',
    });
};
