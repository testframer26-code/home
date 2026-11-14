# Leon Home

A luxury real estate landing page built as static HTML, CSS and JavaScript, served from the repository root.

## Preview

The Base44 environment serves this checkout on port 3000 with a standard-library static server; files are read from disk on every request, so edits appear on refresh.

## End-to-end tests

Playwright covers the footer's desktop layout (four-column navigation, newsletter rail, bottom bar, oversized signature wordmark) and its mobile accordion behavior (collapsed groups, contact details visible by default, accessible open/close state, full-width newsletter, touch targets and no horizontal overflow).

The suite targets a server at `http://localhost:3000`. With the preview stack running:

```sh
docker run --rm --network host -e CI=1 \
  -v "$PWD":/work \
  -v leon-home-node-modules:/work/node_modules \
  -w /work mcr.microsoft.com/playwright:v1.65.1-noble \
  sh -ec "npm install --no-audit --no-fund && npx playwright test"
```

Point the suite at another deployment with `-e BASE_URL=https://example.com` (and drop `--network host` for a remote host). Configuration lives in `playwright.config.js`; specs live in `tests/`.
