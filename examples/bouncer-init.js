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
const bouncer_1 = __importDefault(require("src/lib/bouncer"));
/**
 * Example of basic usage of the CrowdSec Bouncer.
 *
 * This example demonstrates how to fetch the remediation for an IP address.
 *
 * Don't forget to add some decisions to your CrowdSec. You can use the `cscli` CLI to do so.
 **/
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const config = {
        url: 'http://localhost:8080', // Ex: with a local docker -> $ docker run -d -p 8080:8080 --name "crowdsecurity/crowdsec" "crowdsec"
        bouncerApiToken: 'your-api-key', // Ex: $ cscli bouncer add nodejs-cs-bouncer -> API key for: nodejs-cs-bouncer
    };
    const bouncer = new bouncer_1.default(config);
    try {
        const ip = '1.2.3.4'; // This IP should be in your CrowdSec decisions to get a remediation
        const remediation = yield bouncer.getIpRemediation(ip);
        console.log(`Remediation for IP ${ip} : ${remediation}`);
    }
    catch (error) {
        console.error('Error fetching remediation for IP:', error);
    }
});
main();
