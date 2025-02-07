![CrowdSec Logo](images/logo_crowdsec.png)

# CrowdSec Node.js bouncer

## User Guide

**Table of Contents**
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->




<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Prerequisites

To be able to use a bouncer based on this package, the first step is to
install [CrowdSec v1](https://doc.crowdsec.net/docs/getting_started/install_crowdsec/). CrowdSec is only in charge of
the "detection", and won't block anything on its own. You need to deploy a bouncer to "apply" decisions.

Please note that first and foremost a CrowdSec agent must be installed on a server that is accessible by this library.

## Features

- CrowdSec Local API support
    - Handle `ip` and `range` scoped decisions
    - `Live mode` or `Stream mode`


- Support IpV4 and Ipv6 (Ipv6 range decisions are yet only supported in `Live mode`)

## Usage

When a user is suspected by CrowdSec to be malevolent, the bouncer would either display a captcha to resolve or
simply a page notifying that access is denied. If the user is considered as a clean user, the page will be accessible
as normal.

A ban wall could look like:

![Ban wall](images/screenshots/ban-wall.png)

A captcha wall could look like:

![Captcha wall](images/screenshots/captcha-wall.png)

With the provided bouncer, it is possible to customize all the colors of these pages so that they integrate
best with your design.

On the other hand, all texts are also fully customizable. This will allow you, for example, to present translated pages
in your users' language.

## Implement your own bouncer

### Instantiation

Invoking the bouncer is as simple as:

```typescript
import { CrowdSecBouncer, CrowdSecBouncerConfiguration } from '@crowdsec/nodejs-cs-bouncer';

const config: CrowdSecBouncerConfiguration = {
    url: 'http://localhost:8080',
    bouncerApiToken: 'your-api-key',
};

// Init the bouncer
const bouncer = new CrowdSecBouncer(config);

// Get the remediation (value and origin) for an IP
const remediationData = await bouncer.getIpRemediation(malevolentIp);

console.log(remediationData);
// output: { remediation: 'ban', origin: 'cscli' }

```

### Apply a remediation

Thanks to the bouncer, you know the remediation about a given IP.
To apply the remediation you can use render methods offered by the library. You can either display a ban wall or a
captcha wall.

```typescript
// Retrieve ban wall HTML
const banWall = await bouncer.renderWall('ban');
```     

or

```typescript
// Retrieve captcha wall HTML
const captchaWall = await bouncer.renderWall('captcha');
```

### Custom Captcha

By default, this bouncer generates captcha using [
`svg-captcha-fixed` package](https://www.npmjs.com/package/svg-captcha-fixed).

If you want to use your own captcha generator, you can pass a custom captcha to the bouncer.

This captcha must implement the `CaptchaGenerator` interface (see `src/lib/bouncer/captcha.ts`):

```typescript

import { CrowdSecBouncer, CrowdSecBouncerConfiguration, CaptchaGenerator } from '@crowdsec/nodejs-cs-bouncer';

const config: CrowdSecBouncerConfiguration = {
    url: 'http://localhost:8080',
    bouncerApiToken: 'your-api-key',
};

const customCaptchaGenerator: CaptchaGenerator = {
    create: () => {
        // Your custom captcha generation logic
        const captcha = generateCustomCaptcha();
        return {
            phraseToGuess: captcha.phraseToGuess,
            inlineImage: captcha.inlineImage
        };
    },
};


// Pass the custom captcha generator to the bouncer as a second argument
const bouncer = new CrowdSecBouncer(config, customCaptchaGenerator);
```

### Custom Cache Adapter

By default, this bouncer uses an "in-memory" cache.

You can pass your own custom cache adapter to the bouncer, for example to use Redis or any other cache system.

Cache adapter must implement the `CacheAdapter` interface (see `src/lib/cache/interfaces.ts`) and be passed as
the `cacheAdapter` configuration option.

Please refer also to `src/lib/cache/key-adapter.ts` for an example of implementation
using [Keyv](https://keyv.org/docs/).

```typescript

import { CrowdSecBouncer, CrowdSecBouncerConfiguration, CacheAdapter } from '@crowdsec/nodejs-cs-bouncer';

const customCacheAdapter: CacheAdapter = {
    getItem: (key: string) => {
        // Your custom cache get logic
        return getFromCustomCache(key);
    },
    setItem: (key: string, value: any) => {
        // Your custom cache set logic
        return setToCustomCache(key, value);
    },
    deleteItem: (key: string) => {
        // Your custom cache delete logic
        return deleteFromCustomCache(key);
    },
    clear: () => {
        // Your custom cache clear logic
        return clearCustomCache();
    },
};

const config: CrowdSecBouncerConfiguration = {
    url: 'http://localhost:8080',
    bouncerApiToken: 'your-api-key',
    cacheAdapter: customCacheAdapter,
};

// Init the bouncer
const bouncer = new CrowdSecBouncer(config);
```

## Configurations

