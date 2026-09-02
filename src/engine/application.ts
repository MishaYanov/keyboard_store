import type { Component } from './component';
import { ComponentScope } from './component-scope';
import type { ApplicationContext } from './application-context';
import {
    EventManager,
    type EventManagerOptions,
} from './events/event-manager';
import {
    CanvasScheduler,
    type CanvasSchedulerOptions,
} from './rendering/canvas-scheduler';
import { Scheduler, type SchedulerOptions } from './scheduler';

export const ApplicationStatus = {
    Created: 'created',
    Disposed: 'disposed',
    Disposing: 'disposing',
    Mounted: 'mounted',
    Mounting: 'mounting',
} as const;

export type ApplicationStatus = typeof ApplicationStatus[
    keyof typeof ApplicationStatus
    ];

export type RootComponentFactory<TRoot extends Component = Component> = (
    context: ApplicationContext,
) => TRoot;

export interface ApplicationOptions {
    readonly canvasScheduler?: CanvasSchedulerOptions;
    readonly eventManager?: EventManagerOptions;
    readonly scheduler?: SchedulerOptions;
}

/**
 * Composition root for one UI application.
 *
 * It owns all application-wide services and exactly one root component. A
 * failed mount is terminal: the component is rolled back and every global
 * listener or queued job is released before the error is rethrown.
 */
export class Application {
    private readonly root: HTMLElement;
    private readonly scope = new ComponentScope();
    private readonly context: ApplicationContext;

    private rootComponent: Component | null = null;
    private status: ApplicationStatus = ApplicationStatus.Created;

    public constructor(
        root: HTMLElement,
        options: ApplicationOptions = {},
    ) {
        this.root = root;

        const scheduler = new Scheduler(options.scheduler);
        const eventManager = new EventManager(root, options.eventManager);
        let canvasScheduler: CanvasScheduler;

        try {
            canvasScheduler = new CanvasScheduler(options.canvasScheduler);
        } catch (error: unknown) {
            eventManager.dispose();
            scheduler.clear();

            throw error;
        }

        // Registered in dependency order so reverse disposal shuts the Canvas
        // loop down before events, then clears pending reactive work.
        this.scope.add(() => {
            scheduler.clear();
        });
        this.scope.own(eventManager);
        this.scope.own(canvasScheduler);

        this.context = Object.freeze({
            canvasScheduler,
            eventManager,
            root,
            scheduler,
        });
    }

    public mount<TRoot extends Component>(
        createRootComponent: RootComponentFactory<TRoot>,
    ): TRoot {
        if (this.status !== ApplicationStatus.Created) {
            throw new Error(
                `Cannot mount an application with status "${this.status}"`,
            );
        }

        this.status = ApplicationStatus.Mounting;

        let component: TRoot | null = null;

        try {
            component = createRootComponent(this.context);
            component.mount(this.root);

            if (!component.isMounted()) {
                throw new Error(
                    'The root component did not remain mounted during startup',
                );
            }

            this.rootComponent = component;
            this.status = ApplicationStatus.Mounted;

            return component;
        } catch (error: unknown) {
            const rollbackErrors: unknown[] = [];

            if (component) {
                try {
                    component.unmount();
                } catch (rollbackError: unknown) {
                    rollbackErrors.push(rollbackError);
                }
            }

            this.rootComponent = null;

            try {
                this.scope.dispose();
            } catch (rollbackError: unknown) {
                rollbackErrors.push(rollbackError);
            }

            this.status = ApplicationStatus.Disposed;

            if (rollbackErrors.length === 0) {
                throw error;
            }

            throw new AggregateError(
                [error, ...rollbackErrors],
                'Application startup failed and rollback was incomplete',
            );
        }
    }

    public dispose(): void {
        if (
            this.status === ApplicationStatus.Disposing
            || this.status === ApplicationStatus.Disposed
        ) {
            return;
        }

        this.status = ApplicationStatus.Disposing;

        const errors: unknown[] = [];
        const component = this.rootComponent;

        this.rootComponent = null;

        if (component) {
            try {
                component.unmount();
            } catch (error: unknown) {
                errors.push(error);
            }
        }

        try {
            this.scope.dispose();
        } catch (error: unknown) {
            errors.push(error);
        }

        this.status = ApplicationStatus.Disposed;

        if (errors.length === 1) {
            throw errors[0];
        }

        if (errors.length > 1) {
            throw new AggregateError(
                errors,
                'Multiple application cleanups failed',
            );
        }
    }

    public getContext(): ApplicationContext {
        return this.context;
    }

    public getRoot(): HTMLElement {
        return this.root;
    }

    public getRootComponent(): Component | null {
        return this.rootComponent;
    }

    public getStatus(): ApplicationStatus {
        return this.status;
    }

    public isMounted(): boolean {
        return this.status === ApplicationStatus.Mounted;
    }
}
