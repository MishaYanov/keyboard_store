export interface ShopifyConfig {
    readonly domain: string;
    readonly publicToken: string;
    readonly apiVersion: string;
    readonly checkoutDomain: string;
    readonly variantMap: Readonly<Record<string, string>>;
}

export interface ShopifyMoney { amount: string; currencyCode: string }
export interface ShopifyAttribute { key: string; value: string }
export interface ShopifyLineInput {
    merchandiseId: string;
    quantity: number;
    attributes: ShopifyAttribute[];
}
export interface ShopifyCart {
    id: string;
    checkoutUrl: string;
    totalQuantity: number;
    cost: { subtotalAmount: ShopifyMoney; totalAmount: ShopifyMoney };
    lines: { nodes: Array<{
        id: string;
        quantity: number;
        attributes: ShopifyAttribute[];
        merchandise: { id: string };
    }>; pageInfo: { hasNextPage: boolean } };
}
export interface ShopifyProduct {
    id: string;
    handle: string;
    title: string;
    variants: { nodes: Array<{ id: string; title: string; availableForSale: boolean; price: ShopifyMoney }> };
}
export interface ShopifyCartResult {
    cart: ShopifyCart;
    warnings: Array<{ code: string; message: string }>;
}
