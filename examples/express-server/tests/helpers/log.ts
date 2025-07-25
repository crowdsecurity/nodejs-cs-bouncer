import { promises as fs } from 'fs';

export const getFileContent = async (filePath: string) => {
    try {
        return await fs.readFile(filePath, 'utf8');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return ''; // Return empty string if file doesn't exist
    }
};

export const deleteFileContent = async (filePath: string) => {
    try {
        await fs.writeFile(filePath, ''); // Clear file contents
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return false;
    }
};

export const parseJsonLogs = (logContent: string): string[] => {
    return logContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            try {
                const parsed = JSON.parse(line);
                return parsed.msg || '';
            } catch {
                // Handle pino-pretty format: [timestamp] LEVEL (pid): message
                const match = line.match(/^\[[\d:.]+\]\s+\w+\s+\(\d+\):\s+(.*)$/);
                return match ? match[1] : line;
            }
        });
};

export const getLogMessages = async (filePath: string): Promise<string> => {
    const content = await getFileContent(filePath);
    return parseJsonLogs(content).join('\n');
};
