import CrowdSecBouncer from 'src/lib/bouncer';
import { CrowdSecBouncerConfigurations } from 'src/lib/bouncer/types';
import { BOUNCER_KEYS } from 'src/lib/constants';

/**
 * Example of basic usage of the CrowdSec Bouncer.
 *
 * This example demonstrates how to fetch the remediation for an IP address.
 *
 * Don't forget to add some decisions to your CrowdSec. You can use the `cscli` CLI to do so.
 **/

const main = async () => {
    const config: CrowdSecBouncerConfigurations = {
        url: 'http://localhost:8080', // Ex: with a local docker -> $ docker run -d -p 8080:8080 --name "crowdsecurity/crowdsec" "crowdsec"
        bouncerApiToken: 'your-api-key', // Ex: $ cscli bouncer add nodejs-cs-bouncer -> API key for: nodejs-cs-bouncer
    };

    const bouncer = new CrowdSecBouncer(config);

    try {
        const ip = '1.2.3.4'; // This IP should be in your CrowdSec decisions to get a remediation
        const remediationData = await bouncer.getIpRemediation(ip);

        console.log(`Remediation for IP ${ip} : ${remediationData[BOUNCER_KEYS.REMEDIATION]}`);
    } catch (error) {
        console.error('Error fetching remediation for IP:', error);
    }
};

main();
