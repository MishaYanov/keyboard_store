import { Component, effect, type ApplicationContext } from '../../../../engine';
import { GridComponent } from '../../../../shared/grid/grid.component';
import { BUILDER_CONTENT } from '../../models/builder.maps';
import { createKeyboardScene } from './keyboard-scene';
import { keyboardGeometry, hitKeyboardKey } from '@keycaps/domain/keyboard-geometry';
import { keyColorId } from '@keycaps/domain/key-colors';
import { KeyboardSettingsView } from './keyboard-settings.view';
import type { LanguageStep } from '../../models/settings.maps';
import { KEYBOARD_OPTIONS } from '@keycaps/domain/keyboard-options';
import { KeyboardDesignService } from '../../services/keyboard-design.service';
import { checkoutService } from '../../../checkout/services/checkout.service';
import type { KeyboardDesign, KeyboardSize, PhysicalLayout, LetterLayout, LegendLanguage } from '@keycaps/domain/keyboard.types';
import '../../styles/keyboard-settings.css';
import { builderCommand, isEditing, moveSidebar } from '../../services/builder-shortcuts';

export class EngineWrapperComponent extends Component<HTMLElement> {
    private readonly grid: GridComponent;
    private readonly viewStatus: HTMLParagraphElement;
    private readonly panel: HTMLDivElement;
    private readonly settings: KeyboardSettingsView;
    private readonly service = new KeyboardDesignService();
    private activeView = 'keyboard-size';
    private languageStep: LanguageStep = 'layout';
    private framing = '';
    private readonly keyMap = this.builder.element('dialog', { className: 'builder-key-map', attributes: { 'aria-label': 'Builder key map' } });
    private readonly keyMapButton = this.builder.element('button', { attributes: { type: 'button', 'aria-haspopup': 'dialog', 'aria-keyshortcuts': '?' } }, 'Key map ?');
    private readonly keyboardEnabled = this.builder.element('input', { attributes: { type: 'checkbox' }, properties: { checked: true } });
    private returnFocus: HTMLElement | null = null;

