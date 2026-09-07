import '../styles/header.component.css';
import { Component, effect, type ApplicationContext } from '../../../engine';
import { HeaderService, type Theme } from '../services/header.service';

export class HeaderComponent extends Component<HTMLElement> {
    private readonly themeButtons: Array<readonly [Theme, HTMLButtonElement]> = [];
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
        }, this.createBar(this.closeButton));
        this.root.append(this.createBar(this.menuButton), this.menu);
    }

    private createBar(left: HTMLButtonElement): HTMLDivElement {
        const buttons = this.service.content.themes.map(({ value: theme, label }) => [
            theme,
            this.builder.element('button', {
                className: 'shared-header__theme',
                attributes: { type: 'button', 'aria-pressed': String(this.service.theme.get() === theme) },
            }, label),
        ] as const);
        this.themeButtons.push(...buttons);
        const themes = this.builder.element('div', {
            className: 'shared-header__themes',
            attributes: { role: 'group', 'aria-label': this.service.content.themeLabel },
        }, buttons.flatMap(([, button], index) => index === 0 ? [button] : [
            this.builder.element('span', { attributes: { 'aria-hidden': 'true' } }, this.service.content.separator),
            button,
        ]));
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
        for (const [theme, button] of this.themeButtons) {
            this.context.eventManager.on(this.scope, button, 'click', () => this.service.setTheme(theme));
        }
        this.registerCleanup(effect(() => {
            const selected = this.service.theme.get();
            for (const [theme, button] of this.themeButtons) {
                button.setAttribute('aria-pressed', String(theme === selected));
            }
        }, { scheduler: this.context.scheduler }));
    }
}
