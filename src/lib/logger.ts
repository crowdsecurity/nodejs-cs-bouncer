import { pino, Logger } from 'pino';

const LOG_LEVEL = process?.env?.LOG_LEVEL ?? 'debug';

const logger: Logger = pino({ level: LOG_LEVEL });

export default logger;
