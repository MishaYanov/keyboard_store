import { ComponentScope, type ScopeCleanup } from '../component-scope';
import { EventManager } from './event-manager';

export interface CanvasPoint {
    x: number;
    y: number;
}

export interface RoutedPointerEvent extends CanvasPoint {
    button: number;
    buttons: number;
    originalEvent: PointerEvent;
    pointerId: number;
    pressure: number;
    target: PointerTarget;
    capturePointer(): void;
    releasePointer(): void;
}

export interface PointerTarget {
    zIndex?: number;
    hitTest(point: CanvasPoint): boolean;
    onPointerEnter?(event: RoutedPointerEvent): void;
    onPointerLeave?(event: RoutedPointerEvent): void;
    onPointerDown?(event: RoutedPointerEvent): void;
    onPointerMove?(event: RoutedPointerEvent): void;
    onPointerUp?(event: RoutedPointerEvent): void;
    onPointerCancel?(event: RoutedPointerEvent): void;
}

interface TargetRegistration {
    active: boolean;
    order: number;
    target: PointerTarget;
}

/**
 * Routes pointer events from one canvas to hit-testable drawn targets.
 * Coordinates are always expressed in CSS pixels, never backing-buffer pixels.
 *
 * Interactive canvas targets should still have equivalent accessible DOM
 * controls when they represent user actions.
 */
export class PointerRouter {
    private readonly canvas: HTMLCanvasElement;
    private readonly scope: ComponentScope;
    private readonly targets = new Set<TargetRegistration>();
    private readonly capturedTargets = new Map<number, TargetRegistration>();
    private readonly hoveredTargets = new Map<number, TargetRegistration>();

    private nextOrder = 0;
    private disposed = false;

    public constructor(
        canvas: HTMLCanvasElement,
        eventManager: EventManager,
        ownerScope: ComponentScope,
    ) {
        this.canvas = canvas;
        this.scope = ownerScope.createChild();

        eventManager.on(
            this.scope,
            canvas,
            'pointerdown',
            event => this.handlePointerDown(event),
        );
        eventManager.on(
            this.scope,
            canvas,
            'pointermove',
            event => this.handlePointerMove(event),
        );
        eventManager.on(
            this.scope,
            canvas,
            'pointerup',
            event => this.handlePointerUp(event),
        );
        eventManager.on(
            this.scope,
            canvas,
            'pointercancel',
            event => this.handlePointerCancel(event),
        );
        eventManager.on(
            this.scope,
            canvas,
            'pointerleave',
            event => this.handlePointerLeave(event),
            { capture: true },
        );
    }

    public register(
        ownerScope: ComponentScope,
        target: PointerTarget,
    ): ScopeCleanup {
        if (this.disposed) {
            throw new Error('Cannot register a target on a disposed PointerRouter');
        }

        const registration: TargetRegistration = {
            active: true,
            order: this.nextOrder,
            target,
        };

        this.nextOrder += 1;
        this.targets.add(registration);

        return ownerScope.add(() => {
            this.removeRegistration(registration);
        });
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        try {
            this.scope.dispose();
        } finally {
            for (const registration of [...this.targets]) {
                this.removeRegistration(registration);
            }

            this.hoveredTargets.clear();
            this.capturedTargets.clear();
        }
    }

    private handlePointerDown(event: PointerEvent): void {
        const point = this.getPoint(event);
        const registration = this.hitTest(point);

        this.updateHover(event, registration);

        if (registration) {
            registration.target.onPointerDown?.(
                this.createRoutedEvent(event, point, registration),
            );
        }
    }

    private handlePointerMove(event: PointerEvent): void {
        const point = this.getPoint(event);
        const captured = this.capturedTargets.get(event.pointerId);
        const hit = this.hitTest(point);

        if (!captured) {
            this.updateHover(event, hit);
        }

        const registration = captured ?? hit;

        if (registration?.active) {
            registration.target.onPointerMove?.(
                this.createRoutedEvent(event, point, registration),
            );
        }
    }

