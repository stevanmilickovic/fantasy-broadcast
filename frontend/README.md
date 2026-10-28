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
traces are written to `test-results/` and uploaded by CI.

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

`Frontend checks` runs on pull requests and can be started manually. Container
publishing calls the same reusable workflow and waits for its formatting, lint,
unit, type/build and browser checks before building or publishing images. Repository
branch protection can require the `frontend` job from `Frontend checks`; that hosting
setting is managed outside this repository.
