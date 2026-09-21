import {
    Application,
    type ApplicationOptions,
    type RootComponentFactory,
} from './application';
import type { Component } from './component';

export type ApplicationRoot = HTMLElement | string;

/** Resolves a root element while producing a useful startup error. */
export function resolveApplicationRoot(root: ApplicationRoot): HTMLElement {
    if (typeof root !== 'string') {
        return root;
    }

    if (typeof document === 'undefined') {
        throw new Error(
            `Cannot resolve application root "${root}" without a document`,
        );
    }

    const element = document.querySelector<HTMLElement>(root);

    if (!element) {
        throw new Error(`Application root "${root}" was not found`);
    }

    return element;
}

/**
 * Creates and mounts an Application in one call. This is the only framework
 * helper normally needed by src/app.ts.
 */
export function bootstrapApplication<TRoot extends Component>(
    root: ApplicationRoot,
    createRootComponent: RootComponentFactory<TRoot>,
    options: ApplicationOptions = {},
): Application {
    const application = new Application(
        resolveApplicationRoot(root),
        options,
    );

    application.mount(createRootComponent);

    return application;
}
