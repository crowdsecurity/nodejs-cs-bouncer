![CrowdSec Logo](https://raw.githubusercontent.com/crowdsecurity/nodejs-cs-bouncer/main/docs/images/logo_crowdsec.png)

# CrowdSec Node.js bouncer

> The official Node.js bouncer package for the CrowdSec LAPI

![Version](https://img.shields.io/github/v/release/crowdsecurity/nodejs-cs-bouncer?include_prereleases)
![Licence](https://img.shields.io/github/license/crowdsecurity/nodejs-cs-bouncer)

## Overview

This bouncer allows you to protect your Node.js application from IPs that have been detected by CrowdSec. Depending on
the decision taken by CrowdSec, user will either get denied (403) or have to fill a captcha (401).

It supports "ban" and "captcha" remediation, and all decisions of type Ip or Range or Country.

## Usage

See [User Guide](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/docs/USER_GUIDE.md)

## Installation

See [Installation Guide](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/docs/INSTALLATION_GUIDE.md)

## Developer guide

See [Developer guide](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/docs/DEVELOPER.md)

## License

[MIT](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/LICENSE)
