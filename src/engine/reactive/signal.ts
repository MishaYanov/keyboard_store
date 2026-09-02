import {trackDependency, type ReactiveObserver, type ReactiveSource} from './dependency-context';
import { notifyObserver } from './batch';

export interface ReadonlySignal<T> {
    get(): T;
}

export interface WritableSignal<T> extends ReadonlySignal<T> {
    set(value: T): void;
    update(updater: (currentValue: T) => T): void;
}

class SignalNode<T> implements WritableSignal<T>, ReactiveSource {
    private readonly observers = new Set<ReactiveObserver>();
    private value: T;

    public constructor(initialValue: T) {
        this.value = initialValue;
    }

    public get(): T {
        trackDependency(this);

        return this.value;
    }

    public set(nextValue: T): void {
        if (Object.is(this.value, nextValue)) {
            return;
        }

        this.value = nextValue;
        this.notifyObservers();
    }

    public update(updater: (currentValue: T) => T): void {
        this.set(updater(this.value));
    }

    public addObserver(observer: ReactiveObserver): void {
        this.observers.add(observer);
    }

    public removeObserver(observer: ReactiveObserver): void {
        this.observers.delete(observer);
    }

    private notifyObservers(): void {
        const observers = [...this.observers];

        for (const observer of observers) {
            // An earlier observer may have removed this one while being
            // notified. Newly added observers wait for the next change.
            if (this.observers.has(observer)) {
                notifyObserver(observer);
            }
        }
    }
}

export function signal<T>(initialValue: T): WritableSignal<T> {
    return new SignalNode(initialValue);
}
