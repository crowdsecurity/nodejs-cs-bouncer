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
const lapi_client_1 = __importDefault(require("src/lib/lapi-client"));
/**
 * Example usage of the LAPI client.
 *
 * This example demonstrates how to fetch the decision stream from the LAPI.
 * Get your LAPI running and its URL and API key from the CrowdSec dashboard.
 *
 * Don't forget to add some decisions to your CrowdSec. You can use the `cscli` CLI to do so.
 **/
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const options = {
        url: 'http://localhost:8080', // Ex: with a local docker -> $ docker run -d -p 8080:8080 --name "crowdsecurity/crowdsec" "crowdsec"
        bouncerApiToken: 'your-api-key', // Ex: $ cscli bouncer add nodejs-cs-bouncer -> API key for: nodejs-cs-bouncer
    };
    const client = new lapi_client_1.default(options);
    try {
        const decisionStream = yield client.getDecisionStream({
            isFirstFetch: true,
            origins: ['crowdsec', 'cscli'],
            scopes: ['ip'],
        });
        console.log('New decisions:', decisionStream.new);
        console.log('Deleted decisions:', decisionStream.deleted);
    }
    catch (error) {
        console.error('Error fetching decision stream:', error);
    }
});
main();
