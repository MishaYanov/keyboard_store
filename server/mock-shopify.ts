import { createHash, createHmac } from 'node:crypto';
import { validateItems } from './domain';
import { CalculatorService } from '@keycaps/domain/calculator.service';
import { handleWebhook } from './webhooks';
import { HttpError } from './errors';
import type { ApiConfig } from './config';
import type { CommerceGateway, Variant, CartLine } from './models';
import type { CommerceRepository } from './repository';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Development-only provider: no network calls, credentials, payments or supplier dispatch. */
export class MockShopifyGateway implements CommerceGateway {
    private readonly catalog = new Map<string, Variant>();
    constructor(private readonly config: ApiConfig) {
        if (!config.mock || config.production && !config.staging) throw new Error('Mock commerce requires development or explicit staging mock mode');
    }
    prepare(body: unknown) {
        const variants = new Proxy<Record<string, string>>({}, { get: (_, key) => `gid://shopify/ProductVariant/${BigInt('0x' + createHash('sha256').update(String(key)).digest('hex').slice(0, 12))}` });
        const items = validateItems(body, variants);
        const calculator = new CalculatorService();
        for (const item of items) this.catalog.set(item.variantId, {
            id: item.variantId, title: item.pricingKey, product: { title: 'MOCK custom keyboard' }, availableForSale: true,
            price: { amount: (calculator.calculate(item.design).totalCents / 100).toFixed(2), currencyCode: 'USD' },
        });
        return items;
    }
    async variants(ids: string[]) { return ids.map(id => this.catalog.get(id)).filter((item): item is Variant => Boolean(item)); }
    async createCart(lines: CartLine[], id: string) {
        const cents = lines.reduce((sum, line) => sum + Math.round(Number(this.catalog.get(line.merchandiseId)!.price.amount) * 100) * line.quantity, 0);
        const money = { amount: (cents / 100).toFixed(2), currencyCode: 'USD' };
        return { checkoutUrl: `${this.config.origin}/api/mock/checkout/${id}`, cost: { subtotalAmount: money, totalAmount: money } };
    }
}

export async function mockCheckout(req: IncomingMessage, res: ServerResponse, config: ApiConfig, store: CommerceRepository, id: string) {
    const cookieName = config.secureCookies ? '__Host-commerce=' : 'commerce=';
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName))?.slice(cookieName.length) || '';
    const checkout = await store.checkout(id);
    if (!checkout || checkout.owner !== createHash('sha256').update(cookie).digest('hex') || checkout.state !== 'ready') throw new HttpError(404, 'Mock checkout not found.');
    let completed = Boolean(checkout.order_id);
    if (req.method === 'POST' && !completed) {
        if (req.headers.origin !== config.origin) throw new HttpError(403, 'A same-origin request is required.');
        const items = checkout.specification;
        const raw = Buffer.from(JSON.stringify({
            id: Number(BigInt('0x' + createHash('sha256').update(id).digest('hex').slice(0, 12))),
            financial_status: 'paid', currency: 'USD', test: false,
            note_attributes: [{ name: '_checkout_id', value: id }],
            shipping_address: { name: 'Test customer', address1: '1 Test Street', country_code: 'US', city: 'Test City', zip: '00000' },
            line_items: items.map(item => ({ variant_id: Number(item.variantId.split('/').at(-1)), quantity: item.quantity, price: item.price.amount,
                properties: [{ name: '_checkout_id', value: id }, { name: '_line_id', value: item.id }], discount_allocations: [] })),
        }));
        // Exercise real verification/outbox code with synthetic events in the isolated mock database.
        const result = await handleWebhook(config, store, raw, { 'x-shopify-hmac-sha256': createHmac('sha256', config.webhookSecret).update(raw).digest('base64'),
            'x-shopify-shop-domain': config.domain, 'x-shopify-topic': 'orders/paid', 'x-shopify-webhook-id': `mock-${id}` });
        if (result.status !== 'ready' && !(result.duplicate && (await store.checkout(id))?.order_id)) throw new HttpError(500, 'Mock order verification failed.');
        completed = true;
    }
    if (!checkout.result) throw new HttpError(500, 'Missing mock checkout result');
    const cost = checkout.result.cost.totalAmount;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' });
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mock checkout</title><body>
        <h1>Mock checkout — no real payment</h1><p>No payment details are collected. No product will be shipped.</p>
        <p>Total: $${Number(cost.amount).toFixed(2)} USD (mock shipping/tax: $0)</p>
        ${completed ? '<h2>Test order completed</h2><p>Verified order queued in the mock fulfillment outbox.</p>' : '<form method="post"><button>Complete test order</button></form>'}
        <a href="/#/builder">Return to builder</a></body></html>`);
}
