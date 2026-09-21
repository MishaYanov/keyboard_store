import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { CommerceStore } from '../../server/dist/app.js';

const owned = new Set();
export function testDatabase() {
    const directory = mkdtempSync(join(tmpdir(), 'keycaps-sqlite-test-'));
    const filename = join(directory, 'commerce.sqlite');
    owned.add(resolve(filename));
    return filename;
}
export function removeTestDatabase(filename) {
    const target = resolve(filename);
    if (!owned.delete(target)) throw new Error('Refusing to remove an unowned database');
    rmSync(dirname(target), { recursive: true, force: true });
}
export async function isolatedStore(t, beforeClose = async () => {}) {
    const filename = testDatabase();
    const store = await CommerceStore.connect(filename);
    t.after(async () => {
        try { await beforeClose(); }
        finally { try { await store.close(); } finally { removeTestDatabase(filename); } }
    });
    return store;
}
export async function closeServer(server) {
    await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
    });
}
// Read-only test inspection; business services use the typed repository exclusively.
function selection(table, where) {
    if (!['checkouts', 'orders', 'webhook_events', 'fulfillment_jobs', 'service_settings'].includes(table)) throw new Error('Unknown table');
    const values = [];
    const conditions = Object.entries(where).map(([key, value]) => {
        if (!['id', 'status', 'state'].includes(key)) throw new Error('Unknown filter');
        const unequal = typeof value === 'object' && value !== null && '$ne' in value;
        values.push(unequal ? value.$ne : value);
        return `${key} ${unequal ? '<>' : '='} ?`;
    });
    return { sql: table + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), values };
}
export function findRow(db, table, where = {}) {
    const { sql, values } = selection(table, where);
    const row = db.prepare(`SELECT * FROM ${sql} LIMIT 1`).get(...values);
    if (!row) return null;
    const result = { ...row };
    for (const key of ['specification', 'result', 'payload']) if (typeof result[key] === 'string') result[key] = JSON.parse(result[key]);
    if (table === 'checkouts') for (const key of ['result', 'order_id']) if (result[key] === null) delete result[key];
    return result;
}
export function countRows(db, table, where = {}) {
    const { sql, values } = selection(table, where);
    return db.prepare(`SELECT count(*) AS n FROM ${sql}`).get(...values).n;
}