    private handlePointerUp(event: PointerEvent): void {
        const point = this.getPoint(event);
        const hit = this.hitTest(point);
        const registration = this.capturedTargets.get(event.pointerId) ?? hit;

        if (registration?.active) {
            registration.target.onPointerUp?.(
                this.createRoutedEvent(event, point, registration),
            );
        }

        this.releasePointer(event.pointerId);
        this.updateHover(event, hit);
    }

    private handlePointerCancel(event: PointerEvent): void {
        const point = this.getPoint(event);
        const registration = this.capturedTargets.get(event.pointerId)
            ?? this.hoveredTargets.get(event.pointerId);

        if (registration?.active) {
            registration.target.onPointerCancel?.(
                this.createRoutedEvent(event, point, registration),
            );
        }

        this.releasePointer(event.pointerId);
        this.clearHover(event);
    }

    private handlePointerLeave(event: PointerEvent): void {
        this.clearHover(event);
    }

    private updateHover(
        event: PointerEvent,
        next: TargetRegistration | null,
    ): void {
        const previous = this.hoveredTargets.get(event.pointerId) ?? null;

        if (previous === next) {
            return;
        }

        const point = this.getPoint(event);

        if (previous?.active) {
            previous.target.onPointerLeave?.(
                this.createRoutedEvent(event, point, previous),
            );
        }

        if (next?.active) {
            this.hoveredTargets.set(event.pointerId, next);
            next.target.onPointerEnter?.(
                this.createRoutedEvent(event, point, next),
            );
        } else {
            this.hoveredTargets.delete(event.pointerId);
        }
    }

    private clearHover(event: PointerEvent): void {
        const previous = this.hoveredTargets.get(event.pointerId);

        if (!previous) {
            return;
        }

        this.hoveredTargets.delete(event.pointerId);

        if (previous.active) {
            previous.target.onPointerLeave?.(
                this.createRoutedEvent(
                    event,
                    this.getPoint(event),
                    previous,
                ),
            );
        }
    }

    private hitTest(point: CanvasPoint): TargetRegistration | null {
        let match: TargetRegistration | null = null;

        for (const registration of this.targets) {
            if (!registration.active || !registration.target.hitTest(point)) {
                continue;
            }

            if (
                match === null
                || (registration.target.zIndex ?? 0)
                > (match.target.zIndex ?? 0)
                || (
                    (registration.target.zIndex ?? 0)
                    === (match.target.zIndex ?? 0)
                    && registration.order > match.order
                )
            ) {
                match = registration;
            }
        }

        return match;
    }

    private getPoint(event: PointerEvent): CanvasPoint {
        const bounds = this.canvas.getBoundingClientRect();

        return {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
        };
    }

    private createRoutedEvent(
        event: PointerEvent,
        point: CanvasPoint,
        registration: TargetRegistration,
    ): RoutedPointerEvent {
        return {
            button: event.button,
            buttons: event.buttons,
            capturePointer: (): void => {
                this.capturePointer(event.pointerId, registration);
            },
            originalEvent: event,
            pointerId: event.pointerId,
            pressure: event.pressure,
            releasePointer: (): void => {
                this.releasePointer(event.pointerId, registration);
            },
            target: registration.target,
            x: point.x,
            y: point.y,
        };
    }

    private capturePointer(
        pointerId: number,
        registration: TargetRegistration,
    ): void {
        if (!registration.active) {
            return;
        }

        this.canvas.setPointerCapture(pointerId);
        this.capturedTargets.set(pointerId, registration);
    }

    private releasePointer(
        pointerId: number,
        expected?: TargetRegistration,
    ): void {
        const captured = this.capturedTargets.get(pointerId);

        if (!captured || (expected && captured !== expected)) {
            return;
        }

        this.capturedTargets.delete(pointerId);

        if (this.canvas.hasPointerCapture(pointerId)) {
            this.canvas.releasePointerCapture(pointerId);
        }
    }

    private removeRegistration(registration: TargetRegistration): void {
        if (!registration.active) {
            return;
        }

        registration.active = false;
        this.targets.delete(registration);

        for (const [pointerId, captured] of this.capturedTargets) {
            if (captured === registration) {
                this.releasePointer(pointerId, registration);
            }
        }

        for (const [pointerId, hovered] of this.hoveredTargets) {
            if (hovered === registration) {
                this.hoveredTargets.delete(pointerId);
            }
        }
    }
}