    public constructor(private readonly context: ApplicationContext) {
        super(document.createElement('section'));
        this.root.className = 'keyboard-engine';
        this.root.tabIndex = 0;
        this.root.setAttribute('aria-label', 'Keyboard builder workspace');
        this.viewStatus = this.builder.element('p', { attributes: { role: 'status', 'aria-live': 'polite' } });
        this.panel = this.builder.element('div', { className: 'keyboard-settings' });
        this.settings = new KeyboardSettingsView(this.builder, this.panel);
        const scene = createKeyboardScene(() => this.service.design.get(), () => this.activeView === 'individual-style' ? this.service.selectedKey.get() : null);
        scene.pointer = point => {
            if (this.activeView !== 'individual-style') return;
            const design = this.service.design.get();
            const key = hitKeyboardKey(keyboardGeometry(design).keys, point);
            if (key) this.service.selectKey(keyColorId(design, key));
        };
        this.grid = new GridComponent(context, {
            className: 'keyboard-builder-grid',
            resizablePanel: true,
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
        this.keyMap.append(
            this.builder.element('h2', {}, 'Builder key map'),
            this.builder.element('p', {}, 'Controls work only while focus is in the builder. Text fields and dropdowns keep their normal keys. You can switch keyboard controls off in the toolbar.'),
            this.builder.element('dl', {}, [
                ...BUILDER_CONTENT.columns.flatMap((column, index) => [this.builder.element('dt', {}, String(index + 1)), this.builder.element('dd', {}, column.label)]),
                ...[['← / →', 'Change the current radio option (wraps around)'], ['↑ / ↓', 'Focus previous / next sidebar control group'],
                    ['F', 'Focus sidebar options'], ['Tab / Shift+Tab', 'Move through all controls normally'], ['Space / Enter', 'Activate a focused control (Enter applies key text)'],
                    ['A', 'Add to basket — Finalize panel only'], ['B', 'Open basket'], ['Esc', 'Close sidebar or key map'], ['?', 'Open key map']]
                    .flatMap(([key, description]) => [this.builder.element('dt', {}, key!), this.builder.element('dd', {}, description!)]),
            ]),
            this.builder.element('button', { attributes: { type: 'button' }, dataset: { closeMap: 'true' } }, 'Close key map'),
        );
        this.root.append(this.builder.element('div', { className: 'builder-controls' }, [
            this.keyMapButton, this.builder.element('label', {}, [this.keyboardEnabled, ' Keyboard controls']),
        ]), this.viewStatus, this.keyMap);
    }

    protected override onMount(): void {
        this.attach(this.grid, this.root, this.viewStatus);
        const openMap = () => {
            this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : this.keyMapButton;
            if (!this.keyMap.open) this.keyMap.showModal();
        };
        this.context.eventManager.on(this.scope, this.keyMapButton, 'click', openMap);
        this.context.eventManager.on(this.scope, this.keyMap, 'click', event => {
            if (event.target instanceof HTMLElement && event.target.dataset.closeMap) this.keyMap.close();
        });
        this.keyMap.addEventListener('close', () => this.returnFocus?.isConnected && this.returnFocus.focus());
        this.context.eventManager.on(this.scope, this.root, 'keydown', event => {
            if (event.defaultPrevented || this.keyMap.open || !this.keyboardEnabled.checked) return;
            const target = event.target instanceof Element ? event.target : null;
            if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
            if (target instanceof HTMLInputElement && target.name === 'key-legend' && event.key === 'Enter' && !event.repeat) {
                event.preventDefault();
                this.panel.querySelector<HTMLButtonElement>('[data-action="apply-legend"]')?.click();
                return;
            }
            if (isEditing(target)) return;
            const command = builderCommand(event, false);
            if (command) {
                if (command.type === 'add' && (this.activeView !== 'finalize' || !this.panel.isConnected)) return;
                event.preventDefault();
                if (command.type === 'pane') { this.grid.selectView(command.index); this.root.focus({ preventScroll: true }); }
                if (command.type === 'help') openMap();
                if (command.type === 'focus') moveSidebar(this.panel, 'ArrowDown');
                if (command.type === 'close') { this.grid.setPanel(null); this.root.focus({ preventScroll: true }); }
                if (command.type === 'basket') window.location.hash = '#/checkout';
                if (command.type === 'add') this.panel.querySelector<HTMLButtonElement>('[data-action="add-to-basket"]')?.click();
                return;
            }
            // Preserve the tablist and panel resize handle's own arrow-key behavior.
            if (!target?.closest('[role="tablist"], [role="separator"]') && moveSidebar(this.panel, event.key)) event.preventDefault();
        });
        this.root.focus({ preventScroll: true });
        this.context.eventManager.on(this.scope, this.panel, 'change', event => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
            switch (input.name) {
                case 'letter-layout':
                    this.languageStep = 'languages';
                    this.service.setLetterLayout(input.value as LetterLayout); break;
                case 'size': this.service.setSize(input.value as KeyboardSize); break;
                case 'physical': this.service.setPhysical(input.value as PhysicalLayout); break;
                case 'language': this.service.toggleLanguage(input.value as LegendLanguage); break;
                case 'corner': this.service.setCorner(input.value as KeyboardDesign['primaryCorner']); break;
                case 'preset': this.service.setPreset(input.value as KeyboardDesign['presetId']); break;
                case 'custom-mode': this.service.setCustomMode(Number(input.value) as KeyboardDesign['customColorMode']); break;
                case 'custom-letters': this.service.setCustomColor('letters', input.value); break;
                case 'custom-actions': this.service.setCustomColor('actions', input.value); break;
                case 'custom-accent': this.service.setCustomColor('accent', input.value); break;
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
            if (action === 'add-to-basket') {
                checkoutService.addConfiguration(this.service.design.get(), this.grid.captureSnapshot());
                window.location.hash = '#/checkout';
                return;
            }
            if (action === 'apply-legend') {
                const legend = this.panel.querySelector<HTMLInputElement>('[name=key-legend]');
                if (legend) this.service.setKeyLegend(legend.value);
                return;
            }
            if (action === 'close') { this.grid.setPanel(null); return; }
            if (action === 'swap') { this.service.swapLanguages(); return; }
            if (action === 'reset-key') { this.service.resetKeyCustomization(); return; }
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

    private renderPanel(): void {
        this.settings.render(this.activeView, this.languageStep, this.service.design.get(), this.service.selectedKey.get());
        if (!this.service.storageAvailable.get()) {
            this.panel.append(this.builder.element('p', { attributes: { role: 'status' } }, 'Browser storage is unavailable or full. Latest design changes will be lost on reload.'));
        }
    }
}
