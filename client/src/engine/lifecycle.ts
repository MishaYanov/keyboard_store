export const ComponentStatus = {
    Created: 'created',
    Mounting: 'mounting',
    Mounted: 'mounted',
    Unmounting: 'unmounting',
    Unmounted: 'unmounted',
} as const;

export type ComponentStatus = typeof ComponentStatus[
    keyof typeof ComponentStatus
    ];

const allowedTransitions: Readonly<Record<ComponentStatus, readonly ComponentStatus[]>> = {
    [ComponentStatus.Created]: [ComponentStatus.Mounting],
    [ComponentStatus.Mounting]: [ComponentStatus.Mounted, ComponentStatus.Unmounting],
    [ComponentStatus.Mounted]: [ComponentStatus.Unmounting],
    [ComponentStatus.Unmounting]: [ComponentStatus.Unmounted],
    [ComponentStatus.Unmounted]: [],
};

export class ComponentLifecycleError extends Error {
    public readonly currentStatus: ComponentStatus;
    public readonly requestedStatus: ComponentStatus;

    public constructor(currentStatus: ComponentStatus, requestedStatus: ComponentStatus) {
        super(`Invalid component lifecycle transition: ` + `${currentStatus} -> ${requestedStatus}`);

        this.name = 'ComponentLifecycleError';
        this.currentStatus = currentStatus;
        this.requestedStatus = requestedStatus;
    }
}

export function canTransitionComponent(currentStatus: ComponentStatus, requestedStatus: ComponentStatus): boolean {
    return allowedTransitions[currentStatus].includes(requestedStatus);
}

export function assertComponentTransition(currentStatus: ComponentStatus, requestedStatus: ComponentStatus): void {
    if (!canTransitionComponent(currentStatus, requestedStatus)) {
        throw new ComponentLifecycleError(
            currentStatus,
            requestedStatus,
        );
    }
}

export function isMountedComponentStatus(status: ComponentStatus): boolean {
    return status === ComponentStatus.Mounted;
}
