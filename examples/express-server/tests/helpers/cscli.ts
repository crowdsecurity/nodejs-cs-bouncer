import { spawnSync, SpawnSyncReturns } from 'child_process';

type AddIPDecisionParams = {
    ip: string;
    type: string;
    duration: number;
};

export const addIpDecision = async (params: AddIPDecisionParams): Promise<SpawnSyncReturns<string>> => {
    const { ip, type, duration } = params;
    const command = [
        'exec',
        '-i',
        'nodejs-cs-crowdsec',
        'sh',
        '-c',
        `cscli decisions add --ip ${ip} --duration ${duration}s --type ${type}`,
    ];
    return spawnSync('docker', command, { encoding: 'utf-8' });
};

export const removeIpDecision = async (ip: string): Promise<SpawnSyncReturns<string>> => {
    const command = ['exec', '-i', 'nodejs-cs-crowdsec', 'sh', '-c', `cscli decisions delete --ip ${ip}`];
    return spawnSync('docker', command, { encoding: 'utf-8' });
};
