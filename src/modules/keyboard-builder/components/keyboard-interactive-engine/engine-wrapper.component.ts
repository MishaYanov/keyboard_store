import { Component, effect, type ApplicationContext } from '../../../../engine';
import { GridComponent } from '../../../../shared/grid/grid.component';
import { BUILDER_CONTENT } from '../../models/builder.maps';
import { createKeyboardScene } from './keyboard-scene';
import { keyboardGeometry, hitKeyboardKey } from './keyboard-geometry';
import { keyColor, keyColorId } from './key-colors';
import { COLOR_PRESETS } from '../../models/color-presets';
import { KEYBOARD_OPTIONS } from '../../models/keyboard-options';
import { KeyboardDesignService } from '../../services/keyboard-design.service';
import type { KeyboardDesign, KeyboardSize, PhysicalLayout, LetterLayout, LegendLanguage } from '../../models/keyboard.types';
import '../../styles/keyboard-settings.css';

export class EngineWrapperComponent extends Component<HTMLElement> {
    private readonly grid: GridComponent;
    private readonly viewStatus: HTMLParagraphElement;
    private readonly panel: HTMLDivElement;
    private readonly service = new KeyboardDesignService();
    private activeView = 'keyboard-size';
    private languageStep: 'layout' | 'languages' = 'layout';
    private framing = '';

    public constructor(private readonly context: ApplicationContext) {
        super(document.createElement('section'));
        this.root.className = 'keyboard-engine';
        this.viewStatus = this.builder.element('p', { attributes: { role: 'status', 'aria-live': 'polite' } });
        this.panel = this.builder.element('div', { className: 'keyboard-settings' });
        const scene = createKeyboardScene(() => this.service.design.get(), () => this.activeView === 'individual-style' ? this.service.selectedKey.get() : null);
        scene.pointer = point => {
            if (this.activeView !== 'individual-style') return;
            const design = this.service.design.get();
            const key = hitKeyboardKey(keyboardGeometry(design).keys, point);
            if (key) this.service.selectKey(keyColorId(design, key));
        };
        this.grid = new GridComponent(context, {
            label: BUILDER_CONTENT.gridLabel,
            initialArea: BUILDER_CONTENT.initialArea,
            columns: BUILDER_CONTENT.columns.map(column => ({
                ...column,
                onEnter: view => {
                    this.root.dataset.view = view.id;
                    this.activeView = view.id;
                    this.framing = '';
                    this.grid.setPanel(view.id === 'keyboard-overview' ? null : this.panel);
                    this.renderPanel();
                    this.refreshPreview();
                },
            })),
            scene,
        });
        this.root.appendChild(this.viewStatus);
    }

