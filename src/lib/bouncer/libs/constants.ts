import { RemediationType } from 'src/lib/types';

// From lower priority to higher priority.
export const ORDERED_REMEDIATIONS: RemediationType[] = ['bypass', 'captcha', 'ban'];
