import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { isolatedStore, closeServer, findRow, countRows, removeTestDatabase, testDatabase } from './sqlite-fixture.mjs';
import { createApiServer, readConfig, CommerceStore, ShopifyGateway } from '../../server/dist/app.js';

const design = { size: '100', physical: 'ansi', letterLayout: 'qwerty', languages: ['en'], primaryCorner: 'top-left', presetId: 'classic', customColorMode: 2,
    customColors: { letters: '#e8e2d6', actions: '#6f7378', accent: '#b94a48' }, keyColors: {}, keyLegends: {} };
const body = () => ({ items: [{ design: structuredClone(design), quantity: 1 }], total: 1, variantId: 'untrusted' });
const money = { amount: '130.00', currencyCode: 'USD' };
const secret = 'test-webhook-secret';

async function fixture(t, options = {}) {
    const config = readConfig({ APP_ORIGIN: 'http://localhost:5173', SHOPIFY_STORE_DOMAIN: 'fixture.myshopify.com',
        SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-private-secret', SHOPIFY_WEBHOOK_SECRET: secret,
        SHOPIFY_VARIANT_MAP: '{"100:ansi:classic:0:1:0:0":"gid://shopify/ProductVariant/123"}',
        API_ADMIN_KEY: 'test-admin-key-with-at-least-32-characters', ...options.env });
    let server;
    const store = await isolatedStore(t, async () => {
        if (!server) return;
        if (server.listening) await closeServer(server);
        await server.drainRequests();
    });
    const calls = [];
    const gateway = new ShopifyGateway(config, async (url, init) => {
        const request = JSON.parse(init.body);
        calls.push({ ...request, headers: init.headers, url });
        if (request.query.startsWith('query')) return Response.json({ data: { nodes: [{ id: 'gid://shopify/ProductVariant/123', title: 'Full size', product: { title: 'Custom keyboard' }, availableForSale: true, price: money }] } });
        if (options.delay) await options.delay;
        const input = request.variables.input;
        const cart = { id: 'gid://shopify/Cart/test?key=private', checkoutUrl: options.checkoutUrl || 'https://fixture.myshopify.com/checkouts/test', totalQuantity: 1,
            cost: { subtotalAmount: money, totalAmount: money }, lines: { pageInfo: { hasNextPage: false }, nodes: input.lines.map(line => ({ quantity: line.quantity,
                merchandise: { id: line.merchandiseId }, attributes: line.attributes })) } };
        return Response.json({ data: { cartCreate: { cart, userErrors: [], warnings: options.warnings || [] } } });
    });
    server = createApiServer({ config, store, gateway });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (path, value, headers = {}) => fetch(base + path, { method: 'POST', headers: {
        Origin: config.origin, 'Content-Type': 'application/json', Cookie: `commerce=${'a'.repeat(64)}`,
        'Idempotency-Key': 'test-request-00000001', ...headers,
    }, body: typeof value === 'string' ? value : JSON.stringify(value) });
    const signedWebhook = (raw, id = 'delivery-1', topic = 'orders/paid', signature) => {
        return post('/api/webhooks/shopify', raw, {
            'x-shopify-hmac-sha256': signature ?? createHmac('sha256', secret).update(raw).digest('base64'),
            'x-shopify-webhook-id': id, 'x-shopify-shop-domain': config.domain, 'x-shopify-topic': topic,
        });
    };
    const webhook = (payload, ...args) => signedWebhook(JSON.stringify(payload), ...args);
    const paid = async () => {
        const checkout = await findRow(store.db, 'checkouts', {});
        const spec = checkout.specification[0];
        return { id: 456, financial_status: 'paid', currency: 'USD', test: false,
            note_attributes: [{ name: '_checkout_id', value: checkout.id }],
            shipping_address: { name: 'Test Recipient', address1: 'Test address', country_code: 'US', city: 'Test', zip: '00000' },
            line_items: [{ variant_id: 123, quantity: 1, price: '130.00', discount_allocations: [], properties: [
                { name: '_checkout_id', value: checkout.id }, { name: '_line_id', value: spec.id },
            ] }] };
    };
    return { config, store, server, calls, base, post, webhook, signedWebhook, paid };
}

