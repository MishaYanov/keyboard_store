import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { HeroComponent } from './components/hero.component';
import { HeroService } from './services/hero.service';
import { PanelComponent } from '../../shared/panel';
import './styles/homepage-panels.css';
import { HOMEPAGE_CONTENT } from './models/homepage.maps';
import type { IHomepagePanel } from './models/homepage.types';
import { KeycapJourneyComponent } from './components/keycap-journey.component';

/** Route entry point for the homepage module. */
export class HomepageWrapper extends LayoutComponent {
    private readonly hero: HeroComponent;
    private readonly panels: readonly PanelComponent[];
    private readonly sections: readonly HTMLElement[];
    private readonly journeyContext: ApplicationContext;

    public constructor(context: ApplicationContext) {
        super('homepage', context, HOMEPAGE_CONTENT.layout);
        this.journeyContext = context;

        const heroService = new HeroService(HOMEPAGE_CONTENT.hero);

        this.hero = new HeroComponent(heroService);
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
        const switchButton = this.builder.element('button', {
            className: 'keycap-landing__switch',
            attributes: { type: 'button', hidden: true, 'aria-label': 'Bring the keycap to this switch', 'aria-describedby': 'keycap-landing-caption' },
        });
        const target = this.builder.element('div', { className: 'keycap-landing__target' }, switchButton);
        const caption = this.builder.element('p', { className: 'keycap-landing__caption', attributes: { id: 'keycap-landing-caption', role: 'status' } }, 'One key. Entirely yours.');
        const landing = this.builder.element('section', { className: 'keycap-landing', attributes: { 'aria-labelledby': 'keycap-landing-title' } }, [
            this.builder.element('p', { className: 'keycap-landing__eyebrow' }, 'The final touch'),
            this.builder.element('h2', { attributes: { id: 'keycap-landing-title' } }, 'Everything clicks into place.'),
            target,
            caption,
            this.builder.element('a', { className: 'keycap-landing__link', attributes: { href: '#/builder' } }, 'Make your own ↗'),
        ]);
        this.content.append(landing);
        // Keep the fixed canvas outside the content's accessibility filter, which
        // would otherwise make it scroll as a containing block. It applies the same filter itself.
        try {
            this.attach(new KeycapJourneyComponent(this.journeyContext, {
                page: this.content, hero: this.hero.getRoot(), landing, target, highlight: this.hero.titleHighlight,
                motionControl: this.hero.motionControl,
                switchButton, caption,
            }));
        } catch (error) {
            // Decoration must not prevent navigation if WebGL is unavailable.
            console.warn('The keycap journey could not start; showing its still preview.', error);
            this.hero.motionControl.hidden = true;
            const fallback = this.builder.element('span', { className: 'keycap-landing__fallback', attributes: { 'aria-hidden': 'true' } }, 'BUILD');
            this.hero.getRoot().append(fallback);
            switchButton.hidden = false;
            caption.textContent = 'Click the switch to bring the keycap here.';
            this.journeyContext.eventManager.on(this.scope, switchButton, 'click', () => {
                target.append(fallback);
                switchButton.setAttribute('aria-label', 'Press the keyboard switch');
                fallback.getAnimations().forEach(animation => animation.cancel());
                fallback.animate([
                    { translate: '0 0' },
                    { translate: '0 8px', offset: .3 },
                    { translate: '0 0' },
                ], { duration: 280, easing: 'ease-out' });
                caption.textContent = 'One key. Entirely yours.';
            });
        }
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
