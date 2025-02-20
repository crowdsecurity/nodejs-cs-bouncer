import { convertDurationToMilliseconds } from 'src/helpers/duration';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import { ID_SEPARATOR, REMEDIATION_BYPASS, CACHE_EXPIRATION_FOR_BAD_IP, ORIGIN_LISTS, ORIGIN_LISTS_SEPARATOR } from 'src/lib/constants';
import logger from 'src/lib/logger';
import {
    CachableDecision,
    Decision,
    CachableIdentifier,
    Origin,
    Remediation,
    Scope,
    Value,
    CachableExpiresAt,
    Duration,
    Scenario,
    CachableOrigin,
} from 'src/lib/types';

const validateRawDecision = (rawDecision: Decision): boolean => {
    if (rawDecision.origin === ORIGIN_LISTS && !rawDecision.scenario) {
        return false;
    }
    return (
        Boolean(rawDecision.scope) &&
        Boolean(rawDecision.value) &&
        Boolean(rawDecision.duration) &&
        Boolean(rawDecision.type) &&
        Boolean(rawDecision.origin)
    );
};

const buildCachableIdentifier = ({
    origin,
    type,
    scope,
    value,
}: {
    origin: CachableOrigin;
    type: Remediation;
    scope: Scope;
    value: Value;
}): CachableIdentifier => {
    return `${origin}${ID_SEPARATOR}${type}${ID_SEPARATOR}${scope}${ID_SEPARATOR}${value}`;
};

const buildDecisionExpiresAt = ({
    type,
    duration,
    configs,
}: {
    type: Remediation;
    duration: Duration;
    configs: CrowdSecBouncerConfigurations;
}): CachableExpiresAt => {
    let durationInMilliseconds = convertDurationToMilliseconds(duration);
    // In Stream Mode, lifetime for a bad ip depends only on decision duration
    // In Live Mode, we keep the minimum value between decision duration and badIpCacheDuration configuration
    if (REMEDIATION_BYPASS !== type && !configs.streamMode) {
        durationInMilliseconds = Math.min(durationInMilliseconds, (configs.badIpCacheDuration ?? CACHE_EXPIRATION_FOR_BAD_IP) * 1000);
    }

    return Date.now() + durationInMilliseconds;
};

const buildDecisionOrigin = (origin: Origin, scenario: Scenario): CachableOrigin => {
    const result = origin === ORIGIN_LISTS ? `${origin}${ORIGIN_LISTS_SEPARATOR}${scenario}` : origin;
    return result.toLowerCase();
};

export const buildCachableDecision = ({
    type,
    scope,
    value,
    origin,
    expiresAt,
}: {
    type: Remediation;
    scope: Scope;
    value: Value;
    origin: CachableOrigin;
    expiresAt: CachableExpiresAt;
}): CachableDecision => {
    return {
        identifier: buildCachableIdentifier({ origin, type, scope, value }),
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
    const type = rawDecision.type.toLowerCase();
    const scope = rawDecision.scope.toLowerCase();
    const value = rawDecision.value.toLowerCase();
    const origin = buildDecisionOrigin(rawDecision.origin, rawDecision.scenario);
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
            logger.error(`Error converting raw decision to cachable decision: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return cachableDecisions;
    }, []);
};
