import {Component, type ApplicationContext} from '../../../engine';
import {EngineWrapperComponent} from './keyboard-interactive-engine/engine-wrapper.component';
import {BUILDER_CONTENT} from '../models/builder.maps';
import '../styles/builder.css';

export class BuilderComponent extends Component<HTMLElement> {
    private readonly workspace: EngineWrapperComponent;

    public constructor(context: ApplicationContext) {
        super(document.createElement('article'));
        this.root.className = 'keyboard-builder';
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
        );
        this.workspace = new EngineWrapperComponent(context);
    }

    protected override onMount(): void {
        this.attach(this.workspace);
    }
}
