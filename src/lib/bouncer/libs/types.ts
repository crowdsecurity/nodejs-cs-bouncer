import { LapiClientConfigurations } from 'src/lib/lapi-client/libs/types';
import { RemediationType } from 'src/lib/types';

export type CrowdSecBouncerConfiguration = {
    fallbackRemediation?: RemediationType;
} & LapiClientConfigurations;
