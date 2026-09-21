import { requestJson } from '../../engine/api/api-request';
import { isShopifyConfigured } from './shopify.config';
import type { CommerceProvider } from './commerce-provider.types';
import type { ShopifyCart, ShopifyCartResult, ShopifyConfig, ShopifyLineInput, ShopifyProduct } from '@keycaps/domain/shopify.types';

const CART = `id checkoutUrl totalQuantity
    cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
    lines(first: 250) { nodes { id quantity attributes { key value } merchandise { ... on ProductVariant { id } } } pageInfo { hasNextPage } }`;
const RESULT = `cart { ${CART} } userErrors { field message code } warnings { code message }`;
interface Envelope<T> { data?: T; errors?: Array<{ message: string }> }
interface MutationResult { cart: ShopifyCart | null; userErrors: Array<{ message: string }>; warnings: ShopifyCartResult['warnings'] }

/** Public Storefront transport. Never accepts an Admin or private token. */
export class ShopifyProvider implements CommerceProvider {
    public constructor(private readonly config: ShopifyConfig) {}

    private async query<T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
        if (!isShopifyConfigured(this.config)) throw new Error('Checkout is not available yet. Please try again later.');
        const response = await requestJson<Envelope<T>>(`https://${this.config.domain}/api/${this.config.apiVersion}/graphql.json`, {
            method: 'POST', credentials: 'omit',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': this.config.publicToken },
            body: JSON.stringify({ query, variables }),
            ...(signal ? { signal } : {}),
        });
        if (response.errors?.length) throw new Error(response.errors.map(error => error.message).join('; '));
        if (!response.data) throw new Error('Shopify returned no data.');
        return response.data;
    }

    public async products(signal?: AbortSignal): Promise<ShopifyProduct[]> {
        const result = await this.query<{ products: { nodes: ShopifyProduct[] } }>(`query {
            products(first: 100) { nodes { id handle title variants(first: 100) { nodes { id title availableForSale price { amount currencyCode } } } } }
        }`, {}, signal);
        return result.products.nodes;
    }

    public async getCart(id: string, signal?: AbortSignal): Promise<ShopifyCart | null> {
        const result = await this.query<{ cart: ShopifyCart | null }>(`query($id: ID!) { cart(id: $id) { ${CART} } }`, { id }, signal);
        return result.cart;
    }

    private async mutate(name: string, query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<ShopifyCartResult> {
        const response = await this.query<Record<string, MutationResult>>(query, variables, signal);
        const result = response[name];
        if (!result) throw new Error('Shopify returned an invalid cart response.');
        if (result.userErrors.length) throw new Error(result.userErrors.map(error => error.message).join('; '));
        if (!result.cart) throw new Error('Shopify could not create or update the cart.');
        return { cart: result.cart, warnings: result.warnings };
    }

    public createCart(lines: ShopifyLineInput[], signal?: AbortSignal): Promise<ShopifyCartResult> {
        return this.mutate('cartCreate', `mutation($input: CartInput!) { cartCreate(input: $input) { ${RESULT} } }`, { input: { lines } }, signal);
    }
    public addLines(id: string, lines: ShopifyLineInput[], signal?: AbortSignal): Promise<ShopifyCartResult> {
        return this.mutate('cartLinesAdd', `mutation($id: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $id, lines: $lines) { ${RESULT} } }`, { id, lines }, signal);
    }
    public updateLines(id: string, lines: Array<{ id: string; quantity: number }>, signal?: AbortSignal): Promise<ShopifyCartResult> {
        return this.mutate('cartLinesUpdate', `mutation($id: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $id, lines: $lines) { ${RESULT} } }`, { id, lines }, signal);
    }
    public removeLines(id: string, lineIds: string[], signal?: AbortSignal): Promise<ShopifyCartResult> {
        return this.mutate('cartLinesRemove', `mutation($id: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $id, lineIds: $lineIds) { ${RESULT} } }`, { id, lineIds }, signal);
    }
}
