import { create } from 'svg-captcha-fixed';

import fs from 'fs';
import { renderBanWall, renderCaptchaWall } from 'src/lib/rendered';
import { BaseWallOptions } from 'src/lib/rendered/libs/types';

/*
 * Example usage of render methods
 *
 * This example demonstrates how to use the render methods to get the ban wall and captcha wall HTML.
 *
 */

const wallOptions: BaseWallOptions = {
    texts: {
        title: '⚠️ You have been banned ⚠️',
        subtitle: 'You have been banned from accessing this website.',
    },
};

const main = async () => {
    const captcha = create();

    const banWall = await renderBanWall(wallOptions);
    const captchaWall = await renderCaptchaWall({
        ...wallOptions,
        captchaImageTag: captcha.data,
        redirectUrl: '/redirect',
    });

    fs.writeFileSync('ban.html', banWall);
    fs.writeFileSync('captcha.html', captchaWall);

    console.log('Ban wall and captcha wall have been written to ban.html and captcha.html');
};

main();
