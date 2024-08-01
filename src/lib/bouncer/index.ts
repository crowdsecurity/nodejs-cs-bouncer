import { last, sortBy } from 'lodash';

import { parseIpOrRange } from 'src/helpers/ip';
import { ORDERED_REMEDIATIONS } from 'src/lib/bouncer/libs/constants';
import { CrowdSecBouncerConfiguration } from 'src/lib/bouncer/libs/types';
import LapiClient from 'src/lib/lapi-client';
import logger from 'src/lib/logger';
import { Decision, RemediationType } from 'src/lib/types';

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
     * Found decisions for an IP address and get the highest remediation found if there is multiple decisions about it.
     * @param ip The IP address to get the remediation for.
     * @param decisions The decisions to filter.
     * @returns The highest remediation found, else the fallback remediation.
     */
    private getIpHighestRemediation = (ip: string, decisions: Decision[] | null): RemediationType => {
        if (!decisions || decisions.length === 0) {
            logger.debug('No decision found');
            return this.fallbackRemediation;
        }

        // Only get decisions related to the IP
        const relatedDecisions = decisions.filter((decision) => decision.value.toLowerCase() === ip.toLowerCase());

        if (relatedDecisions.length === 0) {
            logger.debug(`No decision found for IP ${ip}`);
            return this.fallbackRemediation;
        }

        // Get all known remediation types from decisions
        const remediationTypes: RemediationType[] = decisions.map(({ type }) => {
            // If we don't know the remediation type, we fallback to the fallback remediation.
            if (ORDERED_REMEDIATIONS.indexOf(type) === -1) {
                return this.fallbackRemediation;
            }
            return type;
        });

        // Sort remediation types by priority
        const orderedRemediationTypes = sortBy(remediationTypes, [(d) => ORDERED_REMEDIATIONS.indexOf(d)]);

        // The last remediation type is the higher priority remediation, could never be empty with previous checks
        const higherPriorityRemediation = last(orderedRemediationTypes) as RemediationType;

        logger.debug(`Higher priority remediation for IP ${ip} is ${higherPriorityRemediation}`);
        return higherPriorityRemediation;
    };

    /**
     * Get the remediation for an IP address. Ask the LAPI for the decisions matching the IP address.
     * @param ip - The IP address to get the remediation for.
     * @returns The remediation for the IP address.
     */
    public getIpRemediation = async (ip: string): Promise<RemediationType> => {
        const validatedIp = parseIpOrRange(ip);
        const decisions = await this.lapiClient.getDecisionsMatchingIp(validatedIp.startAddress().address);
        const remediation = this.getIpHighestRemediation(validatedIp.startAddress().address, decisions);

        if (remediation !== 'bypass') {
            logger.info(`Remediation for IP ${ip} is ${remediation}`);
        }

        return remediation;
    };
}

export default CrowdSecBouncer;
