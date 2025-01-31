import CrowdSecBouncer from 'src/lib/bouncer';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';

/**
 * Example usage of fetching decisions stream.
 *
 * This example demonstrates how to fetch the decision stream from the LAPI.
 * Get your LAPI running and its URL and API key from the CrowdSec dashboard.
 *
 * Don't forget to add some decisions to your CrowdSec. You can use the `cscli` CLI to do so.
 **/

const main = async () => {
    const options: CrowdSecBouncerConfigurations = {
        url: 'http://localhost:8080', // Ex: with a local docker -> $ docker run -d -p 8080:8080 --name "crowdsecurity/crowdsec" "crowdsec"
        bouncerApiToken: 'your-api-key', // Ex: $ cscli bouncer add nodejs-cs-bouncer -> API key for: nodejs-cs-bouncer
    };

    const bouncer = new CrowdSecBouncer(options);

    try {
        const decisionStream = await bouncer.refreshDecisions({
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
