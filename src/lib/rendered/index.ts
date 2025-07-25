import lodash from 'lodash';

import { DEFAULT_COLORS, DEFAULT_TEXTS, RENDERED_TEMPLATES } from './constants';
import { BanWallOptions, BaseWallOptions, CaptchaWallOptions, TemplateType } from './types';

const { template: compileTemplate } = lodash;

export const generateTemplate = async (templateName: TemplateType, data: Record<string, unknown>): Promise<string> => {
    const src = RENDERED_TEMPLATES[templateName];
    if (!src) throw new Error(`Unknown template: ${templateName}`);
    return compileTemplate(src)(data);
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
        captchaImageTag: options?.captchaImageTag ?? '',
        captchaAction: options?.captchaAction,
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
