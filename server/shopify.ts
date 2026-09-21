import { HttpError } from './errors';
import { z } from 'zod';
import type { ApiConfig } from './config';
import { cartSchema, variantSchema, type CartLine, type CommerceGateway } from './models';

export class ShopifyGateway implements CommerceGateway {
    constructor(private readonly config: ApiConfig, private readonly transport: typeof fetch = fetch) {}
    async query(query: string, variables: Record<string, unknown>, buyerIp: string): Promise<unknown> {
        if (!this.config.ready) throw new HttpError(503, 'Checkout is not configured yet.');
        let response;
        try {
            response = await this.transport(`https://${this.config.domain}/api/${this.config.apiVersion}/graphql.json`, {
                method: 'POST', signal: AbortSignal.timeout(12000),
                headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': this.config.token,
                    'Shopify-Storefront-Buyer-IP': buyerIp },
                body: JSON.stringify({ query, variables }),
            });
        } catch { throw new HttpError(502, 'Shopify could not be reached. Please try again.'); }
        if (!response.ok) throw new HttpError(502, 'Shopify is temporarily unavailable.');
        let envelope;
        try { envelope = z.object({ data: z.unknown(), errors: z.array(z.unknown()).optional() }).parse(await response.json()); } catch { throw new HttpError(502, 'Invalid Shopify response.'); }
        if (envelope.errors?.length || !envelope.data) throw new HttpError(502, 'Shopify could not process this request.');
        return envelope.data;
    }
    async variants(ids: string[], ip: string) {
        const raw = await this.query(`query($ids:[ID!]!){ nodes(ids:$ids){ ... on ProductVariant {
            id title availableForSale price { amount currencyCode } product { title }
        } } }`, { ids }, ip);
        const result = z.object({ nodes: z.array(variantSchema) }).safeParse(raw);
        if (!result.success || result.data.nodes.length !== ids.length || !ids.every(id => result.data.nodes.some(node => node.id === id))) {
            throw new HttpError(422, 'One or more configurations are no longer available.');
        }
        return result.data.nodes;
    }
    async createCart(lines: CartLine[], checkoutId: string, ip: string) {
        const raw = await this.query(`mutation($input:CartInput!){ cartCreate(input:$input){
            cart { id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
                lines(first:250){ nodes { quantity attributes {key value} merchandise { ... on ProductVariant { id } } } pageInfo {hasNextPage} } }
            userErrors { message } warnings { message }
        } }`, { input: { lines, attributes: [{ key: '_checkout_id', value: checkoutId }] } }, ip);
        const result = z.object({ cartCreate: z.object({ cart: cartSchema.nullable(), userErrors: z.array(z.unknown()).optional(), warnings: z.array(z.unknown()).optional() }) }).safeParse(raw);
        if (!result.success) throw new HttpError(502, 'Invalid Shopify cart response.');
        const payload = result.data.cartCreate;
        if (!payload.cart || payload.userErrors?.length || payload.warnings?.length) throw new HttpError(422, 'Shopify could not reserve the requested configurations and quantities.');
        const cart = payload.cart;
        if (cart.lines.pageInfo.hasNextPage || cart.lines.nodes.length !== lines.length || !lines.every(line =>
            cart.lines.nodes.some(actual => actual.quantity === line.quantity && actual.merchandise.id === line.merchandiseId
                && line.attributes.every(attr => actual.attributes.some(a => a.key === attr.key && a.value === attr.value))))) {
            throw new HttpError(422, 'The Shopify cart differs from your requested design. Please try again.');
        }
        this.checkoutUrl(cart.checkoutUrl);
        return cart;
    }
    checkoutUrl(value: string) {
        let url;
        try { url = new URL(value); } catch { throw new HttpError(502, 'Invalid checkout URL.'); }
        if (url.protocol !== 'https:' || url.port || url.username || url.password
            || ![this.config.domain, this.config.checkoutDomain].includes(url.hostname)) throw new HttpError(502, 'Invalid checkout URL.');
        return url.href;
    }
}
