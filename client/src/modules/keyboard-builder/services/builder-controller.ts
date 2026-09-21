import { KeyboardDesignService } from './keyboard-design.service';
import type { AppServices } from '../../../core/app-services';

/** Coordinates feature actions without depending on DOM or WebGL. */
export class BuilderController {
    public constructor(private readonly services: Pick<AppServices, 'basket' | 'openBasket'>,
        public readonly design = new KeyboardDesignService()) {}
    public openBasket(): void { this.services.openBasket(); }
    public addToBasket(snapshot: string | null): void {
        this.services.basket.addConfiguration(this.design.design.get(), snapshot);
        this.openBasket();
    }
}
