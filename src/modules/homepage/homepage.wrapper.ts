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
        this.sections = HOMEPAGE_CONTENT.homepage.sections.map((section, index) => this.builder.element('section', {
            className: ['homepage-section', section.className],
        }, [
            section.image ? this.builder.element('div', { className: 'homepage-section__media' },
                this.builder.element('img', { attributes: { src: section.image.src, alt: section.image.alt, loading: 'lazy', decoding: 'async' } })) : null,
            this.builder.element('div', { className: 'homepage-section__body' }, [
                this.builder.element('div', { className: 'homepage-section__meta' }, [
                    this.builder.element('span', {}, section.eyebrow),
                    this.builder.element('span', { attributes: { 'aria-hidden': 'true' } }, String(index + 1).padStart(2, '0')),
                ]),
                this.builder.element('h2', {}, section.title),
                this.builder.element('p', {}, section.text),
                this.builder.element('a', { attributes: { href: section.link.href } }, [section.link.label,
                    this.builder.element('span', { attributes: { 'aria-hidden': 'true' } }, '↗')]),
            ]),
        ]));
    }

    protected override onLayoutMount(): void {
        this.mountEntry(this.hero);
        for (const panel of this.panels) this.mountEntry(panel);
        this.content.append(this.builder.element('section', {
            className: 'homepage-sections',
            attributes: { 'aria-labelledby': 'homepage-next-title' },
        }, [
            this.builder.element('header', { className: 'homepage-sections__header' }, [
                this.builder.element('p', {}, 'Your next move'),
                this.builder.element('h2', { attributes: { id: 'homepage-next-title' } }, 'Make it personal. Then make it real.'),
            ]),
            ...this.sections,
        ]));
    }

    private createPanel(data: IHomepagePanel): PanelComponent {
        const list = this.builder.element('ul', { className: 'homepage-panel__list' },
            data.paragraphs.map(paragraph => this.builder.element('li', {},
                this.builder.element('p', {}, paragraph))));
        const text = this.builder.element('div', {}, [this.builder.element('h2', {}, data.title), list]);
        const content = this.builder.element('img', {
            className: 'homepage-panel__image',
            attributes: { src: data.image.src, alt: data.image.alt, loading: 'lazy', decoding: 'async' },
            style: {
                '--panel-content-height': data.contentHeight,
            },
        });
        return new PanelComponent({ ...data.structure, text, content });
    }
}