test('shutdown drains disconnected checkout handlers before persistence completes', async t => {
    let release;
    const delay = new Promise(resolve => { release = resolve; });
    const f = await fixture(t, { delay });
    const request = httpRequest(f.base + '/api/commerce/checkout', { method: 'POST', headers: {
        Origin: f.config.origin, 'Content-Type': 'application/json',
        Cookie: `commerce=${'a'.repeat(64)}`, 'Idempotency-Key': 'disconnect-request-0001',
    } });
    request.on('error', () => {}); // Destroying the client intentionally causes a socket hang-up.
    request.end(JSON.stringify(body()));
    let drain;
    try {
        const deadline = Date.now() + 5000;
        while (f.calls.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.calls.length, 2, 'checkout reaches the delayed cart request');
        const disconnected = new Promise(resolve => request.once('close', resolve));
        request.destroy();
        await disconnected;
        await closeServer(f.server);

        let drained = false;
        drain = f.server.drainRequests().then(() => { drained = true; });
        await new Promise(resolve => setTimeout(resolve, 25));
        assert.equal(drained, false, 'closing the socket must not finish draining the active handler');
        assert.equal((await findRow(f.store.db, 'checkouts', {})).state, 'pending');

        release();
        await drain;
        const checkout = await findRow(f.store.db, 'checkouts', {});
        assert.equal(checkout.state, 'ready');
        assert.equal(checkout.result.checkoutUrl, 'https://fixture.myshopify.com/checkouts/test');
        assert.equal(await countRows(f.store.db, 'checkouts', {}), 1);
    } finally {
        request.destroy();
        release();
        await (drain || f.server.drainRequests());
    }
});

test('paid webhook missing shipping address retains its checkout link for review', async t => {
    const f = await fixture(t);
    assert.equal((await f.post('/api/commerce/checkout', body())).status, 200);
    const payload = await f.paid();
    const checkoutId = payload.note_attributes.find(attribute => attribute.name === '_checkout_id').value;
    delete payload.shipping_address;
    const response = await f.webhook(payload, 'missing-shipping');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'review');
    const order = await findRow(f.store.db, 'orders', { id: String(payload.id) });
    assert.equal(order.status, 'review');
    assert.equal(order.checkout_id, checkoutId);
    assert.ok(order.reason);
    assert.equal(await countRows(f.store.db, 'fulfillment_jobs', {}), 0);
    assert.equal((await f.store.checkout(checkoutId)).order_id, undefined);
});

test('repository transaction rolls back event and order writes after an injected failure', async t => {
    const store = await isolatedStore(t);
    const eventId = 'rollback-delivery';
    const order = { id: '456', checkout_id: null, status: 'review',
        reason: 'Rollback fixture', created_at: Date.now() };
    const failure = new Error('Injected failure after both writes');
    await assert.rejects(store.transaction(async tx => {
        await tx.insertEvent(eventId);
        await tx.insertOrder(order);
        assert.equal(await tx.hasEvent(eventId), true);
        assert.deepEqual(await tx.order(order.id), order);
        throw failure;
    }), error => error === failure);
    assert.equal(await countRows(store.db, 'webhook_events', {}), 0);
    assert.equal(await countRows(store.db, 'orders', {}), 0);

    // The same identities can be committed after rollback, with no stale deduplication record.
    await store.transaction(async tx => {
        await tx.insertEvent(eventId);
        await tx.insertOrder(order);
    });
    assert.equal(await countRows(store.db, 'webhook_events', { id: eventId }), 1);
    assert.deepEqual(await findRow(store.db, 'orders', { id: order.id }), order);
});

test('health returns 503 when SQLite ping fails and recovers after restoration', async t => {
    const f = await fixture(t);
    assert.equal((await fetch(f.base + '/api/health')).status, 200);
    const ping = f.store.ping;
    let calls = 0;
    f.store.ping = async () => { calls++; throw new Error('Injected SQLite ping failure'); };
    try {
        const response = await fetch(f.base + '/api/health');
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: 'unavailable' });
        assert.equal(calls, 1);
    } finally { f.store.ping = ping; }
    const recovered = await fetch(f.base + '/api/health');
    assert.equal(recovered.status, 200);
    assert.deepEqual(await recovered.json(), { status: 'ok' });
});

