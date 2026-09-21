import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';
import type { KeyboardColor } from '@keycaps/domain/color-palette';

export const COLOR_PRESETS = [
    { id: 'graphite', label: 'Graphite · One color', detail: 'A monochrome charcoal set.', letters: '#34363a', actions: '#34363a', accent: '#34363a' },
    { id: 'classic', label: 'Classic · Two colors', detail: 'Warm ivory alphanumeric keys with gray action keys.', letters: '#e8e2d6', actions: '#6f7378', accent: '#6f7378' },
    { id: 'navy-coral', label: 'Navy & red · Three colors', detail: 'White alphanumeric keys, navy actions, and red F5–F8.', letters: '#f5f5f2', actions: '#263d59', accent: '#b94a48' },
    { id: 'custom', label: 'Custom', detail: 'Choose one, two, or three colors from the production palette.', letters: '#e8e2d6', actions: '#6f7378', accent: '#b94a48' },
] satisfies { id: KeyboardDesign['presetId']; label: string; detail: string; letters: KeyboardColor; actions: KeyboardColor; accent: KeyboardColor }[];
