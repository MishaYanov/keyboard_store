import { createApiServer, readConfig, CommerceStore } from './app';

async function main() {
    const config = readConfig();
    const store = await CommerceStore.connect(config.database, config.mock ? 'mock' : 'live');
    if (!config.persistent) console.warn('SQLite storage is not declared persistent. Do not rely on this deployment to retain orders across restarts/redeploys.');
    const server = createApiServer({ config, store });
    server.listen(config.port, config.host, () => {
        console.log(`Commerce API listening on port ${config.port} (${config.mock ? 'mock' : 'live'} commerce, SQLite connected)`);
    });
    let closing = false;
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
        if (closing) return;
        closing = true;
        const deadline = setTimeout(() => process.exit(1), 15000).unref();
        server.close(() => {
            void server.drainRequests().then(() => store.close()).then(() => { clearTimeout(deadline); }).catch(() => process.exit(1));
        });
    });
}
main().catch(() => {
    // Never print credentials or customer data in startup errors.
    console.error('API startup failed. Check environment configuration and SQLite directory permissions/persistent storage.');
    process.exitCode = 1;
});
