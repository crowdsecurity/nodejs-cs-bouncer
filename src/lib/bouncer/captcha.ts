/**
 * Represents the result of captcha generation
 */
export interface CaptchaObj {
    /**
     * The captcha phrase
     */
    phraseToGuess: string;

    /**
     * The image as a string, typically served as an image/svg+xml MIME type
     */
    inlineImage: string;
}

/**
 * Interface for generating captcha
 */
export interface CaptchaGenerator {
    /**
     * Method to create a captcha
     * @returns A CaptchaObj containing the text and the image
     */
    create(): CaptchaObj | Promise<CaptchaObj>;
}
