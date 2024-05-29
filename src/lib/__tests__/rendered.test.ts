import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import fs from 'fs';
import { generateTemplate, renderBanWall, renderCaptchaWall } from 'src/lib/rendered/index';
import { DEFAULT_COLORS, DEFAULT_TEXTS, TEMPLATES_PATH } from 'src/lib/rendered/libs/constants';
import { BaseOptions } from 'src/lib/rendered/libs/types';

jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
}));

const readFileSpy = jest.spyOn(fs.promises, 'readFile');

describe('📄 Generate Template', () => {
    beforeEach(() => {
        readFileSpy.mockClear();
    });

    it('should generate a base template', async () => {
        // Call the generateTemplate function
        const wall = await generateTemplate('base', {
            colors: DEFAULT_COLORS,
            content: 'Hello World',
            hideCrowdSecMentions: false,
            style: '',
            texts: DEFAULT_TEXTS,
        } as BaseOptions);

        expect(wall).toBeTruthy();

        expect(readFileSpy).toHaveBeenCalled();

        // Assert that the readRawFile function was called with the correct arguments
        expect(readFileSpy).toHaveBeenCalledWith(`${TEMPLATES_PATH}/base.ejs`, 'utf8');

        // Assert that the generated template matches the snapshot
        expect(wall).toMatchSnapshot();
    });

    it('should generate a ban template', async () => {
        // Call the generateTemplate function
        const wall = await renderBanWall();

        expect(wall).toBeTruthy();

        expect(readFileSpy).toHaveBeenCalled();

        // Assert that the readRawFile function was called with the correct arguments
        expect(readFileSpy).toHaveBeenNthCalledWith(1, `${TEMPLATES_PATH}/ban.ejs`, 'utf8');
        expect(readFileSpy).toHaveBeenNthCalledWith(2, `${TEMPLATES_PATH}/base.ejs`, 'utf8');

        // Assert that the generated template matches the snapshot
        expect(wall).toMatchSnapshot();
    });

    it('should generate a captcha template', async () => {
        // Call the generateTemplate function
        const wall = await renderCaptchaWall();

        expect(wall).toBeTruthy();

        expect(readFileSpy).toHaveBeenCalled();

        // Assert that the readRawFile function was called with the correct arguments
        expect(readFileSpy).toHaveBeenNthCalledWith(1, `${TEMPLATES_PATH}/captcha.ejs`, 'utf8');
        expect(readFileSpy).toHaveBeenNthCalledWith(2, `${TEMPLATES_PATH}/captcha-css.ejs`, 'utf8');
        expect(readFileSpy).toHaveBeenNthCalledWith(3, `${TEMPLATES_PATH}/base.ejs`, 'utf8');

        // Assert that the generated template matches the snapshot
        expect(wall).toMatchSnapshot();
    });
});
