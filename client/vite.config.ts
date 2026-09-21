import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        watch: { usePolling: process.env.DEV_POLLING === 'true', interval: 500 },
        proxy: { '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001' } },
    },
});
