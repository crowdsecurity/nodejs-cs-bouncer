import { ID_SEPARATOR } from 'src/lib/constants';

export type OkConnectionHealth = {
    status: 'OK';
    error: null;
};

export type ErrorConnectionHealth = {
    status: 'ERROR';
    error: 'INVALID_API_TOKEN' | 'SECURITY_ENGINE_SERVER_ERROR' | 'SECURITY_ENGINE_UNREACHABLE' | 'UNEXPECTED_STATUS';
};

export type ConnectionHealth = OkConnectionHealth | ErrorConnectionHealth;

/**
 * DecisionOrigin is a single value from the default CrowdSec decision origins (crowdsec, cscli, CAPI, lists:XXX, etc.) or any custom value.
 */
export type DecisionOrigin = string;
/**
 * DecisionScope is a single value from the default CrowdSec decision scopes (ip, range, username, country, etc.) or any custom value.
 */
export type DecisionScope = string;
/**
 * DecisionValue is a single value from the default CrowdSec decision values (an IP, a range of IPs, a username, a country, etc.) or any custom value.
 */
export type DecisionValue = string;
/**
 * RemediationType is a single value from the default CrowdSec remediation types (ban, captcha, bypass, etc.) or any custom value.
 */
export type RemediationType = string;

export type CachableDecisionIdentifier =
    `${DecisionOrigin}${typeof ID_SEPARATOR}${RemediationType}${typeof ID_SEPARATOR}${DecisionScope}${typeof ID_SEPARATOR}${DecisionValue}`;

export type CachableDecisionExpiresAt = number;

export type Decision = {
    /**
     * The external unique identifier of the decision. It should be used in GET requests.
     */
    id: number;
    /**
     * Whether the decision was done via the CLI or by the CrowdSec agent forwarding instructions from the web console.
     */
    origin: DecisionOrigin;
    /**
     * The remediation to apply to the IP.
     */
    type: RemediationType;
    /**
     * Whether the decision applies to an IP, a range of IPs, a username or a country.
     */
    scope: DecisionScope;
    /**
     * The value of the decision scope: an IP, a range, a username or a country.
     */
    value: DecisionValue;
    /**
     * The duration of the decision in a string format.
     *
     * Examples:
     * - "1h" for 1 hour
     * - "3m" for 3 minutes
     * - "45s" for 45 seconds
     */
    duration: string;
    /**
     * The date until the decision must be active.
     */
    until: string;
    /**
     * Whether the decision results from a scenario in simulation mode.
     */
    simulated: boolean;
};

export type CachableDecision = {
    identifier: CachableDecisionIdentifier;
    origin: DecisionOrigin;
    scope: DecisionScope;
    value: DecisionValue;
    type: RemediationType;
    expiresAt: CachableDecisionExpiresAt; // Unix timestamp in milliseconds
};
