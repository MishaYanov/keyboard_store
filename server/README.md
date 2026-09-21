# Custom Keycaps commerce API

For the end-to-end setup, staging checks and launch checklist, see the
[Shopify integration guide](../docs/shopify-integration.md).

Node 24 HTTP + built-in SQLite. All business/runtime code is strict TypeScript;
Zod validates external payloads and the SQLite adapter handles persistence through
typed asynchronous repository interfaces. Vite bundles the server and shared design rules. The frontend
only talks to `/api`; Shopify tokens and approved variant mappings stay on the server.

## Run

1. Use Node **24+**, install dependencies with `npm ci`, and fill in `server/.env` (or copy
   `server/.env.example` if missing). Mock values keep live checkout disabled.
2. Set `API_DATABASE` to a local SQLite file (default `./data/commerce-mock.sqlite` in mock mode).
   Use `npm run docker:dev` for the complete containerized stack with a persistent volume.
   For a host-run API: `npm run api:dev` builds, watches source and restarts the API.
3. In another: `npm run dev`. Vite proxies `/api` to `127.0.0.1:3001`.

For a production server: `npm run api:build`, then `npm run api:start`. Build the
frontend separately with `npm run build`. Serve `client/dist/` and reverse-proxy `/api`
under the **same HTTPS origin**. Set `NODE_ENV=production` and `APP_ORIGIN` to that
origin. No cross-origin CORS access is enabled. Change the Vite proxy target if
you change API_PORT. Source or .env changes require rebuild/restart as appropriate.

`npm run api:test` creates and removes only its own temporary SQLite directories,
using a fake Shopify transport. No database server, real payments or orders are needed.

## Settings

- `APP_ORIGIN`: exact frontend origin; POST requests must carry this Origin.
- `API_HOST` / `API_PORT`: defaults `127.0.0.1:3001`. Use `0.0.0.0` inside a container.
- `API_DATABASE`: environment-specific SQLite path; never share live and mock files.
- `SQLITE_PERSISTENT`: set `true` only when the absolute path is on actual persistent storage.
  Required for live release commerce. SQLite stores approved designs, checkout results,
  order projections, webhook IDs and fulfillment addresses. Render Free must use mock mode.
- `API_TRUST_PROXY`: default false. Enable only behind a proxy which **overwrites**
  X-Forwarded-For, and blocks direct public access to the Node port.
- `API_ADMIN_KEY`: at least 32 random characters; bearer authentication for operational
  endpoints. Never put it in Vite variables, browser storage, source control or a URL.
  Generate, for example: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- `SHOPIFY_STORE_DOMAIN`: exact `your-store.myshopify.com` hostname.
- `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`: private token from the Headless channel.
- `SHOPIFY_API_VERSION`: `2026-07`, pinned deliberately.
- `SHOPIFY_CHECKOUT_DOMAIN`: exact custom checkout hostname, if different from the store.
- `SHOPIFY_VARIANT_MAP`: approved pricing keys mapped to purchasable Shopify variants.
- `SHOPIFY_WEBHOOK_SECRET`: secret used by Shopify to sign the configured webhook
  subscription. App subscriptions normally use the app's client secret; use the
  matching secret for subscriptions created through Shopify admin.
- `SHOPIFY_ADMIN_ACCESS_TOKEN` / `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` are reserved,
  unused placeholders. This API uses private Storefront access and verified webhooks.

## Catalog and pricing

Create/publish all-inclusive variants in Shopify for the combinations your supplier
supports. The configuration key is:

`size:physical:preset:customColorCount:languageCount:coloredKeyCount:customLegendCount`

For non-custom presets customColorCount is 0. For the default design:

```dotenv
SHOPIFY_VARIANT_MAP={"100:ansi:classic:0:1:0:0":"gid://shopify/ProductVariant/REAL_NUMERIC_ID"}
```

The ID above is illustrative; replace it with a numeric Shopify variant ID. Set its
full selling price and inventory in Shopify and publish to the Headless channel.
Unsupported combinations return 422, never an invented price. Prices and availability
are read from Shopify at checkout. Client totals, variant IDs and configuration IDs
are ignored. The local calculator remains an estimate, and should be kept aligned
with the approved Shopify catalog.

