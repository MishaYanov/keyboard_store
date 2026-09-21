import type { ApplicationContext } from '../../engine';
import { SITE_CONTENT } from '../../models/site.maps';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { ClientComponent } from './components/client.component';

export class ClientWrapper extends LayoutComponent {
    public constructor(private readonly context: ApplicationContext) { super('client', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new ClientComponent(this.context)); }
}
