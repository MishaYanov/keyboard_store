import type { KeyboardDesign, KeyboardSize, PhysicalLayout, LetterLayout, LegendLanguage } from '@keycaps/domain/keyboard.types';

export const KEYBOARD_OPTIONS = {
    sizes: [
        { id: '100', label: 'Full-size · 100%', detail: 'Numpad, navigation, arrows, and function row. Usually 104–108 keys.' },
        { id: 'tkl', label: 'Tenkeyless · 80%', detail: 'Separate navigation and arrows, without a numpad. Usually 87–88 keys.' },
        { id: '75', label: 'Compact · 75%', detail: 'Function row and arrows in a tighter footprint. Usually 82–84 keys.' },
        { id: '65', label: 'Compact · 65%', detail: 'Dedicated arrows without the function row. Usually 67–68 keys.' },
        { id: '60', label: 'Ultra-compact · 60%', detail: 'Custom variant with dedicated arrows and a shorter right Shift; no function row or navigation column.' },
    ] satisfies { id: KeyboardSize; label: string; detail: string }[],
    physical: [
        { id: 'ansi', label: 'ANSI', detail: 'Wide, single-row Enter and a long left Shift. Common in North America.' },
        { id: 'iso', label: 'ISO', detail: 'Tall L-shaped Enter and a shorter left Shift with an extra key. Common in Europe.' },
        { id: 'jis', label: 'JIS', detail: 'Tall Enter, a shorter spacebar, and extra input-mode keys. Japanese physical layout.' },
    ] satisfies { id: PhysicalLayout; label: string; detail: string }[],
    letterLayouts: [
        { id: 'qwerty', label: 'QWERTY', detail: 'Q–W–E–R–T–Y. Common for English and many other languages.' },
        { id: 'qwertz', label: 'QWERTZ', detail: 'Q–W–E–R–T–Z. Common in German-speaking and some Central European regions.' },
        { id: 'azerty', label: 'AZERTY', detail: 'A–Z–E–R–T–Y. Common in French-speaking regions; national variants differ.' },
    ] satisfies { id: LetterLayout; label: string; detail: string }[],
    languages: [
        { id: 'en', label: 'English' }, { id: 'de', label: 'German' }, { id: 'fr', label: 'French' },
        { id: 'es', label: 'Spanish' }, { id: 'pt', label: 'Portuguese' }, { id: 'it', label: 'Italian' },
        { id: 'nl', label: 'Dutch' }, { id: 'he', label: 'Hebrew' }, { id: 'ar', label: 'Arabic' }, { id: 'ru', label: 'Russian' },
    ] satisfies { id: LegendLanguage; label: string }[],
    corners: [{ id: 'top-left', label: 'Top left / bottom right' }, { id: 'top-right', label: 'Top right / bottom left' }] as const,
    initial: { size: '100', physical: 'ansi', letterLayout: 'qwerty', languages: ['en'], primaryCorner: 'top-left', presetId: 'classic', customColorMode: 2, customColors: { letters: '#e8e2d6', actions: '#6f7378', accent: '#b94a48' }, keyColors: {}, keyLegends: {} } satisfies KeyboardDesign,
    previewNote: 'Schematic preview: key counts and punctuation vary by board and national layout. Letter placement here is a custom print preview, not an operating-system keymap.',
};

