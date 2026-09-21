import { createHash, randomUUID } from 'node:crypto';
import { validateItems } from './domain';
import { HttpError, errorMessage } from './errors';
import type { ApiConfig } from './config';
import type { ApprovedItem, CommerceGateway } from './models';
import { DuplicateRequestError, type CommerceRepository } from './repository';

export function amountUnits(value: unknown) {
    if (typeof value !== 'string' || !/^\d{1,12}(\.\d{1,6})?$/.test(value)) throw new Error('Invalid money amount');
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'));
}

export class CommerceService {
    constructor(private readonly config: ApiConfig, private readonly store: CommerceRepository, private readonly gateway: CommerceGateway) {}
    validate(body: unknown) {
        if (!this.config.ready) throw new HttpError(503, 'Checkout is not configured yet.');
        try { return this.config.mock && this.gateway.prepare ? this.gateway.prepare(body) : validateItems(body, this.config.variants); }
        catch (error) { throw new HttpError(422, errorMessage(error)); }
    }
    async quoteItems(items: ApprovedItem[], ip: string) {
        const catalog = await this.gateway.variants([...new Set(items.map(item => item.variantId))], ip);
        const currency = catalog[0]?.price.currencyCode;
        if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new HttpError(502, 'Invalid catalog currency.');
        return items.map(item => {
            const variant = catalog.find(value => value.id === item.variantId);
            if (!variant?.availableForSale) throw new HttpError(422, 'A selected configuration is out of stock.');
            if (variant.price.currencyCode !== currency) throw new HttpError(422, 'Mixed currencies are not supported.');
            amountUnits(variant.price.amount);
            return { ...item, price: variant.price, title: variant.product.title };
        });
    }
    async quote(body: unknown, ip: string) {
        const items = await this.quoteItems(this.validate(body), ip);
        return { currency: items[0]!.price.currencyCode, items: items.map(({ pricingKey, quantity, price, title }) => ({ pricingKey, quantity, price, title })) };
    }
    async checkout(body: unknown, owner: string, key: unknown, ip: string) {
        if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new HttpError(400, 'A valid Idempotency-Key header is required.');
        const items = this.validate(body);
        const fingerprint = createHash('sha256').update(JSON.stringify(items)).digest('hex');
        const prior = await this.store.findRequest(owner, key);
        if (prior) {
            if (prior.fingerprint !== fingerprint) throw new HttpError(409, 'This request key belongs to a different basket.');
            if (prior.order_id) throw new HttpError(409, 'This checkout already has a paid order.');
            if (prior.state === 'ready' && prior.result && Date.now() - prior.created_at < 15 * 60_000) return prior.result;
            throw new HttpError(409, 'This checkout request is pending, expired or failed. Use a new request key to retry.');
        }
        // The unique owner/request constraint claims idempotency before contacting Shopify.
        const id = randomUUID();
        try { await this.store.insertCheckout({ id, owner, key, fingerprint, specification: [] }); }
        catch (error) { if (error instanceof DuplicateRequestError) throw new HttpError(409, 'This checkout request is already being processed.'); throw error; }
        try {
            const specification = (await this.quoteItems(items, ip)).map(item => ({ ...item, id: randomUUID() }));
            await this.store.setSpecification(id, specification);
            const lines = specification.map(item => ({ merchandiseId: item.variantId, quantity: item.quantity, attributes: [
                { key: '_checkout_id', value: id }, { key: '_line_id', value: item.id },
            ] }));
            const cart = await this.gateway.createCart(lines, id, ip);
            const expected = specification.reduce((sum, item) => sum + amountUnits(item.price.amount) * BigInt(item.quantity), 0n);
            if (cart.cost.subtotalAmount.currencyCode !== specification[0]!.price.currencyCode
                || amountUnits(cart.cost.subtotalAmount.amount) !== expected) throw new HttpError(409, 'The price changed while preparing checkout. Please request a new quote.');
            const result = { checkoutUrl: cart.checkoutUrl, cost: cart.cost, configurationIds: specification.map(item => item.id) };
            await this.store.finishCheckout(id, result);
            return result;
        } catch (error) { await this.store.failCheckout(id); throw error; }
    }
}