Only validated design fields are saved. Older layout overrides are removed; unsupported
colors and invalid legends are rejected. The server assigns immutable configuration
IDs and stores the complete design snapshot in SQLite. Shopify receives only `_checkout_id`
and `_line_id`, not buyer-editable manufacturing specifications.

## HTTP endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Process and SQLite readiness (503 when unavailable) |
| GET | `/api/commerce/status` | Whether checkout is configured |
| GET | `/api/commerce/catalog` | Approved variants, availability and current prices |
| POST | `/api/commerce/quote` | Validate `{items:[{design,quantity}]}` and return prices |
| POST | `/api/commerce/checkout` | Save approval, create Shopify cart, return checkout URL and costs |
| POST | `/api/webhooks/shopify` | Verified paid/cancelled/refunded events |
| GET | `/api/admin/dashboard` | Counts from this API's verified orders, not invented store analytics |
| GET | `/api/admin/fulfillment` | Recent outbox jobs and review reasons |
| GET | `/api/admin/fulfillment/:id` | Approved specification and destination for a job |

Admin endpoints require `Authorization: Bearer <API_ADMIN_KEY>`. These are operator
endpoints, not a replacement for customer/admin browser login. `/api/account/*`
returns 401 until customer authentication is implemented. The frontend does not
fall back to demo account/admin data on authentication failure.

Checkout requires an `Idempotency-Key` header (16–100 letters/digits/underscore/hyphen).
The anonymous HttpOnly cookie scopes retries. Reusing a key for the same basket returns
the same result for 15 minutes; a conflicting, pending, consumed or expired key returns
409. Mutations are not automatically retried after an uncertain network result.
The frontend creates a new key for each deliberate checkout attempt. Quantity is
limited to 20 per configuration and 20 configurations per request.

## Paid orders and fulfillment

Configure HTTPS subscriptions for `orders/paid`, `orders/cancelled`, and `refunds/create`
pointing to `/api/webhooks/shopify`. Raw-body HMAC and shop domain are verified before
processing; delivery IDs, orders, checkout claims and outbox writes are committed in
one SQLite transaction. Unique constraints and per-file operation serialization protect concurrent requests.
Subscribe in Shopify admin or through your app; nothing is registered automatically.

Before queuing fulfillment the API verifies paid/live status, exact line references,
variant IDs, quantities, currency, unit prices and shipping information against the
stored approval. A checkout can fund only one order. Changed prices, discounts,
unrecognized orders, test orders or invalid configuration references enter **review**.
Unexpected discounts require manual review until a discount policy is implemented.
Cancellation/refund events block jobs, including events arriving before `orders/paid`.
After exporting a job to a supplier, cancellation must also be coordinated with that
supplier; this API cannot recall an externally started manufacturing job.

Valid live orders create **durable ready jobs**. No manufacturer is selected yet, so
there is deliberately no pretend shipping integration or automatic external purchase.
Use authenticated outbox export for manual fulfillment; connect a supplier adapter
and its idempotent order API when that supplier and contract are chosen. Never treat
a checkout redirect as proof of payment. Configure Shopify's own order notifications.

## Deployment limits

Development and staging use separate persistent SQLite volumes. Production requires
a persistent local disk, backups and one API instance per database file.
Restrict database access and choose an address/design retention period for completed orders.
Rate limiting is per process; use an edge limit when deploying multiple instances.
Keep the API behind TLS. Webhook processing does not call suppliers or wait on Shopify.
Abandoned checkout records currently need an operational retention/cleanup policy.

Authentication UI, Shopify Customer Account OAuth, supplier-specific manufacturing
validation, supplier dispatch, and historical Shopify Admin analytics are separate
integrations. The local server does not invent access to them when keys are placeholders.

## Existing data

Existing Mongo volumes and old SQLite files were left untouched. New Docker stacks
use separate SQLite storage; no records are automatically imported from Mongo. If
there are orders to retain, export and reconcile them before taking new live orders.
Back up SQLite consistently including WAL state. Do not delete old files or run `down -v`.
Browser-local drafts/baskets remain browser-local; authenticated cloud saves, receipt
issuance and customer history are separate features, not silently enabled by this migration.

References:
- https://shopify.dev/docs/api/storefront/2026-07
- https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
- https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage
