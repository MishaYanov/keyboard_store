import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CheckoutAttempt } from '../../client/src/core/shopify/checkout-attempt';
import { ShopifyService } from '../../client/src/core/shopify/shopify.service';
import { ClientService } from '../../client/src/modules/client/services/client.service';
import { AdminService } from '../../client/src/modules/admin/services/admin.service';
import { CheckoutService } from '../../client/src/modules/checkout/services/checkout.service';
import { KeyboardDesignService } from '../../client/src/modules/keyboard-builder/services/keyboard-design.service';
import { BuilderController } from '../../client/src/modules/keyboard-builder/services/builder-controller';
import { KEYBOARD_OPTIONS } from '@keycaps/domain/keyboard-options';

test('checkout attempt survives retries and changes only for a new intent', () => {
    let index = 0;
    const attempt = new CheckoutAttempt(() => `key-${++index}`);
    assert.equal(attempt.forPayload('basket-a'), attempt.forPayload('basket-a'));
    assert.equal(attempt.forPayload('basket-b'), 'key-2');
    attempt.reset();
    assert.equal(attempt.forPayload('basket-b'), 'key-3');
});

test('commerce retains request identity on a lost response and rejects malformed success', async () => {
    const original = globalThis.fetch;
    const keys: string[] = [];
    globalThis.fetch = async (_url, init) => {
        keys.push(new Headers(init?.headers).get('Idempotency-Key')!);
        if (keys.length === 1) throw new TypeError('Connection lost');
        return Response.json({ checkoutUrl: 'https://checkout.example.com' });
    };
    try {
        const service = new ShopifyService();
        const items = [{ design: structuredClone(KEYBOARD_OPTIONS.initial), quantity: 1 }];
        await assert.rejects(service.checkout.execute(items), /Connection lost/);
        service.invalidateCheckout();
        await assert.rejects(service.checkout.execute(items));
        assert.equal(keys[0], keys[1]);
        assert.equal(service.checkout.data.get(), null);
        service.restartCheckout();
        await assert.rejects(service.checkout.execute(items));
        assert.notEqual(keys[1], keys[2]);
    } finally { globalThis.fetch = original; }
});

test('live gateways surface outages; demo mode is explicit and makes no requests', async () => {
    const original = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = async () => { requests++; return Response.json({ error: 'Unavailable' }, { status: 503 }); };
    try {
        const account = new ClientService();
        const admin = new AdminService();
        await assert.rejects(account.overview.execute());
        await assert.rejects(admin.dashboard.execute());
        assert.equal(account.overview.status.get(), 'error');
        assert.equal(admin.dashboard.status.get(), 'error');
        assert.equal((await new ClientService('demo').overview.execute())?.source, 'demo');
        assert.equal((await new AdminService('demo').dashboard.execute())?.source, 'demo');
        assert.equal(requests, 2);
        globalThis.fetch = async () => Response.json({ unexpected: true });
        await assert.rejects(account.overview.execute());
        await assert.rejects(admin.dashboard.execute());
    } finally { globalThis.fetch = original; }
});

test('builder coordinates basket and navigation using isolated injected storage', () => {
    const values = new Map<string, unknown>();
    const storage = { read: (key: string) => values.get(key), write: (key: string, value: unknown) => { values.set(key, structuredClone(value)); return true; } };
    const basket = new CheckoutService(storage);
    const design = new KeyboardDesignService(storage);
    let navigations = 0;
    const controller = new BuilderController({ basket, openBasket: () => { navigations++; } }, design);
    design.setSize('60');
    controller.addToBasket(null);
    assert.equal(basket.basket.get()[0]?.design.size, '60');
    assert.equal(navigations, 1);
    design.setSize('75');
    assert.equal(basket.basket.get()[0]?.design.size, '60');
    assert.equal(new CheckoutService(storage).basket.get().length, 1);
});
