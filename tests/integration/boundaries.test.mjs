import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
function sources(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = resolve(directory, entry.name);
        if (['dist', 'node_modules', 'data'].includes(entry.name)) return [];
        return entry.isDirectory() ? sources(file) : /\.(ts|mjs|js)$/.test(file) ? [file] : [];
    });
}
test('client, server and shared domain respect import boundaries', () => {
    for (const [workspace, folder, forbidden] of [
        ['client', 'client/src', ['server', 'tests']],
        ['server', 'server', ['client', 'tests']],
        ['shared', 'shared/src', ['client', 'server', 'tests']],
    ]) {
        for (const file of sources(resolve(root, folder))) {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(/(?:from\s+|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
                const specifier = match[1];
                const target = specifier.startsWith('.') ? relative(root, resolve(dirname(file), specifier)).split(sep)[0]
                    : specifier.startsWith('@keycaps/') ? specifier.split('/')[1] : null;
                assert.ok(!forbidden.includes(target), `${workspace} must not import ${specifier} in ${relative(root, file)}`);
            }
        }
    }
});
