import { Component } from '../component';
import { EventManager } from '../events/event-manager';
import {
    PointerRouter,
    type PointerTarget,
} from '../events/pointer-router';
import {
    CanvasScheduler,
    type CanvasRenderable,
} from './canvas-scheduler';
import {
    CanvasViewport,
    type CanvasViewportSnapshot,
} from './canvas-viewport';
import {
    selectRenderQuality,
    type RenderQualityProfile,
} from './render-quality';

export interface CanvasComponentServices {
    readonly canvasScheduler: CanvasScheduler;
    readonly eventManager: EventManager;
}

export interface CanvasComponentOptions {
    readonly className?: string;
    readonly contextAttributes?: CanvasRenderingContext2DSettings;
    readonly continuous?: boolean;
}

export interface CanvasFrame {
    readonly context: CanvasRenderingContext2D;
    readonly dpr: number;
    readonly height: number;
    readonly quality: RenderQualityProfile;
    readonly time: number;
    readonly width: number;
}

/**
 * Component base for responsive, scheduled Canvas 2D rendering.
 * Subclasses only implement scene painting and optional canvas lifecycle hooks.
 */
export abstract class CanvasComponent
    extends Component<HTMLCanvasElement>
    implements CanvasRenderable {
    protected readonly context: CanvasRenderingContext2D;

    private readonly services: CanvasComponentServices;
    private continuous: boolean;
    private viewport: CanvasViewport | null = null;
    private pointerRouter: PointerRouter | null = null;
    private intersectionObserver: IntersectionObserver | null = null;
    private motionPreference: MediaQueryList | null = null;
    private visible = true;
    private quality: RenderQualityProfile;

    protected constructor(
        services: CanvasComponentServices,
        options: CanvasComponentOptions = {},
    ) {
        const canvas = document.createElement('canvas');

        if (options.className) {
            canvas.className = options.className;
        }

        const context = canvas.getContext('2d', options.contextAttributes);

        if (!context) {
            throw new Error('Unable to create CanvasRenderingContext2D');
        }

        super(canvas);

        this.context = context;
        this.services = services;
        this.continuous = options.continuous ?? false;
        this.quality = selectRenderQuality({
            devicePixelRatio: this.readDevicePixelRatio(),
            reducedMotion: false,
            viewportWidth: 0,
        });
    }

    public paintFrame(timestamp: number): void {
        const viewport = this.viewport?.getSnapshot();

        if (!viewport) {
            return;
        }

        this.paint({
            context: this.context,
            dpr: viewport.dpr,
            height: viewport.height,
            quality: this.quality,
            time: timestamp,
            width: viewport.width,
        });
    }

    public isCanvasActive(): boolean {
        return this.isMounted() && this.visible;
    }

    public getTargetFps(): number {
        return this.quality.targetFps;
    }

    protected override onMount(): void {
        const container = this.root.parentElement;

        if (!container) {
            throw new Error('CanvasComponent must mount inside an Element');
        }

        this.setupMotionPreference();

        this.viewport = new CanvasViewport(this.root, this.context, {
            onResize: snapshot => {
                this.handleResize(snapshot);
            },
            resolveDpr: width => {
                this.quality = this.resolveQuality(width);

                return this.quality.effectiveDpr;
            },
        });
        this.viewport.start(container);

        this.pointerRouter = new PointerRouter(
            this.root,
            this.services.eventManager,
            this.scope,
        );

        this.setupVisibilityObserver();
        this.onCanvasMount();
        this.services.canvasScheduler.setContinuous(this, this.continuous);
        this.invalidate();
    }

    protected override onUnmount(): void {
        try {
            this.onCanvasUnmount();
        } finally {
            this.services.canvasScheduler.unregister(this);
            this.intersectionObserver?.disconnect();
            this.intersectionObserver = null;
            this.pointerRouter?.dispose();
            this.pointerRouter = null;
            this.viewport?.dispose();
            this.viewport = null;
            this.motionPreference = null;
        }
    }

    /** Paint one frame in CSS-pixel coordinates. Clearing is scene-controlled. */
    protected abstract paint(frame: CanvasFrame): void;

    protected onCanvasMount(): void {}

    protected onCanvasUnmount(): void {}

    protected onCanvasResize(_viewport: CanvasViewportSnapshot): void {}

    protected invalidate(): void {
        this.services.canvasScheduler.invalidate(this);
    }

    protected setContinuousAnimation(enabled: boolean): void {
        this.continuous = enabled;

        if (this.isMounted()) {
            this.services.canvasScheduler.setContinuous(this, enabled);
        }
    }

    protected registerPointerTarget(target: PointerTarget): () => void {
        if (!this.pointerRouter) {
            throw new Error(
                'Pointer targets can only be registered while mounted',
            );
        }

        return this.pointerRouter.register(this.scope, target);
    }

    protected getQualityProfile(): RenderQualityProfile {
        return this.quality;
    }

    protected getViewportSnapshot(): CanvasViewportSnapshot | null {
        return this.viewport?.getSnapshot() ?? null;
    }

    private handleResize(snapshot: CanvasViewportSnapshot): void {
        this.quality = this.resolveQuality(snapshot.width);
        this.onCanvasResize(snapshot);
        this.invalidate();
    }

    private setupMotionPreference(): void {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return;
        }

        const preference = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const listener = (): void => {
            this.quality = this.resolveQuality(
                this.viewport?.getSnapshot().width ?? 0,
            );
            this.viewport?.refresh();
            this.invalidate();
        };

        this.motionPreference = preference;
        preference.addEventListener('change', listener);
        this.registerCleanup(() => {
            preference.removeEventListener('change', listener);
        });
    }

    private setupVisibilityObserver(): void {
        if (typeof IntersectionObserver === 'undefined') {
            return;
        }

        this.intersectionObserver = new IntersectionObserver(entries => {
            const entry = entries[0];

            if (!entry) {
                return;
            }

            const wasVisible = this.visible;
            this.visible = entry.isIntersecting;

            if (!wasVisible && this.visible) {
                this.invalidate();
            }
        });
        this.intersectionObserver.observe(this.root);
    }

    private resolveQuality(viewportWidth: number): RenderQualityProfile {
        return selectRenderQuality({
            devicePixelRatio: this.readDevicePixelRatio(),
            reducedMotion: this.motionPreference?.matches ?? false,
            viewportWidth,
        });
    }

    private readDevicePixelRatio(): number {
        return typeof window === 'undefined'
            ? 1
            : window.devicePixelRatio || 1;
    }
}
