import type { EventManager } from './events/event-manager';
import type { CanvasScheduler } from './rendering/canvas-scheduler';
import type { Scheduler } from './scheduler';

/**
 * Shared runtime services created once for an application.
 *
 * Components receive this object explicitly. The runtime does not use hidden
 * global service singletons.
 */
export interface ApplicationContext {
    readonly canvasScheduler: CanvasScheduler;
    readonly eventManager: EventManager;
    readonly root: HTMLElement;
    readonly scheduler: Scheduler;
}
