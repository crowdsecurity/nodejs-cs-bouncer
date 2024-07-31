export type OkConnectionHealth = {
    status: 'OK';
    error: null;
};

export type ErrorConnectionHealth = {
    status: 'ERROR';
    error: 'INVALID_API_TOKEN' | 'SECURITY_ENGINE_SERVER_ERROR' | 'SECURITY_ENGINE_UNREACHABLE' | 'UNEXPECTED_STATUS';
};

export type ConnectionHealth = OkConnectionHealth | ErrorConnectionHealth;

export type DecisionOrigin = 'cscli' | 'crowdsec';

export type DecisionScope = 'ip' | 'range' | 'username';

export type DecisionType = 'ban' | 'captcha' | 'custom';

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
    type: DecisionType;
    /**
     * Whether the decision applies to an IP, a range of IPs or a username.
     */
    scope: DecisionScope;
    /**
     * The value of the decision scope: an IP, a range or a username.
     */
    value: string;
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
