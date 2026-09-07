import '../styles/hero.component.css';
import {Component, type ApplicationContext} from '../../../engine';
import {HeroBallCanvasComponent} from './hero-ball-canvas.component';
import type {HeroService} from '../services/hero.service';

export class HeroComponent extends Component<HTMLElement> {
    private readonly canvasStage: HTMLDivElement;
    private readonly ballCanvas: HeroBallCanvasComponent;

    public constructor(context: ApplicationContext, service: HeroService) {
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

        const title = this.builder.element('h1', {
            className: 'hero__title',
        }, [this.builder.element('span', {}, titleText), titleHighlight]);

        const subTitle = this.builder.element('h3', {
            className: 'hero__subtitle',
        }, data.subtitle);

        const header = this.builder.element('header', {
            className: 'hero__header',
        }, [title, subTitle]);

        this.root.appendChild(header);

        this.canvasStage = this.builder.element(
            'div',
            {
                className: 'hero__canvas-stage',
            },
        );
        this.ballCanvas = new HeroBallCanvasComponent(
            context,
            titleHighlight,
        );
        this.root.appendChild(this.canvasStage);
    }

    protected override onMount(): void {
        this.attach(
            this.ballCanvas,
            this.canvasStage,
        );
    }
}
