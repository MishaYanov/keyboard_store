import { build } from 'vite';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

let child;
let closing = false;
let restart = Promise.resolve();
const watcher = await build({ configFile: 'vite.config.mjs', build: { watch: {
    watcher: { usePolling: process.env.DEV_POLLING === 'true', pollInterval: 500 },
} } });
async function stopChild() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
}
watcher.on('event', event => {
    if (event.code !== 'END') return;
    restart = restart.then(async () => {
        await stopChild();
        if (!closing) child = spawn(process.execPath, ['--env-file-if-exists=.env', 'dist/start.js'], {
            stdio: 'inherit', windowsHide: true, env: { ...process.env, NODE_ENV: 'development' },
        });
    }).catch(error => console.error('API restart failed:', error.message));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    closing = true;
    await watcher.close();
    await restart;
    await stopChild();
    process.exit(0);
});
