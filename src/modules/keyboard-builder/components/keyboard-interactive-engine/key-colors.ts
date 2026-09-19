import type { KeyboardDesign } from '../../models/keyboard.types';
import { COLOR_PRESETS } from '../../models/color-presets';
import type { PreviewKey } from './keyboard-geometry';

/** Overrides belong to a physical key within its size/layout, not its printed letter. */
export function keyColorId(design: KeyboardDesign, key: PreviewKey): string {
    return `${design.size}:${design.physical}:${key.row === undefined ? `${key.x}:${key.y}:${key.label}` : `letter:${key.row}:${key.letter}`}`;
}
export function keyColor(design: KeyboardDesign, key: PreviewKey): string {
    const override = design.keyColors[keyColorId(design, key)];
    if (override) return override;
    const preset = design.presetId === 'custom' ? design.customColors : COLOR_PRESETS.find(option => option.id === design.presetId)!;
    const alphanumeric = key.row !== undefined || (Array.from(key.label).length === 1 && !'←↑↓→'.includes(key.label));
    if (design.presetId === 'custom' && design.customColorMode === 1) return preset.letters;
    if (design.presetId === 'custom' && design.customColorMode === 2) return alphanumeric ? preset.letters : preset.actions;
    if (/^F[5-8]$/.test(key.label)) return preset.accent;
    return alphanumeric ? preset.letters : preset.actions;
}
export function legendColor(background: string): string {
    const channels = [1, 3, 5].map(offset => parseInt(background.slice(offset, offset + 2), 16) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    return luminance > 0.179 ? '#111111' : '#ffffff';
}
