import { computed, createApiRequest, requestJson, ApiResponseError } from '../../engine';
import type { ConfigurationItem } from '@keycaps/domain/shopify.adapter';
import type { ShopifyMoney } from '@keycaps/domain/shopify.types';

export interface CheckoutSession {
    checkoutUrl: string;
    cost: { subtotalAmount: ShopifyMoney; totalAmount: ShopifyMoney };
    configurationIds: string[];
}
async function api<T>(url: string, init: RequestInit): Promise<T> {
    try { return await requestJson<T>(url, init); }
    catch (error) {
        if (error instanceof ApiResponseError && error.body && typeof error.body === 'object'
            && 'error' in error.body && typeof error.body.error === 'string') throw new Error(error.body.error);
        throw error;
    }
}

/** Browser-facing adapter. Shopify credentials and price mappings live on the API server. */
export class ShopifyService {
    public readonly availability = createApiRequest(async (_, { signal }) =>
        api<{ configured: boolean; mock?: boolean }>('/api/commerce/status', { signal }));
    public readonly configured = computed(() => this.availability.data.get()?.configured === true);
    public readonly catalog = createApiRequest(async (_, { signal }) =>
        api<{ variants: Array<{ id: string; title: string; price: ShopifyMoney; availableForSale: boolean }> }>('/api/commerce/catalog', { signal }));
    public readonly quote = createApiRequest<unknown, readonly ConfigurationItem[]>(async (items, { signal }) =>
        api('/api/commerce/quote', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map(({ design, quantity }) => ({ design, quantity })) }) }));
    public readonly checkout = createApiRequest<CheckoutSession, readonly ConfigurationItem[]>(async (items, { signal }) => {
        const result = await api<CheckoutSession>('/api/commerce/checkout', {
            method: 'POST', signal,
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({ items: items.map(({ design, quantity }) => ({ design, quantity })) }),
        });
        this.validateUrl(result.checkoutUrl);
        return result;
    });
    public readonly total = computed(() => {
        const money = this.checkout.data.get()?.cost.totalAmount;
        return money ? new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currencyCode }).format(Number(money.amount)) : null;
    });
    private validateUrl(value: string): string {
        const url = new URL(value);
        // The server enforces the store-specific hostname allowlist.
        const localMock = import.meta.env.DEV && this.availability.data.get()?.mock === true
            && url.origin === window.location.origin && /^\/api\/mock\/checkout\/[a-f0-9-]{36}$/.test(url.pathname);
        if ((!localMock && url.protocol !== 'https:') || url.username || url.password) throw new Error('Invalid secure checkout address.');
        return url.href;
    }
    public invalidateCheckout(): void { this.checkout.reset(); }
    public checkoutUrl(): string | null {
        const result = this.checkout.data.get();
        return result ? this.validateUrl(result.checkoutUrl) : null;
    }
}
export const shopifyService = new ShopifyService();
