import { z } from 'zod';
import type { validateItems } from './domain';

export type ApprovedItem = ReturnType<typeof validateItems>[number];
export const moneySchema = z.object({ amount: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/), currencyCode: z.string().regex(/^[A-Z]{3}$/) });
export type Money = z.infer<typeof moneySchema>;
export const variantSchema = z.object({ id: z.string(), title: z.string(), availableForSale: z.boolean(), price: moneySchema, product: z.object({ title: z.string() }) });
export type Variant = z.infer<typeof variantSchema>;
export const attributeSchema = z.object({ key: z.string(), value: z.string() });
export const cartSchema = z.object({
    checkoutUrl: z.string(), cost: z.object({ subtotalAmount: moneySchema, totalAmount: moneySchema }),
    lines: z.object({ pageInfo: z.object({ hasNextPage: z.boolean() }), nodes: z.array(z.object({
        quantity: z.number().int().positive(), merchandise: z.object({ id: z.string() }), attributes: z.array(attributeSchema),
    })) }),
});
export type Cart = Pick<z.infer<typeof cartSchema>, 'checkoutUrl' | 'cost'>;
export interface CartLine { merchandiseId: string; quantity: number; attributes: z.infer<typeof attributeSchema>[] }
export interface CommerceGateway {
    prepare?(body: unknown): ApprovedItem[];
    variants(ids: string[], ip: string): Promise<Variant[]>;
    createCart(lines: CartLine[], checkoutId: string, ip: string): Promise<Cart>;
}
export interface Specification extends ApprovedItem { id: string; price: Money; title: string }
export interface CheckoutResult extends Cart { configurationIds: string[] }
export interface CheckoutRecord {
    id: string; owner: string; request_key: string; fingerprint: string;
    state: 'pending' | 'ready' | 'failed'; specification: Specification[];
    result?: CheckoutResult; created_at: number; order_id?: string;
}
export type OrderState = 'ready' | 'review' | 'blocked';
export interface OrderRecord { id: string; checkout_id: string | null; status: OrderState; reason: string | null; created_at: number }
export interface FulfillmentPayload {
    orderId: string; configurations: Specification[];
    shipping: { name: string; address1: string; address2: string; city: string; province: string; zip: string; countryCode: string };
}
export interface FulfillmentJob { id: string; order_id: string; state: 'ready' | 'blocked'; payload: FulfillmentPayload; created_at: number }
export interface WebhookResult { received: true; duplicate?: boolean; status?: OrderState }

const property = z.object({ name: z.string(), value: z.string() });
export const paidOrderSchema = z.object({
    id: z.number().int().positive().safe(), financial_status: z.literal('paid'), currency: z.string(),
    test: z.boolean().optional(), cancelled_at: z.unknown().optional(),
    note_attributes: z.array(property),
    line_items: z.array(z.object({ variant_id: z.number().int().positive().safe(), quantity: z.number().int().positive(),
        price: moneySchema.shape.amount, properties: z.array(property),
        discount_allocations: z.array(z.object({ amount: moneySchema.shape.amount })).optional(),
    })),
    shipping_address: z.object({ name: z.string().default(''), address1: z.string().min(1), address2: z.string().nullish(),
        city: z.string().default(''), province: z.string().nullish(), zip: z.string().nullish(), country_code: z.string().min(1) }),
});
