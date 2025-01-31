// We use this snippet to simulate the nodejs-bouncer package with the dist folder
import { addAlias } from 'module-alias';

import path from 'path';
// Simulate nodejs-bouncer package with the dist folder
addAlias('@crowdsec/nodejs-bouncer', path.resolve(__dirname, '../../dist'));

export {};
