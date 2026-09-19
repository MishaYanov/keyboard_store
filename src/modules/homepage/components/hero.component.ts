import '../styles/hero.component.css';
import {Component} from '../../../engine';
import type {HeroService} from '../services/hero.service';

export class HeroComponent extends Component<HTMLElement> {
    public readonly titleHighlight: HTMLSpanElement;
    public readonly motionControl: HTMLButtonElement;

    public constructor(service: HeroService) {
        const root = document.createElement('section');
        root.className = 'hero';

        super(root, { styleScope: 'hero' });

        const data = service.content;
        this.root.style.setProperty('--hero-height', data.height);
        this.root.style.setProperty('--hero-header-top', data.header.top);
        this.root.style.setProperty('--hero-header-left', data.header.left);
        this.root.style.setProperty('--hero-header-right', data.header.right);
        const titleText = data.title;

        const titleHighlight = this.builder.element('span', {
            className: 'hero__title-highlight',
            attributes: { 'aria-hidden': 'true' },
        }, titleText);
        this.titleHighlight = titleHighlight;

        const title = this.builder.element('h1', {
            className: 'hero__title',
        }, [this.builder.element('span', {}, titleText), titleHighlight]);

        const subTitle = this.builder.element('p', {
            className: 'hero__subtitle',
        }, data.subtitle);

        this.motionControl = this.builder.element('button', {
            className: 'hero__motion-control',
            attributes: { type: 'button', hidden: true },
        }, 'Animate keycap');

        const header = this.builder.element('header', {
            className: 'hero__header',
        }, [title, subTitle, this.motionControl]);

        this.root.appendChild(header);

    }
}
