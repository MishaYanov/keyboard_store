import {
    Component,
    type ApplicationContext,
} from './engine';
import { HomepageWrapper } from './modules/homepage/homepage.wrapper';

export type AppRoute = '';

type RouteFactory = (context: ApplicationContext) => Component;

const routes: Readonly<Record<AppRoute, RouteFactory>> = {
    '': context => new HomepageWrapper(context),
};

/**
 * Root application component responsible only for route-to-wrapper selection.
 */
export class Router extends Component<HTMLDivElement> {
    private readonly context: ApplicationContext;
    private activeRoute: AppRoute | null = null;
    private activeWrapper: Component | null = null;

    public constructor(context: ApplicationContext) {
        const root = document.createElement('div');

        root.className = 'router-view';

        super(root);

        this.context = context;
    }

    public navigate(route: AppRoute): void {
        if (route === this.activeRoute && this.activeWrapper?.isMounted()) {
            return;
        }

        const createWrapper = routes[route];
        const previousWrapper = this.activeWrapper;
        const nextWrapper = createWrapper(this.context);

        // Mount first so a failed route cannot remove the currently visible
        // module. attach() also makes the Router own the new wrapper.
        this.attach(nextWrapper);

        if (previousWrapper) {
            this.detach(previousWrapper);
        }

        this.activeWrapper = nextWrapper;
        this.activeRoute = route;
        this.root.dataset.route = route;
    }

    public getActiveRoute(): AppRoute | null {
        return this.activeRoute;
    }

    public getActiveWrapper(): Component | null {
        return this.activeWrapper;
    }

    protected override onMount(): void {
        this.navigate('');
    }
}
