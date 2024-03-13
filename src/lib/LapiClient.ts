import { Decision, DecisionOrigin, DecisionScope } from 'src/lib/types';

type LapiClientOptions = {
    lapiUrl: string;
    bouncerApiToken: string;
    userAgent?: string;
    timeout?: number;
};

class LapiClient {
    private bouncerApiToken: string;
    private lapiUrl: string;
    private userAgent: string;

    constructor(options: LapiClientOptions) {
        const isValidUrl =
            options.lapiUrl &&
            (options.lapiUrl.startsWith('http://') ||
                options.lapiUrl.startsWith('https://'));

        if (!isValidUrl) {
            throw new Error(
                '`lapiUrl` seems invalid. It should start with "http://" or "https://"',
            );
        }

        if (!options.bouncerApiToken) {
            throw new Error(
                '`bouncerApiToken` is required and must be non-empty',
            );
        }

        this.lapiUrl = options.lapiUrl;
        this.bouncerApiToken = options.bouncerApiToken;
        this.userAgent = options.userAgent ?? 'nodejs-cs-bouncer';
    }

    private callLapiGetEndpoint = async <T>(path: string): Promise<T> => {
        const response = await fetch(`${this.lapiUrl}/${path}`, {
            method: 'GET',
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
    }: {
        isFirstFetch?: boolean;
        origins?: DecisionOrigin[];
        scopes?: DecisionScope[];
        scenariosContaining?: string[];
        scenariosNotContaining?: string[];
    } = {}): Promise<{ new: Decision[]; deleted: Decision[] }> => {
        const params = new URLSearchParams({
            startup: isFirstFetch.toString(),
            ...(scopes ? { scopes: scopes.join(',') } : {}),
            ...(origins ? { origins: origins.join(',') } : {}),
            ...(scenariosContaining
                ? { scenarios_containing: scenariosContaining.join(',') }
                : {}),
            ...(scenariosNotContaining
                ? { scenarios_not_containing: scenariosNotContaining.join(',') }
                : {}),
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
    public getDecisionsMatchingIp = async (ip: string): Promise<Decision[]> => {
        const params = new URLSearchParams({ ip });
        const fullUrl = `v1/decisions?${params.toString()}`;
        return this.callLapiGetEndpoint<Decision[]>(fullUrl);
    };
}

export default LapiClient;
