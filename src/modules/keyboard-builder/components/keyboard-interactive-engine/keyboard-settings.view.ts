import type { ComponentBuilder } from '../../../../engine';
import { BUILDER_CONTENT } from '../../models/builder.maps';
import { SETTINGS_CONTENT, type LanguageStep } from '../../models/settings.maps';
import { KEYBOARD_OPTIONS } from '../../models/keyboard-options';
import { COLOR_PRESETS } from '../../models/color-presets';
import type { KeyboardDesign } from '../../models/keyboard.types';
import type { KeyboardDesign as KeyboardDesignAlias } from '../../models/keyboard.types';
import { keyboardGeometry } from './keyboard-geometry';
import { keyColor, keyColorId } from './key-colors';
import { CalculatorService } from '../../services/calculator.service';

/** Renders settings from a state snapshot; the wrapper owns events and state changes. */
export class KeyboardSettingsView {
    public constructor(private readonly builder: ComponentBuilder, private readonly panel: HTMLDivElement) {}

    private button(text: string, action: string): HTMLButtonElement {
        return this.builder.element('button', { attributes: { type: 'button' }, dataset: { action } }, text);
    }

    private choices(name: string, title: string, options: readonly { id: string; label: string; detail?: string }[], selected: readonly string[], multiple = false): HTMLFieldSetElement {
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

    public render(activeView: string, languageStep: LanguageStep, design: KeyboardDesign, selectedKey: string | null): void {
        const focused = document.activeElement;
        const focusName = focused instanceof HTMLInputElement || focused instanceof HTMLSelectElement ? focused.name : '';
        const focusValue = focused instanceof HTMLInputElement && ['radio', 'checkbox'].includes(focused.type) ? focused.value : '';
        const focusAction = focused instanceof HTMLElement ? focused.dataset.action : undefined;
        const title = activeView === 'languages' && languageStep === 'languages' ? SETTINGS_CONTENT.printedLanguages : BUILDER_CONTENT.columns.find(column => column.id === activeView)!.label;
        const nodes: Node[] = [this.builder.element('div', { className: 'keyboard-settings__heading' }, [
            this.builder.element('h2', { attributes: { tabindex: -1 } }, title), this.button(SETTINGS_CONTENT.close, 'close'),
        ])];
        if (activeView === 'keyboard-size') nodes.push(this.choices('size', SETTINGS_CONTENT.size, KEYBOARD_OPTIONS.sizes, [design.size]));
        if (activeView === 'physical-layout') nodes.push(this.choices('physical', SETTINGS_CONTENT.physical, KEYBOARD_OPTIONS.physical, [design.physical]));
        if (activeView === 'preset-colors') nodes.push(...this.renderPresets(design));
        if (activeView === 'individual-style') nodes.push(...this.renderIndividual(design, selectedKey));
        if (activeView === 'languages') nodes.push(...this.renderLanguages(design, languageStep));
        if (activeView === 'finalize') nodes.push(...this.renderFinalize(design));
        this.panel.replaceChildren(...nodes);
        if (focusName === 'letter-layout' && languageStep === 'languages') {
            this.panel.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
        } else if (focusName && this.panel.isConnected) {
            this.panel.querySelector<HTMLElement>(`[name="${CSS.escape(focusName)}"]${focusValue ? `[value="${CSS.escape(focusValue)}"]` : ''}`)?.focus({ preventScroll: true });
        } else if (focusAction && this.panel.isConnected) {
            this.panel.querySelector<HTMLElement>(`[data-action="${CSS.escape(focusAction)}"]`)?.focus({ preventScroll: true });
        }
    }

    private renderFinalize(design: KeyboardDesign): Node[] {
        const calculator = new CalculatorService();
        const quote = calculator.calculate(design);
        return [
            this.builder.element('p', {}, 'Your configuration, ready to add to your basket.'),
            this.builder.element('dl', { className: 'keyboard-settings__price' }, quote.items.flatMap(item => [
                this.builder.element('dt', {}, `${item.label}${item.quantity !== 1 ? ` × ${item.quantity}` : ''}`),
                this.builder.element('dd', {}, item.totalCents === 0 ? 'Included' : `${calculator.format(item.totalCents)}${item.quantity > 1 ? ` (${calculator.format(item.unitCents)} each)` : ''}`),
            ])),
            this.builder.element('p', { attributes: { role: 'status' } }, `Subtotal: ${calculator.format(quote.totalCents)}`),
            this.builder.element('p', {}, 'Sample prices in USD. Shipping and tax are not included.'),
            this.button('Add to basket', 'add-to-basket'),
            this.builder.element('a', { attributes: { href: '#/checkout' } }, 'View basket'),
        ];
    }

    private renderPresets(design: KeyboardDesign): Node[] {
        const nodes: Node[] = [];
        nodes.push(this.choices('preset', SETTINGS_CONTENT.colorScheme, COLOR_PRESETS, [design.presetId]));
        nodes.push(this.builder.element('div', { className: 'keyboard-settings__swatches', attributes: { 'aria-label': SETTINGS_CONTENT.palette } },
            ['letters', 'actions', 'accent'].map(group => this.builder.element('span', {
                style: { '--swatch-color': COLOR_PRESETS.find(preset => preset.id === design.presetId)![group as 'letters' | 'actions' | 'accent'] },
                attributes: { title: group },
            }))));
        nodes.push(this.builder.element('p', {}, SETTINGS_CONTENT.preserveColors));
        if (design.size === '60' || design.size === '65') nodes.push(this.builder.element('p', {}, SETTINGS_CONTENT.noFunctionRow));
        if (design.presetId === 'custom') {
            nodes.push(this.choices('custom-mode', SETTINGS_CONTENT.customMode, [{ id: '1', label: SETTINGS_CONTENT.customOne }, { id: '2', label: SETTINGS_CONTENT.customTwo }, { id: '3', label: SETTINGS_CONTENT.customThree }], [String(design.customColorMode)]));
            const roles: (keyof KeyboardDesign['customColors'])[] = design.customColorMode === 1 ? ['letters'] : design.customColorMode === 2 ? ['letters', 'actions'] : ['letters', 'actions', 'accent'];
            const labels = { letters: SETTINGS_CONTENT.lettersColor, actions: SETTINGS_CONTENT.actionsColor, accent: SETTINGS_CONTENT.accentColor } as const;
            for (const role of roles) nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [labels[role], this.builder.element('input', { attributes: { name: `custom-${role}`, type: 'color' }, properties: { value: design.customColors[role] } })]));
        }
        nodes.push(this.button(SETTINGS_CONTENT.resetAll, 'reset-colors'));
        return nodes;
    }

    private renderIndividual(design: KeyboardDesign, selectedKey: string | null): Node[] {
        const nodes: Node[] = [];
        const keys = keyboardGeometry(design).keys;
        const selected = keys.find(key => keyColorId(design, key) === selectedKey);
        nodes.push(this.builder.element('p', {}, SETTINGS_CONTENT.selectHelp));
        nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [
            SETTINGS_CONTENT.selectedKey,
            this.builder.element('select', { attributes: { name: 'selected-key' } }, [
                this.builder.element('option', { attributes: { value: '' } }, SETTINGS_CONTENT.chooseKey),
                ...keys.map((key, index) => this.builder.element('option', {
                    attributes: { value: keyColorId(design, key) },
                    properties: { selected: keyColorId(design, key) === selectedKey },
                }, SETTINGS_CONTENT.keyOption(key.label, index + 1))),
            ]),
        ]));
        if (selected) {
            nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [
                SETTINGS_CONTENT.colorFor(selected.label),
                this.builder.element('input', { attributes: { name: 'key-color', type: 'color' }, properties: { value: keyColor(design, selected) } }),
            ]));
            nodes.push(this.builder.element('p', { attributes: { role: 'status' } }, `${selected.label}: ${keyColor(design, selected).toUpperCase()}`));
            nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [
                SETTINGS_CONTENT.hexColor,
                this.builder.element('input', { attributes: { name: 'key-color-hex', type: 'text', pattern: '#[0-9a-fA-F]{6}', maxlength: 7, spellcheck: 'false', title: SETTINGS_CONTENT.hexHelp }, properties: { value: keyColor(design, selected) } }),
            ]));
            nodes.push(this.button(SETTINGS_CONTENT.applyColor, 'apply-color'));
            nodes.push(this.button(SETTINGS_CONTENT.resetKey, 'reset-key'));
        }
        return nodes;
    }

    private renderLanguages(design: KeyboardDesign, languageStep: LanguageStep): Node[] {
        const nodes: Node[] = [];
        if (languageStep === 'layout') nodes.push(
            this.choices('letter-layout', SETTINGS_CONTENT.letterArrangement, KEYBOARD_OPTIONS.letterLayouts, [design.letterLayout]),
            this.button(SETTINGS_CONTENT.chooseLanguages, 'languages'),
        );
        else {
            nodes.push(this.button(SETTINGS_CONTENT.backToLayout, 'layout'));
            nodes.push(this.builder.element('p', {}, SETTINGS_CONTENT.languageHelp(design.letterLayout)));
            nodes.push(this.choices('language', SETTINGS_CONTENT.languageCount(design.languages.length), KEYBOARD_OPTIONS.languages, design.languages, true));
            nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [
                SETTINGS_CONTENT.placement,
                this.builder.element('select', { attributes: { name: 'corner' } }, KEYBOARD_OPTIONS.corners.map(corner =>
                    this.builder.element('option', { attributes: { value: corner.id }, properties: { selected: corner.id === design.primaryCorner } }, corner.label))),
            ]));
            if (design.languages.length === 2) nodes.push(this.button(SETTINGS_CONTENT.swap, 'swap'));
            const sample = this.builder.element('div', { className: 'keyboard-settings__sample', attributes: { 'aria-label': SETTINGS_CONTENT.cornerPreview } },
                design.languages.map((id, index) => this.builder.element('span', {
                    dataset: { corner: index === 0 ? design.primaryCorner : design.primaryCorner === 'top-left' ? 'bottom-right' : 'bottom-left' },
                }, KEYBOARD_OPTIONS.languages.find(language => language.id === id)!.label)));
            nodes.push(sample);
        }
        return nodes;
    }
}
