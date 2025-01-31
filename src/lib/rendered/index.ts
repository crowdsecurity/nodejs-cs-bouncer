import { template } from 'lodash';

import fs from 'fs';
import { DEFAULT_COLORS, DEFAULT_TEXTS, TEMPLATES_PATH } from 'src/lib/rendered/constants';
import { BanWallOptions, BaseWallOptions, CaptchaWallOptions, TemplateType } from 'src/lib/rendered/types';

export const generateTemplate = async (templateName: TemplateType, data: Record<string, unknown>): Promise<string> => {
    const templatePath = `${TEMPLATES_PATH}/${templateName}.ejs`;
    const content = await fs.promises.readFile(templatePath, 'utf8');
    const compiled = template(content);
    return compiled(data);
};

export const renderBanWall = async (options?: BanWallOptions): Promise<string> => {
    const texts = {
        ...DEFAULT_TEXTS.ban,
        ...options?.texts,
    };

    const colors = {
        text: { ...DEFAULT_COLORS.text, ...options?.colors?.text },
        background: { ...DEFAULT_COLORS.background, ...options?.colors?.background },
    };

    const banOption: BanWallOptions = {
        texts,
        colors,
    };

    const content = await generateTemplate('ban', banOption);

    const baseOptions: BaseWallOptions = {
        texts,
        colors,
        hideCrowdSecMentions: options?.hideCrowdSecMentions ?? false,
        style: '',
        content,
    };

    return generateTemplate('base', baseOptions);
};

export const renderCaptchaWall = async (options?: CaptchaWallOptions): Promise<string> => {
    const texts = {
        ...DEFAULT_TEXTS.captcha,
        ...options?.texts,
    };

    const colors = {
        text: { ...DEFAULT_COLORS.text, ...options?.colors?.text },
        background: { ...DEFAULT_COLORS.background, ...options?.colors?.background },
    };

    const captchaOptions: CaptchaWallOptions = {
        texts,
        colors,
        error: options?.error ?? undefined,
        captchaImageTag: options?.captchaImageTag ?? '',
        redirectUrl: options?.redirectUrl ?? '',
    };

    const content = await generateTemplate('captcha', captchaOptions);
    const style = await generateTemplate('captcha-css', { colors });

    const baseOptions: BaseWallOptions = {
        texts,
        colors,
        hideCrowdSecMentions: options?.hideCrowdSecMentions ?? false,
        style,
        content,
    };

    return await generateTemplate('base', baseOptions);
};
