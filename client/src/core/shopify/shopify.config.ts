import type { ShopifyConfig } from '@keycaps/domain/shopify.types';

export function readShopifyConfig(env: Record<string, unknown>): ShopifyConfig {
    let variantMap: Record<string, string> = {};
    try {
        const parsed: unknown = JSON.parse(String(env.VITE_SHOPIFY_VARIANT_MAP ?? '{}'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.values(parsed).every(value => typeof value === 'string')) {
            variantMap = parsed as Record<string, string>;
        }
    } catch { /* Unconfigured mappings are rejected before any cart mutation. */ }
    return {
        domain: String(env.VITE_SHOPIFY_STORE_DOMAIN ?? ''),
        publicToken: String(env.VITE_SHOPIFY_STOREFRONT_PUBLIC_TOKEN ?? ''),
        apiVersion: String(env.VITE_SHOPIFY_API_VERSION ?? '2026-07'),
        checkoutDomain: String(env.VITE_SHOPIFY_CHECKOUT_DOMAIN ?? env.VITE_SHOPIFY_STORE_DOMAIN ?? ''),
        variantMap,
    };
}

export function isShopifyConfigured(config: ShopifyConfig): boolean {
    return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(config.domain)
        && !!config.publicToken && !/mock-KEY/i.test(config.domain + config.publicToken)
        && /^\d{4}-(01|04|07|10)$/.test(config.apiVersion);
}

export function validateCheckoutUrl(value: string, config: ShopifyConfig): string {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
        || ![config.domain, config.checkoutDomain].includes(url.hostname)) {
        throw new Error('Shopify returned an unexpected checkout address.');
    }
    return url.href;
}
