# Fantasy Broadcast frontend

React, TypeScript and Vite. Use Node 22 (minimum 22.12) and the committed npm lockfile.

```bash
nvm use
npm ci
npm run dev
```

The development server proxies `/api`, `/oauth2` and `/login/oauth2` to the backend
at `http://localhost:8080`. Production uses same-origin paths through Nginx.

## Validation

```bash
npm run check
npx playwright install chromium
npm run test:browser
```

`check` runs formatting, ESLint with zero allowed warnings, Vitest, TypeScript and
the production build. It includes browser tests and Vite, Vitest and Playwright
configuration files in type checking. Formatting covers source, tests, configuration,
this README, frontend architecture/refactor documentation and workflow YAML.

Browser tests start a production preview on port 4173, so run `npm run check` or
`npm run build` first. They use deterministic API fixtures and Chromium; no backend,
mail service or payment credentials are required. API interceptors match paths
starting with `/api/` so they cannot intercept source modules. Screenshots and failure
traces are written to `test-results/`. The manual browser workflow uploads failure
artifacts; CI records traces on the first retry instead of tracing every passing test.

To use an already installed Chrome instead of downloading Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:browser
```

The suite checks phone portrait/landscape, tablet, laptop, desktop and TV. Desktop
administration is intentionally skipped on phone/tablet projects. Browser smoke tests
complement unit tests for queues, timers, focus changes and stale responses. They do
not validate real payments, mail delivery, audio output or OS wake lock permissions.

## Code ownership

- `src/app`: route resolution, browser navigation and top-level screen composition.
- `src/features`: authentication, leagues, billing, administration, broadcast, players
  and public pages. A feature owns its API functions, contracts, hooks, UI and CSS.
- `src/shared/api`: HTTP errors and abortable query/mutation state.
- `src/shared/fpl`: FPL contracts, shirt data and club matching.
- `src/shared/ui`: public header/footer and shared visual primitives.
- `src/index.css`: reset and design tokens. `src/app/styles.css`: explicit style import
  order; feature breakpoints stay with their feature.

Read [the architecture guide](../docs/frontend-architecture.md) for session lifetimes,
playback rules, feature dependencies and where to make changes. The completed
[refactor record](../docs/frontend-refactor.md) documents behavior fixes and validation.
Follow [AGENTS.md](AGENTS.md) when changing frontend code.

## Continuous integration

Automatic CI runs only when a version tag such as `v1.3.0` is pushed. The tag must
match `VERSION`. The release job runs `npm run check` and packages/tests the backend
once, then builds container images from those outputs. npm, Maven and Docker layer
caches reduce repeat downloads and packaging work. Releases retain image security
scans and do not install browsers or run screen tests.

Run the full responsive suite on demand from **Actions → Browser tests (manual) →
Run workflow**, selecting the branch or tag to test. It builds the frontend and runs
all six viewport projects. Browser tests remain available locally with the commands
above. Ordinary branch pushes and pull requests do not trigger these workflows.

If branch protection previously required the removed `Frontend checks` job, update
that GitHub setting to match this tag-only release policy.
