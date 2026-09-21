# Docker development and tests

Requires Linux containers and Docker Compose v2.24.4+ (`!reset` / `!override`).
Run from the repository root:

```powershell
npm run docker:dev
# http://127.0.0.1:5173
# Optional: $env:DEV_PORT = '5174'
npm run docker:test:unit
npm run docker:test:e2e
npm run docker:test:down
npm run docker:down
```

Development uses mock commerce and SQLite at `/data/development-mock.sqlite`,
inside the persistent `sqlite-data` volume. Only the frontend port is published
on loopback. No database server or credentials are needed.

TypeScript server sources and shared rules are individually mounted; `server/.env`
is not mounted. The dev watcher builds and starts `dist/start.js`. Rebuild for
dependency/build-tool changes; add mounts when adding source files.

## Tests

Unit/API tests use unique temporary SQLite files. They check transactional rollback,
competing webhook deliveries, cancellation races, idempotency, persistence and
shutdown draining. No external service is required.

Playwright runs in the separate `keycaps-test` project with `compose.test.yaml`.
The API uses in-memory SQLite; source mounts and published frontend ports are removed.
The browser shares the web container network namespace, using `http://localhost:5173`.
Mock commerce never contacts Shopify or suppliers.

Playwright package/image remain pinned to 1.63.0. Reports are under
`tests/e2e/playwright-report/` and `tests/e2e/test-results/`. Cleanup commands
remove containers/networks but retain persistent volumes. Do not use `down -v`.

## Release

`docker/release.Dockerfile` builds compiled client/API images; the API runs as
nonroot with writable `/data` and a read-only root filesystem. Staging/production
have separate Compose projects and volumes. Staging permits mock commerce;
production requires live credentials and explicitly persistent SQLite storage.

The prior Mongo containers are no longer part of Compose. Their volumes are
preserved; no Mongo data is imported automatically.
See [deployment and Render settings](../docs/deployment.md).
