import { defineConfig } from 'vite';

export default defineConfig({ ssr: { noExternal: ['@keycaps/domain'] }, build: {
    ssr: true, target: 'node24', outDir: 'dist',
    rollupOptions: { input: { app: 'app.ts', start: 'start.ts' }, output: { entryFileNames: '[name].js' } },
} });
