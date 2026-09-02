import type { ReactiveObserver } from './dependency-context';

let batchDepth = 0;
let flushingObservers = false;

const pendingObservers = new Set<ReactiveObserver>();

/**
 * Notifies an observer immediately, or defers it until the active batch ends.
 * Reactive sources use this function instead of calling observer.notify()
 * directly.
 */
export function notifyObserver(observer: ReactiveObserver): void {
    if (batchDepth > 0 || flushingObservers) {
        pendingObservers.add(observer);

        return;
    }

    observer.notify();
}

/**
 * Applies several synchronous reactive writes as one notification boundary.
 * Nested batches flush only after the outermost batch finishes.
 */
export function batch<T>(computation: () => T): T {
    batchDepth += 1;

    try {
        return computation();
    } finally {
        batchDepth -= 1;

        if (batchDepth === 0) {
            flushPendingObservers();
        }
    }
}

function flushPendingObservers(): void {
    if (flushingObservers || pendingObservers.size === 0) {
        return;
    }

    flushingObservers = true;

    try {
        while (pendingObservers.size > 0) {
            const observers = [...pendingObservers];

            pendingObservers.clear();

            for (const observer of observers) {
                observer.notify();
            }
        }
    } finally {
        flushingObservers = false;
    }
}
