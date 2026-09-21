import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { SITE_CONTENT } from '../../models/site.maps';
import { CheckoutComponent } from './components/checkout.component';

export class CheckoutWrapper extends LayoutComponent {
    public constructor(private readonly context: ApplicationContext) { super('checkout', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new CheckoutComponent(this.context)); }
}
