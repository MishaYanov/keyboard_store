import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readConfig } from '../../server/dist/app.js';

const release = {
    NODE_ENV: 'production', COMMERCE_MODE: 'live', APP_ORIGIN: 'https://staging.example.com',
    SHOPIFY_STORE_DOMAIN: 'fixture.myshopify.com', SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'fixture-private-token',
    SHOPIFY_WEBHOOK_SECRET: 'fixture-webhook-secret', API_ADMIN_KEY: 'a'.repeat(64),
    API_DATABASE: resolve('release-data/commerce.sqlite'), SQLITE_PERSISTENT: 'true',
    SHOPIFY_VARIANT_MAP: '{"fixture":"gid://shopify/ProductVariant/123"}',
};
test('release accepts configured persistent commerce for both deployment environments', () => {
    for (const DEPLOY_ENV of ['staging', 'production']) {
        const config = readConfig({ ...release, DEPLOY_ENV });
        assert.equal(config.ready, true);
        assert.equal(config.mock, false);
        assert.equal(config.database, release.API_DATABASE);
        assert.equal(config.persistent, true);
    }
});
test('production rejects mocks, placeholders, missing secrets and ephemeral storage', () => {
    for (const override of [
        { COMMERCE_MODE: 'mock' }, { APP_ORIGIN: 'http://localhost' },
        { SHOPIFY_STORE_DOMAIN: 'mock-KEY.myshopify.com' },
        { SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'mock-KEY-token' },
        { SHOPIFY_VARIANT_MAP: '{}' }, { SHOPIFY_WEBHOOK_SECRET: '' },
        { API_ADMIN_KEY: 'short' }, { API_DATABASE: ':memory:' }, { API_DATABASE: 'relative.sqlite' }, { SQLITE_PERSISTENT: 'false' },
    ]) assert.throws(() => readConfig({ ...release, DEPLOY_ENV: 'production', ...override }));
});

test('staging explicitly permits mock commerce with production Node settings', () => {
    for (const APP_ORIGIN of ['https://staging.example.com', 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://[::1]:8080']) {
        const config = readConfig({ NODE_ENV: 'production', DEPLOY_ENV: 'staging', COMMERCE_MODE: 'mock', APP_ORIGIN,
            API_DATABASE: ':memory:' });
        assert.equal(config.mock, true);
        assert.equal(config.ready, true);
        assert.equal(config.database, ':memory:');
    }
    assert.throws(() => readConfig({ ...release, DEPLOY_ENV: 'staging', COMMERCE_MODE: 'mock', APP_ORIGIN: 'http://staging.example.com' }));
});

test('mock commerce requires explicit staging opt-in outside development', () => {
    for (const DEPLOY_ENV of [undefined, 'production', 'preview']) {
        assert.throws(() => readConfig({ ...release, COMMERCE_MODE: 'mock', DEPLOY_ENV }));
    }
    assert.throws(() => readConfig({ ...release, NODE_ENV: 'development', DEPLOY_ENV: 'production', COMMERCE_MODE: 'mock' }));
});

test('Render port is honored and its free mock configuration needs no database service', () => {
    const config = readConfig({ NODE_ENV: 'production', DEPLOY_ENV: 'staging', COMMERCE_MODE: 'mock',
        APP_ORIGIN: 'https://demo.example.com', API_DATABASE: '/tmp/demo.sqlite', SQLITE_PERSISTENT: 'false', PORT: '10000' });
    assert.equal(config.port, 10000);
    assert.equal(config.mock, true);
    assert.equal(config.persistent, false);
    assert.throws(() => readConfig({ ...release, SQLITE_PERSISTENT: 'yes' }));
    assert.throws(() => readConfig({ ...release, SQLITE_PERSISTENT: 'false' }));
});
