# Shopify integration guide

This guide describes **this repository's implementation**, not a generic Shopify starter.
Last checked against the code and Shopify documentation: **20 September 2026**.

## 1. Architecture and responsibilities

```text
Keyboard builder → local basket → /api/commerce/checkout
                                      │
                          validate design + approved variant
                          read Shopify price + save design
                                      │
                               Shopify cartCreate
                                      │
Browser ← checkoutUrl ←────────────────┘
   │
   └→ Shopify hosted checkout
                │
          signed order webhook → API → SQLite transaction → fulfillment outbox
                                                                  │
                                                        supplier connection: TODO
```

| Responsibility | Owner in this project |
| --- | --- |
| Keyboard preview, editing, local saved design/basket | Frontend |
| Estimated price shown in the builder | Local calculator and pricing constants |
| Allowed designs, approved variant mapping, saved manufacturing specification | Node API |
| Product prices and availability used for checkout | Shopify, queried by the Node API |
| Payment details and shipping-address entry | Shopify hosted checkout |
| Payment-event verification and fulfillment approval | Node API |
| Manufacturing, supplier purchase, shipment/tracking updates | Not connected yet |

The application uses the Storefront API's cart workflow and redirects the buyer to the
returned `checkoutUrl`. It does not collect card details or implement a payment form.
See Shopify's [cart and checkout guide](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage).

Shopify does not replace the custom design validation or supplier integration. Keep your
own API, credentials and stored customer addresses protected even when payment is hosted.

## 2. Choose your environment

### Mock development: no Shopify account or payment needed

```powershell
npm run docker:dev
```

Open `http://127.0.0.1:5173`. If that port is occupied:

```powershell
$env:DEV_PORT = '5174'
npm run docker:dev
```

Then open `http://127.0.0.1:5174`.

The supplied Compose stack explicitly uses `COMMERCE_MODE=mock`, ignores your `server/.env`
for application configuration, and uses an in-memory database. Checkout goes to a
clearly labeled mock page. Completing it creates a synthetic verified order, not a
Shopify order or real shipment. An API restart clears these mock records.

**Putting real Shopify keys into `server/.env` will not turn this Docker stack into a live store.**
It is a development/test setup, not a production deployment definition.
See [Docker setup and tests](../docker/README.md).

### Real Shopify integration: use a separate test store first

Use Node 24+ and the normal frontend/API processes described below. Use separate
credentials, databases and public webhook URLs for staging and production. Do not run
the automated Playwright purchase suite against a real shop: it intentionally checks
for mock mode before exercising its checkout flows.

## 3. Prepare Shopify

1. Install Shopify's **Headless** sales channel and create a storefront.
2. In that storefront's API settings, obtain its **private Storefront access token**.
   Configure the permissions needed for product/variant reads and cart creation.
3. Create the products/variants you intend to sell, set their complete prices and
   inventory, and publish them to the Headless channel. Verify shipping requirements
   and the relevant shipping/payment settings in Shopify.
4. Copy each approved variant's GraphQL ID into the server's variant map, as described
   in section 5. A product ID is not a variant ID.

