import sunIcon from '../../../../public/assets/images/mode-sun.svg?url';
import modeIcon from '../../../../public/assets/images/mode.svg?url';
import '../styles/header.component.css';
import { Component, effect, type ApplicationContext } from '../../../engine';
import { HeaderService } from '../services/header.service';

export class HeaderComponent extends Component<HTMLElement> {
    private readonly themeButtons: HTMLButtonElement[] = [];
    private readonly menuButton: HTMLButtonElement;
    private readonly closeButton: HTMLButtonElement;
    private readonly menu: HTMLDialogElement;

    public constructor(
        private readonly context: ApplicationContext,
        private readonly service: HeaderService,
    ) {
        super(document.createElement('header'), { styleScope: 'shared-header' });
        this.root.className = 'shared-header';
        this.menuButton = this.builder.element('button', {
            className: 'shared-header__menu-button',
            attributes: { type: 'button', 'aria-label': service.content.openMenuLabel, 'aria-expanded': 'false', 'aria-haspopup': 'dialog' },
        }, this.builder.element('span', { className: 'shared-header__hamburger', attributes: { 'aria-hidden': 'true' } }));
        this.closeButton = this.builder.element('button', {
            className: 'shared-header__close',
            attributes: { type: 'button', 'aria-label': service.content.closeMenuLabel },
        }, service.content.closeMenuText);
        this.menu = this.builder.element('dialog', {
            className: 'shared-header__menu',
            attributes: { 'aria-label': service.content.menuLabel },
        }, [this.createBar(this.closeButton), this.builder.element('nav', {
            className: 'shared-header__navigation', attributes: { 'aria-label': service.content.navigationLabel },
        }, service.content.links.map(link => this.builder.element('a', {
            attributes: { href: link.href, ...(link.href === (window.location.hash || '#/') ? { 'aria-current': 'page' } : {}) },
        }, link.label)))]);
        this.root.append(this.createBar(this.menuButton), this.menu);
    }

    private createBar(left: HTMLButtonElement): HTMLDivElement {
        const button = this.builder.element('button', {
            className: 'shared-header__theme',
            attributes: { type: 'button', 'aria-label': this.service.content.themeLabel, 'aria-pressed': String(this.service.theme.get() === 'dark') },
        }, this.builder.element('img', { attributes: { src: modeIcon, alt: '', width: 44, height: 44, 'aria-hidden': 'true' } }));
        this.themeButtons.push(button);
        const themes = this.builder.element('div', { className: 'shared-header__themes' }, button);
        return this.builder.element('div', { className: 'shared-header__bar' }, [
            this.builder.element('div', { className: 'shared-header__left' }, left),
            this.builder.element('div', { attributes: { 'aria-hidden': 'true' } }),
            themes,
        ]);
    }

    protected override onMount(): void {
        this.context.eventManager.on(this.scope, this.menuButton, 'click', () => this.service.setMenuOpen(true));
        this.context.eventManager.on(this.scope, this.closeButton, 'click', () => this.service.setMenuOpen(false));

        const onCancel = (event: Event) => {
            event.preventDefault();
            this.service.setMenuOpen(false);
        };

        const onNavigate = (event: MouseEvent) => {
            if (event.target instanceof Element && event.target.closest('a[href]')) this.service.setMenuOpen(false);
        };
        this.menu.addEventListener('click', onNavigate);
        this.registerCleanup(() => this.menu.removeEventListener('click', onNavigate));
        this.menu.addEventListener('cancel', onCancel);
        this.registerCleanup(() => this.menu.removeEventListener('cancel', onCancel));
        const desktop = window.matchMedia('(min-width: 769px)');
        const onBreakpoint = () => { if (desktop.matches) this.service.setMenuOpen(false); };
        desktop.addEventListener('change', onBreakpoint);
        this.registerCleanup(() => desktop.removeEventListener('change', onBreakpoint));
        this.registerCleanup(() => this.menu.close());
        this.registerCleanup(effect(() => {
            const open = this.service.menuOpen.get();
            this.menuButton.setAttribute('aria-expanded', String(open));
            if (open && !this.menu.open) this.menu.showModal();
            if (!open && this.menu.open) this.menu.close();
        }, { scheduler: this.context.scheduler }));
        for (const button of this.themeButtons) {
            this.context.eventManager.on(this.scope, button, 'click', () => this.service.setTheme(this.service.theme.get() === 'dark' ? 'light' : 'dark'));
        }
        this.registerCleanup(effect(() => {
            const selected = this.service.theme.get();
            for (const button of this.themeButtons) {
                const icon = button.querySelector('img');
                if (icon) icon.src = selected === 'dark' ? sunIcon : modeIcon;
                button.dataset.targetTheme = selected === 'dark' ? 'light' : 'dark';
                const label = selected === 'dark' ? this.service.content.switchToLight : this.service.content.switchToDark;
                button.setAttribute('aria-label', label);
                button.setAttribute('title', label);
                button.removeAttribute('aria-pressed');
            }
        }, { scheduler: this.context.scheduler }));
    }
}
