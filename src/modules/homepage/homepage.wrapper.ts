import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { HeroComponent } from './components/hero.component';
import { HeroService } from './services/hero.service';
import { PanelComponent } from '../../shared/panel';
import './styles/homepage-panels.css';
import { HOMEPAGE_CONTENT } from './models/homepage.maps';
import type { IHomepagePanel } from './models/homepage.types';

/** Route entry point for the homepage module. */
export class HomepageWrapper extends LayoutComponent {
    private readonly hero: HeroComponent;
    private readonly panels: readonly PanelComponent[];
    private readonly sections: readonly HTMLElement[];

    public constructor(context: ApplicationContext) {
        super('homepage', context, HOMEPAGE_CONTENT.layout);

        const heroService = new HeroService(HOMEPAGE_CONTENT.hero);

        this.hero = new HeroComponent(context, heroService);
        this.panels = HOMEPAGE_CONTENT.homepage.panels.map(panel => this.createPanel(panel));
        this.sections = HOMEPAGE_CONTENT.homepage.sections.map(section => this.builder.element('section', {
            className: ['homepage-section', section.className],
            style: { '--section-height': section.height },
        }, [
            this.builder.element('h2', {}, section.title),
            this.builder.element('p', {}, section.text),
            this.builder.element('a', { attributes: { href: section.link.href } }, section.link.label),
        ]));
    }

    protected override onLayoutMount(): void {
        this.mountEntry(this.hero);
        for (const panel of this.panels) this.mountEntry(panel);
        this.content.append(...this.sections);
    }

    private createPanel(data: IHomepagePanel): PanelComponent {
        const list = this.builder.element('ul', { className: 'homepage-panel__list' },
            data.paragraphs.map(paragraph => this.builder.element('li', {},
                this.builder.element('p', {}, paragraph))));
        const text = this.builder.element('div', {}, [this.builder.element('h2', {}, data.title), list]);
        const content = this.builder.element('div', {
            className: 'homepage-panel__color',
            attributes: { 'aria-hidden': 'true' },
            style: {
                '--panel-content-color': data.color,
                '--panel-content-height': data.contentHeight,
            },
        });
        return new PanelComponent({ ...data.structure, text, content });
    }
}
