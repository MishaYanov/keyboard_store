import { CheckoutService } from '../modules/checkout/services/checkout.service';
import { ShopifyService } from './shopify/shopify.service';

export type BasketStore = Pick<CheckoutService, 'basket' | 'storageAvailable' | 'calculator' | 'addConfiguration' | 'setQuantity' | 'remove' | 'totalCents'>;
export type CommerceGateway = Pick<ShopifyService, 'availability' | 'configured' | 'checkout' | 'checkoutUrl' | 'invalidateCheckout' | 'restartCheckout'>;
export interface AppServices {
    readonly basket: BasketStore;
    readonly commerce: CommerceGateway;
    readonly openBasket: () => void;
}

/** Feature dependencies belong to the application, not the generic rendering engine. */
export function createAppServices(): AppServices {
    return { basket: new CheckoutService(), commerce: new ShopifyService(), openBasket: () => { window.location.hash = '#/checkout'; } };
}
