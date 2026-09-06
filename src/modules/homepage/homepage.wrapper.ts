import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { HeroComponent } from './components/hero.component';
import { HeroService } from './services/hero.service';

/** Route entry point for the homepage module. */
export class HomepageWrapper extends LayoutComponent {
    private readonly hero: HeroComponent;

    public constructor(context: ApplicationContext) {
        super('homepage', context);

        const heroService = new HeroService();

        this.hero = new HeroComponent(context, heroService);
    }

    protected override onLayoutMount(): void {
        this.mountEntry(this.hero);
    }
}
