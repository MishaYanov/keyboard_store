import type { ComponentBuilder } from '../../../../engine';
import { BUILDER_CONTENT } from '../../models/builder.maps';
import { SETTINGS_CONTENT, type LanguageStep } from '../../models/settings.maps';
import { KEYBOARD_OPTIONS } from '@keycaps/domain/keyboard-options';
import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';
import { enhanceBuilderSelect } from './builder-select';
import { SettingsControls } from './settings-controls';
import { renderFinalize } from './finalize-panel';
import { renderPresets } from './presets-panel';
import { renderIndividual } from './individual-panel';
import { renderLanguages } from './languages-panel';

/** Renders settings from a state snapshot; the wrapper owns events and state changes. */
export class KeyboardSettingsView {
    private readonly controls: SettingsControls;
    private readonly panels: Record<string, (design: KeyboardDesign, step: LanguageStep, key: string | null) => Node[]>;
    public constructor(private readonly builder: ComponentBuilder, private readonly panel: HTMLDivElement) {
        const controls = this.controls = new SettingsControls(builder);
        this.panels = {
            'keyboard-size': design => [controls.choices('size', SETTINGS_CONTENT.size, KEYBOARD_OPTIONS.sizes, [design.size])],
            'physical-layout': design => [controls.choices('physical', SETTINGS_CONTENT.physical, KEYBOARD_OPTIONS.physical, [design.physical])],
            'preset-colors': design => renderPresets(controls, design),
            'individual-style': (design, _step, key) => renderIndividual(controls, design, key),
            languages: (design, step) => renderLanguages(controls, design, step),
            finalize: design => renderFinalize(controls, design),
            'keyboard-overview': () => [],
        };
    }

    public render(activeView: string, languageStep: LanguageStep, design: KeyboardDesign, selectedKey: string | null): void {
        const focused = document.activeElement;
        const focusName = focused instanceof HTMLInputElement || focused instanceof HTMLSelectElement || focused instanceof HTMLButtonElement ? focused.name : '';
        const focusValue = focused instanceof HTMLInputElement && ['radio', 'checkbox'].includes(focused.type) ? focused.value : '';
        const focusAction = focused instanceof HTMLElement ? focused.dataset.action : undefined;
        const title = activeView === 'languages' && languageStep === 'languages' ? SETTINGS_CONTENT.printedLanguages : BUILDER_CONTENT.columns.find(column => column.id === activeView)!.label;
        const nodes: Node[] = [this.builder.element('div', { className: 'keyboard-settings__heading' }, [
            this.builder.element('h2', { attributes: { tabindex: -1 } }, title), this.controls.button(SETTINGS_CONTENT.close, 'close'),
        ])];
        const renderPanel = this.panels[activeView];
        if (!renderPanel) throw new Error(`Unknown builder panel: ${activeView}`);
        nodes.push(...renderPanel(design, languageStep, selectedKey));
        this.panel.replaceChildren(...nodes);
        this.panel.querySelectorAll('select').forEach(enhanceBuilderSelect);
        if (focusName === 'letter-layout' && languageStep === 'languages') {
            this.panel.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
        } else if (focusName && this.panel.isConnected) {
            Array.from(this.panel.querySelectorAll<HTMLElement>(`[name="${CSS.escape(focusName)}"]${focusValue ? `[value="${CSS.escape(focusValue)}"]` : ''}`))
                .find(control => control.getClientRects().length > 0)?.focus({ preventScroll: true });
        } else if (focusAction && this.panel.isConnected) {
            this.panel.querySelector<HTMLElement>(`[data-action="${CSS.escape(focusAction)}"]`)?.focus({ preventScroll: true });
        }
    }

}
