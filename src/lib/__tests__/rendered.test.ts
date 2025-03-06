import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import fs from 'fs';
import { generateTemplate, renderBanWall, renderCaptchaWall } from 'src/lib/rendered';
import { DEFAULT_COLORS, DEFAULT_TEXTS, TEMPLATES_PATH } from 'src/lib/rendered/constants';
import { BaseWallOptions } from 'src/lib/rendered/types';

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
        } as BaseWallOptions);

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

    it('should be able to customize ban template', async () => {
        const title = 'Custom Title';
        const subtitle = 'Custom Subtitle';

        // Call the generateTemplate function
        const wall = await renderBanWall({
            colors: {
                text: {
                    primary: '#000000',
                    secondary: '#FFFFFF',
                },
                background: {
                    page: '#FFFFFF',
                    container: '#000000',
                },
            },
            texts: {
                title: title,
                subtitle: subtitle,
            },
        });

        expect(wall).toBeTruthy();

        // Check if the custom title and subtitle are present in the generated template
        expect(wall).toContain(title);
        expect(wall).toContain(subtitle);

        // Assert that the generated template matches the snapshot
        expect(wall).toMatchSnapshot();
    });

    it('should be able to customize captcha template', async () => {
        const title = 'Custom Title';
        const subtitle = 'Custom Subtitle';

        const captchaImageTag = '<img src="captcha.png" />';

        // Call the generateTemplate function
        const wall = await renderCaptchaWall({
            colors: {
                text: {
                    primary: '#000000',
                    secondary: '#FFFFFF',
                },
                background: {
                    page: '#FFFFFF',
                    container: '#000000',
                },
            },
            texts: {
                title: title,
                subtitle: subtitle,
            },
            captchaImageTag: captchaImageTag,
        });

        expect(wall).toBeTruthy();

        // Check if the custom title and subtitle are present in the generated template
        expect(wall).toContain(title);
        expect(wall).toContain(subtitle);
        expect(wall).toContain(captchaImageTag);

        // Assert that the generated template matches the snapshot
        expect(wall).toMatchSnapshot();
    });

    it('should display by default CrowdSec mention "Powered by CrowdSec" by default', async () => {
        // Call the generateTemplate function
        const banWall = await renderBanWall();
        const captchaWall = await renderCaptchaWall();

        expect(banWall).toBeTruthy();
        expect(captchaWall).toBeTruthy();

        // Check if the CrowdSec mentions are displayed
        expect(banWall).toContain('Powered by');
        expect(captchaWall).toContain('Powered by');

        // Assert that the generated template matches the snapshot
        expect(banWall).toMatchSnapshot();
        expect(captchaWall).toMatchSnapshot();
    });

    it('should be able to hide CrowdSec mention "Powered by CrowdSec"', async () => {
        // Call the generateTemplate function
        const banWall = await renderBanWall({
            hideCrowdSecMentions: true,
        });
        const captchaWall = await renderCaptchaWall({
            hideCrowdSecMentions: true,
            captchaImageTag: '<img src="captcha.png" />',
        });

        expect(banWall).toBeTruthy();
        expect(captchaWall).toBeTruthy();

        // Check if the CrowdSec mentions are hidden
        expect(banWall).not.toContain('Powered by');
        expect(captchaWall).not.toContain('Powered by');

        // Assert that the generated template matches the snapshot
        expect(banWall).toMatchSnapshot();
        expect(captchaWall).toMatchSnapshot();
    });

    it('should be able to display error message on captcha template', async () => {
        const error = 'Custom Error Message';

        // Call the generateTemplate function
        const wall = await renderCaptchaWall({
            captchaImageTag: '<img src="captcha.png" />',
            texts: {
                error: error,
            },
        });

        expect(wall).toBeTruthy();

        // Check if the error message is displayed
        expect(wall).toContain(error);

        // Assert that the generated template matches the snapshot
        expect(wall).toMatchSnapshot();
    });
});
