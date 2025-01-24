import { REMEDIATION_BYPASS, REMEDIATION_CAPTCHA, REMEDIATION_BAN } from 'src/lib/constants';
import { Remediation } from 'src/lib/types';

// From lower priority to higher priority.
// @TODO: make this configurable to allow custom remediation types.
export const ORDERED_REMEDIATIONS: Remediation[] = [REMEDIATION_BYPASS, REMEDIATION_CAPTCHA, REMEDIATION_BAN];

export const CAPTCHA_REDIRECT = '/';
