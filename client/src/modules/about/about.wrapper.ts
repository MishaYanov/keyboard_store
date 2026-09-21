import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { SITE_CONTENT } from '../../models/site.maps';
import { AboutComponent } from './components/about.component';

export class AboutWrapper extends LayoutComponent {
    public constructor(context: ApplicationContext) { super('about', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new AboutComponent()); }
}
