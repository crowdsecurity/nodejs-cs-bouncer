<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [CrowdSec NodeJS Bouncer](#crowdsec-nodejs-bouncer)
  - [Basic Usage](#basic-usage)
    - [Apply the remediation](#apply-the-remediation)
  - [API](#api)
    - [CrowdSecBouncer](#crowdsecbouncer)
    - [Render ban wall](#render-ban-wall)
    - [Render captcha wall](#render-captcha-wall)
  - [MIT Licence](#mit-licence)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<p align="center">
  <img src="https://github.com/crowdsecurity/nodejs-cs-bouncer/raw/main/docs/assets/app-sec.webp" width="200px" align="center" alt="Crowdsec Bouncer logo" />
  <h1 align="center">CrowdSec NodeJS Bouncer</h1>
  <p align="center">
    ✨ <a href="https://www.crowdsec.net/">Crowdsec</a> ✨
  </p>
</p>
<p align="center">
    <a href="https://codecov.io/github/crowdsecurity/nodejs-cs-bouncer">
      <img src="https://codecov.io/github/crowdsecurity/nodejs-cs-bouncer/branch/main/graph/badge.svg?token=BQA733CC26" alt="Crowdsec JS Bouncer Codecov" />
    </a>
    <a href="https://opensource.org/licenses/MIT">
      <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="Crowdsec JS Bouncer License" />
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
  <a href="https://www.npmjs.com/package/@crowdsec/express-bouncer">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/crowdsecurity/nodejs-cs-bouncer/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://x.com/Crowd_Security">@crowdsec</a>
  <br/>
  <br/>
</div>

CrowdSec is a behavior detection engine that blocks common attacks like credential brute-force, port scans, and web scans.
It maintains a global IP reputation database, curated to avoid false positives, and shares it with all network members.

## Basic Usage

Invoking the bouncer is as simple as (Check our [examples](./examples)):

```typescript
import { CrowdSecBouncer, CrowdSecBouncerConfiguration } from '@crowdsec/nodejs-cs-bouncer';

const config: CrowdSecBouncerConfiguration = {
    url: 'http://localhost:8080',
    bouncerApiToken: 'your-api-key',
};

// Init the bouncer
const bouncer = new CrowdSecBouncer(config);

// Get the remediation for an IP
const remediation = await bouncer.getIpRemediation(malevolentIp);
```

### Apply the remediation

Thanks to the bouncer, you know the remediation about a given IP.
To apply the remediation you can use render methods offered by the library. You can either display a ban wall or a captcha wall (Check our [examples](./examples)):

```typescript
import { renderBanWall, BanWallOptions } from '@crowdsec/nodejs-cs-bouncer';

const wallOptions: BanWallOptions = {
    texts: {
        title: '⚠️ You have been banned ⚠️',
        subtitle: 'You have been banned from accessing this website.',
    },
};

// Render a full customizable HTML page
const banWall = await renderBanWall(wallOptions);
```

Example of a ban or captcha wall:

<div align="center">
  <img src="https://github.com/crowdsecurity/nodejs-cs-bouncer/raw/main/docs/assets/ban-wall.png" height="200px" align="center" alt="Crowdsec Bouncer Ban wall" />
  <img src="https://github.com/crowdsecurity/nodejs-cs-bouncer/raw/main/docs/assets/captcha-wall.png" height="200px" align="center" alt="Crowdsec Bouncer Captcha wall" />
</div>

## API

### CrowdSecBouncer

[Check the initialization example](./examples/bouncer-init.ts)

-   `constructor(config: CrowdSecBouncerConfiguration)` : Create a new instance of the CrowdSecBouncer.

-   `CrowdSecBouncerConfiguration`

```typescript
{
    url: 'string'; // The URL of your CrowdSec Local API
    bouncerApiToken: 'string'; // The API token to use the bouncer
    fallbackRemediation: 'RemediationType'; // The fallback remediation to use. Default: 'ban'
}
```

-   `getIpRemediation(ip: string): Promise<Remediation>`: Get the remediation for a given IP.

### Render ban wall

-   `renderBanWall(options: BanWallOptions): Promise<string>`: Return a computed HTML page with the ban wall.

-   `BanWallOptions` Default options:

```typescript
{
    tabTitle: 'CrowdSec | Ban Wall', // The title of the tab
    title: 'Access Denied', // Title present in the ban wall card
    subtitle: 'This page is secured against cyber attacks, and your IP has been blocked by our system', // Subtitle present in the ban wall card
    footer: '', // Footer present in the ban wall card
    hideCrowdSecMentions: false, // Hide the CrowdSec mentions
    colors: // Check default colors
    texts: // Check default texts
}
```

### Render captcha wall

-   `renderCaptchaWall(options: CaptchaWallOptions): Promise<string>` : Return a computed HTML page with the captcha wall.
-   `CaptchaWallOptions` Default options:

```typescript
{
    tabTitle: 'CrowdSec | Captcha Wall', // The title of the tab
    title: 'Access Denied', // Title present in the captcha wall card
    subtitle: 'This page is secured against cyber attacks, and your IP has been blocked by our system', // Subtitle present in the captcha wall card
    footer: '', // Footer present in the captcha wall card
    hideCrowdSecMentions: false, // Hide the CrowdSec mentions
    colors: // Check default colors
    texts: // Check default texts
    error: '', // The error message to show when the captcha validation fails
    captchaImageTag: '', // The captcha image tag
    redirectUrl: '', // The URL to redirect after the captcha validation
}
```

## MIT Licence

[MIT Licence](./LICENCE)
