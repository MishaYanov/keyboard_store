import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApiServer, readConfig } from '../../server/dist/app.js';
import { isolatedStore, closeServer, countRows } from './sqlite-fixture.mjs';

test('mock mode is explicit, isolated and forbidden in production', () => {
    assert.equal(readConfig({}).mock, false);
    assert.equal(readConfig({ COMMERCE_MODE: 'mock' }).database, './data/commerce-mock.sqlite');
    assert.throws(() => readConfig({ COMMERCE_MODE: 'mock', NODE_ENV: 'production', APP_ORIGIN: 'https://example.com' }), /forbidden/);
    assert.throws(() => readConfig({ COMMERCE_MODE: 'typo' }), /Invalid COMMERCE_MODE/);
});

test('mock checkout verifies an order, rejects strangers and deduplicates completion', async t => {
    const config = readConfig({ COMMERCE_MODE: 'mock' });
    let server;
    const store = await isolatedStore(t, () => server && closeServer(server));
    server = createApiServer({ config, store });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    for (let i = 0; i < 65; i++) assert.equal((await fetch(base + '/api/health')).status, 200);
    const response = await fetch(base + '/api/commerce/checkout', { method: 'POST', headers: {
        Origin: config.origin, 'Content-Type': 'application/json', 'Idempotency-Key': 'mock-test-request-0001',
    }, body: JSON.stringify({ items: [{ quantity: 2, design: {
        size: '60', physical: 'ansi', letterLayout: 'qwerty', languages: ['en'], primaryCorner: 'top-left', presetId: 'classic', customColorMode: 2,
        customColors: { letters: '#e8e2d6', actions: '#6f7378', accent: '#b94a48' }, keyColors: {}, keyLegends: {},
    } }] }) });
    assert.equal(response.status, 200);
    const cart = await response.json();
    assert.equal(cart.cost.totalAmount.amount, '160.00');
    const path = new URL(cart.checkoutUrl).pathname;
    assert.equal((await fetch(base + path)).status, 404);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base + path, { method: 'POST', headers: { Cookie: cookie } })).status, 403);
    for (let i = 0; i < 2; i++) {
        const completed = await fetch(base + path, { method: 'POST', headers: { Origin: config.origin, Cookie: cookie } });
        assert.equal(completed.status, 200);
        assert.match(await completed.text(), /Test order completed/);
    }
    assert.equal(await countRows(store.db, 'orders', {}), 1);
    assert.equal(await countRows(store.db, 'fulfillment_jobs', {}), 1);
});