test('signed malformed webhook payloads are rejected or reviewed without fulfillment', async t => {
    const f = await fixture(t);
    assert.equal((await f.post('/api/commerce/checkout', body())).status, 200);
    const valid = await f.paid();
    const cases = [
        ['invalid JSON', () => '{broken', 400],
        ['null payload', () => 'null', 400],
        ['array payload', () => '[]', 400],
        ['string payload', () => '"order"', 400],
        ['missing order ID', () => '{}', 400],
        ['string order ID', p => ({ ...p, id: '456' }), 400],
        ['null note attributes', p => ({ ...p, note_attributes: null })],
        ['object note attributes', p => ({ ...p, note_attributes: {} })],
        ['null note attribute entry', p => ({ ...p, note_attributes: [null] })],
        ['null line items', p => ({ ...p, line_items: null })],
        ['object line items', p => ({ ...p, line_items: {} })],
        ['null line item entry', p => ({ ...p, line_items: [null] })],
        ['null properties', p => { p.line_items[0].properties = null; return p; }],
        ['null property entry', p => { p.line_items[0].properties = [null]; return p; }],
        ['null discounts', p => { p.line_items[0].discount_allocations = null; return p; }],
        ['null discount entry', p => { p.line_items[0].discount_allocations = [null]; return p; }],
        ['null shipping address', p => ({ ...p, shipping_address: null })],
    ];
    for (const [index, [name, malformed, expectedStatus]] of cases.entries()) {
        await t.test(name, async () => {
            const payload = malformed({ ...structuredClone(valid), id: 1000 + index });
            const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const eventId = `malformed-${index}`;
            const response = await f.signedWebhook(raw, eventId);
            if (expectedStatus) assert.equal(response.status, expectedStatus);
            else assert.ok([200, 400].includes(response.status), `${name}: unexpected HTTP ${response.status}`);
            if (response.status === 200) {
                assert.equal((await response.json()).status, 'review');
                assert.equal((await findRow(f.store.db, 'orders', { id: String(payload.id) })).status, 'review');
                assert.equal(await countRows(f.store.db, 'webhook_events', { id: eventId }), 1);
            } else {
                assert.equal(await countRows(f.store.db, 'webhook_events', { id: eventId }), 0);
                assert.equal(await countRows(f.store.db, 'orders', { id: String(1000 + index) }), 0);
            }
            assert.equal(await countRows(f.store.db, 'fulfillment_jobs', {}), 0);
            assert.equal((await findRow(f.store.db, 'checkouts', {})).order_id, undefined);
        });
    }
});

test('server owns variant/price, strips extra fields, and caches same-owner idempotent requests', async t => {
    const f = await fixture(t);
    const response = await f.post('/api/commerce/checkout', body());
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.cost.totalAmount.amount, '130.00');
    assert.equal(result.checkoutUrl, 'https://fixture.myshopify.com/checkouts/test');
    assert.equal(result.id, undefined, 'private Shopify cart IDs stay on the server');
    assert.equal(f.calls[1].variables.input.lines[0].merchandiseId, 'gid://shopify/ProductVariant/123');
    assert.equal(f.calls[0].headers['Shopify-Storefront-Private-Token'], 'test-private-secret');
    assert.ok(f.calls[0].headers['Shopify-Storefront-Buyer-IP']);
    assert.equal(f.calls[1].variables.input.lines[0].attributes.length, 2, 'only server references enter the cart');
    assert.equal((await f.post('/api/commerce/checkout', body())).status, 200);
    assert.equal(f.calls.length, 2);
    const changed = body(); changed.items[0].quantity = 2;
    assert.equal((await f.post('/api/commerce/checkout', changed)).status, 409);
});

