export interface CanvasViewportSnapshot {
    readonly dpr: number;
    readonly height: number;
    readonly pixelHeight: number;
    readonly pixelWidth: number;
    readonly width: number;
}

export interface CanvasResizeObserver {
    disconnect(): void;
    observe(target: Element): void;
}

export interface CanvasViewportOptions {
    readonly createResizeObserver?: (
        callback: () => void,
    ) => CanvasResizeObserver;
    readonly onResize?: (snapshot: CanvasViewportSnapshot) => void;
    readonly resolveDpr?: (width: number, height: number) => number;
}

function defaultResizeObserverFactory(
    callback: () => void,
): CanvasResizeObserver {
    return new ResizeObserver(callback);
}

function normalizeDimension(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeDpr(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 1;
}

function snapshotsEqual(
    left: CanvasViewportSnapshot | null,
    right: CanvasViewportSnapshot,
): boolean {
    return left !== null
        && left.width === right.width
        && left.height === right.height
        && left.dpr === right.dpr
        && left.pixelWidth === right.pixelWidth
        && left.pixelHeight === right.pixelHeight;
}

/**
 * Keeps a canvas backing buffer aligned with its CSS-pixel dimensions.
 * All dimensions exposed to scenes remain in CSS pixels.
 */
export class CanvasViewport {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private readonly createResizeObserver: (
        callback: () => void,
    ) => CanvasResizeObserver;
    private readonly onResize?: (snapshot: CanvasViewportSnapshot) => void;
    private readonly resolveDpr: (width: number, height: number) => number;

    private observer: CanvasResizeObserver | null = null;
    private snapshot: CanvasViewportSnapshot = {
        dpr: 1,
        height: 0,
        pixelHeight: 0,
        pixelWidth: 0,
        width: 0,
    };
    private hasSnapshot = false;
    private disposed = false;

    public constructor(
        canvas: HTMLCanvasElement,
        context: CanvasRenderingContext2D,
        options: CanvasViewportOptions = {},
    ) {
        this.canvas = canvas;
        this.context = context;
        this.createResizeObserver = options.createResizeObserver
            ?? defaultResizeObserverFactory;
        this.onResize = options.onResize;
        this.resolveDpr = options.resolveDpr ?? (() => 1);
    }

    public start(container: Element): void {
        this.assertUsable();

        if (this.observer) {
            throw new Error('CanvasViewport has already started');
        }

        this.observer = this.createResizeObserver(() => {
            this.refresh();
        });
        this.observer.observe(container);
        this.refresh();
    }

    public refresh(): CanvasViewportSnapshot {
        this.assertUsable();

        const bounds = this.canvas.getBoundingClientRect();
        const width = normalizeDimension(bounds.width);
        const height = normalizeDimension(bounds.height);
        const dpr = normalizeDpr(this.resolveDpr(width, height));
        const next: CanvasViewportSnapshot = {
            dpr,
            height,
            pixelHeight: Math.floor(height * dpr),
            pixelWidth: Math.floor(width * dpr),
            width,
        };
        const previous = this.hasSnapshot ? this.snapshot : null;

        if (snapshotsEqual(previous, next)) {
            return this.snapshot;
        }

        const backingBufferChanged = this.canvas.width !== next.pixelWidth
            || this.canvas.height !== next.pixelHeight;

        if (this.canvas.width !== next.pixelWidth) {
            this.canvas.width = next.pixelWidth;
        }

        if (this.canvas.height !== next.pixelHeight) {
            this.canvas.height = next.pixelHeight;
        }

        if (backingBufferChanged || previous?.dpr !== dpr) {
            this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        this.snapshot = next;
        this.hasSnapshot = true;
        this.onResize?.(next);

        return next;
    }

    public getSnapshot(): CanvasViewportSnapshot {
        return this.snapshot;
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.observer?.disconnect();
        this.observer = null;
    }

    private assertUsable(): void {
        if (this.disposed) {
            throw new Error('CanvasViewport has been disposed');
        }
    }
}
