import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const HOME_TITLE = 'CrowdSec Node.js bouncer test page';
export const BAN_TITLE = 'CrowdSec | Ban Wall';
export const CAPTCHA_TITLE = 'CrowdSec | Captcha Wall';
export const E2E_ENDPOINT = '/end-to-end';
export const LOG_PATH = `${__dirname}/logs/crowdsec.log`;