test('validation, CSRF, authentication, and mock configuration fail closed', async t => {
    const f = await fixture(t);
    const malformed = body(); malformed.items[0].design.customColors.letters = '#abcdef';
    assert.equal((await f.post('/api/commerce/quote', malformed)).status, 422);
    const unmapped = body(); unmapped.items[0].design.size = '60';
    assert.equal((await f.post('/api/commerce/quote', unmapped)).status, 422);
    const zero = body(); zero.items[0].quantity = 0;
    assert.equal((await f.post('/api/commerce/quote', zero)).status, 422);
    assert.equal((await f.post('/api/commerce/checkout', body(), { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await f.post('/api/commerce/checkout', '{broken')).status, 400);
    assert.equal((await fetch(f.base + '/api/admin/fulfillment')).status, 401);
    assert.equal((await fetch(f.base + '/api/account/overview')).status, 401);
    assert.equal(f.calls.length, 0);
    const mock = await fixture(t, { env: { SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'mock-KEY' } });
    assert.equal((await mock.post('/api/commerce/checkout', body())).status, 503);
});

test('simultaneous requests cannot create duplicate carts', async t => {
    let release;
    const delay = new Promise(resolve => { release = resolve; });
    const f = await fixture(t, { delay });
    const pending = f.post('/api/commerce/checkout', body());
    try {
        const deadline = Date.now() + 5000;
        while (f.calls.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.calls.length, 2, 'first checkout reaches the gateway');
        const duplicate = await f.post('/api/commerce/checkout', body());
        assert.equal(duplicate.status, 409);
    } finally { release(); }
    assert.equal((await pending).status, 200);
    assert.equal(f.calls.length, 2);
});

test('paid webhook is verified, persisted, deduplicated and queued exactly once', async t => {
    const f = await fixture(t);
    await f.post('/api/commerce/checkout', body());
    const payload = await f.paid();
    assert.equal((await f.webhook(payload, 'bad-signature', 'orders/paid', 'wrong')).status, 401);
    assert.equal(await countRows(f.store.db, 'orders', {}), 0);
    const first = await f.webhook(payload);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).status, 'ready');
    await f.webhook(payload);
    await f.webhook(payload, 'different-delivery-same-order');
    assert.equal(await countRows(f.store.db, 'fulfillment_jobs', {}), 1);
    const job = await findRow(f.store.db, 'fulfillment_jobs', {});
    assert.deepEqual(job.payload.configurations[0].design, design);
    const copied = structuredClone(payload); copied.id = 457;
    assert.equal((await (await f.webhook(copied, 'replay')).json()).status, 'review');
    await f.webhook({ order_id: 456 }, 'refund-1', 'refunds/create');
    assert.equal((await findRow(f.store.db, 'fulfillment_jobs', {})).state, 'blocked');
});

test('altered quantity/variant/price, discounts, unpaid and test orders never enter production', async t => {
    for (const mutate of [
        p => { p.line_items[0].quantity = 2; }, p => { p.line_items[0].variant_id = 124; },
        p => { p.line_items[0].price = '1.00'; }, p => { p.test = true; },
        p => { p.financial_status = 'pending'; }, p => { p.line_items[0].discount_allocations = [{ amount: '10.00' }]; },
    ]) {
        const f = await fixture(t);
        await f.post('/api/commerce/checkout', body());
        const payload = await f.paid(); mutate(payload);
        assert.equal((await (await f.webhook(payload)).json()).status, 'review');
        assert.equal(await countRows(f.store.db, 'fulfillment_jobs', {}), 0);
    }
});

test('out-of-order cancellation prevents fulfillment and wrong domains/warnings prevent checkout', async t => {
    const f = await fixture(t);
    await f.post('/api/commerce/checkout', body());
    await f.webhook({ id: 456 }, 'cancel-1', 'orders/cancelled');
    await f.webhook(await f.paid());
    assert.equal(await countRows(f.store.db, 'fulfillment_jobs', {}), 0);
    const wrong = await fixture(t, { checkoutUrl: 'https://evil.example/payment' });
    assert.equal((await wrong.post('/api/commerce/checkout', body())).status, 502);
    const warning = await fixture(t, { warnings: [{ message: 'Out of stock' }] });
    assert.equal((await warning.post('/api/commerce/checkout', body())).status, 422);
});

test('concurrent copies of one webhook delivery commit one order and one job', async t => {
    const f = await fixture(t);
    assert.equal((await f.post('/api/commerce/checkout', body())).status, 200);
    const payload = await f.paid();
    const responses = await Promise.all(Array.from({ length: 8 }, () => f.webhook(payload, 'concurrent-delivery')));
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(await countRows(f.store.db, 'webhook_events', {}), 1);
    assert.equal(await countRows(f.store.db, 'orders', {}), 1);
    assert.equal(await countRows(f.store.db, 'fulfillment_jobs', {}), 1);
    assert.equal((await findRow(f.store.db, 'orders', { id: '456' })).status, 'ready');
    assert.equal((await findRow(f.store.db, 'checkouts', {})).order_id, '456');
});

