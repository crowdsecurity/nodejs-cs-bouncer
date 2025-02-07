import { REMEDIATION_BYPASS, REMEDIATION_CAPTCHA, REMEDIATION_BAN } from 'src/lib/constants';
import { Remediation } from 'src/lib/types';

// From lower priority to higher priority.
export const ORDERED_REMEDIATIONS: Remediation[] = [REMEDIATION_BYPASS, REMEDIATION_CAPTCHA, REMEDIATION_BAN];

export const BOUNCING_LEVEL_DISABLED = 'disabled_bouncing';
export const BOUNCING_LEVEL_FLEX = 'flex_bouncing';
export const BOUNCING_LEVEL_NORMAL = 'normal_bouncing';
