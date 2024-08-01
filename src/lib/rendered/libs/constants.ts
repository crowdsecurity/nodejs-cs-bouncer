export const DEFAULT_COLORS = {
    text: {
        primary: '#F9FAFA',
        secondary: '#B0B5BF',
        button: 'F9FAFA',
        error_message: '#F55B60',
    },
    background: {
        page: '#04041F',
        container: '#162131',
        button: '#888BCE',
    },
};

export const DEFAULT_TEXTS = {
    ban: {
        tabTitle: 'CrowdSec | Ban Wall',
        title: 'Access Denied',
        subtitle: 'This page is secured against cyber attacks, and your IP has been blocked by our system',
        footer: '',
    },
    captcha: {
        tabTitle: 'CrowdSec | Captcha Wall',
        title: 'Access Denied',
        subtitle: 'Please complete the security check.',
        refresh_image_link: 'Reload the image',
        captcha_placeholder: 'Type here...',
        send_button: 'Continue',
        error: 'Please try again.',
        footer: '',
    },
};

export const TEMPLATES_PATH = `${process.cwd()}/src/lib/rendered/templates`;
