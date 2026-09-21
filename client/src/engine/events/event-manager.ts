import type { ComponentScope, ScopeCleanup } from '../component-scope';

export interface DelegatedEventOptions {
    capture?: boolean;
    once?: boolean;
}

export type DelegatedEventHandler<TEvent extends Event = Event> = (
    event: TEvent,
    currentTarget: EventTarget,
) => void;

export type EventManagerErrorHandler = (
    error: unknown,
    event: Event,
    currentTarget: EventTarget,
) => void;

export interface EventManagerOptions {
    onError?: EventManagerErrorHandler;
}

interface HandlerRegistration {
    active: boolean;
    capture: boolean;
    handler: DelegatedEventHandler;
    once: boolean;
    remove(): void;
}

interface HandlerBucket {
    capture: Set<HandlerRegistration>;
    bubble: Set<HandlerRegistration>;
}

interface RootListenerRecord {
    capture: boolean;
    count: number;
    listener: EventListener;
    type: string;
}

function reportUnhandledEventError(error: unknown): void {
    queueMicrotask(() => {
        throw error;
    });
}

/**
 * Delegates DOM events from one application root.
 *
 * Each event type uses at most one native listener for capture and one for
 * bubbling, regardless of how many component handlers are registered.
 */
export class EventManager {
    private readonly root: HTMLElement;
    private readonly onError: EventManagerErrorHandler;
    private readonly handlers = new WeakMap<
        EventTarget,
        Map<string, HandlerBucket>
    >();
    private readonly registrations = new Set<HandlerRegistration>();
    private readonly rootListeners = new Map<string, RootListenerRecord>();

    private disposed = false;

    public constructor(
        root: HTMLElement,
        options: EventManagerOptions = {},
    ) {
        this.root = root;
        this.onError = options.onError ?? reportUnhandledEventError;
    }

    public on<K extends keyof GlobalEventHandlersEventMap>(
        scope: ComponentScope,
        target: EventTarget,
        type: K,
        handler: DelegatedEventHandler<GlobalEventHandlersEventMap[K]>,
        options: DelegatedEventOptions = {},
    ): ScopeCleanup {
        if (this.disposed) {
            throw new Error('Cannot register an event on a disposed EventManager');
        }

        const capture = options.capture ?? false;
        const bucket = this.getOrCreateBucket(target, type);
        const lane = capture ? bucket.capture : bucket.bubble;

        const registration: HandlerRegistration = {
            active: true,
            capture,
            handler: handler as unknown as DelegatedEventHandler,
            once: options.once ?? false,
            remove: (): void => {},
        };

        registration.remove = (): void => {
            if (!registration.active) {
                return;
            }

            registration.active = false;
            lane.delete(registration);
            this.registrations.delete(registration);
            this.releaseRootListener(type, capture);

            if (bucket.capture.size === 0 && bucket.bubble.size === 0) {
                this.handlers.get(target)?.delete(type);
            }
        };

        lane.add(registration);
        this.registrations.add(registration);
        this.retainRootListener(type, capture);

        return scope.add(registration.remove);
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        for (const registration of [...this.registrations]) {
            registration.remove();
        }

        this.registrations.clear();
    }

    private getOrCreateBucket(
        target: EventTarget,
        type: string,
    ): HandlerBucket {
        let targetHandlers = this.handlers.get(target);

        if (!targetHandlers) {
            targetHandlers = new Map();
            this.handlers.set(target, targetHandlers);
        }

        let bucket = targetHandlers.get(type);

        if (!bucket) {
            bucket = {
                capture: new Set(),
                bubble: new Set(),
            };
            targetHandlers.set(type, bucket);
        }

        return bucket;
    }

    private retainRootListener(type: string, capture: boolean): void {
        const key = this.rootListenerKey(type, capture);
        const current = this.rootListeners.get(key);

        if (current) {
            current.count += 1;

            return;
        }

        const listener: EventListener = (event): void => {
            this.dispatch(event, capture);
        };

        this.root.addEventListener(type, listener, capture);
        this.rootListeners.set(key, {
            capture,
            count: 1,
            listener,
            type,
        });
    }

    private releaseRootListener(type: string, capture: boolean): void {
        const key = this.rootListenerKey(type, capture);
        const current = this.rootListeners.get(key);

        if (!current) {
            return;
        }

        current.count -= 1;

        if (current.count > 0) {
            return;
        }

        this.root.removeEventListener(type, current.listener, capture);
        this.rootListeners.delete(key);
    }

    private dispatch(event: Event, capture: boolean): void {
        const path = this.getApplicationPath(event);

        if (path.length === 0) {
            return;
        }

        const route = capture ? [...path].reverse() : path;

        for (const target of route) {
            const bucket = this.handlers.get(target)?.get(event.type);
            const lane = capture ? bucket?.capture : bucket?.bubble;

            if (!lane || this.isDisabled(target)) {
                continue;
            }

            for (const registration of [...lane]) {
                if (!registration.active) {
                    continue;
                }

                try {
                    registration.handler(event, target);
                } catch (error: unknown) {
                    this.onError(error, event, target);
                } finally {
                    if (registration.once) {
                        registration.remove();
                    }
                }
            }

            if (event.cancelBubble) {
                return;
            }
        }
    }

    private getApplicationPath(event: Event): EventTarget[] {
        const path = typeof event.composedPath === 'function'
            ? event.composedPath()
            : this.createFallbackPath(event.target);
        const rootIndex = path.indexOf(this.root);

        return rootIndex === -1
            ? []
            : path.slice(0, rootIndex + 1);
    }

    private createFallbackPath(target: EventTarget | null): EventTarget[] {
        const path: EventTarget[] = [];
        let current = target as (EventTarget & {
            host?: EventTarget | null;
            parentNode?: EventTarget | null;
        }) | null;

        while (current) {
            path.push(current);

            if (current === this.root) {
                break;
            }

            current = current.parentNode ?? current.host ?? null;
        }

        return path;
    }

    private isDisabled(target: EventTarget): boolean {
        return (target as EventTarget & { disabled?: boolean }).disabled === true;
    }

    private rootListenerKey(type: string, capture: boolean): string {
        return `${capture ? 'capture' : 'bubble'}:${type}`;
    }
}
