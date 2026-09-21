import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CommerceStore } from '../../server/dist/app.js';
import { isolatedStore, findRow, countRows, removeTestDatabase } from './sqlite-fixture.mjs';

for (const mode of ['mock', 'live']) {
    test(`${mode} database allows same-mode reopen and rejects the opposite mode`, async t => {
        // Keep a separate connection for cleanup even if reopening fails.
        const cleanupStore = await isolatedStore(t);
        const database = cleanupStore.filename;
        const first = await CommerceStore.connect(database, mode);
        try {
            await first.insertCheckout({ id: 'persisted', owner: 'owner', key: 'request',
                fingerprint: 'hash', specification: [] });
            assert.deepEqual(await findRow(first.db, 'service_settings', { id: 'commerce_mode' }),
                { id: 'commerce_mode', mode });
        } finally { await first.close(); }

        const reopened = await CommerceStore.connect(database, mode);
        try {
            await reopened.ping();
            assert.equal((await reopened.checkout('persisted')).id, 'persisted');
            const opposite = mode === 'mock' ? 'live' : 'mock';
            await assert.rejects(async () => {
                const unexpected = await CommerceStore.connect(database, opposite);
                // Avoid leaking a client if a regression incorrectly accepts the switch.
                await unexpected.close();
            }, /Mock and live commerce must use separate SQLite databases/);
            assert.deepEqual(await findRow(reopened.db, 'service_settings', { id: 'commerce_mode' }),
                { id: 'commerce_mode', mode });
            assert.equal((await reopened.checkout('persisted')).id, 'persisted');
            await reopened.ping();
        } finally { await reopened.close(); }
    });
}
