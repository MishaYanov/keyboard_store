import { AccessibilityComponent } from '../accessibility/accessibility.component';
import { ACCESSIBILITY_CONTENT } from '../accessibility/accessibility.models';
import { Component, type ApplicationContext } from '../../engine';
import { HeaderComponent } from '../header/components/header.component';
import { HeaderService } from '../header/services/header.service';
import { FooterComponent } from '../footer/components/footer.component';
import type { ILayoutContent } from './layout.types';

/**
 * Shared structural shell for a route-level module.
 *
 * A module wrapper extends this class and mounts its first component into the
 * content element. The layout supplies structure and styling hooks, but never
 * imports a concrete feature module.
 */
export abstract class LayoutComponent extends Component<HTMLElement> {
    protected readonly content: HTMLDivElement;
    private readonly header: HeaderComponent;
    private readonly footer: FooterComponent;

    protected constructor(moduleName: string, context: ApplicationContext, contentConfig: ILayoutContent) {
        const root = document.createElement('section');
        const content = document.createElement('div');

        root.className = `module-layout module-layout--${moduleName}`;
        root.dataset.module = moduleName;
        content.className = 'module-layout__content';
        content.id = 'main-content';
        content.setAttribute('role', 'main');
        content.tabIndex = -1;
        root.appendChild(content);

        super(root);

        const skip = this.builder.element('a', { className: 'skip-content', attributes: { href: '#main-content' } }, ACCESSIBILITY_CONTENT.skip);
        const skipContent = (event: Event) => { event.preventDefault(); content.focus(); content.scrollIntoView({ behavior: 'instant' }); };
        skip.addEventListener('click', skipContent);
        this.registerCleanup(() => skip.removeEventListener('click', skipContent));
        this.root.prepend(skip);
        this.content = content;
        this.header = new HeaderComponent(context, new HeaderService(contentConfig.header));
        this.footer = new FooterComponent(contentConfig.footer);
    }

    protected override onMount(): void {
        this.attach(this.header, this.root, this.content);
        this.attach(new AccessibilityComponent());
        this.onLayoutMount();
        this.attach(this.footer);
    }

    protected onLayoutMount(): void {}

    protected mountEntry<TEntry extends Component>(entry: TEntry): TEntry {
        return this.attach(entry, this.content);
    }
}
