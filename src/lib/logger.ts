import { pino, Logger } from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'debug';

// Detect clean Node.js runtime (bundler or Edge runtime will fall back without transport)
const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

let logger: Logger;

if (isNode) {
    try {
        logger = pino({
            level: LOG_LEVEL,
            transport: {
                target: 'pino-pretty',
                options: {
                    // Disable colors if CS_NO_COLOR is set
                    colorize: !process.env.CS_NO_COLOR,
                },
            },
        });
    } catch {
        // If transport resolution fails (e.g. webpack), fallback to default pino
        logger = pino({ level: LOG_LEVEL });
    }
} else {
    // Non-Node environments: plain JSON output
    logger = pino({ level: LOG_LEVEL });
}

export default logger;
