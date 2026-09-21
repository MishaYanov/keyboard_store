import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';

export default defineConfig({ ssr: { noExternal: ['@keycaps/domain'] }, build: {
    ssr: true, target: 'node24', outDir: 'dist',
    rollupOptions: {
        input: Object.fromEntries(readdirSync('unit').filter(name => name.endsWith('.test.ts')).map(name => [name.replace(/\.ts$/, ''), `unit/${name}`])),
        output: { entryFileNames: '[name].mjs' },
    },
} });
