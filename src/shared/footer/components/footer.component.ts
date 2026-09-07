import '../styles/footer.component.css';
import { Component } from '../../../engine';
import type { ILayoutContent } from '../../layout/layout.types';

export class FooterComponent extends Component<HTMLElement> {
    public constructor(config: ILayoutContent['footer']) {
        super(document.createElement('footer'), { styleScope: 'shared-footer' });
        this.root.className = 'shared-footer';
        this.root.style.setProperty('--footer-height', config.height);
        this.root.append(
            this.builder.element('h2', {}, config.title),
            this.builder.element('nav', { attributes: { 'aria-label': 'Footer navigation' } },
                config.links.map(link => this.builder.element('a', { attributes: { href: link.href } }, link.label))),
            this.builder.element('div', { className: 'shared-footer__notes' },
                config.disclaimers.map(text => this.builder.element('p', {}, text))),
        );
    }
}
