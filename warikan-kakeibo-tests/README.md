# warikan-kakeibo-tests

End-to-end tests for `docs/index.html`（ふたりの家計簿）. The app itself has
no build step and isn't split into importable modules, so these tests drive
the real rendered page with Playwright instead of unit-testing individual
functions.

Firebase is swapped for a tiny in-memory mock (`mock-firebase/`) that
implements just the Firestore v9 modular SDK surface the app uses, so tests
run fully offline with no real Firebase project.

## Running

```sh
npm ci
npx playwright install --with-deps chromium   # first time only
npm test
```

This starts a local static server for `../docs/` (with the two Firebase CDN
imports rewritten to the mock), runs every `tests/*.test.js` file against it
in a headless browser, and exits non-zero if any assertion fails.

In a sandboxed environment that already has a Chromium binary elsewhere and
can't reach Playwright's download CDN, point `PLAYWRIGHT_CHROMIUM_PATH` at it
instead of installing a second copy:

```sh
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm test
```

## Adding a test

Add a new `tests/<name>.test.js` exporting `async function run({ browser, baseUrl })`
that opens its own page, drives the app, and throws on any failed assertion
(see `tests/helpers.js` for the shared `assert()` / `setupHousehold()` /
`collectPageErrors()` helpers). `run-tests.js` picks up any file in `tests/`
matching `*.test.js` automatically.
