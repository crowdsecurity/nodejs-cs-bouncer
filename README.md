<p align="center">
  <img src="https://raw.githubusercontent.com/crowdsecurity/nodejs-cs-bouncer/main/docs/assets/app-sec.webp" width="200px" align="center" alt="Crowdsec Bouncer logo" />
  <h1 align="center">CrowdSec Node.js Bouncer</h1>
  <p align="center">
    ✨ <a href="https://www.crowdsec.net/">CrowdSec</a> ✨
  </p>
</p>
<p align="center">
    <a href="https://github.com/crowdsecurity/nodejs-cs-bouncer/releases">
      <img src="https://img.shields.io/github/v/release/crowdsecurity/nodejs-cs-bouncer" alt="Crowdsec JS Bouncer Version" />
    </a>
    <a href="https://opensource.org/licenses/MIT">
      <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="Crowdsec JS Bouncer License" />
    </a>
    <a href="https://github.com/crowdsecurity/nodejs-cs-bouncer/actions/workflows/end-to-end.yml">
      <img src="https://github.com/crowdsecurity/nodejs-cs-bouncer/actions/workflows/end-to-end.yml/badge.svg" alt="Crowdsec JS Bouncer E2E" />
    </a>
    <a href="https://codecov.io/github/crowdsecurity/nodejs-cs-bouncer">
      <img src="https://codecov.io/github/crowdsecurity/nodejs-cs-bouncer/branch/main/graph/badge.svg?token=BQA733CC26" alt="Crowdsec JS Bouncer Codecov" />
    </a>
    <a href="https://discord.gg/wGN7ShmEE8">
      <img src="https://img.shields.io/discord/463752820026376202.svg?logo=discord&logoColor=fff&label=Discord&color=7389d8" alt="Discord conversation" />
    </a>
</p>

<div align="center">
  <a href="https://docs.crowdsec.net/">Documentation</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://app.crowdsec.net/hub">Hub</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://www.npmjs.com/package/@crowdsec/nodejs-bouncer">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/crowdsecurity/nodejs-cs-bouncer/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://x.com/Crowd_Security">@crowdsec</a>
  <br/>
  <br/>
</div>

## Overview

This bouncer allows you to protect your Node.js application from IPs that have been detected by CrowdSec. Depending on
the decision taken by CrowdSec, user will either get denied (403) or have to fill a captcha (401).

It supports `ban` and `captcha` remediation, and all decisions with `Ip` or `Range` scope.

## Usage

See [User Guide](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/docs/USER_GUIDE.md)

## Installation

See [Installation Guide](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/docs/INSTALLATION_GUIDE.md)

## Developer guide

See [Developer Guide](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/docs/DEVELOPER.md)

## License

[MIT](https://github.com/crowdsecurity/nodejs-cs-bouncer/blob/main/LICENSE)
