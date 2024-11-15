"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const svg_captcha_1 = require("svg-captcha");
const fs_1 = __importDefault(require("fs"));
const rendered_1 = require("src/lib/rendered");
/*
 * Example usage of render methods
 *
 * This example demonstrates how to use the render methods to get the ban wall and captcha wall HTML.
 *
 */
const wallOptions = {
    texts: {
        title: '⚠️ You have been banned ⚠️',
        subtitle: 'You have been banned from accessing this website.',
    },
};
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const captcha = (0, svg_captcha_1.create)();
    const banWall = yield (0, rendered_1.renderBanWall)(wallOptions);
    const captchaWall = yield (0, rendered_1.renderCaptchaWall)(Object.assign(Object.assign({}, wallOptions), { captchaImageTag: captcha.data, redirectUrl: '/redirect' }));
    fs_1.default.writeFileSync('ban.html', banWall);
    fs_1.default.writeFileSync('captcha.html', captchaWall);
    console.log('Ban wall and captcha wall have been written to ban.html and captcha.html');
});
main();
