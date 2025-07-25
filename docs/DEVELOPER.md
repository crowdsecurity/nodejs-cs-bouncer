![CrowdSec Logo](images/logo_crowdsec.png)

# CrowdSec Node.js bouncer

## Developer Guide

**Table of Contents**

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Unit tests](#unit-tests)
  - [Coverage](#coverage)
- [Linting](#linting)
- [Prettier](#prettier)
- [End-to-end tests](#end-to-end-tests)
  - [Prepare the environment](#prepare-the-environment)
  - [Run tests](#run-tests)
- [Update documentation table of contents](#update-documentation-table-of-contents)
- [Release process](#release-process)

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

### Prepare the environment

Please read
`examples/express-server/README.md` [Test the bouncer](../examples/express-server/README.md#test-the-bouncer) to
set up the environment.

Do not launch the server yet as it will be automatically started by the tests below.

### Run tests

We need to pass a `E2E_TEST_NAME` environment variable before each separate test
because we want to load a different bouncer configuration for each test.

For example, to run the `live-mode.spec.ts` test file, you should run:

```bash
E2E_TEST_NAME=live-mode npx playwright test live-mode
```

## Update documentation table of contents

To update the table of contents in the documentation, you can use [the
`doctoc` tool](https://github.com/thlorenz/doctoc).

First, install it:

```bash
npm install -g doctoc
```

Then, run it in the relevant folders:

```bash
doctoc docs/* --maxlevel 4 && doctoc examples/express-server/README.md --maxlevel 4 && doctoc examples/nextjs/README.md --maxlevel 4
```

## Release process

We use [Semantic Versioning](https://semver.org/spec/v2.0.0.html) approach to determine the next version number of the
package.

Once you are ready to release a new version (e.g. when all your changes are on the `main` branch), you should:

- Determine the next version number based on the changes made since the last release: `MAJOR.MINOR.PATCH`


- Update the [CHANGELOG.md](../CHANGELOG.md) file with the new version number and the changes made since the last
  release.
    - Each release description must respect the same format as the previous ones.
- Update the `package.json` file with the new version number.
- Update the `src/lib/constants.ts` file with the new version number for the `VERSION` constant.


- Commit the changes with a message like `chore(changelog) Prepare for release MAJOR.MINOR.PATCH`.


- Browse to the [GitHub
  `Create and publish release` action](https://github.com/crowdsecurity/nodejs-cs-bouncer/actions/workflows/release.yml)
    - Click on `Run workflow` and fill the `Tag name` input with the new version number prefixed by a `v`:
      `vMAJOR.MINOR.PATCH`.
    - Tick the `Publish to NPM` checkbox.
    - Click on `Run workflow` to trigger the release process.