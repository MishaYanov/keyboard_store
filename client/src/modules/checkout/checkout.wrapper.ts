import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { SITE_CONTENT } from '../../models/site.maps';
import { CheckoutComponent } from './components/checkout.component';
import type { AppServices } from '../../core/app-services';

export class CheckoutWrapper extends LayoutComponent {
    public constructor(private readonly context: ApplicationContext, private readonly services: AppServices) { super('checkout', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new CheckoutComponent(this.context, this.services)); }
}
