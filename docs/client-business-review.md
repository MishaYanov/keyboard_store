# Client and business/API code review

Current storage update: the Mongo migration was subsequently replaced by a strict
TypeScript SQLite adapter. The async service boundary, runtime schemas and concurrency
regressions remain. See [deployment](deployment.md) for persistent Docker versus
ephemeral Render Free demo settings; observations below describe earlier snapshots.

Update (Mongo/TypeScript migration): this is a historical review. The runtime modules
referenced below have moved from `.mjs` to `.ts`, all runtime/business modules are now
strictly typechecked, provider payloads have runtime schemas, and MongoDB replaces
SQLite. Production startup now requires a webhook secret. Unrelated findings remain
open unless separately resolved. See [current server architecture](../server/README.md).

Reviewed: 20 September 2026. Scope: current repository after the workspace split.
This is a code/architecture review with automated regression checks, not a security
certification or verification against live Shopify or a manufacturer.

## Findings — remaining work, not silently fixed by the move

### P1 — Live checkout can accept payment without a usable webhook receiver

Evidence: [server/config.mjs](../server/config.mjs), lines 28–29, calculates `ready`
from domain, token and variant mappings but not the webhook secret. Meanwhile
[server/webhooks.mjs](../server/webhooks.mjs), lines 13–15, returns 503 without that secret.

Reproduction: supply a real-format domain/token/map, leave `SHOPIFY_WEBHOOK_SECRET`
empty, and read configuration/status. Checkout is enabled even though paid events
cannot be verified or placed in the fulfillment outbox. Missing subscription setup
is a related operational risk that checking the secret alone cannot detect.

Recommendation: distinguish catalog readiness from sell readiness; require payment
processing prerequisites for live checkout and add a staging webhook verification
check plus reconciliation/alerts. Do not claim that an HTTP health check validates Shopify.

### P2 — Basket limits disagree with the backend contract

Evidence: [checkout service](../client/src/modules/checkout/services/checkout.service.ts),
lines 19 and 48, accepts quantities through 99; the [quantity input](../client/src/modules/checkout/components/checkout.component.ts),
line 80, also advertises 99. [server/domain.ts](../server/domain.ts), line 13, rejects
quantities over 20 and requests containing more than 20 configurations.

Reproduction: add a design and set quantity to 21; the UI saves it as valid, but checkout
returns 422. The client also permits adding more configurations than the request limit.

Recommendation: introduce shared commerce limits and enforce them at input, service,
restoration and API boundaries. Test 20/21 quantities and 20/21 basket entries. Decide
how to migrate already-saved oversized baskets instead of silently dropping them.

### P2 — Displayed estimates are not reconciled with live catalog prices

Evidence: [checkout rendering](../client/src/modules/checkout/components/checkout.component.ts)
uses the local calculator; [ShopifyService](../client/src/core/shopify/shopify.service.ts)
exposes a quote resource that the checkout view does not execute. Live prices come
from [CommerceService.quoteItems](../server/commerce.mjs), not the prototype constants.

Impact: a Shopify price change or unsupported design is only discovered when the user
continues to checkout. The UI labels totals as estimates, which helps, but does not
show an approved price before redirect. Currency/market selection is also not explicit.

Recommendation: request a typed server quote when the basket changes, invalidate stale
quotes, present the approved currency/total and availability, and require review of a
changed price. Retain server revalidation; never accept a quoted browser total as authority.

### P2 — Retries discard the client's idempotency identity

Evidence: [ShopifyService checkout](../client/src/core/shopify/shopify.service.ts), line 32,
generates a fresh UUID for each execution. [CommerceService.checkout](../server/commerce.mjs)
only deduplicates repeated requests carrying the same owner/key and approved payload.

Impact: after an uncertain network response, retrying can create a second approval/cart
for the same basket rather than retrieve the first one. This is not an automatic duplicate
charge, but it leaves multiple payable checkout sessions and complicates reconciliation.

Recommendation: retain an attempt key per immutable basket snapshot until its outcome
is known; distinguish an intentional new checkout from a transport retry. Add a test
where the first response is lost after server-side success.

### P2 — Most backend implementation is outside TypeScript checking

Evidence: [server/tsconfig.json](../server/tsconfig.json) includes `domain.ts` and shared
TypeScript only. HTTP, SQLite, Shopify and webhook implementations are `.mjs` files.
Vite catches syntax/import failures, and integration tests exercise important flows,
but neither establishes type safety for the backend implementation or provider payloads.

