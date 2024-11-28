import { REMEDIATION_BYPASS, REMEDIATION_CAPTCHA, REMEDIATION_BAN } from 'src/lib/constants';
import { RemediationType } from 'src/lib/types';

// From lower priority to higher priority.
// @TODO: make this configurable to allow custom remediation types.
export const ORDERED_REMEDIATIONS: RemediationType[] = [REMEDIATION_BYPASS, REMEDIATION_CAPTCHA, REMEDIATION_BAN];
