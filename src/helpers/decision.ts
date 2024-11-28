import { getConfig } from 'src/helpers/config';
import { convertDurationToMilliseconds } from 'src/helpers/duration';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/libs/types';
import { ID_SEPARATOR, REMEDIATION_BYPASS, CACHE_EXPIRATION_FOR_BAD_IP } from 'src/lib/constants';
import logger from 'src/lib/logger';
import {
    CachableDecision,
    Decision,
    CachableDecisionIdentifier,
    DecisionOrigin,
    RemediationType,
    DecisionScope,
    DecisionValue,
    CachableDecisionExpiresAt,
} from 'src/lib/types';

const validateRawDecision = (rawDecision: Decision): boolean => {
    return !!rawDecision.scope && !!rawDecision.value && !!rawDecision.duration && !!rawDecision.type && !!rawDecision.origin;
};

const buildCachableDecisionIdentifier = ({
    origin,
    type,
    scope,
    value,
}: {
    origin: DecisionOrigin;
    type: RemediationType;
    scope: DecisionScope;
    value: DecisionValue;
}): CachableDecisionIdentifier => {
    return `${origin}${ID_SEPARATOR}${type}${ID_SEPARATOR}${scope}${ID_SEPARATOR}${value}`;
};

const buildDecisionExpiresAt = ({
    type,
    duration,
    configs,
}: {
    type: RemediationType;
    duration: string;
    configs: CrowdSecBouncerConfigurations;
}): CachableDecisionExpiresAt => {
    let durationInSeconds = convertDurationToMilliseconds(duration);
    if (REMEDIATION_BYPASS !== type && getConfig('streamMode', configs)) {
        durationInSeconds = Math.min(durationInSeconds, getConfig('badIpCacheDuration', configs) ?? CACHE_EXPIRATION_FOR_BAD_IP);
    }

    return Date.now() + durationInSeconds;
};

export const buildCachableDecision = ({
    type,
    scope,
    value,
    origin,
    expiresAt,
}: {
    type: RemediationType;
    scope: DecisionScope;
    value: DecisionValue;
    origin: DecisionOrigin;
    expiresAt: CachableDecisionExpiresAt;
}): CachableDecision => {
    return {
        identifier: buildCachableDecisionIdentifier({ origin, type, scope, value }),
        origin,
        scope,
        value,
        type,
        expiresAt,
    };
};

const convertRawDecisionToCachableDecision = (rawDecision: Decision, configs: CrowdSecBouncerConfigurations): CachableDecision | null => {
    if (!validateRawDecision(rawDecision)) {
        logger.error('Invalid decision received', rawDecision);
        return null;
    }
    // @TODO: clean all of the lowercase/uppercase mess: CAPI, Ip, etc.
    const type = rawDecision.type.toLowerCase() as RemediationType;
    const scope = rawDecision.scope.toLowerCase() as DecisionScope;
    const value = rawDecision.value.toLowerCase() as DecisionValue;
    const origin = rawDecision.origin.toLowerCase() as DecisionOrigin;
    const expiresAt = buildDecisionExpiresAt({ type, duration: rawDecision.duration, configs });

    return buildCachableDecision({ type, scope, value, origin, expiresAt });
};

export const convertRawDecisionsToDecisions = (rawDecisions: Decision[], configs: CrowdSecBouncerConfigurations): CachableDecision[] => {
    // Loop on all decisions and convert them to cachable decisions
    return rawDecisions.reduce((cachableDecisions: CachableDecision[], rawDecision: Decision) => {
        try {
            const cachableDecision = convertRawDecisionToCachableDecision(rawDecision, configs);
            if (cachableDecision) {
                cachableDecisions.push(cachableDecision);
            }
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Error converting raw decision to cachable decision: ${error.message}`);
            } else {
                logger.error('An unexpected error occurred');
            }
        }

        return cachableDecisions;
    }, []);
};
