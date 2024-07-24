export const DEFAULT_COLORS = {
    text: {
        primary: 'black',
        secondary: '#AAA',
        button: 'white',
        error_message: '#b90000',
    },
    background: {
        page: '#eee',
        container: 'white',
        button: '#626365',
        button_hover: '#333',
    },
};

export const DEFAULT_TEXTS = {
    ban: {
        tabTitle: 'Oops..',
        title: '🤭 Oh!',
        subtitle: 'This page is protected against cyber attacks and your IP has been banned by our system.',
        footer: '',
    },
    captcha: {
        tabTitle: 'Oops..',
        title: 'Hmm, sorry but...',
        subtitle: 'Please complete the security check.',
        refresh_image_link: 'refresh image',
        captcha_placeholder: 'Type here...',
        send_button: 'CONTINUE',
        error_message: 'Please try again.',
        footer: '',
    },
};

export const TEMPLATES_PATH = `${process.cwd()}/src/lib/rendered/templates`;
