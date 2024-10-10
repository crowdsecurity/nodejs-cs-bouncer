import { GetDecisionsOptions, LapiClientConfigurations } from 'src/lib/lapi-client/libs/types';
import logger from 'src/lib/logger';
import { ConnectionHealth, Decision } from 'src/lib/types';

class LapiClient {
    private readonly bouncerApiToken: string;
    private readonly lapiUrl: string;
    private readonly userAgent: string;

    constructor(options: LapiClientConfigurations) {
        const isValidUrl = options.url && (options.url.startsWith('http://') || options.url.startsWith('https://'));

        if (!isValidUrl) {
            throw new Error('`lapiUrl` seems invalid. It should start with "http://" or "https://"');
        }

        if (!options.bouncerApiToken) {
            throw new Error('`bouncerApiToken` is required and must be non-empty');
        }

        this.lapiUrl = options.url;
        this.bouncerApiToken = options.bouncerApiToken;
        this.userAgent = options.userAgent ?? 'nodejs-cs-bouncer';

        this.initializeConnectionHealth();
    }

    private initializeConnectionHealth(): void {
        this.checkConnectionHealth().then((response) => {
            if (response.status === 'ERROR') {
                logger.error(`Connection with LAPI is unhealthy: ${response.error}`);
            } else {
                logger.info('Connection with LAPI is healthy');
            }
        });
    }

    private readonly callLapiGetEndpoint = async <T>(path: string, method: 'GET' | 'OPTIONS' = 'GET'): Promise<T> => {
        const response = await fetch(`${this.lapiUrl}/${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': this.bouncerApiToken,
                'User-Agent': this.userAgent,
            },
        });

        if (!response.ok) {
            throw new Error(`Call to ${path} failed`);
        }

        return response.json() as T;
    };

    /**
     * Retrieves a stream of decisions from the API.
     * @param isFirstFetch - Indicates if it's the first fetch. If it is the first fetch, the LAPI will return the full list of decisions. If it's not, it will return only the changes
     * that occurred since the last fetch (done by the same bouncer API token).
     * @param origins - Filter decisions by their origin.
     * @param scopes - Filter decisions by their scope.
     * @param scenariosContaining - Filter decisions and returns **only** the ones associated with scenarios containing words passed in this argument.
     * @param scenariosNotContaining - Filter decisions and returns **none** of the one associated with scenarios containing words passed in this argument.
     */
    public getDecisionStream = async ({
        isFirstFetch = false,
        origins,
        scopes,
        scenariosContaining,
        scenariosNotContaining,
    }: GetDecisionsOptions = {}): Promise<{ new: Decision[]; deleted: Decision[] }> => {
        const params = new URLSearchParams({
            startup: isFirstFetch.toString(),
            ...(scopes ? { scopes: scopes.join(',') } : {}),
            ...(origins ? { origins: origins.join(',') } : {}),
            ...(scenariosContaining ? { scenarios_containing: scenariosContaining.join(',') } : {}),
            ...(scenariosNotContaining ? { scenarios_not_containing: scenariosNotContaining.join(',') } : {}),
        });

        const fullUrl = `v1/decisions/stream?${params.toString()}`;

        return this.callLapiGetEndpoint<{
            new: Decision[];
            deleted: Decision[];
        }>(fullUrl);
    };

    /**
     * Retrieves decisions that match the given IP address.
     * @param ip - The IP address to match against the decisions.
     */
    public getDecisionsMatchingIp = async (ip: string): Promise<Decision[] | null> => {
        const params = new URLSearchParams({ ip });
        const fullUrl = `v1/decisions?${params.toString()}`;
        return this.callLapiGetEndpoint<Decision[]>(fullUrl);
    };

    // Check the health of the connection with the LAPI
    public checkConnectionHealth = async (): Promise<ConnectionHealth> => {
        try {
            const response = await fetch(`${this.lapiUrl}/v1/decisions`, {
                method: 'HEAD',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.bouncerApiToken,
                    'User-Agent': this.userAgent,
                },
            });

            if (!response.ok) {
                if (response.status === 403) {
                    return {
                        status: 'ERROR',
                        error: 'INVALID_API_TOKEN',
                    };
                }

                if (response.status >= 500) {
                    return {
                        status: 'ERROR',
                        error: 'SECURITY_ENGINE_SERVER_ERROR',
                    };
                }

                // Should we log something here?
                return {
                    status: 'ERROR',
                    error: 'UNEXPECTED_STATUS',
                };
            }

            return {
                status: 'OK',
                error: null,
            };
        } catch {
            return {
                status: 'ERROR',
                error: 'SECURITY_ENGINE_UNREACHABLE',
            };
        }
    };
}

export default LapiClient;
