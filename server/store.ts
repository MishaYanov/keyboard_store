import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, existsSync, realpathSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isKeyboardDesign } from '@keycaps/domain/keyboard-design.validation';
import { moneySchema, type CheckoutRecord, type CheckoutResult, type Specification, type OrderRecord, type OrderState, type FulfillmentJob } from './models';
import { DuplicateRequestError, type CommerceRepository, type WebhookTransaction } from './repository';

// Share a queue across connections to the same file: awaited transactions must not
// admit unrelated writes/reads or nested BEGINs on the synchronous SQLite connection.
const queues = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, operation: () => T | Promise<T>): Promise<T> {
    const work = (queues.get(key) || Promise.resolve()).then(operation);
    const settled = work.then(() => undefined, () => undefined);
    queues.set(key, settled);
    void settled.then(() => { if (queues.get(key) === settled) queues.delete(key); });
    return work;
}
const specificationSchema = z.array(z.object({ id: z.string(), design: z.custom<Specification['design']>(isKeyboardDesign),
    pricingKey: z.string(), variantId: z.string(), quantity: z.number().int().positive(), price: moneySchema, title: z.string() }));
const resultSchema = z.object({ checkoutUrl: z.string(), configurationIds: z.array(z.string()),
    cost: z.object({ subtotalAmount: moneySchema, totalAmount: moneySchema }) });
const json = (value: unknown): unknown => JSON.parse(z.string().parse(value));
const orderSchema = z.object({ id: z.string(), checkout_id: z.string().nullable(), status: z.enum(['ready', 'review', 'blocked']), reason: z.string().nullable(), created_at: z.number() });
const checkoutSchema = z.object({ id: z.string(), owner: z.string(), request_key: z.string(), fingerprint: z.string(),
    state: z.enum(['pending', 'ready', 'failed']), specification: z.string(), result: z.string().nullable(), created_at: z.number(), order_id: z.string().nullable() });
const shippingSchema = z.object({ name: z.string(), address1: z.string(), address2: z.string(), city: z.string(), province: z.string(), zip: z.string(), countryCode: z.string() });
const payloadSchema = z.object({ orderId: z.string(), configurations: specificationSchema, shipping: shippingSchema });
const jobSchema = z.object({ id: z.string(), order_id: z.string(), state: z.enum(['ready', 'blocked']), payload: z.string(), created_at: z.number() });

