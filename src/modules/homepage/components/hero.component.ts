import '../styles/hero.component.css';
import {Component, type ApplicationContext} from '../../../engine';
import {HeroBallCanvasComponent} from './hero-ball-canvas.component';
import type {HeroService} from '../services/hero.service';

export class HeroComponent extends Component<HTMLElement> {
    private readonly canvasScroll: HTMLDivElement;
    private readonly canvasTrack: HTMLDivElement;
    private readonly ballCanvas: HeroBallCanvasComponent;

    public constructor(context: ApplicationContext, service: HeroService) {
        const root = document.createElement('section');
        root.className = 'hero';

        super(root, { styleScope: 'hero' });

        const title = this.builder.element('h1', {
            className: 'hero__title',
        }, 'Hello0000000');

        const subTitle = this.builder.element('h3', {
            className: 'hero__subtitle',
        }, 'this is the sub title for this hero');

        const header = this.builder.element('header', {
            className: 'hero__header',
        }, [title, subTitle]);

        this.root.appendChild(header);

        const startSnap = this.builder.element('div', {
            className: 'hero__canvas-snap hero__canvas-snap--start',
            attributes: {
                'aria-hidden': 'true',
            },
        });
        const endSnap = this.builder.element('div', {
            className: 'hero__canvas-snap hero__canvas-snap--end',
            attributes: {
                'aria-hidden': 'true',
            },
        });

        this.canvasTrack = this.builder.element(
            'div',
            {
                className: 'hero__canvas-track',
            },
            [startSnap, endSnap],
        );

        this.canvasScroll = this.builder.element(
            'div',
            {
                className: 'hero__canvas-scroll',
                attributes: {
                    'aria-label': 'Scroll to move the 3D sphere',
                    role: 'region',
                    tabindex: 0,
                },
            },
            this.canvasTrack,
        );
        this.ballCanvas = new HeroBallCanvasComponent(
            context,
            this.canvasScroll,
        );
        this.root.appendChild(this.canvasScroll);
    }

    protected override onMount(): void {
        this.attach(
            this.ballCanvas,
            this.canvasScroll,
            this.canvasTrack,
        );
    }
}
