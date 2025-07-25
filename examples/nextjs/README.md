# NextJS basic implementation

The `nextjs` folder contains a basic implementation of the CrowdSec NodeJs
remediation component for Next.js applications.

It aims to help developers to understand how to integrate CrowdSec remediation in their Next.js application.

**Table of Contents**

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Technical overview](#technical-overview)
  - [Middleware (`src/middleware.ts`)](#middleware-srcmiddlewarets)
  - [API Route (`src/app/api/crowdsec/route.ts`)](#api-route-srcappapicrowdsecroutets)
  - [Captcha Handler (`src/app/crowdsec-captcha/route.ts`)](#captcha-handler-srcappcrowdsec-captcharoutets)
- [Test the bouncer](#test-the-bouncer)
  - [Pre-requisites](#pre-requisites)
  - [Prepare the tests](#prepare-the-tests)
  - [Test a "bypass" remediation](#test-a-bypass-remediation)
  - [Test a "ban" remediation](#test-a-ban-remediation)
  - [Test a "captcha" remediation](#test-a-captcha-remediation)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Technical overview

The implementation uses Next.js App Router with middleware and API routes.

**Important Note**: We cannot use the CrowdSec bouncer directly in the Next.js middleware because middleware runs on the Edge Runtime, which doesn't have access to Node.js APIs that the bouncer requires. While Next.js offers an experimental `nodeMiddleware` feature that would allow Node.js APIs in middleware, we prefer not to rely on experimental features for production use. Instead, we use a custom API route (`/api/crowdsec`) that runs in the Node.js runtime and can access the full bouncer functionality.

**Additional Note**: We had to update the Next.js configuration (`next.config.ts`) to copy font files from the `svg-captcha-fixed` library to make them available at runtime. This is necessary because Next.js doesn't automatically include these assets in the build, and the captcha functionality requires access to these fonts to generate captcha images.

### Middleware (`src/middleware.ts`)

The middleware intercepts all requests and calls the CrowdSec API:

```js
export async function middleware(req: NextRequest) {
    // Skip CrowdSec check for captcha route and non-HTML requests
    if (pathname === '/crowdsec-captcha' || !acceptHeader.includes('text/html')) {
        return NextResponse.next();
    }
    
    // Call internal API to check IP remediation
    const checkUrl = `${req.nextUrl.origin}/api/crowdsec`;
    const res = await fetch(checkUrl, { method: 'POST' });
    
    if (res.status !== 200) {
        // Return ban/captcha wall HTML
        const html = await res.text();
        return new NextResponse(html, {
            status: res.status,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
    
    return NextResponse.next();
}
```

### API Route (`src/app/api/crowdsec/route.ts`)

The API route handles the CrowdSec logic:

```js
export async function POST(req: Request) {
    const { remediation, origin } = await bouncer.getIpRemediation(ip);
    const bouncerResponse = await bouncer.getResponse({ ip, origin, remediation });

    if (remediation === 'ban' || remediation === 'captcha') {
        return new NextResponse(bouncerResponse.html, {
            status: bouncerResponse.status,
        });
    }

    return new NextResponse(null, { status: 200 });
}
```

### Captcha Handler (`src/app/crowdsec-captcha/route.ts`)

Handles captcha form submissions:

```js
export async function POST(req: Request) {
    const form = await req.formData();
    const phrase = form.get('phrase')?.toString() || '';
    const refresh = form.get('crowdsec_captcha_refresh')?.toString() || '0';
    
    await bouncer.handleCaptchaSubmission({ ip, userPhrase: phrase, refresh, origin });
    return NextResponse.redirect(new URL('/', req.url));
}
```

## Test the bouncer

### Pre-requisites

- Node.js and Docker installed on your machine

    - You can run `nvm use` from the root folder to use the recommended NodeJS version for this project

- Copy the `.env.example` file to `.env` and fill in the required values

- Copy the `crowdsec/.env.example` file to `crowdsec/.env` and fill in the required values

- Install all dependencies using a local archive.

  Run the following commands from the `nextjs` folder:

  ```shell
  npm run pack-locally && npm install
  ```

### Prepare the tests

1. Launch the docker instance:

```shell
docker compose up
```

This will instantiate a CrowdSec container with a `http://localhost:8080` LAPI url.

2. Create a bouncer

In another terminal, create a bouncer if you haven't already:

```shell
docker exec -ti nodejs-cs-nextjs-crowdsec sh -c 'cscli bouncers add NodeBouncer --key $BOUNCER_KEY'
```

We are using here the `BOUNCER_KEY` variable defined in `crowdsec/.env` file.

3. Launch the Next.js Server

```shell
npm run start
```

For development, you can use:

```shell
npm run dev
```

This will launch a Next.js server accessible on `http://localhost:3000` (aka "the home page").

You should see different log messages in your terminal when you access the home page.

### Test a "bypass" remediation

As you don't have yet any decisions, you can access the `http://localhost:3000` page and just see the normal Next.js content.

![](./docs/bypass.png)

You should see `Final remediation for IP <BOUNCED_IP> is bypass` in the terminal.

### Test a "ban" remediation

First, add a ban remediation for the IP that will be tested:

```shell
docker exec -ti nodejs-cs-nextjs-crowdsec sh -c 'cscli decisions add --ip $BOUNCED_IP --duration 12m --type ban'
```

We are using here the `BOUNCED_IP` variable defined in `crowdsec/.env` file.

You should see the success message `Decision successfully added`.

If you try to access the home page (after one minute as it is the default ttl for clean IP), you should the "Access
Denied" ban wall.

![](./docs/ban-wall.png)

You should see `Final remediation for IP <BOUNCED_IP> is ban` in terminal.

### Test a "captcha" remediation

First, remove your last decision:

```shell
docker exec -ti nodejs-cs-crowdsec sh -c 'cscli decisions delete --ip $BOUNCED_IP'
```

Then, add a captcha decision:

```shell
docker exec -ti nodejs-cs-crowdsec sh -c 'cscli decisions add --ip $BOUNCED_IP --duration 12m --type captcha'
```

If you try to access the home page (after two minutes as it is the default ttl for malicious IP), you should the "Access
Denied" captcha wall.

![](./docs/captcha-wall.png)

You should see `Final remediation for IP <BOUNCED_IP> is captcha` in terminal.

When a user solves the captcha successfully, they are redirected to the home page (`/`).
