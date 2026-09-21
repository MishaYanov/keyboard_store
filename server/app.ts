import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { readConfig, configured, type ApiConfig } from './config';
import { CommerceStore } from './store';
import { ShopifyGateway } from './shopify';
import { CommerceService } from './commerce';
import { handleWebhook } from './webhooks';
import { HttpError, errorMessage } from './errors';
import { MockShopifyGateway, mockCheckout } from './mock-shopify';
import type { CommerceRepository } from './repository';
import type { CommerceGateway } from './models';

export { readConfig, CommerceStore, ShopifyGateway };

async function readBody(req: IncomingMessage, limit: number) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) throw new HttpError(413, 'Request body is too large.');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
function json(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(JSON.stringify(value));
}
function authorized(req: IncomingMessage, config: ApiConfig) {
    const value = req.headers.authorization;
    if (!configured(config.adminKey) || config.adminKey.length < 32 || typeof value !== 'string') return false;
    const expected = createHash('sha256').update(`Bearer ${config.adminKey}`).digest();
    return timingSafeEqual(expected, createHash('sha256').update(value).digest());
}

export function createApiServer({ config, store, gateway = config.mock ? new MockShopifyGateway(config) : new ShopifyGateway(config) }: {
    config: ApiConfig; store: CommerceRepository; gateway?: CommerceGateway;
}) {
    const commerce = new CommerceService(config, store, gateway);
    const buckets = new Map<string, { count: number; until: number }>();
    const handle = async (req: IncomingMessage, res: ServerResponse) => {
        try {
            const path = new URL(req.url || '/', 'http://localhost').pathname;
            const socketIp = req.socket.remoteAddress || '127.0.0.1';
            const forwarded = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0]!.trim() : '';
            const ip = config.trustProxy && isIP(forwarded) ? forwarded : socketIp;
            if (path === '/api/webhooks/shopify' && req.method === 'POST') {
                return json(res, 200, await handleWebhook(config, store, await readBody(req, 1024 * 1024), req.headers));
            }
            // Container probes must not consume shopper rate limits or make a busy API unhealthy.
            if (req.method === 'GET' && path === '/api/health') {
                try { await store.ping(); } catch { return json(res, 503, { status: 'unavailable' }); }
                return json(res, 200, { status: 'ok' });
            }
            const now = Date.now();
            for (const [key, entry] of buckets) if (now > entry.until) buckets.delete(key);
            const bucket = buckets.get(ip) || { count: 0, until: now + 60_000 };
            if (buckets.size >= 10000 && !buckets.has(ip)) throw new HttpError(429, 'Please try again shortly.');
            buckets.set(ip, bucket);
            if (++bucket.count > (config.mock ? 600 : 60)) { res.setHeader('Retry-After', '60'); throw new HttpError(429, 'Too many requests. Please wait a minute.'); }
            if (req.headers.origin && req.headers.origin !== config.origin) throw new HttpError(403, 'Origin is not allowed.');
            if (req.method === 'GET' && path === '/api/commerce/status') return json(res, 200, { configured: config.ready, mock: config.mock === true });
            const mockId = /^\/api\/mock\/checkout\/([a-f0-9-]{36})$/.exec(path)?.[1];
            if (config.mock && mockId && ['GET', 'POST'].includes(req.method || '')) return await mockCheckout(req, res, config, store, mockId);
            if (req.method === 'GET' && path === '/api/commerce/catalog') {
                if (!config.ready) throw new HttpError(503, 'The catalog is not configured yet.');
                const ids = [...new Set(Object.values(config.variants))];
                const products = [];
                for (let offset = 0; offset < ids.length; offset += 100) products.push(...await gateway.variants(ids.slice(offset, offset + 100), ip));
                return json(res, 200, { variants: products });
            }
            if (path.startsWith('/api/account/')) throw new HttpError(401, 'Customer sign-in is not connected yet.');
            if (path.startsWith('/api/admin/')) {
                if (!authorized(req, config)) throw new HttpError(401, 'Administrator authentication required.');
                if (req.method === 'GET' && path === '/api/admin/fulfillment') {
                    return json(res, 200, await store.fulfillmentOverview());
                }
                const jobId = /^\/api\/admin\/fulfillment\/([\w-]+)$/.exec(path)?.[1];
                if (req.method === 'GET' && jobId) {
                    const job = await store.job(jobId);
                    if (!job) throw new HttpError(404, 'Fulfillment job not found.');
                    return json(res, 200, job);
                }
                if (req.method === 'GET' && path === '/api/admin/dashboard') {
                    const [ready, review, blocked, jobs] = await Promise.all([store.countOrders('ready'), store.countOrders('review'), store.countOrders('blocked'), store.countJobs()]);
                    return json(res, 200, {
                        updatedAt: new Date().toISOString(), metrics: [
                            { label: 'Verified orders', value: String(ready), change: 'Recorded by this service', direction: 'flat' },
                            { label: 'Needs review', value: String(review), change: 'Held for approval', direction: 'flat' },
                            { label: 'Blocked', value: String(blocked), change: 'Cancelled or refunded', direction: 'flat' },
                            { label: 'Fulfillment jobs', value: String(jobs), change: 'Local outbox', direction: 'flat' },
                        ], sales: [], stages: [{ label: 'Ready', count: ready, tone: 'done' }, { label: 'Review', count: review, tone: 'work' }], orders: [], activity: [],
                    });
                }
                throw new HttpError(404, 'Unknown admin endpoint.');
            }
            if (req.method === 'POST' && ['/api/commerce/quote', '/api/commerce/checkout'].includes(path)) {
                if (req.headers.origin !== config.origin) throw new HttpError(403, 'A same-origin request is required.');
                if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'JSON is required.');
                let body: unknown;
                try { body = JSON.parse((await readBody(req, 128 * 1024)).toString('utf8')); }
                catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid JSON.'); }
                if (path.endsWith('/quote')) return json(res, 200, await commerce.quote(body, ip));
                const cookieName = config.secureCookies ? '__Host-commerce' : 'commerce';
                let owner = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.split('=')[1];
                if (!owner || !/^[a-f0-9]{64}$/.test(owner)) {
                    owner = randomBytes(32).toString('hex');
                    res.setHeader('Set-Cookie', `${cookieName}=${owner}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${config.secureCookies ? '; Secure' : ''}`);
                }
                return json(res, 200, await commerce.checkout(body, createHash('sha256').update(owner).digest('hex'), req.headers['idempotency-key'], ip));
            }
            throw new HttpError(404, 'Endpoint not found.');
        } catch (error) {
            // Never log request bodies, cookies, customer addresses, or provider tokens.
            const status = error instanceof HttpError ? error.status : 500;
            if (status === 500) console.error('API request failed:', error instanceof Error ? error.name : 'Unknown');
            if (!res.headersSent) json(res, status, { error: status === 500 ? 'An unexpected server error occurred.' : errorMessage(error) });
        }
    };
    // A disconnected socket can leave an async checkout/webhook running. Drain work, not just sockets.
    const active = new Set<Promise<void>>();
    const server = createServer((req, res) => {
        const request = handle(req, res);
        active.add(request);
        void request.then(() => active.delete(request), () => active.delete(request));
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    server.keepAliveTimeout = 5000;
    // The caller owns the repository lifetime, including asynchronous shutdown.
    return Object.assign(server, { async drainRequests() {
        while (active.size) await Promise.allSettled([...active]);
    } });
}