    protected override onMount(): void {
        this.attach(this.grid, this.root, this.viewStatus);
        this.context.eventManager.on(this.scope, this.panel, 'change', event => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
            switch (input.name) {
                case 'size': this.service.setSize(input.value as KeyboardSize); break;
                case 'physical': this.service.setPhysical(input.value as PhysicalLayout); break;
                case 'language': this.service.toggleLanguage(input.value as LegendLanguage); break;
                case 'corner': this.service.setCorner(input.value as KeyboardDesign['primaryCorner']); break;
                case 'preset': this.service.setPreset(input.value as KeyboardDesign['presetId']); break;
                case 'selected-key': this.service.selectKey(input.value || null); break;
                case 'key-color': this.service.setKeyColor(input.value); break;
            }
        });
        this.context.eventManager.on(this.scope, this.panel, 'click', event => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target instanceof HTMLInputElement && target.name === 'letter-layout') {
                this.languageStep = 'languages';
                this.service.setLetterLayout(target.value as LetterLayout);
                return;
            }
            const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
            if (action === 'close') { this.grid.setPanel(null); return; }
            if (action === 'swap') { this.service.swapLanguages(); return; }
            if (action === 'reset-key') { this.service.resetKeyColor(); return; }
            if (action === 'reset-colors') { this.service.resetAllColors(); return; }
            if (action === 'languages' || action === 'layout') {
                this.languageStep = action;
                this.renderPanel();
                this.panel.querySelector<HTMLElement>('h2')?.focus();
            }
        });
        this.registerCleanup(effect(() => {
            this.service.design.get();
            this.service.selectedKey.get();
            this.renderPanel();
            this.refreshPreview();
        }, { scheduler: this.context.scheduler }));
    }

    private refreshPreview(): void {
        const design = this.service.design.get();
        const geometry = keyboardGeometry(design);
        const framing = `${geometry.width}:${geometry.height}`;
        this.grid.refresh(framing === this.framing ? undefined : { x: -0.6, y: -0.6, width: geometry.width + 1.2, height: geometry.height + 1.2 });
        this.framing = framing;
        const names = design.languages.map(id => KEYBOARD_OPTIONS.languages.find(option => option.id === id)!.label);
        const corners = design.primaryCorner === 'top-left' ? ['top left', 'bottom right'] : ['top right', 'bottom left'];
        this.viewStatus.textContent = `${KEYBOARD_OPTIONS.sizes.find(option => option.id === design.size)!.label} · ${design.physical.toUpperCase()} · ${design.letterLayout.toUpperCase()} · ${names.map((name, index) => `${name}: ${corners[index]}`).join(' · ')}. ${KEYBOARD_OPTIONS.previewNote}`;
    }

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

    private renderPanel(): void {
        const focused = document.activeElement;
        const focusName = focused instanceof HTMLInputElement || focused instanceof HTMLSelectElement ? focused.name : '';
        const focusValue = focused instanceof HTMLInputElement && ['radio', 'checkbox'].includes(focused.type) ? focused.value : '';
        const focusAction = focused instanceof HTMLElement ? focused.dataset.action : undefined;
        const design = this.service.design.get();
        const title = this.activeView === 'languages' && this.languageStep === 'languages' ? 'Printed languages' : BUILDER_CONTENT.columns.find(column => column.id === this.activeView)!.label;
        const nodes: Node[] = [this.builder.element('div', { className: 'keyboard-settings__heading' }, [
            this.builder.element('h2', { attributes: { tabindex: -1 } }, title), this.button('Close', 'close'),
        ])];
        if (this.activeView === 'keyboard-size') nodes.push(this.choices('size', 'Size & form factor', KEYBOARD_OPTIONS.sizes, [design.size]));
        if (this.activeView === 'physical-layout') nodes.push(this.choices('physical', 'Physical construction', KEYBOARD_OPTIONS.physical, [design.physical]));
        if (this.activeView === 'preset-colors') {
            nodes.push(this.choices('preset', 'Color scheme', COLOR_PRESETS, [design.presetId]));
            nodes.push(this.builder.element('div', { className: 'keyboard-settings__swatches', attributes: { 'aria-label': 'Preset palette' } },
                ['letters', 'actions', 'accent'].map(group => this.builder.element('span', {
                    style: { '--swatch-color': COLOR_PRESETS.find(preset => preset.id === design.presetId)![group as 'letters' | 'actions' | 'accent'] },
                    attributes: { title: group },
                }))));
            nodes.push(this.builder.element('p', {}, 'Individual colors stay in place when you change presets. Reset them to apply the palette to every key.'));
            if (design.size === '60' || design.size === '65') nodes.push(this.builder.element('p', {}, 'This size has no function row, so the F5–F8 accent is not visible.'));
            nodes.push(this.button('Reset all individual colors', 'reset-colors'));
        }
        if (this.activeView === 'individual-style') {
            const keys = keyboardGeometry(design).keys;
            const selected = keys.find(key => keyColorId(design, key) === this.service.selectedKey.get());
            nodes.push(this.builder.element('p', {}, 'Click a key in the preview, or choose it below. Its outline marks the key you are editing.'));
            nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [
                'Selected key',
                this.builder.element('select', { attributes: { name: 'selected-key' } }, [
                    this.builder.element('option', { attributes: { value: '' } }, 'Choose a key'),
                    ...keys.map((key, index) => this.builder.element('option', {
                        attributes: { value: keyColorId(design, key) },
                        properties: { selected: keyColorId(design, key) === this.service.selectedKey.get() },
                    }, `${key.label} · key ${index + 1}`)),
                ]),
            ]));
            if (selected) {
                nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [
                    `Color for ${selected.label}`,
                    this.builder.element('input', { attributes: { name: 'key-color', type: 'color' }, properties: { value: keyColor(design, selected) } }),
                ]));
                nodes.push(this.builder.element('p', { attributes: { role: 'status' } }, `${selected.label}: ${keyColor(design, selected).toUpperCase()}`));
                nodes.push(this.button('Reset key to preset', 'reset-key'));
            }
        }
        if (this.activeView === 'languages') {
            if (this.languageStep === 'layout') nodes.push(
                this.choices('letter-layout', '1. Letter arrangement', KEYBOARD_OPTIONS.letterLayouts, [design.letterLayout]),
                this.button('Choose languages →', 'languages'),
            );
            else {
                nodes.push(this.button('← Letter arrangement', 'layout'));
                nodes.push(this.builder.element('p', {}, `${design.letterLayout.toUpperCase()} · Select one or two languages. The first selected language uses the top corner; the second uses the opposite bottom corner.`));
                nodes.push(this.choices('language', `2. Printed languages (${design.languages.length}/2)`, KEYBOARD_OPTIONS.languages, design.languages, true));
                nodes.push(this.builder.element('label', { className: 'keyboard-settings__placement' }, [
                    '3. Legend placement',
                    this.builder.element('select', { attributes: { name: 'corner' } }, KEYBOARD_OPTIONS.corners.map(corner =>
                        this.builder.element('option', { attributes: { value: corner.id }, properties: { selected: corner.id === design.primaryCorner } }, corner.label))),
                ]));
                if (design.languages.length === 2) nodes.push(this.button('Swap primary and secondary', 'swap'));
                const sample = this.builder.element('div', { className: 'keyboard-settings__sample', attributes: { 'aria-label': 'Legend corner preview' } },
                    design.languages.map((id, index) => this.builder.element('span', {
                        dataset: { corner: index === 0 ? design.primaryCorner : design.primaryCorner === 'top-left' ? 'bottom-right' : 'bottom-left' },
                    }, KEYBOARD_OPTIONS.languages.find(language => language.id === id)!.label)));
                nodes.push(sample);
            }
        }
        this.panel.replaceChildren(...nodes);
        if (focusName === 'letter-layout' && this.languageStep === 'languages') {
            this.panel.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
        } else if (focusName && this.panel.isConnected) {
            this.panel.querySelector<HTMLElement>(`[name="${CSS.escape(focusName)}"]${focusValue ? `[value="${CSS.escape(focusValue)}"]` : ''}`)?.focus({ preventScroll: true });
        } else if (focusAction && this.panel.isConnected) {
            this.panel.querySelector<HTMLElement>(`[data-action="${CSS.escape(focusAction)}"]`)?.focus({ preventScroll: true });
        }
    }
}
