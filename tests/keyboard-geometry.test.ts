import assert from 'node:assert/strict';
import { keyboardGeometry } from '../src/modules/keyboard-builder/components/keyboard-interactive-engine/keyboard-geometry.ts';

const base = { size: '100', physical: 'ansi', letterLayout: 'qwerty', languages: ['en'], primaryCorner: 'top-left', presetId: 'classic', customColorMode: 2, customColors: { letters: '#e8e2d6', actions: '#899096', accent: '#ee826f' }, keyColors: {} } as const;
for (const [size, count] of [['100', 104], ['tkl', 87], ['75', 82], ['65', 67], ['60', 63]] as const) {
    const board = keyboardGeometry({ ...base, size });
    assert.equal(board.keys.length, count, `${size} ANSI count`);
    assert.equal(board.keys.some(key => key.label === 'Num'), size === '100');
    assert.equal(board.keys.some(key => key.label === 'F1'), ['100', 'tkl', '75'].includes(size));
    assert.equal(board.keys.some(key => key.label === '↑'), true);
}
const ansi = keyboardGeometry(base);
const iso = keyboardGeometry({ ...base, physical: 'iso' });
assert.equal(iso.keys.length, 105);
assert(iso.keys.some(key => key.label === 'Enter' && key.iso));
assert(!ansi.keys.some(key => key.iso));
const jis = keyboardGeometry({ ...base, physical: 'jis' });
assert(jis.keys.find(key => key.label === 'Space')!.width < ansi.keys.find(key => key.label === 'Space')!.width);
assert(jis.keys.some(key => key.label === 'かな'));
for (const [letterLayout, expected] of [['qwerty', 'QWERTY'], ['qwertz', 'QWERTZ'], ['azerty', 'AZERTY']] as const) {
    const board = keyboardGeometry({ ...base, letterLayout });
    assert.equal(board.keys.filter(key => key.row === 0).slice(0, 6).map(key => key.label).join(''), expected);
}
console.log('PASS: size counts, key groups, ANSI/ISO/JIS differences, and letter arrangements');
for (const size of ['60', '65', '75'] as const) {
    for (const physical of ['ansi', 'iso', 'jis'] as const) {
        const { keys } = keyboardGeometry({ ...base, size, physical });
        const arrows = ['←', '↓', '→', '↑'].map(label => {
            assert.equal(keys.filter(key => key.label === label).length, 1);
            return keys.find(key => key.label === label)!;
        });
        const [left, down, right, up] = arrows;
        assert.equal(up.x, down.x, `${size} ${physical}: vertical arrows align`);
        assert.equal(left.x + 1, down.x);
        assert.equal(down.x + 1, right.x);
        assert.equal(up.y + 1, down.y);
        for (const arrow of arrows) for (const key of keys) {
            if (key === arrow) continue;
            assert(!(arrow.x < key.x + key.width && arrow.x + arrow.width > key.x && arrow.y < key.y + key.height && arrow.y + arrow.height > key.y), `${size} ${physical}: ${arrow.label} overlaps ${key.label}`);
        }
    }
}
console.log('PASS: compact arrow alignment and no arrow overlaps across ANSI, ISO and JIS');
