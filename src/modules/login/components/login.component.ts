import { PageComponent } from '../../../shared/page/page.component';
import { SITE_CONTENT } from '../../../models/site.maps';

export class LoginComponent extends PageComponent {
    public constructor() { super(SITE_CONTENT.pages.login); }
}
