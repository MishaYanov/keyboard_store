import { Component, type ApplicationContext } from '../../engine';
import { HeaderComponent } from '../header/components/header.component';
import { HeaderService } from '../header/services/header.service';

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

    protected constructor(moduleName: string, context: ApplicationContext) {
        const root = document.createElement('section');
        const content = document.createElement('div');

        root.className = `module-layout module-layout--${moduleName}`;
        root.dataset.module = moduleName;
        content.className = 'module-layout__content';
        root.appendChild(content);

        super(root);

        this.content = content;
        this.header = new HeaderComponent(context, new HeaderService());
    }

    protected override onMount(): void {
        this.attach(this.header, this.root, this.content);
        this.onLayoutMount();
    }

    protected onLayoutMount(): void {}

    protected mountEntry<TEntry extends Component>(entry: TEntry): TEntry {
        return this.attach(entry, this.content);
    }
}
