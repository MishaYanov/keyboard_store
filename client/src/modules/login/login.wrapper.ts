import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { SITE_CONTENT } from '../../models/site.maps';
import { LoginComponent } from './components/login.component';

export class LoginWrapper extends LayoutComponent {
    public constructor(context: ApplicationContext) { super('login', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new LoginComponent()); }
}
