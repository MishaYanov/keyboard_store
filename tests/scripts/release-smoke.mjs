// Runs inside the final API image, without Shopify requests or real secrets.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiServer, readConfig, CommerceStore } from '/app/dist/app.js';

assert.notEqual(process.getuid(), 0, 'API must run as nonroot');
const directory = mkdtempSync(join(tmpdir(), 'keycaps-release-smoke-'));
const config = readConfig({
    NODE_ENV: 'production', COMMERCE_MODE: 'live', APP_ORIGIN: 'https://fixture.example.com',
    API_HOST: '127.0.0.1',
    API_DATABASE: join(directory, 'commerce.sqlite'), SQLITE_PERSISTENT: 'true',
    SHOPIFY_STORE_DOMAIN: 'fixture.myshopify.com', SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'fixture-token',
    SHOPIFY_WEBHOOK_SECRET: 'fixture-secret', API_ADMIN_KEY: 'a'.repeat(64),
    SHOPIFY_VARIANT_MAP: '{"fixture":"gid://shopify/ProductVariant/123"}',
});
const store = await CommerceStore.connect(config.database, 'live');
const server = createApiServer({ config, store });
try {
    server.listen(0, config.host);
    await once(server, 'listening');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
    await store.insertCheckout({ id: 'smoke', owner: 'smoke', key: 'smoke', fingerprint: 'smoke', specification: [] });
    assert.equal((await store.checkout('smoke')).id, 'smoke');
    await store.ping();
    console.log('Release API smoke passed: nonroot, SQLite writable, HTTP health OK');
} finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await server.drainRequests();
    await store.close();
    const reopened = await CommerceStore.connect(config.database, 'live');
    try { assert.equal((await reopened.checkout('smoke')).id, 'smoke'); }
    finally { await reopened.close(); rmSync(directory, { recursive: true, force: true }); }
}
