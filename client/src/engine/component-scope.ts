export type ScopeCleanup = () => void;

export interface ScopeDisposable {
    dispose(): void;
}

/**
 * Owns the resources created during a component's lifetime.
 *
 * Cleanups run once in reverse registration order. Disposing the scope is
 * idempotent, and one failed cleanup does not prevent the remaining cleanups.
 */
export class ComponentScope implements ScopeDisposable {
    private readonly cleanups = new Set<ScopeCleanup>();
    private disposed = false;

    /**
     * Registers a cleanup and returns a function that can release it early.
     * A cleanup registered after disposal runs immediately.
     */
    public add(cleanup: ScopeCleanup): ScopeCleanup {
        let active = true;

        const runOnce = (): void => {
            if (!active) {
                return;
            }

            active = false;
            cleanup();
        };

        if (this.disposed) {
            runOnce();

            return runOnce;
        }

        this.cleanups.add(runOnce);

        return (): void => {
            this.cleanups.delete(runOnce);
            runOnce();
        };
    }

    /**
     * Registers an object with a dispose method and returns that same object.
     */
    public own<T extends ScopeDisposable>(disposable: T): T {
        this.add(() => {
            disposable.dispose();
        });

        return disposable;
    }

    /**
     * Creates a nested scope that is disposed with this scope.
     */
    public createChild(): ComponentScope {
        return this.own(new ComponentScope());
    }

    public isDisposed(): boolean {
        return this.disposed;
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        const cleanups = [...this.cleanups].reverse();
        const errors: unknown[] = [];

        this.cleanups.clear();

        for (const cleanup of cleanups) {
            try {
                cleanup();
            } catch (error: unknown) {
                errors.push(error);
            }
        }

        if (errors.length === 1) {
            throw errors[0];
        }

        if (errors.length > 1) {
            throw new AggregateError(
                errors,
                'Multiple component-scope cleanups failed',
            );
        }
    }
}
