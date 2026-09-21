import { KEYBOARD_OPTIONS } from '@keycaps/domain/keyboard-options';
import { COLOR_PRESETS } from '@keycaps/domain/color-presets';
import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';
import { closestKeyboardColor, isKeyboardColor } from '@keycaps/domain/color-palette';

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate persisted data before it reaches the geometry and pricing code. */
export function isKeyboardDesign(value: unknown): value is KeyboardDesign {
    if (!isRecord(value)) return false;
    const legend = (input: unknown) => typeof input === 'string'
        && input === input.trim() && [...input].length > 0 && [...input].length <= 24;
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
        && isKeyboardColor(value.customColors.letters) && isKeyboardColor(value.customColors.actions) && isKeyboardColor(value.customColors.accent)
        && isRecord(value.keyColors) && Object.values(value.keyColors).every(isKeyboardColor)
        && isRecord(value.keyLegends) && Object.values(value.keyLegends).every(legend);
}

/** Upgrade older free-form color designs to the nearest supported production color. */
export function normalizeKeyboardDesign(value: unknown): KeyboardDesign | null {
    if (!isRecord(value) || !isRecord(value.customColors) || !isRecord(value.keyColors)) return null;
    const normalizeColor = (input: unknown) => typeof input === 'string' && /^#[0-9a-f]{6}$/i.test(input)
        ? closestKeyboardColor(input)
        : null;
    const letters = normalizeColor(value.customColors.letters);
    const actions = normalizeColor(value.customColors.actions);
    const accent = normalizeColor(value.customColors.accent);
    if (!letters || !actions || !accent) return null;
    const keyColors: Record<string, ReturnType<typeof closestKeyboardColor>> = {};
    for (const [id, color] of Object.entries(value.keyColors)) {
        const normalized = normalizeColor(color);
        if (!normalized) return null;
        keyColors[id] = normalized;
    }
    const keyLegends = value.keyLegends === undefined ? {} : value.keyLegends;
    const candidate = {
        ...value,
        customColors: { letters, actions, accent },
        keyColors,
        keyLegends,
    };
    return isKeyboardDesign(candidate) ? candidate : null;
}
