import { Component } from '../../engine';

/**
 * Shared structural shell for a route-level module.
 *
 * A module wrapper extends this class and mounts its first component into the
 * content element. The layout supplies structure and styling hooks, but never
 * imports a concrete feature module.
 */
export abstract class LayoutComponent extends Component<HTMLElement> {
    protected readonly content: HTMLDivElement;

    protected constructor(moduleName: string) {
        const root = document.createElement('section');
        const content = document.createElement('div');

        root.className = `module-layout module-layout--${moduleName}`;
        root.dataset.module = moduleName;
        content.className = 'module-layout__content';
        root.appendChild(content);

        super(root);

        this.content = content;
    }

    protected mountEntry<TEntry extends Component>(entry: TEntry): TEntry {
        return this.attach(entry, this.content);
    }
}
