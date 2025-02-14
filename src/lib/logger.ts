import { pino } from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'debug';

const logger = pino({
    level: LOG_LEVEL,
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
        },
    },
});

export default logger;
