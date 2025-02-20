![CrowdSec Logo](images/logo_crowdsec.png)

# CrowdSec Node.js bouncer

## Developer Guide

**Table of Contents**

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Unit tests

```bash
npm test
```

### Coverage

If you want to see the result of code coverage in a browser, you can run the following command:

```bash
npm test -- --coverage --coverageReporters=html 
```

Then open the generated `coverage/index.html` file in your browser.

## Linting

```bash
npm run lint
```

## Prettier

```bash
npm run prettify-check
```

## End-to-end tests

We are using the `examples/express-server` example and Playwright to test the bouncer from end to end.

```bash
cd examples/express-server
```

We need to pass a `E2E_TEST_NAME` environment variable before each separate test
because we want to load a different bouncer configuration for each test.

For example, to run the `live-mode.spec.ts` test file, you should run:

```bash
E2E_TEST_NAME=live-mode npx playwright test live-mode
```
