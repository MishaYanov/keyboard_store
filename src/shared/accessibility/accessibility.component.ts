import { Component } from '../../engine';
import { ACCESSIBILITY_CONTENT as content, defaultPreferences } from './accessibility.models';
import { AccessibilityService } from './accessibility.service';
import './accessibility.css';

const accessibilityIcon = '/assets/images/accessibility-icon.svg';

export class AccessibilityComponent extends Component<HTMLElement> {
    private readonly service = new AccessibilityService();

    public constructor() {
        super(document.createElement('div'));
        this.root.className = 'accessibility-tools';
    }

    protected override onMount(): void {
        const trigger = this.builder.element('button', {
            className: 'accessibility-tools__trigger',
            attributes: {
                type: 'button',
                'aria-label': content.title,
                title: content.title,
                'aria-haspopup': 'dialog',
                'aria-expanded': 'false',
                'aria-controls': 'accessibility-dialog',
            },
        }, this.builder.element('img', {
            attributes: {
                src: accessibilityIcon,
                alt: '',
                width: '24',
                height: '24',
                'aria-hidden': 'true',
            },
        }));
        const close = this.builder.element('button', { attributes: { type: 'button', autofocus: true } }, content.close);
        const reset = this.builder.element('button', { attributes: { type: 'button' } }, content.reset);
        const controls = content.options.map(option => ({
            ...option,
            input: this.builder.element('input', { attributes: { type: 'checkbox' }, properties: { checked: this.service.preferences[option.id] } }),
        }));
        const colors = this.builder.element('select', { attributes: { 'aria-describedby': 'accessibility-colors-help' } }, content.colorModes.map(mode => this.builder.element('option', { attributes: { value: mode.id }, properties: { selected: mode.id === this.service.preferences.colorMode } }, mode.label)));
        const dialog = this.builder.element('dialog', { className: 'accessibility-tools__dialog', attributes: { id: 'accessibility-dialog', 'aria-labelledby': 'accessibility-title' } }, [
            this.builder.element('h2', { attributes: { id: 'accessibility-title' } }, content.title),
            this.builder.element('p', {}, content.description),
            ...controls.map(control => this.builder.element('label', {}, [control.input, control.label])),
            this.builder.element('label', {}, [content.colorLabel, colors]),
            this.builder.element('p', { attributes: { id: 'accessibility-colors-help' } }, content.colorHelp),
            reset, close,
        ]);
        const listen = (element: HTMLElement, event: string, handler: () => void) => {
            element.addEventListener(event, handler);
            this.registerCleanup(() => element.removeEventListener(event, handler));
        };
        listen(trigger, 'click', () => { dialog.showModal(); trigger.setAttribute('aria-expanded', 'true'); });
        listen(close, 'click', () => dialog.close());
        listen(dialog, 'close', () => { trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); });
        for (const control of controls) listen(control.input, 'change', () => {
            this.service.preferences[control.id] = control.input.checked;
            this.service.apply();
        });
        listen(colors, 'change', () => {
            this.service.preferences.colorMode = colors.value as typeof this.service.preferences.colorMode;
            this.service.apply();
        });
        listen(reset, 'click', () => {
            this.service.preferences = defaultPreferences();
            this.service.apply();
            for (const control of controls) control.input.checked = false;
            colors.value = 'normal';
        });
        this.registerCleanup(() => dialog.close());
        this.root.append(trigger, dialog);
    }
}