The Headless channel manages storefront tokens, permissions and channel publishing.
See [Shopify's Headless channel guide](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/manage-headless-channels).

The private token is sent by the server in `Shopify-Storefront-Private-Token`.
Do not substitute a public Storefront token or Admin API token in that setting.
See [Shopify API authentication](https://shopify.dev/docs/api/usage/authentication).

## 4. Configure the server

Create `server/.env` from `server/.env.example` **only if one does not already exist**.
Do not overwrite existing credentials. Keep this file out of Git and Docker images.

Example for a local frontend talking to a real staging Shopify store:

```dotenv
NODE_ENV=development
COMMERCE_MODE=live
APP_ORIGIN=http://localhost:5173
API_HOST=127.0.0.1
API_PORT=3001
API_DATABASE=./data/shopify-test.sqlite
SQLITE_PERSISTENT=false
API_TRUST_PROXY=false
API_ADMIN_KEY=mock-KEY-REPLACE-WITH-AT-LEAST-32-RANDOM-CHARACTERS

SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2026-07
SHOPIFY_CHECKOUT_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=mock-KEY-PRIVATE-STOREFRONT-TOKEN
SHOPIFY_WEBHOOK_SECRET=mock-KEY-WEBHOOK-SIGNING-SECRET
SHOPIFY_VARIANT_MAP={"100:ansi:classic:0:1:0:0":"gid://shopify/ProductVariant/1234567890"}
```

`1234567890` is an example, not a usable variant. Replace all placeholders before
testing a real checkout. Values containing `mock-KEY` are treated as unconfigured.

| Setting | Meaning |
| --- | --- |
| `COMMERCE_MODE` | `live` or omitted uses Shopify; `mock` enables the isolated fake provider. Production Node builds permit mocks only with explicit `DEPLOY_ENV=staging`; actual production forbids mocks. |
| `APP_ORIGIN` | Exact frontend origin, including scheme and port. `localhost` and `127.0.0.1` are different origins. |
| `SHOPIFY_STORE_DOMAIN` | Bare `*.myshopify.com` hostname, without `https://` or a path. |
| `SHOPIFY_API_VERSION` | Storefront API version pinned by this project; currently `2026-07`. Review compatibility before upgrading. |
| `SHOPIFY_CHECKOUT_DOMAIN` | Exact additional checkout hostname if Shopify returns a custom domain. The store hostname is also accepted. No wildcard allowlist. |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | Server-only private Storefront token. |
| `SHOPIFY_VARIANT_MAP` | Single-line JSON mapping approved pricing keys to variant GIDs. |
| `SHOPIFY_WEBHOOK_SECRET` | Signing secret matching the actual webhook subscriptions; not the Storefront token. |
| `API_HOST`, `API_PORT` | API binding; defaults to `127.0.0.1:3001`. Containers need `0.0.0.0`. |
| `API_DATABASE`, `SQLITE_PERSISTENT` | SQLite file path and explicit durable-storage declaration. Live release requires an absolute file path on a persistent disk. |
| `API_TRUST_PROXY` | Enable only behind a trusted proxy that overwrites forwarded IP headers and blocks direct API access. |
| `API_ADMIN_KEY` | At least 32 random characters for operator-only API requests. Not browser login. |
| `API_PROXY_TARGET` | Optional Vite process environment setting when the API is not at `http://127.0.0.1:3001`. |

`SHOPIFY_ADMIN_ACCESS_TOKEN` and `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` in `.env.example`
are reserved placeholders: the current implementation does not use them. Filling them
in does not enable analytics, OAuth or customer history. Never prefix secrets with
`VITE_`, put them in browser storage, or paste them into frontend code.

Start the local integration:

```powershell
npm ci
npm run api:dev
```

In a second terminal:

```powershell
npm run dev
```

Open the exact `APP_ORIGIN`. Restart the API after changing `.env`.

## 5. Map builder designs to sellable variants

The active mapping is calculated by `ShopifyAdapter.pricingKey`:

```text
size:physical:preset:customColorCount:languageCount:coloredKeyCount:customLegendCount
```

| Example design | Pricing key |
| --- | --- |
| Default full-size ANSI, classic palette, one language | `100:ansi:classic:0:1:0:0` |
| 60% ANSI, classic palette, one language | `60:ansi:classic:0:1:0:0` |
| Default design with one individually colored key and one custom legend | `100:ansi:classic:0:1:1:1` |

For non-custom presets, customColorCount is always `0`. Only overrides on keys active
in the selected layout count. The exact text, chosen colors and language identities
remain in the saved design, even though the price key contains counts rather than
all those values. Confirm that your supplier can support those choices.

Each approved key maps to one **all-inclusive priced variant**. The server does not
charge an arbitrary frontend total or create products/variants dynamically. Unknown
combinations return HTTP 422. The UI currently allows designs that may not be mapped;
decide which combinations you will sell before launch.

Read IDs with Shopify's API tooling, for example using this Storefront query against
the private token's store (keep the token server-side):

```graphql
query VariantIds {
  products(first: 20) {
    nodes {
      title
      variants(first: 20) {
        nodes { id title availableForSale price { amount currencyCode } }
        pageInfo { hasNextPage endCursor }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Paginate products and variants when `hasNextPage` is true. Use IDs shaped like
`gid://shopify/ProductVariant/1234567890`.

The frontend's `pricing.constants.ts` contains **prototype USD estimates**. Shopify
prices are authoritative for checkout. Keep them aligned or implement quote-driven
display before selling. The current flow does not explicitly select a Shopify Market
or buyer currency; currency or price changes at payment can cause manual review.

Mapping every combination can become unwieldy. The current adapter is suitable for
a constrained catalog. A different pricing/product model needs a separate design and
implementation; adding attributes to a Shopify line does not implement a surcharge.

## 6. Checkout contract

The browser's `ShopifyService` uses signal/computed API resources and calls your API,
not Shopify directly. The main routes are:

| Method and path | Behavior |
| --- | --- |
| `GET /api/health` | Liveness only; does not verify Shopify connectivity. |
| `GET /api/commerce/status` | Configuration flags: `configured` and `mock`. Not a credential test. |
| `GET /api/commerce/catalog` | Fetch mapped variants from Shopify; useful connectivity smoke check. |
| `POST /api/commerce/quote` | Validate designs and return current approved unit prices. |
| `POST /api/commerce/checkout` | Persist approved designs, create cart and return `checkoutUrl`, costs and configuration IDs. |

Both POST routes accept `{ "items": [{ "design": <KeyboardDesign>, "quantity": 1 }] }`.
Limits are 20 configurations and 20 units per configuration. Checkout requires a
16–100-character `Idempotency-Key` using letters, digits, `_` or `-`.

For a supported basket, the API validates the design, ignores client-supplied prices
and variant IDs, checks inventory, saves the complete specification, then creates a
Shopify cart. Cart attributes contain `_checkout_id`; each line has `_checkout_id`
and `_line_id`. The API verifies returned lines and subtotal before returning the URL.

An anonymous HttpOnly cookie scopes idempotency. Repeating the same key and payload
can reuse a ready result for 15 minutes; conflicts, pending/failed/expired requests and
already-paid checkouts return 409. The frontend currently generates a new key for
each deliberate attempt. Do not blindly retry a mutation after an uncertain response.

The browser redirects to Shopify. A redirect or thank-you screen is **not** payment
proof. The basket currently remains in browser storage; paid-order confirmation and
automatic basket clearing are not implemented.

The older public provider and `ShopifyAdapter.toLines` utility are not the active
checkout path. Do not bypass server approval or treat buyer-editable attributes as
the manufacturing source of truth.

## 7. Register webhooks

Use a reachable HTTPS endpoint:

```text
https://your-staging-domain.example/api/webhooks/shopify
```

Localhost is not reachable by Shopify. For local integration testing, use a controlled
HTTPS tunnel or a deployed staging API; do not change the browser's `APP_ORIGIN` merely
because the webhook uses a tunnel.

Register these topics, all with JSON delivery to that endpoint:

| Topic | Project behavior |
| --- | --- |
| `orders/paid` | Verify paid order against saved approval; queue it or mark it for review. |
| `orders/cancelled` | Block associated fulfillment; record cancellation even if paid delivery arrives later. |
| `refunds/create` | Conservatively block the order's jobs, including partial-refund events. |

You can configure subscriptions in Shopify admin under Settings → Notifications →
Webhooks, or through an app. Select the matching events, JSON format, URL and supported
payload API version. The application does not register subscriptions automatically.
See [Shopify's webhook setup instructions](https://help.shopify.com/en/manual/fulfillment/setup/notifications/webhooks).

Set `SHOPIFY_WEBHOOK_SECRET` to the secret matching that subscription mechanism.
App-managed subscriptions generally use the app client secret; admin-created
subscriptions use the signing secret provided for them. Do not mix signing secrets
from different mechanisms: the current receiver supports one configured secret.

The receiver verifies the HMAC against **raw request bytes**, checks the shop domain,
and deduplicates deliveries and orders. Keep proxies/middleware from rewriting the
body. Shopify documents the verification requirements in
[Verify webhook deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries).

### Approval and fulfillment limits

An eligible order must match the stored line references, variant IDs, quantities,
currency and unit prices, include a shipping address, and be paid, uncancelled and
non-test. Discounts currently require review. Unrelated store orders also enter
review because they have no matching builder approval.

**Shopify orders marked `test: true` are deliberately held for review.** A test order
validates delivery/signature handling but must not enter the real fulfillment queue.
The mock provider's simulated success is not evidence of a live Shopify integration.

Verified live orders create durable outbox jobs, but there is no supplier worker,
dispatch acknowledgment, tracking sync or automatic Shopify fulfillment update yet.
Do not connect an automatic dropshipping app that can dispatch builder orders before
your configuration verification. Supplier cancellation after external dispatch also
requires separate coordination.

Operator endpoints require `Authorization: Bearer <API_ADMIN_KEY>`:

- `GET /api/admin/dashboard`: local verified-order counts, not full Shopify analytics.
- `GET /api/admin/fulfillment`: recent jobs and review reasons.
- `GET /api/admin/fulfillment/:id`: approved specification and shipping destination.

Use these only from trusted operator tools. Never embed the admin key in the website.
The UI route `#/admin` is not a security boundary or a completed role-based login system.

## 8. Verification and go-live checklist

### Automated checks (mock only)

```powershell
npm run docker:test:unit
npm run docker:test:e2e
npm run docker:test:down
```

The suites cover pricing, geometry, storage, API resources, checkout validation,
idempotency, webhook HMAC/replays, refunds, SQLite persistence/transaction races, and desktop/mobile
builder flows. They do not verify real Shopify credentials or supplier compatibility.

### Staging checks (manual, separate Shopify test store)

1. Confirm `/api/commerce/status` reports `mock: false` and `configured: true`.
2. Request `/api/commerce/catalog`; confirm expected IDs, prices and availability.
3. Build one mapped configuration, add it to the basket and continue to Shopify.
4. Check line quantity, final currency, shipping, tax and returned checkout hostname.
5. Complete a Shopify test-mode checkout, never an accidental live payment.
6. Inspect the order's cart/line attributes and webhook delivery. Confirm the API
   associates the saved configuration and holds this **test order** for review.
7. Exercise cancellation/refund delivery and replay handling in staging. Dashboard
   sample webhook payloads without saved checkout references cannot prove approval.

### Production gates

- Configure `NODE_ENV=production`, `COMMERCE_MODE=live` and an HTTPS `APP_ORIGIN`.
- Build frontend and API; serve `client/dist/` and proxy `/api` under the same origin.
  Use `npm run build`, `npm run api:build`, then `npm run api:start`. The last command
  expects a server-side `.env`; if your host injects environment variables instead,
  start with `node dist/start.js` from `server/` after building.
- Provision a persistent private SQLite disk, backups and a retention policy for
  addresses, designs and abandoned checkouts. Ephemeral storage is unsuitable.
- Configure real webhook subscriptions, signing secret and operator authentication.
  Monitor delivery failures, held orders, outbox backlog and disk usage.
- Agree supplier-supported designs and pricing; implement dispatch or a controlled
  manual fulfillment process before accepting live custom orders.
- Verify real store payment/shipping/tax settings, price-display alignment, and
  refund/discount handling. Any live-payment validation requires explicit approval.
- Plan webhook reconciliation for missed deliveries; it is not implemented here.
- Keep tokens out of logs and browser bundles. Rotate the private token by deploying
  its replacement and checking access before revoking the previous one.

Customer Account OAuth, authenticated purchase history/address management, browser
admin authentication, multi-store OAuth/install flows and historical Admin API analytics
are future work. `/api/account/*` currently returns 401. Shopify's
[authentication overview](https://shopify.dev/docs/api/usage/authentication) distinguishes
Storefront, Admin and Customer Account access; one token does not enable all three.

## 9. Troubleshooting

| Symptom | Check |
| --- | --- |
| `configured: false` / 503 | Placeholder token/domain, empty mapping, or wrong process environment; restart after `.env` edits. |
| `configured: true`, catalog fails | Configuration presence is not a connection test. Check token, permissions, publication and actual variant IDs. |
| 403 on checkout | Exact browser `Origin` must match `APP_ORIGIN`; check scheme, hostname and port. |
| 422 configuration not offered | Add an approved mapping for the exact pricing key or constrain the UI catalog. |
| 422 missing/unavailable variant | Verify publication, availability and that you used a variant GID, not a product ID. |
| 409 checkout | Price changed or idempotency key is conflicting, pending, expired or consumed; inspect before retrying. |
| Invalid checkout URL | Compare Shopify's actual hostname with `SHOPIFY_CHECKOUT_DOMAIN`; don't disable the allowlist. |
| Webhook 401 / 403 / 503 | Wrong HMAC secret or modified body / unexpected shop domain / missing secret. |
| Webhook 200 but no job | Inspect `review`/`blocked` state. Test orders, discounts, mismatches or missing shipping can prevent approval. |
| Works in mock, fails in Shopify | Mock accepts validated designs with local estimates; live mode needs explicit published variants and real store settings. |
| Basket remains after payment | Expected until confirmed-order handling is implemented. |
| Admin/account says sign-in required | Authentication is not implemented; do not expose operator credentials to work around it. |

## 10. Code map

- [Browser service](../client/src/core/shopify/shopify.service.ts): reactive API state and checkout redirect validation.
- [Pricing-key adapter](../shared/src/shopify.adapter.ts): mapping-key format.
- [Frontend price estimates](../shared/src/pricing.constants.ts).
- [Server configuration](../server/config.ts): settings and mock/production guards.
- [HTTP routes](../server/app.ts) and [API reference](../server/README.md).
- [Design validation](../server/domain.ts) and [checkout orchestration](../server/commerce.ts).
- [Shopify gateway](../server/shopify.ts): GraphQL reads, cart creation and URL allowlist.
- [Webhook verifier](../server/webhooks.ts) and [SQLite repository](../server/store.ts).
- [Mock provider](../server/mock-shopify.ts): development/staging simulation.
- [Environment template](../server/.env.example) and [Docker/test instructions](../docker/README.md).
