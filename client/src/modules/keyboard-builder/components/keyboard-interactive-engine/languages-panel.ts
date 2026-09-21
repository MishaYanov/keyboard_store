import { SETTINGS_CONTENT, type LanguageStep } from '../../models/settings.maps';
import { KEYBOARD_OPTIONS } from '@keycaps/domain/keyboard-options';
import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';

import type { SettingsControls } from './settings-controls';

export function renderLanguages(controls: SettingsControls, design: KeyboardDesign, languageStep: LanguageStep): Node[] {
    const nodes: Node[] = [];
    if (languageStep === 'layout') nodes.push(
        controls.choices('letter-layout', SETTINGS_CONTENT.letterArrangement, KEYBOARD_OPTIONS.letterLayouts, [design.letterLayout]),
        controls.button(SETTINGS_CONTENT.chooseLanguages, 'languages'),
    );
    else {
        nodes.push(controls.button(SETTINGS_CONTENT.backToLayout, 'layout'));
        nodes.push(controls.builder.element('p', {}, SETTINGS_CONTENT.languageHelp(design.letterLayout)));
        nodes.push(controls.choices('language', SETTINGS_CONTENT.languageCount(design.languages.length), KEYBOARD_OPTIONS.languages, design.languages, true));
        nodes.push(controls.builder.element('label', { className: 'keyboard-settings__placement' }, [
            SETTINGS_CONTENT.placement,
            controls.builder.element('select', { attributes: { name: 'corner' } }, KEYBOARD_OPTIONS.corners.map(corner =>
                controls.builder.element('option', { attributes: { value: corner.id }, properties: { selected: corner.id === design.primaryCorner } }, corner.label))),
        ]));
        if (design.languages.length === 2) nodes.push(controls.button(SETTINGS_CONTENT.swap, 'swap'));
        const sample = controls.builder.element('div', { className: 'keyboard-settings__sample', attributes: { 'aria-label': SETTINGS_CONTENT.cornerPreview } },
            design.languages.map((id, index) => controls.builder.element('span', {
                dataset: { corner: index === 0 ? design.primaryCorner : design.primaryCorner === 'top-left' ? 'bottom-right' : 'bottom-left' },
            }, KEYBOARD_OPTIONS.languages.find(language => language.id === id)!.label)));
        nodes.push(sample);
    }
    return nodes;
}
