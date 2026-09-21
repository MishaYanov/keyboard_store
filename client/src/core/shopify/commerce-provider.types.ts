import type { ShopifyCart, ShopifyCartResult, ShopifyLineInput, ShopifyProduct } from '@keycaps/domain/shopify.types';

/** Legacy browser transport interface, not part of the platform-neutral business rules. */
export interface CommerceProvider {
    products(signal?: AbortSignal): Promise<ShopifyProduct[]>;
    getCart(id: string, signal?: AbortSignal): Promise<ShopifyCart | null>;
    createCart(lines: ShopifyLineInput[], signal?: AbortSignal): Promise<ShopifyCartResult>;
    addLines(id: string, lines: ShopifyLineInput[], signal?: AbortSignal): Promise<ShopifyCartResult>;
    updateLines(id: string, lines: Array<{ id: string; quantity: number }>, signal?: AbortSignal): Promise<ShopifyCartResult>;
    removeLines(id: string, lineIds: string[], signal?: AbortSignal): Promise<ShopifyCartResult>;
}
