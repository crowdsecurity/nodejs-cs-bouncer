import LapiClient from 'src/lib/lapi-client';
import { LapiClientConfigurations } from 'src/lib/lapi-client/libs/types';

/**
 * Example usage of the LAPI client.
 *
 * This example demonstrates how to fetch the decision stream from the LAPI.
 * Get your LAPI running and its URL and API key from the CrowdSec dashboard.
 *
 * Don't forget to add some decisions to your CrowdSec. You can use the `cscli` CLI to do so.
 **/

const main = async () => {
    const options: LapiClientConfigurations = {
        url: 'http://localhost:8080', // Ex: with a local docker -> $ docker run -d -p 8080:8080 --name "crowdsecurity/crowdsec" "crowdsec"
        bouncerApiToken: 'your-api-key', // Ex: $ cscli bouncer add nodejs-cs-bouncer -> API key for: nodejs-cs-bouncer
    };

    const client = new LapiClient(options);

    try {
        const decisionStream = await client.getDecisionStream({
            isFirstFetch: true,
            origins: ['crowdsec', 'cscli'],
            scopes: ['ip'],
        });

        console.log('New decisions:', decisionStream.new);
        console.log('Deleted decisions:', decisionStream.deleted);
    } catch (error) {
        console.error('Error fetching decision stream:', error);
    }
};

main();
