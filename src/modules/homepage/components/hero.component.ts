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
        super(root);


        const startSnap = this.builder.element('div', {
            className: 'hero__canvas-snap hero__canvas-snap--start',
            attributes: {
                'aria-hidden': 'true',
            },
            style: {
                height: '1dvh',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
            },
        });
        const endSnap = this.builder.element('div', {
            className: 'hero__canvas-snap hero__canvas-snap--end',
            attributes: {
                'aria-hidden': 'true',
            },
            style: {
                height: '100dvh',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
            },
        });

        this.canvasTrack = this.builder.element(
            'div',
            {
                className: 'hero__canvas-track',
                style: {
                    position: 'relative',
                    zIndex: 0,
                },
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
                style: {
                    background: 'white',
                    height: '100dvh',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    overscrollBehaviorY: 'contain',
                    position: 'relative',
                    scrollBehavior: 'smooth',
                    scrollSnapType: 'y mandatory',
                    touchAction: 'pan-y',
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
