import { bootstrapApplication } from './engine';
import { Router } from './router';

/**
 * Browser entry point.
 *
 * The router is the root component. It selects a module wrapper; each wrapper
 * applies the shared module layout and composes that module's components.
 */
export const application = bootstrapApplication(
    '#app',
    context => new Router(context),
);