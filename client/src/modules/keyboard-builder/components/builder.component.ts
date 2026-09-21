import {Component, type ApplicationContext} from '../../../engine';
import {EngineWrapperComponent} from './keyboard-interactive-engine/engine-wrapper.component';
import {BUILDER_CONTENT} from '../models/builder.maps';
import '../styles/builder.css';
import { activeColorAdjustments } from '../../../shared/accessibility/accessibility.service';
import type { AppServices } from '../../../core/app-services';

export class BuilderComponent extends Component<HTMLElement> {
    private readonly workspace: EngineWrapperComponent;
    private readonly colorWarning: HTMLParagraphElement;

    public constructor(context: ApplicationContext, services: AppServices) {
        super(document.createElement('article'));
        this.root.className = 'keyboard-builder';
        this.colorWarning = this.builder.element('p', {
            className: 'builder-color-warning',
            attributes: { role: 'alert', 'aria-live': 'assertive', hidden: true },
        });
        this.root.append(
            this.builder.element('a', {
                className: 'builder-back',
                attributes: { href: BUILDER_CONTENT.backHref, 'aria-label': BUILDER_CONTENT.backLabel, title: BUILDER_CONTENT.backLabel },
            }, this.builder.element('span', { attributes: { 'aria-hidden': 'true' } }, '←')),
            this.builder.element('header', {className: 'builder-header'},
                [
                    this.builder.element('h1', {}, BUILDER_CONTENT.title),
                    this.builder.element('p', {}, BUILDER_CONTENT.description),
                ]
            ),
            this.colorWarning,
        );
        this.workspace = new EngineWrapperComponent(context, services);
    }

    protected override onMount(): void {
        const updateColorWarning = () => {
            const adjustments = activeColorAdjustments();
            this.colorWarning.hidden = adjustments.length === 0;
            this.colorWarning.textContent = adjustments.length === 0 ? ''
                : `Color preview warning: ${adjustments.join(' and ')} ${adjustments.length === 1 ? 'is' : 'are'} active. Your saved key colors are unchanged, but the preview is not color-accurate.`;
        };
        const observer = new MutationObserver(updateColorWarning);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-a11y-colors', 'data-a11y-contrast'],
        });
        window.addEventListener('accessibilitychange', updateColorWarning);
        this.registerCleanup(() => {
            observer.disconnect();
            window.removeEventListener('accessibilitychange', updateColorWarning);
        });
        updateColorWarning();
        this.attach(this.workspace);
    }
}
