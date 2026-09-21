# Custom Keycaps

Node 24+ / npm workspaces. Install once with `npm ci` at the repository root.

```text
client/                 Browser app, public assets, Vite and image converter
server/                 Strict TypeScript API, Shopify gateway, SQLite repository
shared/                 @keycaps/domain: design, pricing, validation and geometry
tests/
  unit/                 Client and shared-rule tests
  integration/          HTTP, SQLite transactions, webhooks and import-boundary tests
  e2e/                  Playwright specs, config and generated reports
  manual/               Browser verification fixtures
  scripts/              Local E2E stack launcher
docker/                 All Dockerfiles and Docker instructions
compose.yaml            Mock development stack
compose.test.yaml       Isolated test-stack overrides
docs/                   Integration guide and code review
```

Client and server both import `@keycaps/domain`; neither imports the other. Only tests
import implementation code across project boundaries. Shared TypeScript is bundled
into each application's build, not deployed as another service. One root lockfile
manages all four workspaces; the root package is orchestration, not an application.

## Commands from the root

```sh
npm run dev             # Client on localhost:5173
npm run api:dev         # Separate terminal; reads server/.env
npm run build           # client/dist
npm run api:build       # server/dist/app.js
npm run api:start       # API; working directory is server/
npm run typecheck       # Client + server TS boundary + shared rules
npm test               # Unit + API/SQLite/webhook/boundary tests; no database server required
npm run test:e2e        # Isolated mock stack on 127.0.0.1:5180
npm run towebp          # client/public/assets/images
```

Before local E2E: `npm exec --workspace @keycaps/tests -- playwright install chromium`.
Reports: `npm run report --workspace @keycaps/tests`. Browser fixtures:
`npm run manual --workspace @keycaps/tests`, then `/manual/panel.html` or
`/manual/keyboard-design.html` on port 5181.

Workspace commands also work individually, e.g. `npm run build --workspace @keycaps/client`.
Install dependencies at the root to maintain workspace links and a single lockfile.

## Docker

```sh
npm run docker:dev
npm run docker:test:unit
npm run docker:test:e2e
npm run docker:test:down
npm run docker:down
```

All Dockerfiles are in `docker/`. Client/server images copy only their own application
source plus shared rules; the unit image has both apps, and the Playwright image has
E2E specs. Tooling dependencies share a development base image; these are not minimal
production images. See [Docker guide](docker/README.md).

## Migration notes

- Frontend source, assets, HTML/CSS entrypoints and Vite/TS config moved into `client/`.
- Private local `.env` and its template live in `server/`. The API now uses
  `API_DATABASE` and `SQLITE_PERSISTENT`. Old database files/volumes are preserved but
  are not read or automatically imported; see [server notes](server/README.md).
- E2E moved into `tests/e2e/` with dependencies managed by the root lockfile.
- API/unit outputs are now `server/dist` and `tests/dist`. Old root build artifacts
  are unused and were left untouched, not deleted.
- Update IDE configurations referencing root `src`, old scripts or old build paths.
- The old root `src/` and `scripts/` directories are empty but currently held open by
  another local process. They contain no application code; close the old IDE/watchers
  before removing these empty directories. No source or database files were discarded.

[Shopify integration](docs/shopify-integration.md) · [Client/business review](docs/client-business-review.md)
# Release environments

See [staging, production and optional Jenkins setup](docs/deployment.md).
Release Dockerfiles remain in `docker/`; environment templates live in `deploy/`.
