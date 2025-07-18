import { ID_SEPARATOR } from './constants';

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
 * Origin is a single value from the default CrowdSec decision origins (crowdsec, cscli, CAPI, lists, etc.) or any custom value.
 */
export type Origin = string;
/**
 * Cacheable origin: a string that uniquely identifies the origin of a decision in the cache
 * (crowdsec, cscli, capi, lists:XXX where XXX comes from the scenario, etc.).
 */
export type CachableOrigin = string;
/**
 * Scope is a single value from the default CrowdSec decision scopes (ip, range, username, country, etc.) or any custom value.
 */
export type Scope = string;
/**
 * Value is a single value from the default CrowdSec decision values (an IP, a range of IPs, a username, a country, etc.) or any custom value.
 */
export type Value = string;
/**
 * The duration of the decision in a string format.
 * A duration string is a possibly signed sequence of decimal numbers, each with optional fraction and a unit suffix,
 * such as "300ms", "-1.5h" or "2h45m". Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".
 */
export type Duration = string;
/**
 * Scenario is a string representing a scenario.
 */
export type Scenario = string;
/**
 * Remediation is a single value from the default CrowdSec remediation types (ban, captcha, bypass, etc.) or any custom value.
 */
export type Remediation = string;
/**
 * A cachable decision identifier is a string that uniquely identifies a decision in the cache.
 */
export type CachableIdentifier =
    `${Origin}${typeof ID_SEPARATOR}${Remediation}${typeof ID_SEPARATOR}${Scope}${typeof ID_SEPARATOR}${Value}`;

/**
 * Unix timestamp in milliseconds
 */
export type CachableExpiresAt = number;

export type Decision = {
    origin: Origin;
    type: Remediation;
    scope: Scope;
    value: Value;
    duration: Duration;
    scenario: Scenario;
};

export type CachableDecision = {
    identifier: CachableIdentifier;
    origin: CachableOrigin;
    scope: Scope;
    value: Value;
    type: Remediation;
    expiresAt: CachableExpiresAt;
};
