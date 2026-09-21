import { SETTINGS_CONTENT } from '../../models/settings.maps';
import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';
import { keyboardGeometry } from '@keycaps/domain/keyboard-geometry';
import { keyColor, keyColorId } from '@keycaps/domain/key-colors';

import type { SettingsControls } from './settings-controls';

export function renderIndividual(controls: SettingsControls, design: KeyboardDesign, selectedKey: string | null): Node[] {
    const nodes: Node[] = [];
    const keys = keyboardGeometry(design).keys;
    const selected = keys.find(key => keyColorId(design, key) === selectedKey);
    nodes.push(controls.builder.element('p', {}, SETTINGS_CONTENT.selectHelp));
    nodes.push(controls.builder.element('label', { className: 'keyboard-settings__placement' }, [
        SETTINGS_CONTENT.selectedKey,
        controls.builder.element('select', { attributes: { name: 'selected-key' } }, [
            controls.builder.element('option', { attributes: { value: '' } }, SETTINGS_CONTENT.chooseKey),
            ...keys.map((key, index) => controls.builder.element('option', {
                attributes: { value: keyColorId(design, key) },
                properties: { selected: keyColorId(design, key) === selectedKey },
            }, SETTINGS_CONTENT.keyOption(key.label, index + 1))),
        ]),
    ]));
    if (selected) {
        nodes.push(controls.palette('key-color', SETTINGS_CONTENT.colorFor(selected.label), keyColor(design, selected)));
        nodes.push(controls.builder.element('label', { className: 'keyboard-settings__placement' }, [
            SETTINGS_CONTENT.legendFor(selected.label),
            controls.builder.element('input', {
                attributes: { name: 'key-legend', type: 'text', maxlength: 24, spellcheck: 'false', 'aria-describedby': 'key-legend-help' },
                properties: { value: design.keyLegends[selectedKey!] ?? selected.label },
            }),
        ]));
        nodes.push(controls.builder.element('small', { attributes: { id: 'key-legend-help' } }, SETTINGS_CONTENT.legendHelp));
        nodes.push(controls.button(SETTINGS_CONTENT.applyLegend, 'apply-legend'));
        nodes.push(controls.button(SETTINGS_CONTENT.resetKey, 'reset-key'));
    }
    return nodes;
}
