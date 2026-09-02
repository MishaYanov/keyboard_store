/**
 * A reactive value that can be observed.
 *
 * Signals and computed values implement this interface.
 */
export interface ReactiveSource {
    addObserver(observer: ReactiveObserver): void;
    removeObserver(observer: ReactiveObserver): void;
}

/**
 * A computation that depends on reactive sources.
 *
 * Effects and computed values implement this interface.
 */
export interface ReactiveObserver {
    addDependency(source: ReactiveSource): void;
    notify(): void;
}

let activeObserver: ReactiveObserver | null = null;

/**
 * Records a source read against the currently executing observer.
 * Does nothing when the read happens outside a reactive computation.
 */
export function trackDependency(source: ReactiveSource): void {
    activeObserver?.addDependency(source);
}

/**
 * Runs a synchronous computation as the active reactive observer.
 *
 * Nested calls are supported. The previous observer is restored even when
 * the computation throws.
 */
export function runWithObserver<T>(observer: ReactiveObserver, computation: () => T): T {
    const previousObserver = activeObserver;

    activeObserver = observer;

    try {
        return computation();
    } finally {
        activeObserver = previousObserver;
    }
}

/**
 * Runs a synchronous computation without collecting reactive dependencies.
 */
export function runUntracked<T>(computation: () => T): T {
    const previousObserver = activeObserver;

    activeObserver = null;

    try {
        return computation();
    } finally {
        activeObserver = previousObserver;
    }
}