test('concurrent different orders cannot both claim the same checkout', async t => {
    const f = await fixture(t);
    assert.equal((await f.post('/api/commerce/checkout', body())).status, 200);
    const payload = await f.paid();
    const responses = await Promise.all([
        f.webhook(payload, 'claim-456'),
        f.webhook({ ...payload, id: 457 }, 'claim-457'),
    ]);
    assert.ok(responses.every(response => response.status === 200));
    const results = await Promise.all(responses.map(response => response.json()));
    assert.deepEqual(results.map(result => result.status).sort(), ['ready', 'review']);
    const db = f.store.db;
    assert.equal(await countRows(db, 'webhook_events', {}), 2);
    assert.equal(await countRows(db, 'orders', { status: 'ready' }), 1);
    assert.equal(await countRows(db, 'orders', { status: 'review' }), 1);
    assert.equal(await countRows(db, 'fulfillment_jobs', {}), 1);
    const job = await findRow(db, 'fulfillment_jobs', {});
    const checkout = await findRow(db, 'checkouts', {});
    assert.equal(job.order_id, checkout.order_id);
    assert.equal((await findRow(db, 'orders', { id: job.order_id })).status, 'ready');
});

test('cancellation and refund racing payment leave no actionable fulfillment', async t => {
    for (const topic of ['orders/cancelled', 'refunds/create']) {
        await t.test(topic, async t => {
            const f = await fixture(t);
            assert.equal((await f.post('/api/commerce/checkout', body())).status, 200);
            const payload = await f.paid();
            const cancellation = topic === 'orders/cancelled' ? { id: 456 } : { order_id: 456 };
            const responses = await Promise.all([
                f.webhook(payload, 'racing-payment'),
                f.webhook(cancellation, 'racing-cancellation', topic),
                f.webhook(payload, 'racing-payment-retry'),
            ]);
            assert.ok(responses.every(response => response.status === 200));
            const db = f.store.db;
            assert.equal(await countRows(db, 'webhook_events', {}), 3);
            assert.equal(await countRows(db, 'orders', {}), 1);
            assert.equal((await findRow(db, 'orders', { id: '456' })).status, 'blocked');
            assert.equal(await countRows(db, 'fulfillment_jobs', { state: { $ne: 'blocked' } }), 0);
            assert.ok(await countRows(db, 'fulfillment_jobs', {}) <= 1);
            assert.equal((await f.webhook(payload, 'payment-after-cancellation')).status, 200);
            assert.equal((await findRow(db, 'orders', { id: '456' })).status, 'blocked');
            assert.equal(await countRows(db, 'fulfillment_jobs', { state: { $ne: 'blocked' } }), 0);
        });
    }
});

test('SQLite state survives reopening the same database', async () => {
    const database = testDatabase();
    let store = await CommerceStore.connect(database);
    const specification = [{ id: 'line', design, quantity: 1, pricingKey: '100:ansi:classic:0:1:0:0',
        variantId: 'gid://shopify/ProductVariant/123', price: money, title: 'Full size' }];
    const result = { checkoutUrl: 'https://fixture.myshopify.com/checkouts/test',
        cost: { subtotalAmount: money, totalAmount: money }, configurationIds: ['line'] };
    try {
        await store.insertCheckout({ id: 'persisted', owner: 'owner', key: 'request', fingerprint: 'hash', specification: [] });
        await store.setSpecification('persisted', specification);
        await store.finishCheckout('persisted', result);
        await store.close();
        store = await CommerceStore.connect(database);
        await store.ping();
        const checkout = await store.findRequest('owner', 'request');
        assert.equal(checkout.id, 'persisted');
        assert.deepEqual(checkout.specification, specification);
        assert.deepEqual(checkout.result, result);
        assert.equal((await store.checkout('persisted')).state, 'ready');
    } finally {
        try { await store.close(); } finally { removeTestDatabase(database); }
    }
});
