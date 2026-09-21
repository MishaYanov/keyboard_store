import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { SITE_CONTENT } from '../../models/site.maps';
import { PageComponent } from '../../shared/page/page.component';

export class NotFoundWrapper extends LayoutComponent {
    public constructor(context: ApplicationContext) { super('not-found', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new PageComponent(SITE_CONTENT.pages.notFound)); }
}
