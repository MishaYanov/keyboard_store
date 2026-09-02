import type { ScheduledJob } from '../scheduler';
import {
    runUntracked,
    runWithObserver,
    type ReactiveObserver,
    type ReactiveSource,
} from './dependency-context';

export type EffectCleanup = () => void;
export type EffectComputation = () => void | EffectCleanup;
export type EffectDisposer = () => void;

export interface EffectScheduler {
    queue(job: ScheduledJob): void;
    cancel(job: ScheduledJob): void;
}

export interface EffectOptions {
    scheduler: EffectScheduler;
}

class EffectNode implements ReactiveObserver {
    private readonly dependencies = new Set<ReactiveSource>();
    private readonly computation: EffectComputation;
    private readonly scheduler: EffectScheduler;
    private readonly scheduledRun: ScheduledJob;

    private cleanup: EffectCleanup | null = null;
    private dirty = false;
    private disposed = false;

    public constructor(
        computation: EffectComputation,
        scheduler: EffectScheduler,
    ) {
        this.computation = computation;
        this.scheduler = scheduler;
        this.scheduledRun = (): void => {
            this.run();
        };
    }

    public run(): void {
        if (this.disposed) {
            return;
        }

        this.dirty = false;
        this.removeDependencies();
        this.runCleanup();

        const nextCleanup = runWithObserver(this, this.computation);

        // The computation is allowed to dispose its own effect. If that
        // happens, a newly returned cleanup must run immediately.
        if (this.disposed) {
            if (typeof nextCleanup === 'function') {
                runUntracked(nextCleanup);
            }

            return;
        }

        this.cleanup = typeof nextCleanup === 'function'
            ? nextCleanup
            : null;
    }

    public addDependency(source: ReactiveSource): void {
        if (this.disposed || this.dependencies.has(source)) {
            return;
        }

        this.dependencies.add(source);
        source.addObserver(this);
    }

    public notify(): void {
        if (this.disposed || this.dirty) {
            return;
        }

        this.dirty = true;
        this.scheduler.queue(this.scheduledRun);
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.dirty = false;

        this.scheduler.cancel(this.scheduledRun);
        this.removeDependencies();
        this.runCleanup();
    }

    private removeDependencies(): void {
        for (const dependency of this.dependencies) {
            dependency.removeObserver(this);
        }

        this.dependencies.clear();
    }

    private runCleanup(): void {
        const cleanup = this.cleanup;

        this.cleanup = null;

        if (cleanup) {
            runUntracked(cleanup);
        }
    }
}

/**
 * Creates an eager reactive effect and returns an idempotent disposer.
 */
export function effect(computation: EffectComputation, options: EffectOptions): EffectDisposer {
    const effectNode = new EffectNode(computation, options.scheduler);

    try {
        effectNode.run();
    } catch (error: unknown) {
        effectNode.dispose();

        throw error;
    }

    return (): void => {
        effectNode.dispose();
    };
}
