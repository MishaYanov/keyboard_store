import type { KeyboardDesign } from './keyboard.types';

export const COLOR_PRESETS = [
    { id: 'graphite', label: 'Graphite · One color', detail: 'A monochrome charcoal set.', letters: '#454851', actions: '#454851', accent: '#454851' },
    { id: 'classic', label: 'Classic · Two colors', detail: 'Warm ivory alphanumeric keys with gray action keys.', letters: '#e8e2d6', actions: '#899096', accent: '#899096' },
    { id: 'navy-coral', label: 'Navy & coral · Three colors', detail: 'Pale alphanumeric keys, navy actions, and coral F5–F8.', letters: '#dce6ee', actions: '#263d59', accent: '#ee826f' },
] satisfies { id: KeyboardDesign['presetId']; label: string; detail: string; letters: string; actions: string; accent: string }[];
