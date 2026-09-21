import { Component } from '../component';
import type { ApplicationContext } from '../application-context';
import {
    PointerRouter,
    type PointerTarget,
} from '../events/pointer-router';
import type { CanvasRenderable } from './canvas-scheduler';
import type { CanvasViewportSnapshot } from './canvas-viewport';
import {
    selectRenderQuality,
    type RenderQualityProfile,
} from './render-quality';

export type WebGlComponentServices = Pick<
    ApplicationContext,
    'canvasScheduler' | 'eventManager'
>;

export interface WebGlComponentOptions {
    readonly className?: string;
    readonly contextAttributes?: WebGLContextAttributes;
    readonly continuous?: boolean;
}

export interface WebGlFrame extends CanvasViewportSnapshot {
    readonly context: WebGL2RenderingContext;
    readonly quality: RenderQualityProfile;
    readonly time: number;
}

function normalizeDimension(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Base component for responsive WebGL2 scenes.
 *
 * It shares the application's CanvasScheduler with CanvasComponent, but keeps
 * WebGL context creation and backing-buffer management separate from Canvas 2D.
 */
export abstract class WebGlComponent
    extends Component<HTMLCanvasElement>
    implements CanvasRenderable {
    protected readonly context: WebGL2RenderingContext;

    private readonly services: WebGlComponentServices;
    private continuous: boolean;
    private contextLost = false;
    private intersectionObserver: IntersectionObserver | null = null;
    private motionPreference: MediaQueryList | null = null;
    private pointerRouter: PointerRouter | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private visible = true;
    private quality: RenderQualityProfile;
    private viewport: CanvasViewportSnapshot | null = null;

    protected constructor(
        services: WebGlComponentServices,
        options: WebGlComponentOptions = {},
    ) {
        const canvas = document.createElement('canvas');

        if (options.className) {
            canvas.className = options.className;
        }

        const context = canvas.getContext(
            'webgl2',
            options.contextAttributes,
        );

        if (!context) {
            throw new Error('Unable to create WebGL2RenderingContext');
        }

        super(canvas);

        this.context = context;
        this.services = services;
        this.continuous = options.continuous ?? false;
        this.quality = this.resolveQuality(0);
    }

    public paintFrame(timestamp: number): void {
        const viewport = this.viewport;

        if (!viewport || this.contextLost) {
            return;
        }

        this.context.viewport(
            0,
            0,
            viewport.pixelWidth,
            viewport.pixelHeight,
        );
        this.paint({
            ...viewport,
            context: this.context,
            quality: this.quality,
            time: timestamp,
        });
    }

    public isCanvasActive(): boolean {
        return this.isMounted() && this.visible && !this.contextLost;
    }

    public getTargetFps(): number {
        return this.quality.targetFps;
    }

    protected override onMount(): void {
        const container = this.root.parentElement;

        if (!container) {
            throw new Error('WebglComponent must mount inside an Element');
        }

        this.setupMotionPreference();
        this.setupContextLifecycle();
        this.setupResizeObserver(container);

        this.pointerRouter = new PointerRouter(
            this.root,
            this.services.eventManager,
            this.scope,
        );

        this.setupVisibilityObserver();
        this.onWebGlMount();
        this.services.canvasScheduler.setContinuous(this, this.continuous);
        this.invalidate();
    }

    protected override onUnmount(): void {
        try {
            this.onWebGlUnmount();
        } finally {
            this.services.canvasScheduler.unregister(this);
            this.intersectionObserver?.disconnect();
            this.intersectionObserver = null;
            this.pointerRouter?.dispose();
            this.pointerRouter = null;
            this.resizeObserver?.disconnect();
            this.resizeObserver = null;
            this.motionPreference = null;
            this.viewport = null;
        }
    }

    protected abstract paint(frame: WebGlFrame): void;

    protected onWebGlMount(): void {}

    protected onWebGlUnmount(): void {}

    protected onWebGlResize(_viewport: CanvasViewportSnapshot): void {}

    protected onWebGlContextLost(): void {}

    protected onWebGlContextRestored(): void {}

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
        return this.viewport;
    }

    private setupResizeObserver(container: Element): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.refreshViewport();
        });
        this.resizeObserver.observe(container);
        // Fixed canvases can resize independently of their page container.
        this.resizeObserver.observe(this.root);
        this.refreshViewport();
    }

    private refreshViewport(): void {
        // Rendering uses local dimensions, independent of CSS rotation on a parent.
        const width = normalizeDimension(this.root.clientWidth);
        const height = normalizeDimension(this.root.clientHeight);

        this.quality = this.resolveQuality(width);

        const dpr = this.quality.effectiveDpr;
        const next: CanvasViewportSnapshot = {
            dpr,
            height,
            pixelHeight: Math.floor(height * dpr),
            pixelWidth: Math.floor(width * dpr),
            width,
        };
        const previous = this.viewport;

        if (
            previous
            && previous.width === next.width
            && previous.height === next.height
            && previous.dpr === next.dpr
            && previous.pixelWidth === next.pixelWidth
            && previous.pixelHeight === next.pixelHeight
        ) {
            return;
        }

        if (this.root.width !== next.pixelWidth) {
            this.root.width = next.pixelWidth;
        }

        if (this.root.height !== next.pixelHeight) {
            this.root.height = next.pixelHeight;
        }

        this.viewport = next;
        this.onWebGlResize(next);
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
            this.refreshViewport();
            this.invalidate();
        };

        this.motionPreference = preference;
        preference.addEventListener('change', listener);
        this.registerCleanup(() => {
            preference.removeEventListener('change', listener);
        });
    }

    private setupContextLifecycle(): void {
        const onContextLost = (event: Event): void => {
            event.preventDefault();
            this.contextLost = true;
            this.onWebGlContextLost();
        };
        const onContextRestored = (): void => {
            this.contextLost = false;
            this.onWebGlContextRestored();
            this.refreshViewport();
            this.invalidate();
        };

        this.root.addEventListener('webglcontextlost', onContextLost);
        this.root.addEventListener('webglcontextrestored', onContextRestored);
        this.registerCleanup(() => {
            this.root.removeEventListener('webglcontextlost', onContextLost);
            this.root.removeEventListener(
                'webglcontextrestored',
                onContextRestored,
            );
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
            devicePixelRatio: typeof window === 'undefined'
                ? 1
                : window.devicePixelRatio || 1,
            reducedMotion: this.motionPreference?.matches ?? false,
            viewportWidth,
        });
    }
}
