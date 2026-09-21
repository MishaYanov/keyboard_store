import { z } from 'zod';
import { isAbsolute } from 'node:path';

export function configured(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && !/mock-KEY|CHANGE_ME/i.test(value); }
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
    const origin = new URL(env.APP_ORIGIN || 'http://localhost:5173');
    const production = env.NODE_ENV === 'production';
    const staging = env.DEPLOY_ENV === 'staging';
    const mock = env.COMMERCE_MODE === 'mock';
    if (env.COMMERCE_MODE && !['mock', 'live'].includes(env.COMMERCE_MODE)) throw new Error('Invalid COMMERCE_MODE');
    if (env.DEPLOY_ENV && !['development', 'test', 'staging', 'production'].includes(env.DEPLOY_ENV)) throw new Error('Invalid DEPLOY_ENV');
    if (env.DEPLOY_ENV === 'production' && !production) throw new Error('Production deployment requires NODE_ENV=production');
    if (mock && production && !staging) throw new Error('Mock commerce is forbidden in production');
    const localStaging = staging && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    if (production && origin.protocol !== 'https:' && !(localStaging && origin.protocol === 'http:')) throw new Error('APP_ORIGIN must use HTTPS in production');
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('APP_ORIGIN must be an HTTP(S) origin');
    let raw: unknown;
    try { raw = JSON.parse(env.SHOPIFY_VARIANT_MAP || '{}'); } catch { throw new Error('SHOPIFY_VARIANT_MAP must be JSON'); }
    const variants = z.record(z.string(), z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/)).parse(raw);
    const domain = env.SHOPIFY_STORE_DOMAIN || 'mock-KEY.myshopify.com';
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) throw new Error('Invalid SHOPIFY_STORE_DOMAIN');
    const apiVersion = env.SHOPIFY_API_VERSION || '2026-07';
    if (!/^\d{4}-(01|04|07|10)$/.test(apiVersion)) throw new Error('Invalid SHOPIFY_API_VERSION');
    const token = env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || '';
    const checkoutDomain = env.SHOPIFY_CHECKOUT_DOMAIN || domain;
    if (!/^[a-z0-9.-]+$/i.test(checkoutDomain)) throw new Error('Invalid SHOPIFY_CHECKOUT_DOMAIN');
    const port = Number(env.API_PORT || env.PORT || 3001);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API_PORT');
    const database = env.API_DATABASE || (mock ? './data/commerce-mock.sqlite' : './data/commerce.sqlite');
    if (!configured(database) || database.includes('\0') || database.startsWith('file:')) throw new Error('Invalid API_DATABASE');
    if (env.SQLITE_PERSISTENT && !['true', 'false'].includes(env.SQLITE_PERSISTENT)) throw new Error('Invalid SQLITE_PERSISTENT');
    const persistent = env.SQLITE_PERSISTENT === 'true';
    if (persistent && (database === ':memory:' || !isAbsolute(database))) throw new Error('Persistent SQLite requires an absolute file path');
    if (production && !mock) {
        if (!persistent) throw new Error('Live release commerce requires SQLITE_PERSISTENT=true and a mounted persistent disk');
        if (!configured(domain) || !configured(token) || !configured(checkoutDomain) || !Object.keys(variants).length)
            throw new Error('Production requires real Shopify credentials and a nonempty variant map');
        if (!configured(env.SHOPIFY_WEBHOOK_SECRET)) throw new Error('Production requires SHOPIFY_WEBHOOK_SECRET');
        if (!configured(env.API_ADMIN_KEY) || env.API_ADMIN_KEY.length < 32) throw new Error('Production requires an API_ADMIN_KEY of at least 32 characters');
    }
    return {
        origin: origin.origin, production, staging, mock, port, host: env.API_HOST || '127.0.0.1',
        secureCookies: origin.protocol === 'https:', database, persistent, domain, apiVersion, token, checkoutDomain,
        webhookSecret: mock ? 'local-simulation-only-not-a-real-secret' : env.SHOPIFY_WEBHOOK_SECRET || '', adminKey: env.API_ADMIN_KEY || '',
        variants, ready: mock || configured(domain) && configured(token) && Object.keys(variants).length > 0,
        trustProxy: env.API_TRUST_PROXY === 'true',
    };
}
export type ApiConfig = ReturnType<typeof readConfig>;
