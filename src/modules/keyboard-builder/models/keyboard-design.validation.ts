import { KEYBOARD_OPTIONS } from './keyboard-options';
import { COLOR_PRESETS } from './color-presets';
import type { KeyboardDesign } from './keyboard.types';

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate persisted data before it reaches the geometry and pricing code. */
export function isKeyboardDesign(value: unknown): value is KeyboardDesign {
    if (!isRecord(value)) return false;
    const color = (input: unknown) => typeof input === 'string' && /^#[0-9a-f]{6}$/i.test(input);
    return KEYBOARD_OPTIONS.sizes.some(option => option.id === value.size)
        && KEYBOARD_OPTIONS.physical.some(option => option.id === value.physical)
        && KEYBOARD_OPTIONS.letterLayouts.some(option => option.id === value.letterLayout)
        && COLOR_PRESETS.some(option => option.id === value.presetId)
        && Array.isArray(value.languages) && value.languages.length >= 1 && value.languages.length <= 2
        && new Set(value.languages).size === value.languages.length
        && value.languages.every(language => KEYBOARD_OPTIONS.languages.some(option => option.id === language))
        && (value.primaryCorner === 'top-left' || value.primaryCorner === 'top-right')
        && (value.customColorMode === 1 || value.customColorMode === 2 || value.customColorMode === 3)
        && isRecord(value.customColors)
        && color(value.customColors.letters) && color(value.customColors.actions) && color(value.customColors.accent)
        && isRecord(value.keyColors) && Object.values(value.keyColors).every(color);
}
