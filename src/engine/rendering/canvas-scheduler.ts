export interface CanvasRenderable {
    getTargetFps(): number;
    isCanvasActive(): boolean;
    paintFrame(timestamp: number): void;
}

export interface CanvasVisibilitySource {
    readonly hidden: boolean;
    addEventListener(type: 'visibilitychange', listener: EventListener): void;
    removeEventListener(type: 'visibilitychange', listener: EventListener): void;
}

export interface CanvasSchedulerOptions {
    readonly cancelFrame?: (handle: number) => void;
    readonly onError?: (error: unknown, renderable: CanvasRenderable) => void;
    readonly requestFrame?: (callback: FrameRequestCallback) => number;
    readonly visibilitySource?: CanvasVisibilitySource;
}

function reportUnhandledCanvasError(error: unknown): void {
    queueMicrotask(() => {
        throw error;
    });
}

function normalizeFps(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Shares one requestAnimationFrame loop across dirty and animated canvases.
 * Dirty canvases paint once; continuous canvases are throttled per component.
 */
export class CanvasScheduler {
    private readonly requestFrame: (callback: FrameRequestCallback) => number;
    private readonly cancelFrame: (handle: number) => void;
    private readonly onError: (
        error: unknown,
        renderable: CanvasRenderable,
    ) => void;
    private readonly visibilitySource?: CanvasVisibilitySource;
    private readonly visibilityListener: EventListener;

    private readonly dirty = new Set<CanvasRenderable>();
    private readonly continuous = new Set<CanvasRenderable>();
    private readonly lastPaintTimes = new Map<CanvasRenderable, number>();

    private frameHandle: number | null = null;
    private disposed = false;

    public constructor(options: CanvasSchedulerOptions = {}) {
        this.requestFrame = options.requestFrame
            ?? (callback => requestAnimationFrame(callback));
        this.cancelFrame = options.cancelFrame
            ?? (handle => cancelAnimationFrame(handle));
        this.onError = options.onError
            ?? ((error): void => reportUnhandledCanvasError(error));
        this.visibilitySource = options.visibilitySource
            ?? (typeof document === 'undefined' ? undefined : document);
        this.visibilityListener = (): void => {
            this.handleVisibilityChange();
        };

        this.visibilitySource?.addEventListener(
            'visibilitychange',
            this.visibilityListener,
        );
    }

    public invalidate(renderable: CanvasRenderable): void {
        this.assertUsable();
        this.dirty.add(renderable);
        this.requestNextFrame();
    }

    public setContinuous(
        renderable: CanvasRenderable,
        enabled: boolean,
    ): void {
        this.assertUsable();

        if (enabled) {
            this.continuous.add(renderable);
            this.requestNextFrame();
        } else {
            this.continuous.delete(renderable);
            this.lastPaintTimes.delete(renderable);
        }
    }

    public unregister(renderable: CanvasRenderable): void {
        this.dirty.delete(renderable);
        this.continuous.delete(renderable);
        this.lastPaintTimes.delete(renderable);
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        if (this.frameHandle !== null) {
            this.cancelFrame(this.frameHandle);
            this.frameHandle = null;
        }

        this.visibilitySource?.removeEventListener(
            'visibilitychange',
            this.visibilityListener,
        );
        this.dirty.clear();
        this.continuous.clear();
        this.lastPaintTimes.clear();
    }

    private requestNextFrame(): void {
        if (
            this.disposed
            || this.frameHandle !== null
            || this.visibilitySource?.hidden
        ) {
            return;
        }

        this.frameHandle = this.requestFrame(timestamp => {
            this.runFrame(timestamp);
        });
    }

    private runFrame(timestamp: number): void {
        this.frameHandle = null;

        if (this.disposed || this.visibilitySource?.hidden) {
            return;
        }

        const candidates = new Set([
            ...this.dirty,
            ...this.continuous,
        ]);

        for (const renderable of candidates) {
            if (!renderable.isCanvasActive()) {
                continue;
            }

            const isDirty = this.dirty.has(renderable);

            if (!isDirty && !this.isContinuousFrameDue(renderable, timestamp)) {
                continue;
            }

            this.dirty.delete(renderable);

            try {
                renderable.paintFrame(timestamp);
            } catch (error: unknown) {
                this.onError(error, renderable);
            } finally {
                // Failed continuous frames are still throttled, preventing a
                // broken scene from turning into a 60-errors-per-second loop.
                this.lastPaintTimes.set(renderable, timestamp);
            }
        }

        if (this.hasActiveWork()) {
            this.requestNextFrame();
        }
    }

    private isContinuousFrameDue(
        renderable: CanvasRenderable,
        timestamp: number,
    ): boolean {
        if (!this.continuous.has(renderable)) {
            return false;
        }

        const fps = normalizeFps(renderable.getTargetFps());

        if (fps === 0) {
            return false;
        }

        const previous = this.lastPaintTimes.get(renderable);

        return previous === undefined
            || timestamp - previous >= (1000 / fps) - 0.5;
    }

    private hasActiveWork(): boolean {
        for (const renderable of this.dirty) {
            if (renderable.isCanvasActive()) {
                return true;
            }
        }

        for (const renderable of this.continuous) {
            if (
                renderable.isCanvasActive()
                && normalizeFps(renderable.getTargetFps()) > 0
            ) {
                return true;
            }
        }

        return false;
    }

    private handleVisibilityChange(): void {
        if (this.visibilitySource?.hidden) {
            if (this.frameHandle !== null) {
                this.cancelFrame(this.frameHandle);
                this.frameHandle = null;
            }

            return;
        }

        if (this.hasActiveWork()) {
            this.requestNextFrame();
        }
    }

    private assertUsable(): void {
        if (this.disposed) {
            throw new Error('CanvasScheduler has been disposed');
        }
    }
}
