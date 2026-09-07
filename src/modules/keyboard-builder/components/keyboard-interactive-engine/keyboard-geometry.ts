import type { KeyboardDesign } from '../../models/keyboard.types';

export interface PreviewKey { x: number; y: number; width: number; height: number; label: string; row?: number; letter?: number; iso?: boolean }
export function hitKeyboardKey(keys: readonly PreviewKey[], point: { x: number; y: number }): PreviewKey | undefined {
    return keys.find(key => {
        const x = point.x - key.x - 0.35, y = point.y - key.y - 0.35;
        return x >= 0 && x <= key.width - 0.1 && y >= 0 && y <= key.height - 0.1 && !(key.iso && x < 0.25 && y > 0.95);
    });
}
export function keyboardGeometry(design: KeyboardDesign): { keys: PreviewKey[]; width: number; height: number } {
    const keys: PreviewKey[] = [];
    const hasFunctions = ['100', 'tkl', '75'].includes(design.size);
    const compactArrows = ['60', '65', '75'].includes(design.size);
    const arrowX = design.size === '60' ? 13 : 14;
    const offset = hasFunctions ? 1.4 : 0;
    const add = (x: number, y: number, width: number, label: string, extra: Partial<PreviewKey> = {}) => keys.push({ x, y: y + offset, width, height: 1, label, ...extra });
    const row = (y: number, entries: (string | [string, number])[]) => {
        let x = 0;
        for (const entry of entries) { const [label, width] = typeof entry === 'string' ? [entry, 1] : entry; add(x, y, width, label); x += width; }
    };
    row(0, ['`', '1','2','3','4','5','6','7','8','9','0','-','=', ['Back', 2]]);
    const sequences = design.letterLayout === 'azerty' ? ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'] : design.letterLayout === 'qwertz' ? ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'] : ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    add(0, 1, 1.5, 'Tab');
    [...sequences[0]!].forEach((letter, index) => add(1.5 + index, 1, 1, letter, { row: 0, letter: index }));
    add(11.5, 1, 1, '['); add(12.5, 1, 1, ']');
    if (design.physical === 'ansi') add(13.5, 1, 1.5, '\\');
    add(0, 2, 1.75, 'Caps');
    [...sequences[1]!].forEach((letter, index) => add(1.75 + index, 2, 1, letter, { row: 1, letter: index }));
    if (sequences[1]!.length === 9) add(10.75, 2, 1, ';');
    add(11.75, 2, 1, "'");
    if (design.physical === 'ansi') add(12.75, 2, 2.25, 'Enter');
    else {
        add(12.75, 2, 1, design.physical === 'jis' ? 'む' : '#');
        add(13.5, 1, 1.5, 'Enter', { height: 2, iso: true });
    }
    add(0, 3, design.physical === 'iso' ? 1.25 : 2.25, 'Shift');
    if (design.physical === 'iso') add(1.25, 3, 1, '<');
    [...sequences[2]!].forEach((letter, index) => add(2.25 + index, 3, 1, letter, { row: 2, letter: index }));
    let punctuation = 2.25 + sequences[2]!.length;
    while (punctuation < 12.25) { add(punctuation, 3, 1, [',', '.', '/'][Math.round(punctuation - 9.25)] ?? ','); punctuation += 1; }
    add(12.25, 3, compactArrows ? arrowX - 12.25 : design.physical === 'jis' ? 1.75 : 2.75, 'Shift');
    if (compactArrows) add(arrowX, 3, 1, '↑');
    else if (design.physical === 'jis') add(14, 3, 1, 'ろ');
    if (design.physical === 'jis' && compactArrows) {
        row(4, [['Ctrl', 1.25], ['Win', 1], ['Alt', 1.25], ['無変換', 1.25], ['Space', arrowX - 10.5], ['変換', 1.25], ['かな', 1.25], ['Alt', 1.25], ['Fn', 1], '←', '↓', '→']);
    } else if (design.physical === 'jis') {
        row(4, [['Ctrl', 1.25], ['Win', 1], ['Alt', 1.25], ['無変換', 1.25], ['Space', 3.5], ['変換', 1.25], ['かな', 1.25], ['Alt', 1.25], ['Menu', 1.5], ['Ctrl', 1.5]]);
    } else if (compactArrows) row(4, [['Ctrl', 1.25], ['Win', 1.25], ['Alt', 1.25], ['Space', 6.25], 'Alt', ['Fn', arrowX - 12], '←', '↓', '→']);
    else row(4, [['Ctrl', 1.25], ['Win', 1.25], ['Alt', 1.25], ['Space', 6.25], ['Alt', 1.25], ['Win', 1.25], ['Menu', 1.25], ['Ctrl', 1.25]]);
    if (hasFunctions) {
        keys.push({ x: 0, y: 0, width: 1, height: 1, label: 'Esc' });
        for (let i = 0; i < 12; i++) keys.push({ x: 2 + i + (design.size === '75' ? 0 : Math.floor(i / 4) * 0.5), y: 0, width: 1, height: 1, label: `F${i + 1}` });
    }
    if (design.size === '100' || design.size === 'tkl') {
        ['Prt', 'Scr', 'Pause'].forEach((label, i) => keys.push({ x: 15.5 + i, y: 0, width: 1, height: 1, label }));
        ['Ins', 'Home', 'PgUp', 'Del', 'End', 'PgDn'].forEach((label, i) => add(15.5 + i % 3, Math.floor(i / 3), 1, label));
        add(16.5, 3, 1, '↑'); ['←', '↓', '→'].forEach((label, i) => add(15.5 + i, 4, 1, label));
    } else if (design.size !== '60') {
        ['Del', 'PgUp', 'PgDn', 'End'].forEach((label, i) => add(15, i, 1, label));
        if (design.size === '75') {
            keys.push({ x: 14, y: 0, width: 1, height: 1, label: 'Home' });
            keys.push({ x: 15, y: 0, width: 1, height: 1, label: 'Del' });
        }
    }
    if (design.size === '100') {
        ['Num', '/', '*', '-'].forEach((label, i) => add(19 + i, 0, 1, label));
        ['7','8','9','4','5','6','1','2','3'].forEach((label, i) => add(19 + i % 3, 1 + Math.floor(i / 3), 1, label));
        add(22, 1, 1, '+', { height: 2 }); add(22, 3, 1, 'Enter', { height: 2 }); add(19, 4, 2, '0'); add(21, 4, 1, '.');
    }
    return { keys, width: Math.max(...keys.map(key => key.x + key.width)) + 0.6, height: offset + 5.6 };
}

