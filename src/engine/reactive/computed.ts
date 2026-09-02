import { notifyObserver } from './batch';
import {runWithObserver, trackDependency, type ReactiveObserver, type ReactiveSource} from './dependency-context';
import type { ReadonlySignal } from './signal';

export type ComputedComputation<T> = () => T;

interface ComputedCache<T> {
    value: T;
}

class ComputedNode<T> implements ReadonlySignal<T>, ReactiveObserver, ReactiveSource {
    private readonly computation: ComputedComputation<T>;
    private readonly dependencies = new Set<ReactiveSource>();
    private readonly observers = new Set<ReactiveObserver>();

    private cache: ComputedCache<T> | null = null;
    private dirty = true;
    private evaluating = false;
    private disconnectPending = false;

    public constructor(computation: ComputedComputation<T>) {
        this.computation = computation;
    }

    public get(): T {
        if (this.evaluating) {
            throw new Error('Circular computed dependency detected');
        }

        trackDependency(this);

        if (this.dirty || this.cache === null) {
            this.recompute();
        }

        const value = this.cache!.value;

        if (this.observers.size === 0) {
            this.scheduleDisconnect();
        }

        return value;
    }

    public addDependency(source: ReactiveSource): void {
        if (this.dependencies.has(source)) {
            return;
        }

        this.dependencies.add(source);
        source.addObserver(this);
    }

    public notify(): void {
        if (this.dirty) {
            return;
        }

        this.dirty = true;

        const observers = [...this.observers];

        for (const observer of observers) {
            if (this.observers.has(observer)) {
                notifyObserver(observer);
            }
        }
    }

    public addObserver(observer: ReactiveObserver): void {
        this.observers.add(observer);
    }

    public removeObserver(observer: ReactiveObserver): void {
        this.observers.delete(observer);

        if (this.observers.size === 0) {
            this.scheduleDisconnect();
        }
    }

    private recompute(): void {
        this.removeDependencies();
        this.dirty = false;
        this.evaluating = true;

        try {
            this.cache = {
                value: runWithObserver(this, this.computation),
            };
        } catch (error: unknown) {
            this.dirty = true;

            throw error;
        } finally {
            this.evaluating = false;
        }
    }

    private scheduleDisconnect(): void {
        if (this.disconnectPending) {
            return;
        }

        this.disconnectPending = true;

        queueMicrotask(() => {
            this.disconnectPending = false;

            if (this.observers.size === 0) {
                this.removeDependencies();
                this.dirty = true;
            }
        });
    }

    private removeDependencies(): void {
        for (const dependency of this.dependencies) {
            dependency.removeObserver(this);
        }

        this.dependencies.clear();
    }
}

/**
 * Creates a lazy, cached value derived from other reactive values.
 */
export function computed<T>(computation: ComputedComputation<T>): ReadonlySignal<T> {
    return new ComputedNode(computation);
}
