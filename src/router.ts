import {
    Component,
    type ApplicationContext,
} from './engine';
import { HomepageWrapper } from './modules/homepage/homepage.wrapper';
import { AboutWrapper } from './modules/about/about.wrapper';
import { BuilderWrapper } from './modules/keyboard-builder/builder.wrapper';
import { CheckoutWrapper } from './modules/checkout/checkout.wrapper';
import { ClientWrapper } from './modules/client/client.wrapper';
import { AdminWrapper } from './modules/admin/admin.wrapper';
import { NotFoundWrapper } from './modules/not-found/not-found.wrapper';

export type AppRoute = '' | 'about' | 'login' | 'account' | 'admin' | 'builder' | 'checkout' | 'not-found';

type RouteFactory = (context: ApplicationContext) => Component;

const routes: Readonly<Record<AppRoute, RouteFactory>> = {
    '': context => new HomepageWrapper(context),
    about: context => new AboutWrapper(context),
    // Keep the old login URL as a compatibility route while authentication is deferred.
    login: context => new ClientWrapper(context),
    account: context => new ClientWrapper(context),
    admin: context => new AdminWrapper(context),
    builder: context => new BuilderWrapper(context),
    checkout: context => new CheckoutWrapper(context),
    'not-found': context => new NotFoundWrapper(context),
};

/**
 * Root application component responsible only for route-to-wrapper selection.
 */
export class Router extends Component {
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
        const hash = route === '' ? '#/' : `#/${route}`;
        if (window.location.hash !== hash) window.history.pushState(null, '', hash);
        this.renderRoute(route);
    }

    private renderRoute(route: AppRoute): void {
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
        document.title = `${route === '' ? 'Home' : route === 'not-found' ? 'Page not found' : route[0]!.toUpperCase() + route.slice(1)} | Custom Keycaps`;
        window.scrollTo({ top: 0, behavior: 'instant' });
        const heading = nextWrapper.getRoot().querySelector('h1');
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
        }
    }

    public getActiveRoute(): AppRoute | null {
        return this.activeRoute;
    }

    public getActiveWrapper(): Component | null {
        return this.activeWrapper;
    }

    protected override onMount(): void {
        const onLocationChange = () => {
            const path = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
            const route = Object.prototype.hasOwnProperty.call(routes, path) ? path as AppRoute : 'not-found';
            this.renderRoute(route);
        };
        window.addEventListener('hashchange', onLocationChange);
        window.addEventListener('popstate', onLocationChange);
        this.registerCleanup(() => {
            window.removeEventListener('hashchange', onLocationChange);
            window.removeEventListener('popstate', onLocationChange);
        });
        onLocationChange();
    }
}
