import type { ApplicationContext } from '../../engine';
import { SITE_CONTENT } from '../../models/site.maps';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { AdminComponent } from './components/admin.component';

export class AdminWrapper extends LayoutComponent {
    public constructor(private readonly context: ApplicationContext) { super('admin', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new AdminComponent(this.context)); }
}
