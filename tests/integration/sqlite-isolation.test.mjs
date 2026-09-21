import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CommerceStore } from '../../server/dist/app.js';
import { isolatedStore, findRow, countRows } from './sqlite-fixture.mjs';

test('another connection cannot enter a transaction across await or have its writes rolled back', async t => {
    const first = await isolatedStore(t);
    const second = await CommerceStore.connect(first.filename);
    t.after(() => second.close());
    let entered, resume;
    const started = new Promise(resolve => { entered = resolve; });
    const delay = new Promise(resolve => { resume = resolve; });
    let externalDone = false;
    const transaction = first.transaction(async tx => {
        await tx.insertEvent('rolled-back');
        entered();
        await delay;
        throw new Error('Deliberate rollback');
    });
    const rollback = assert.rejects(transaction, /Deliberate rollback/);
    await started;
    const outside = second.insertCheckout({ id: 'outside', owner: 'owner', key: 'key', fingerprint: 'hash', specification: [] })
        .then(() => { externalDone = true; });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(externalDone, false);
    resume();
    await rollback;
    await outside;
    assert.equal(countRows(first.db, 'webhook_events'), 0);
    assert.equal((await first.checkout('outside')).id, 'outside');
    assert.equal(findRow(first.db, 'checkouts').state, 'pending');
    await second.close();
});

test('completed transaction handles cannot write after commit', async t => {
    const store = await isolatedStore(t);
    let leaked;
    await store.transaction(async tx => { leaked = tx; });
    await assert.rejects(leaked.insertEvent('too-late'), /no longer active/);
    assert.equal(countRows(store.db, 'webhook_events'), 0);
});