Recommendation: incrementally use typed `.ts` modules or checked JSDoc and runtime
schemas for external payloads. Start with webhook/order shapes and Shopify responses.
Until then, describe the command as a TS-boundary check, not complete backend typechecking.

## Launch gaps (known unfinished integrations)

- Customer authentication and account history/address APIs are not connected;
  `/api/account/*` returns 401. A placeholder client ID is not an OAuth implementation.
- Removing the Admin link is navigation hygiene, not access control. Operator endpoints
  require a server-only bearer key; browser admin sessions/roles are still missing.
- Verified orders enter a SQLite outbox, but supplier dispatch, claim/acknowledgment,
  tracking updates and Shopify fulfillment synchronization are not implemented.
- Test orders and discounted/mismatched orders are intentionally held for review.
  Refunds block jobs conservatively; external manufacturing cannot be undone locally.
- Basket clearing and a verified order-confirmation screen are not connected.
- Database retention, backup/restore drills, missed-webhook reconciliation and production
  monitoring need an operational implementation. The Docker stack is mock development,
  not a production deployment or a scalability claim.

These gaps should remain explicit rather than treating the current prototype as launch-ready.

## Project overview after decoupling

| Project | Responsibilities | Boundary |
| --- | --- | --- |
| `client` / `@keycaps/client` | Component engine, routing, themes/a11y, keyboard canvas/editor, shortcuts, browser persistence, API state | Browser code and assets; no server secrets or imports from server/tests |
| `server` / `@keycaps/server` | HTTP validation, Shopify gateway, checkout approvals/idempotency, webhook verification, SQLite and outbox | Own working directory, env and build; no client or test imports |
| `shared` / `@keycaps/domain` | Design types, palette, geometry, price estimates, validation and pricing-key adapter | DOM-free, no client/server/tests imports; source TypeScript bundled by consumers |
| `tests` / `@keycaps/tests` | Unit, integration, boundary and browser tests; fixtures and isolated local launcher | May import code under test; not imported by applications |

```text
client ─────→ shared ←───── server
   ↑                         ↑
   └──────── tests ──────────┘

Browser communication: client → HTTP /api → server → Shopify
Build/run orchestration: root npm scripts + root Compose + docker/
```

Root npm aliases preserve common commands. Source ownership and build outputs are
separate, while one workspace lockfile keeps dependency versions consistent. The domain
package is not independently published; consumers must compile its TypeScript.
Development image dependencies are shared, but frontend images do not contain backend
application source and API images do not contain frontend source.

## Strengths retained

- Server-owned mapping/pricing authority, active-key filtering and a strict color palette.
- BigInt money comparison, server-generated configuration references and checkout URL allowlist.
- Raw-body HMAC verification, deduplication, transactional order/outbox writes and
  cancellation/refund handling, including out-of-order events.
- Explicit in-memory mock mode with production guards and a fake checkout that never charges.
- Reactive request cancellation/take-latest behavior; defensive browser-storage reads/writes.
- Keyboard controls scoped to the builder with typing/modifier guards, an opt-out toggle,
  native help dialog and desktop/mobile browser coverage.

## Verification and limitations

Completed during the restructuring:

- Workspace checks for client, shared rules and the server TypeScript boundary.
- **7 unit checks and 10 integration checks** passed in Docker, including the new
  import-boundary regression check.
- **14 Playwright tests** passed in isolated Docker client/API/browser containers,
  covering desktop/mobile builder, customization, storage, checkout, keyboard controls
  and route-only Admin navigation.
- The same 14 browser tests passed using the root local E2E command and its automatically
  launched mock stack. Separate client/API builds passed locally.
- The moved SQLite database returned `ok` from a read-only `PRAGMA quick_check`.
- Runtime image inspection confirmed that the API has no client source/tests or private
  `.env`, and the client has no server source or private `.env`. Both dev services are healthy.

The review findings above are based on inspected source paths and concrete triggering
conditions; they are not claimed as fixes or newly added failure tests. No real customer
payment, supplier request, live Shopify contract test or external penetration test was run.

## Recommended order of follow-up

1. Separate live sell-readiness from catalog status and verify webhook operations.
2. Unify shared basket limits and surface server-approved quotes in the UI.
3. Preserve checkout attempt identity across uncertain network responses.
4. Add checked backend contracts and broader negative payload tests.
5. Implement customer/admin authentication and a supplier dispatch lifecycle before launch.
