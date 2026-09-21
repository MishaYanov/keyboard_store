# Staging, production and Render

The backend is strict TypeScript, compiled for Node 24. SQLite is provided by
Node's built-in driver; Zod validates provider payloads. No external database,
Mongo container, Atlas account or database credentials are required.

## Environment layout

| Environment | Storage | Commerce |
| --- | --- | --- |
| Local development | SQLite in the Compose `sqlite-data` volume | Mock |
| Local staging | Separate `keycaps-staging_sqlite-data` volume | Mock by default |
| Unit/API tests | Unique temporary SQLite files | Fixtures/mock |
| Playwright | In-memory SQLite in an isolated API | Mock |
| Render Free | Temporary SQLite under `/tmp` | Disposable mock demo only |
| Production | SQLite on an actually mounted persistent disk | Live only |

Services keep the async repository boundary. The SQLite adapter serializes file
operations, uses WAL and short `BEGIN IMMEDIATE` transactions, and preserves
checkout deduplication, payment validation and atomic webhook/outbox processing.
Run one API instance per database file. Do not put SQLite on a network filesystem
or scale multiple hosts against the same file.

## Local Docker

Run from the repository root:

```sh
npm run docker:dev
npm run docker:staging
```

Development opens at `http://127.0.0.1:5173`; staging at `http://localhost:8080`.
Use the exact origin to match cookies and origin validation. Staging uses
`deploy/staging/.env`, production uses `deploy/production/.env`; actual env files
are ignored by Git and Docker build contexts. Templates are committed.

The release image runs as nonroot, with a read-only root filesystem and writable
`/data` volume. Caddy serves the built frontend and proxies `/api/*`.
Public HTTPS needs a real hostname, DNS and reachable ports 80/443. Local staging
uses loopback HTTP and does not request certificates.

`API_DATABASE` selects the SQLite file. `SQLITE_PERSISTENT=true` is an operator
declaration that the absolute path is on durable storage; it does not create a
disk or prove one is mounted. Docker Compose supplies that volume. Live release
mode rejects in-memory/relative paths or missing persistence confirmation.

Mock/live modes cannot share a database: use a new filename when switching
staging to a real Shopify test store. Live staging also needs all Shopify
credentials, mappings and test-payment setup.

## Render Free: API deployment form

This deploys the backend, not the frontend. Push the current SQLite changes and
lockfile to the branch Render builds. No files are uploaded or pushed automatically.

| Input | Value |
| --- | --- |
| Language | Node |
| Root Directory | Leave blank (workspace root is required) |
| Build Command | `npm ci --include=dev && npm run api:build` |
| Start Command | `node server/dist/start.js` |
| Compute | Free |
| Health Check Path | `/api/health` |

Set environment variables from `deploy/render/.env.example`:

```dotenv
NODE_VERSION=24.21.0
NODE_ENV=production
DEPLOY_ENV=staging
COMMERCE_MODE=mock
API_HOST=0.0.0.0
API_DATABASE=/tmp/keycaps-demo.sqlite
SQLITE_PERSISTENT=false
APP_ORIGIN=https://YOUR-ACTUAL-FRONTEND-HOST
```

Generate `API_ADMIN_KEY` in Render if you need operator endpoints.
Do not copy `MONGODB_*` variables or local Docker paths.
The API reads Render's `PORT` automatically unless `API_PORT` overrides it.

Render Free loses local file changes on sleep, restart or redeploy. The demo
database and test orders can disappear; this is intentional and NOT a live store.
Do not enable real payments or claim persistent customer storage. See
[Render free limits](https://render.com/docs/free).

The frontend still needs its own static deployment and same-origin `/api`
routing. Do not point the browser directly at a different API origin without
designing the cookie/proxy behavior. This migration does not provision that routing.

## Production

For Render, use a paid service with a persistent disk (for example mount
`/var/data`), then set `API_DATABASE=/var/data/commerce.sqlite` and
`SQLITE_PERSISTENT=true`. Never set that flag just to bypass validation on a
free ephemeral service. See [persistent disks](https://render.com/docs/disks).

For Docker, production Compose mounts `/data`. Set `DEPLOY_ENV=production`,
`NODE_ENV=production`, `COMMERCE_MODE=live`, an HTTPS origin and real Shopify
credentials, webhook secret, variant mapping and admin secret.

Build and approve staging images, publish both API/web images to your chosen
registry under an immutable commit tag, and pull that same tag in production.
`npm run docker:production` uses `--no-build`. No registry or deployment is
configured automatically. Pin reviewed base-image digests for repeatable releases.

## Backups, migration and rollback

Back up SQLite with a SQLite-aware backup operation, or stop the API and copy the
whole database directory including WAL files. Do not copy only a live main file.
Store encrypted backups off-host and test restores.

Existing Mongo volumes and old SQLite files are preserved, not imported or deleted.
Local Mongo env settings were backed up in Git-ignored `.env.mongodb-backup`
files where present. The new Docker stack uses a separate `sqlite-data` volume.
If Mongo contains orders you need, export and reconcile them before a live cutover;
switching the driver does not move records. Browser drafts/baskets remain local.

Do not run `docker compose down -v` against valuable data. Rollback of images
does not roll back database contents; check schema/data compatibility first.

## Tests and optional Jenkins

`npm test` runs typechecks, unit and SQLite integration tests without another
service. `npm run docker:test:e2e` runs desktop/mobile Playwright with mock
checkout. Test fixtures only remove temporary directories they created.

Jenkins runs tests, builds release images, validates Caddy and smoke-tests the
nonroot SQLite API with temporary storage. It does not push or deploy. Use a
trusted dedicated Docker-capable agent, never untrusted pull requests on a
privileged Docker host. No Jenkins server is needed to deploy manually on Render.

Health checks confirm database connectivity, not Shopify credentials or business
readiness. Customer authentication, cloud draft saving, receipt issuance and
supplier dispatch remain separate features.
