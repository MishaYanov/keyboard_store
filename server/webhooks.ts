import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { z } from 'zod';
import { configured, type ApiConfig } from './config';
import { HttpError, errorMessage } from './errors';
import { amountUnits } from './commerce';
import { paidOrderSchema, type WebhookResult, type FulfillmentPayload } from './models';
import type { CommerceRepository } from './repository';

export function verifyWebhook(raw: Buffer, signature: unknown, secret: string) {
    if (!configured(secret) || typeof signature !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
    const supplied = Buffer.from(signature, 'base64');
    const expected = createHmac('sha256', secret).update(raw).digest();
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export async function handleWebhook(config: ApiConfig, store: CommerceRepository, raw: Buffer, headers: IncomingHttpHeaders): Promise<WebhookResult> {
    if (!configured(config.webhookSecret)) throw new HttpError(503, 'Webhook receiver is not configured.');
    if (!verifyWebhook(raw, headers['x-shopify-hmac-sha256'], config.webhookSecret)) throw new HttpError(401, 'Invalid webhook signature.');
    if (headers['x-shopify-shop-domain'] !== config.domain) throw new HttpError(403, 'Unexpected Shopify store.');
    const topic = headers['x-shopify-topic'];
    if (typeof topic !== 'string' || !['orders/paid', 'orders/cancelled', 'refunds/create'].includes(topic)) throw new HttpError(400, 'Unsupported webhook topic.');
    const eventId = headers['x-shopify-webhook-id'];
    if (typeof eventId !== 'string' || !/^[\w-]{1,100}$/.test(eventId)) throw new HttpError(400, 'Missing webhook delivery ID.');
    let rawPayload: unknown;
    try { rawPayload = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Invalid webhook JSON.'); }
    const identity = z.object({ id: z.number().int().positive().safe().optional(), order_id: z.number().int().positive().safe().optional() }).safeParse(rawPayload);
    const numericId = identity.success ? topic === 'refunds/create' ? identity.data.order_id : identity.data.id : undefined;
    if (!numericId) throw new HttpError(400, 'Invalid Shopify order ID.');
    const orderId = String(numericId);
    return store.transaction(async tx => {
        if (await tx.hasEvent(eventId)) return { received: true, duplicate: true };
        await tx.insertEvent(eventId);
        if (topic !== 'orders/paid') {
            await tx.blockOrder(orderId, topic);
            return { received: true };
        }
        if (await tx.order(orderId)) return { received: true, duplicate: true };
        const parsed = paidOrderSchema.safeParse(rawPayload);
        const payload = parsed.success ? parsed.data : null;
        // Preserve correlation even when unrelated paid-order fields fail validation.
        const correlation = z.object({ note_attributes: z.array(z.object({ name: z.string(), value: z.string() })).optional() }).safeParse(rawPayload);
        const checkoutId = correlation.success ? correlation.data.note_attributes?.find(attr => attr.name === '_checkout_id')?.value : undefined;
        const checkout = checkoutId ? await tx.checkout(checkoutId) : null;
        let reason: string | null = null;
        let fulfillment: FulfillmentPayload | null = null;
        try {
            if (!payload) throw new Error(`Malformed or unpaid Shopify order: ${parsed.success ? 'invalid payload' : parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.code}`).join('; ').slice(0, 500)}`);
            if (!checkout || checkout.state !== 'ready' || checkout.order_id) throw new Error('Unknown, incomplete or already-used checkout');
            if (payload.cancelled_at || payload.test === true) throw new Error('Order is not an eligible live paid order');
            const specification = checkout.specification;
            if (payload.line_items.length !== specification.length || !specification.length) throw new Error('Order lines differ from the approved configuration');
            const seen = new Set<string>();
            for (const line of payload.line_items) {
                const lineId = line.properties.find(attr => attr.name === '_line_id')?.value;
                const lineCheckout = line.properties.find(attr => attr.name === '_checkout_id')?.value;
                const approved = specification.find(item => item.id === lineId);
                if (!lineId || !approved || seen.has(lineId) || lineCheckout !== checkoutId
                    || approved.variantId !== `gid://shopify/ProductVariant/${line.variant_id}` || approved.quantity !== line.quantity
                    || payload.currency !== approved.price.currencyCode || amountUnits(line.price) !== amountUnits(approved.price.amount))
                    throw new Error('Paid variant, configuration, quantity or price does not match approval');
                if (line.discount_allocations?.some(allocation => amountUnits(allocation.amount) > 0n)) throw new Error('Discounted custom order requires review');
                seen.add(lineId);
            }
            const address = payload.shipping_address;
            fulfillment = { orderId, configurations: specification, shipping: {
                name: address.name, address1: address.address1, address2: address.address2 || '', city: address.city,
                province: address.province || '', zip: address.zip || '', countryCode: address.country_code,
            } };
        } catch (error) { reason = errorMessage(error); }
        const state = reason ? 'review' : 'ready';
        await tx.insertOrder({ id: orderId, checkout_id: checkout?.id ?? null, status: state, reason, created_at: Date.now() });
        if (!reason && checkout && fulfillment) {
            await tx.claimCheckout(checkout.id, orderId);
            const id = randomUUID();
            await tx.insertJob({ id, order_id: orderId, state: 'ready', payload: fulfillment, created_at: Date.now() });
        }
        return { received: true, status: state };
    });
}
