import { createServer } from 'vite';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createApiServer, readConfig, CommerceStore } from '../../server/dist/app.js';

process.chdir(fileURLToPath(new URL('../../client', import.meta.url)));
const config = readConfig({ COMMERCE_MODE: 'mock', APP_ORIGIN: 'http://127.0.0.1:5180' });
const store = await CommerceStore.connect(':memory:', 'mock');
const api = createApiServer({ config, store });
let web;
let shutdown;
function close() {
    return shutdown ??= (async () => {
        try { await web?.close(); }
        finally {
            try { await new Promise(resolve => { api.close(resolve); api.closeAllConnections(); }); }
            finally {
                await api.drainRequests();
                await store.close();
            }
        }
    })();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    void close().catch(error => { console.error(error); process.exitCode = 1; });
});
try {
    api.listen(0, '127.0.0.1');
    await once(api, 'listening');
    web = await createServer({ server: { host: '127.0.0.1', port: 5180, strictPort: true,
        proxy: { '/api': { target: `http://127.0.0.1:${api.address().port}` } } } });
    await web.listen();
} catch (error) {
    await close();
    throw error;
}
