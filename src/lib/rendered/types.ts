import { DEFAULT_COLORS, DEFAULT_TEXTS } from 'src/lib/rendered/constants';

export type TemplateType = 'ban' | 'captcha' | 'base' | 'captcha-css';

export type StyleConfig = Partial<{
    text: Partial<(typeof DEFAULT_COLORS)['text']>;
    background: Partial<(typeof DEFAULT_COLORS)['background']>;
}>;

export type BaseWallOptions = Partial<{
    texts: Partial<(typeof DEFAULT_TEXTS)['ban']>;
    content: string;
    colors: StyleConfig;
    hideCrowdSecMentions: boolean;
    style: string;
}>;

export type BanWallOptions = BaseWallOptions &
    Partial<{
        texts: Partial<(typeof DEFAULT_TEXTS)['ban']>;
        colors: StyleConfig;
    }>;

export type CaptchaWallOptions = BaseWallOptions &
    Partial<{
        texts: Partial<(typeof DEFAULT_TEXTS)['captcha']>;
        error: string;
    }> & {
        captchaImageTag: string;
        redirectUrl: string; // When the captcha is resolved, the user will be redirected to this URL
    };

export type WallsOptions = {
    ban: BanWallOptions;
    captcha: CaptchaWallOptions;
};
