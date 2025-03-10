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
