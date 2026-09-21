import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiRequest } from '../../client/src/engine/api/api-request';

test('request signals update; stale responses cannot overwrite newer data', async () => {
    const pending: Array<{ resolve: (value: string) => void; signal: AbortSignal }> = [];
    const resource = createApiRequest<string>((_, { signal }) => new Promise(resolve => pending.push({ resolve, signal })));
    const first = resource.execute();
    assert.equal(resource.loading.get(), true);
    const second = resource.execute();
    assert.equal(pending[0]!.signal.aborted, true);
    pending[1]!.resolve('latest');
    assert.equal(await second, 'latest');
    pending[0]!.resolve('stale');
    assert.equal(await first, undefined);
    assert.equal(resource.data.get(), 'latest');
    assert.equal(resource.snapshot.get().loading, false);
    resource.reset();
    assert.equal(resource.data.get(), null);
    assert.equal(resource.status.get(), 'idle');
});

test('failed request exposes error and retry recovers', async () => {
    let attempt = 0;
    const resource = createApiRequest(async () => {
        if (attempt++ === 0) throw new Error('offline');
        return 42;
    });
    await assert.rejects(resource.execute(), /offline/);
    assert.equal(resource.failed.get(), true);
    assert.equal(resource.error.get()?.message, 'offline');
    assert.equal(await resource.execute(), 42);
    assert.equal(resource.successful.get(), true);
    assert.equal(resource.error.get(), null);
});
