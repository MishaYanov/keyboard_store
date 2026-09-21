import type { ApplicationContext } from '../../engine';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { SITE_CONTENT } from '../../models/site.maps';
import { BuilderComponent } from './components/builder.component';

export class BuilderWrapper extends LayoutComponent {
    public constructor(private readonly context: ApplicationContext) { super('builder', context, SITE_CONTENT.layout); }
    protected override onLayoutMount(): void { this.mountEntry(new BuilderComponent(this.context)); }
}
