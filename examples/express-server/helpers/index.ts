import dotenv from 'dotenv';
import dotenvSafe from 'dotenv-safe';
import pino from 'pino';

import path from 'path';

export const getExcludedPaths = () => {
    // Skip favicon requests as each access to the page will trigger a request to /favicon.ico
    // and there is no need to apply remediation twice
    const excludedPaths = ['/favicon.ico'];
    if (process.env.E2E_TEST_NAME) {
        // We need to exclude this endpoint only for end-to-end tests purposes
        excludedPaths.push('/end-to-end-tools');
    }
    return excludedPaths;
};

export const getLogger = () => {
    return pino({
        level: process.env.TEST_LOG_LEVEL ?? 'debug',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: false,
            },
        },
    });
};

// Load and validate environment variables from .env file
export const loadEnv = () => {
    dotenvSafe.config({
        path: path.resolve(__dirname, '../.env'),
        example: path.resolve(__dirname, '../.env.example'),
    });
    dotenv.config();
    // Load and validate the .env file in the crowdsec folder (will override any duplicate values from the main .env)
    dotenvSafe.config({
        path: path.resolve(__dirname, '../crowdsec/.env'),
        example: path.resolve(__dirname, '../crowdsec/.env.example'),
    });
    dotenv.config({ path: path.resolve(__dirname, '../crowdsec/.env') });
};
