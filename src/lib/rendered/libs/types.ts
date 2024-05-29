import { DEFAULT_COLORS, DEFAULT_TEXTS } from 'src/lib/rendered/libs/constants';

export type TemplateType = 'ban' | 'captcha' | 'base' | 'captcha-css';

export type StyleConfig = Partial<{
    text: Partial<(typeof DEFAULT_COLORS)['text']>;
    background: Partial<(typeof DEFAULT_COLORS)['background']>;
}>;

export type BaseOptions = {
    texts: Partial<(typeof DEFAULT_TEXTS)['ban']>;
    content: string;
    colors: StyleConfig;
    hideCrowdSecMentions: boolean;
    style: string;
};

export type BanWallOptions = {
    texts: Partial<(typeof DEFAULT_TEXTS)['ban']>;
    colors: StyleConfig;
};

export type CaptchaWallOptions = {
    texts: Partial<(typeof DEFAULT_TEXTS)['captcha']>;
    colors: StyleConfig;
    hideCrowdSecMentions: boolean;
    error: string | null;
    captchaImageTag: string;
    captchaResolutionFormUrl: string;
};
