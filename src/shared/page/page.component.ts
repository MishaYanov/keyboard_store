import './page.css';
import { Component } from '../../engine';
import type { IPageContent } from '../../models/site.maps';

export class PageComponent extends Component<HTMLElement> {
    public constructor(data: IPageContent) {
        super(document.createElement('article'), { styleScope: 'page' });
        this.root.className = 'page';
        this.root.append(
            this.builder.element('h1', {}, data.title),
            ...data.paragraphs.map(text => this.builder.element('p', {}, text)),
            this.builder.element('nav', { attributes: { 'aria-label': 'Page navigation' } },
                data.links.map(link => this.builder.element('a', { attributes: { href: link.href } }, link.label))),
        );
    }
}
