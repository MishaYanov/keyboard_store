import {ComponentScope, type ScopeCleanup, type ScopeDisposable} from './component-scope';
import { ComponentBuilder } from './component-builder';
import {ComponentStatus, assertComponentTransition, isMountedComponentStatus, type ComponentStatus as ComponentStatusValue} from './lifecycle';

const STYLE_SCOPE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface ComponentOptions {
    readonly styleScope?: string;
}

/**
 * Base class for components backed by one HTMLElement.
 *
 * A component can be mounted once. Unmounting is terminal and releases child
 * components, scoped resources, and the root element.
 */
export abstract class Component<TRoot extends HTMLElement = HTMLElement> implements ScopeDisposable {
    protected readonly root: TRoot;
    protected readonly scope = new ComponentScope();
    protected readonly builder: ComponentBuilder;

    private readonly children: Component[] = [];
    private status: ComponentStatusValue = ComponentStatus.Created;

    protected constructor(root: TRoot, options: ComponentOptions = {}) {
        const styleScope = options.styleScope;

        root.setAttribute('data-component-root', '');

        if (styleScope !== undefined) {
            if (!STYLE_SCOPE_NAME_PATTERN.test(styleScope)) {
                throw new Error(`Invalid component style scope: ${styleScope}`);
            }

            root.dataset.styleScope = styleScope;
        }

        this.root = root;
        this.builder = new ComponentBuilder(this.scope);
    }

    public mount(parent: Node, before: Node | null = null): void {
        this.transitionTo(ComponentStatus.Mounting);

        let mountHookStarted = false;

        try {
            parent.insertBefore(this.root, before);

            mountHookStarted = true;
            this.onMount();

            // A component may intentionally unmount itself from onMount().
            if (this.status === ComponentStatus.Mounting) {
                this.transitionTo(ComponentStatus.Mounted);
            }
        } catch (error: unknown) {
            const rollbackErrors = this.status === ComponentStatus.Unmounted
                ? []
                : this.teardown(mountHookStarted);

            if (rollbackErrors.length === 0) {
                throw error;
            }

            throw new AggregateError(
                [error, ...rollbackErrors],
                'Component mounting failed and rollback was incomplete',
            );
        }
    }

    public unmount(): void {
        if (
            this.status === ComponentStatus.Created
            || this.status === ComponentStatus.Unmounting
            || this.status === ComponentStatus.Unmounted
        ) {
            return;
        }

        const errors = this.teardown(true);

        if (errors.length === 1) {
            throw errors[0];
        }

        if (errors.length > 1) {
            throw new AggregateError(
                errors,
                'Multiple component cleanups failed',
            );
        }
    }

    public dispose(): void {
        this.unmount();
    }

    public getRoot(): TRoot {
        return this.root;
    }

    public getStatus(): ComponentStatusValue {
        return this.status;
    }

    public isMounted(): boolean {
        return isMountedComponentStatus(this.status);
    }

    /**
     * Mounts and owns a child component.
     */
    protected attach<TChild extends Component>(
        child: TChild,
        parent: Node = this.root,
        before: Node | null = null,
    ): TChild {
        if (
            this.status !== ComponentStatus.Mounting
            && this.status !== ComponentStatus.Mounted
        ) {
            throw new Error(
                'Child components can only be attached while the parent '
                + 'is mounting or mounted',
            );
        }

        child.mount(parent, before);

        if (child.isMounted()) {
            this.children.push(child);
        }

        return child;
    }

    /**
     * Releases an owned child before the parent is unmounted.
     */
    protected detach(child: Component): boolean {
        const index = this.children.indexOf(child);

        if (index === -1) {
            return false;
        }

        this.children.splice(index, 1);
        child.unmount();

        return true;
    }

    protected registerCleanup(cleanup: ScopeCleanup): ScopeCleanup {
        return this.scope.add(cleanup);
    }

    protected own<T extends ScopeDisposable>(disposable: T): T {
        return this.scope.own(disposable);
    }

    protected onMount(): void {}

    protected onUnmount(): void {}

    private transitionTo(nextStatus: ComponentStatusValue): void {
        assertComponentTransition(this.status, nextStatus);
        this.status = nextStatus;
    }

    private teardown(callUnmountHook: boolean): unknown[] {
        if (this.status === ComponentStatus.Unmounted) {
            return [];
        }

        if (
            this.status === ComponentStatus.Mounting
            || this.status === ComponentStatus.Mounted
        ) {
            this.transitionTo(ComponentStatus.Unmounting);
        }

        const errors: unknown[] = [];

        if (callUnmountHook) {
            try {
                this.onUnmount();
            } catch (error: unknown) {
                errors.push(error);
            }
        }

        while (this.children.length > 0) {
            const child = this.children.pop();

            try {
                child?.unmount();
            } catch (error: unknown) {
                errors.push(error);
            }
        }

        try {
            this.scope.dispose();
        } catch (error: unknown) {
            errors.push(error);
        }

        try {
            this.root.remove();
        } catch (error: unknown) {
            errors.push(error);
        }

        if (this.status === ComponentStatus.Unmounting) {
            this.transitionTo(ComponentStatus.Unmounted);
        }

        return errors;
    }
}
