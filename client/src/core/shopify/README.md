# Shopify integration

Start with the [complete Shopify integration guide](../../../../docs/shopify-integration.md)
for storefront setup, credentials, variant mapping, webhooks and launch requirements.

The browser uses `ShopifyService` from this folder to call the local commerce API.
It exposes availability, catalog, quote and checkout as engine API resources with
signal/computed state. No Shopify credentials are read by the frontend.

The Node API in `server/` validates designs, owns pricing mappings, stores immutable
design approvals, creates hosted checkouts and verifies paid-order webhooks.
See [server setup and endpoint documentation](../../../../server/README.md).

`ShopifyAdapter.pricingKey` in `@keycaps/domain` is shared with server validation. The older public
Storefront provider remains a standalone transport utility, but is not imported
or used by the application. Never wire that utility into custom checkout to bypass
the server's approval flow. `SHOPIFY_*` values in the ignored `server/.env` are
server-only. No `VITE_SHOPIFY_*` configuration is needed.

The basket is retained until confirmed order handling is implemented. Card details,
customer login and shipping entry are handled by Shopify's hosted checkout.
