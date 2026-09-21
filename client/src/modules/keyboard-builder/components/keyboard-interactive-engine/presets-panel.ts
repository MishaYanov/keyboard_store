import { SETTINGS_CONTENT } from '../../models/settings.maps';
import { COLOR_PRESETS } from '@keycaps/domain/color-presets';
import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';

import type { SettingsControls } from './settings-controls';

export function renderPresets(controls: SettingsControls, design: KeyboardDesign): Node[] {
    const nodes: Node[] = [];
    nodes.push(controls.choices('preset', SETTINGS_CONTENT.colorScheme, COLOR_PRESETS, [design.presetId]));
    nodes.push(controls.builder.element('div', { className: 'keyboard-settings__swatches', attributes: { 'aria-label': SETTINGS_CONTENT.palette } },
        ['letters', 'actions', 'accent'].map(group => controls.builder.element('span', {
            style: { '--swatch-color': COLOR_PRESETS.find(preset => preset.id === design.presetId)![group as 'letters' | 'actions' | 'accent'] },
            attributes: { title: group },
        }))));
    nodes.push(controls.builder.element('p', {}, SETTINGS_CONTENT.preserveColors));
    if (design.size === '60' || design.size === '65') nodes.push(controls.builder.element('p', {}, SETTINGS_CONTENT.noFunctionRow));
    if (design.presetId === 'custom') {
        nodes.push(controls.choices('custom-mode', SETTINGS_CONTENT.customMode, [{ id: '1', label: SETTINGS_CONTENT.customOne }, { id: '2', label: SETTINGS_CONTENT.customTwo }, { id: '3', label: SETTINGS_CONTENT.customThree }], [String(design.customColorMode)]));
        const roles: (keyof KeyboardDesign['customColors'])[] = design.customColorMode === 1 ? ['letters'] : design.customColorMode === 2 ? ['letters', 'actions'] : ['letters', 'actions', 'accent'];
        const labels = { letters: SETTINGS_CONTENT.lettersColor, actions: SETTINGS_CONTENT.actionsColor, accent: SETTINGS_CONTENT.accentColor } as const;
        nodes.push(controls.builder.element('p', {}, SETTINGS_CONTENT.strictPalette));
        for (const role of roles) nodes.push(controls.palette(`custom-${role}`, labels[role], design.customColors[role]));
    }
    nodes.push(controls.button(SETTINGS_CONTENT.resetAll, 'reset-colors'));
    return nodes;
}
