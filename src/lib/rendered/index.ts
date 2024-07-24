import { template } from 'lodash';

import fs from 'fs';
import { DEFAULT_COLORS, DEFAULT_TEXTS, TEMPLATES_PATH } from 'src/lib/rendered/libs/constants';
import { BanWallOptions, BaseOptions, CaptchaWallOptions, TemplateType } from 'src/lib/rendered/libs/types';

export const generateTemplate = async (templateName: TemplateType, data: Record<string, unknown>) => {
    const templatePath = `${TEMPLATES_PATH}/${templateName}.ejs`;
    const content = await fs.promises.readFile(templatePath, 'utf8');
    const compiled = template(content, {});
    return compiled(data);
};

export const renderBanWall = async (options?: BanWallOptions) => {
    const texts = {
        ...DEFAULT_TEXTS.ban,
        ...options?.texts,
    };

    const colors = {
        text: { ...DEFAULT_COLORS.text, ...options?.colors.text },
        background: { ...DEFAULT_COLORS.background, ...options?.colors.background },
    };

    const banOption: BanWallOptions = {
        texts,
        colors,
    };

    const content = await generateTemplate('ban', banOption);

    const baseOptions: BaseOptions = {
        texts,
        colors,
        hideCrowdSecMentions: false,
        style: '',
        content,
    };

    const base = await generateTemplate('base', baseOptions);
    return base;
};

export const renderCaptchaWall = async (options?: CaptchaWallOptions) => {
    const texts = {
        ...DEFAULT_TEXTS.captcha,
        ...options?.texts,
    };

    const colors = {
        text: { ...DEFAULT_COLORS.text, ...options?.colors.text },
        background: { ...DEFAULT_COLORS.background, ...options?.colors.background },
    };

    const captchaOptions: CaptchaWallOptions = {
        texts,
        colors,
        hideCrowdSecMentions: options?.hideCrowdSecMentions ?? false,
        error: options?.error ?? null,
        captchaImageTag: options?.captchaImageTag ?? '',
        captchaResolutionFormUrl: options?.captchaResolutionFormUrl ?? '',
    };

    const content = await generateTemplate('captcha', captchaOptions);
    const style = await generateTemplate('captcha-css', { colors });

    const baseOptions: BaseOptions = {
        texts,
        colors,
        hideCrowdSecMentions: options?.hideCrowdSecMentions ?? false,
        style,
        content,
    };

    const base = await generateTemplate('base', baseOptions);
    return base;
};
