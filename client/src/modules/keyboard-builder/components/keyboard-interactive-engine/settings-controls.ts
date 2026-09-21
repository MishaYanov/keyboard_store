import type { ComponentBuilder } from '../../../../engine';
import { KEYBOARD_COLOR_PALETTE, type KeyboardColor } from '@keycaps/domain/color-palette';

/** Reusable controls only; pane-specific content lives in panel renderers. */
export class SettingsControls {
    public constructor(public readonly builder: ComponentBuilder) {}
    public button(text: string, action: string): HTMLButtonElement {
        return this.builder.element('button', { attributes: { type: 'button' }, dataset: { action } }, text);
    }

    public choices(name: string, title: string, options: readonly { id: string; label: string; detail?: string }[], selected: readonly string[], multiple = false): HTMLFieldSetElement {
        return this.builder.element('fieldset', {}, [
            this.builder.element('legend', {}, title),
            ...options.map(option => this.builder.element('label', { className: 'keyboard-settings__option' }, [
                this.builder.element('input', {
                    attributes: { type: multiple ? 'checkbox' : 'radio', name, value: option.id },
                    properties: { checked: selected.includes(option.id), disabled: multiple && (selected.length === 2 && !selected.includes(option.id) || selected.length === 1 && selected.includes(option.id)) },
                }),
                this.builder.element('span', {}, [
                    this.builder.element('strong', {}, option.label),
                    option.detail ? this.builder.element('small', {}, option.detail) : null,
                ]),
            ])),
        ]);
    }

    public palette(name: string, title: string, selected: KeyboardColor): HTMLFieldSetElement {
        return this.builder.element('fieldset', { className: 'keyboard-settings__palette-field' }, [
            this.builder.element('legend', {}, title),
            this.builder.element('div', { className: 'keyboard-settings__palette' }, KEYBOARD_COLOR_PALETTE.map(color =>
                this.builder.element('label', { className: 'keyboard-settings__color-option', attributes: { title: `${color.label} · ${color.value.toUpperCase()}` } }, [
                    this.builder.element('input', {
                        attributes: { type: 'radio', name, value: color.value, 'aria-label': color.label },
                        properties: { checked: color.value === selected },
                    }),
                    this.builder.element('span', { className: 'keyboard-settings__color-swatch', style: { '--swatch-color': color.value } }),
                    this.builder.element('span', {}, color.label),
                ]),
            )),
        ]);
    }

}
