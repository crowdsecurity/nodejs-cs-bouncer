import path from 'path';
import fs from 'fs';

export const getBouncedIp = (): string => {
    const bouncedIp = process.env.BOUNCED_IP ?? '';
    if (bouncedIp !== '') {
        return bouncedIp;
    }
    throw new Error('BOUNCER_IP env is not defined.');
};

export const getEndToEndTestConfig = (testName: string): JSON => {
    console.log('Running End to End test:', testName);
    try {
        const configFilePath = path.resolve(__dirname, `../configs/${testName}.json`); // Adjust the path as needed
        const fileContents = fs.readFileSync(configFilePath, 'utf-8');
        return JSON.parse(fileContents);
    } catch (error) {
        console.error('Failed to load config from file');
        process.exit(1); // Exit if config file is required and cannot be loaded
    }
};