export class CommerceStore implements CommerceRepository {
    private closed = false;
    private constructor(readonly db: DatabaseSync, readonly filename: string, private readonly queueKey: string) {}
    static async connect(filename: string, mode?: 'mock' | 'live'): Promise<CommerceStore> {
        let key = `memory:${randomUUID()}`;
        if (filename !== ':memory:') {
            filename = resolve(filename);
            mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
            filename = existsSync(filename) ? realpathSync(filename) : join(realpathSync(dirname(filename)), basename(filename));
            key = process.platform === 'win32' ? filename.toLowerCase() : filename;
        }
        return serialized(key, () => {
            const db = new DatabaseSync(filename);
            try {
                db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
                    CREATE TABLE IF NOT EXISTS checkouts (
                        id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
                        state TEXT NOT NULL, specification TEXT NOT NULL, result TEXT, created_at INTEGER NOT NULL,
                        order_id TEXT, UNIQUE(owner, request_key));
                    CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
                    CREATE TABLE IF NOT EXISTS orders (
                        id TEXT PRIMARY KEY, checkout_id TEXT, status TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL);
                    CREATE TABLE IF NOT EXISTS fulfillment_jobs (
                        id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, state TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
                    CREATE TABLE IF NOT EXISTS service_settings (id TEXT PRIMARY KEY, mode TEXT NOT NULL);
                    CREATE INDEX IF NOT EXISTS orders_status_created ON orders(status,created_at DESC);
                    CREATE INDEX IF NOT EXISTS jobs_created ON fulfillment_jobs(created_at DESC);`);
                if (mode) {
                    db.exec('BEGIN IMMEDIATE');
                    try {
                        const setting = db.prepare("SELECT mode FROM service_settings WHERE id='commerce_mode'").get();
                        if (!setting && mode === 'mock' && Number(db.prepare('SELECT count(*) AS n FROM checkouts').get()?.n) > 0)
                            throw new Error('Use a new database for mock commerce');
                        db.prepare("INSERT OR IGNORE INTO service_settings(id,mode) VALUES('commerce_mode',?)").run(mode);
                        if (db.prepare("SELECT mode FROM service_settings WHERE id='commerce_mode'").get()?.mode !== mode)
                            throw new Error('Mock and live commerce must use separate SQLite databases');
                        db.exec('COMMIT');
                    } catch (error) { db.exec('ROLLBACK'); throw error; }
                }
                return new CommerceStore(db, filename, key);
            } catch (error) { db.close(); throw error; }
        });
    }
    private run<T>(operation: () => T | Promise<T>): Promise<T> {
        return serialized(this.queueKey, () => {
            if (this.closed) throw new Error('Database is closed');
            return operation();
        });
    }
    private readCheckout(sql: string, ...params: SQLInputValue[]): CheckoutRecord | null {
        const row = this.db.prepare(sql).get(...params);
        if (!row) return null;
        const { specification, result, order_id, ...parsed } = checkoutSchema.parse(row);
        return { ...parsed, specification: specificationSchema.parse(json(specification)),
            ...(result !== null ? { result: resultSchema.parse(json(result)) } : {}),
            ...(order_id !== null ? { order_id } : {}) };
    }
    private readOrder(id: string): OrderRecord | null {
        const row = this.db.prepare('SELECT * FROM orders WHERE id=?').get(id);
        return row ? orderSchema.parse(row) : null;
    }
    private readJob(id: string): FulfillmentJob | null {
        const row = this.db.prepare('SELECT * FROM fulfillment_jobs WHERE id=?').get(id);
        if (!row) return null;
        const parsed = jobSchema.parse(row);
        return { ...parsed, payload: payloadSchema.parse(json(parsed.payload)) };
    }
    async ping() { await this.run(() => this.db.prepare('SELECT 1').get()); }
    async close() { await serialized(this.queueKey, () => { if (!this.closed) { this.db.close(); this.closed = true; } }); }
    findRequest(owner: string, key: string) { return this.run(() => this.readCheckout('SELECT * FROM checkouts WHERE owner=? AND request_key=?', owner, key)); }
    checkout(id: string) { return this.run(() => this.readCheckout('SELECT * FROM checkouts WHERE id=?', id)); }
    async insertCheckout(value: { id: string; owner: string; key: string; fingerprint: string; specification: Specification[] }) {
        await this.run(() => {
            try {
                this.db.prepare('INSERT INTO checkouts(id,owner,request_key,fingerprint,state,specification,created_at) VALUES(?,?,?,?,?,?,?)')
                    .run(value.id, value.owner, value.key, value.fingerprint, 'pending', JSON.stringify(value.specification), Date.now());
            } catch (error) {
                if (error instanceof Error && 'errcode' in error && [1555, 2067].includes(Number(error.errcode)))
                    throw new DuplicateRequestError('Duplicate checkout request');
                throw error;
            }
        });
    }
    async setSpecification(id: string, specification: Specification[]) {
        await this.run(() => {
            if (!this.db.prepare("UPDATE checkouts SET specification=? WHERE id=? AND state='pending'").run(JSON.stringify(specification), id).changes)
                throw new Error('Checkout is not pending');
        });
    }
    async finishCheckout(id: string, result: CheckoutResult) {
        await this.run(() => {
            if (!this.db.prepare("UPDATE checkouts SET result=?,state='ready' WHERE id=? AND state='pending'").run(JSON.stringify(result), id).changes)
                throw new Error('Checkout is not pending');
        });
    }
    async failCheckout(id: string) { await this.run(() => this.db.prepare("UPDATE checkouts SET state='failed' WHERE id=? AND state='pending'").run(id)); }
    async transaction<T>(fn: (transaction: WebhookTransaction) => Promise<T>): Promise<T> {
        return this.run(async () => {
            this.db.exec('BEGIN IMMEDIATE');
            let active = true;
            const operation = <R>(work: () => R): Promise<R> => {
                if (!active) return Promise.reject(new Error('Transaction is no longer active'));
                try { return Promise.resolve(work()); } catch (error) { return Promise.reject(error); }
            };
            const tx: WebhookTransaction = {
                hasEvent: id => operation(() => Boolean(this.db.prepare('SELECT id FROM webhook_events WHERE id=?').get(id))),
                insertEvent: id => operation(() => { this.db.prepare('INSERT INTO webhook_events VALUES(?,?)').run(id, Date.now()); }),
                order: id => operation(() => this.readOrder(id)),
                checkout: id => operation(() => this.readCheckout('SELECT * FROM checkouts WHERE id=?', id)),
                blockOrder: (id, reason) => operation(() => {
                    this.db.prepare(`INSERT INTO orders(id,status,reason,created_at) VALUES(?,?,?,?)
                        ON CONFLICT(id) DO UPDATE SET status=excluded.status,reason=excluded.reason`).run(id, 'blocked', reason, Date.now());
                    this.db.prepare("UPDATE fulfillment_jobs SET state='blocked' WHERE order_id=?").run(id);
                }),
                insertOrder: order => operation(() => { this.db.prepare('INSERT INTO orders(id,checkout_id,status,reason,created_at) VALUES(?,?,?,?,?)')
                    .run(order.id, order.checkout_id, order.status, order.reason, order.created_at); }),
                claimCheckout: (id, orderId) => operation(() => {
                    if (!this.db.prepare("UPDATE checkouts SET order_id=? WHERE id=? AND state='ready' AND order_id IS NULL").run(orderId, id).changes)
                        throw new Error('Checkout already claimed');
                }),
                insertJob: job => operation(() => { this.db.prepare('INSERT INTO fulfillment_jobs VALUES(?,?,?,?,?)')
                    .run(job.id, job.order_id, job.state, JSON.stringify(job.payload), job.created_at); }),
            };
            try { const result = await fn(tx); this.db.exec('COMMIT'); return result; }
            catch (error) { this.db.exec('ROLLBACK'); throw error; }
            finally { active = false; }
        });
    }
    fulfillmentOverview() {
        return this.run(() => ({
            jobs: z.array(jobSchema.omit({ payload: true })).parse(this.db.prepare('SELECT id,order_id,state,created_at FROM fulfillment_jobs ORDER BY created_at DESC LIMIT 100').all()),
            reviews: z.array(orderSchema.pick({ id: true, reason: true, created_at: true })).parse(this.db.prepare("SELECT id,reason,created_at FROM orders WHERE status='review' ORDER BY created_at DESC LIMIT 100").all()),
        }));
    }
    job(id: string) { return this.run(() => this.readJob(id)); }
    countOrders(status: OrderState) { return this.run(() => Number(this.db.prepare('SELECT count(*) AS n FROM orders WHERE status=?').get(status)?.n)); }
    countJobs() { return this.run(() => Number(this.db.prepare('SELECT count(*) AS n FROM fulfillment_jobs').get()?.n)); }
}
