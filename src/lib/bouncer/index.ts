import { parseIpOrRange } from 'src/helpers/ip';
import { CrowdSecBouncerConfiguration } from 'src/lib/bouncer/libs/types';
import LapiClient from 'src/lib/lapi-client';
import logger from 'src/lib/logger';
import { RemediationType } from 'src/lib/types';

class CrowdSecBouncer {
    private lapiClient: LapiClient;

    public fallbackRemediation: RemediationType = 'bypass';

    constructor(private config: CrowdSecBouncerConfiguration) {
        logger.debug('Bouncer initialized.');

        if (config.fallbackRemediation) {
            this.fallbackRemediation = config.fallbackRemediation;
        }

        this.lapiClient = new LapiClient(config);
    }

    /**
     * Get the remediation for an IP address. Ask the LAPI for the decisions matching the IP address.
     * @param ip - The IP address to get the remediation for.
     * @returns The remediation for the IP address.
     */
    public getIpRemediation = async (ip: string): Promise<RemediationType> => {
        const validatedIp = parseIpOrRange(ip);
        const decisions = await this.lapiClient.getDecisionsMatchingIp(validatedIp.startAddress().address);

        if (!decisions) {
            return this.fallbackRemediation;
        }

        const ipDecision = decisions.find((decision) => decision.value === ip);

        if (!ipDecision) {
            return this.fallbackRemediation;
        }

        logger.debug(`Remediation for IP ${ip}: ${ipDecision.type}`);

        return ipDecision.type;
    };
}

export default CrowdSecBouncer;
