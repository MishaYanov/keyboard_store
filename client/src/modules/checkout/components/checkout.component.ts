import { Component, effect, type ApplicationContext } from '../../../engine';
import type { AppServices } from '../../../core/app-services';
import '../styles/checkout.css';

export class CheckoutComponent extends Component<HTMLElement> {
    private readonly items = this.builder.element('div');
    private readonly total = this.builder.element('p', { attributes: { role: 'status' } });
    private readonly storageStatus = this.builder.element('p', { attributes: { role: 'status' } });
    private readonly pay = this.builder.element('button', { attributes: { type: 'button' } }, 'Continue to secure checkout');
    private readonly paymentStatus = this.builder.element('p', { attributes: { role: 'status' } });
    private readonly restart = this.builder.element('button', { attributes: { type: 'button', hidden: true } }, 'Start a new checkout attempt');

    public constructor(private readonly context: ApplicationContext, private readonly services: AppServices) {
        super(document.createElement('article'));
        this.root.className = 'checkout';
        this.root.append(
            this.builder.element('h1', {}, 'Your basket'),
            this.builder.element('a', { attributes: { href: '#/builder' } }, 'Build another keyboard'),
            this.items, this.total, this.storageStatus,
            this.builder.element('p', {}, 'Estimated prices in USD. Final prices, shipping and taxes are confirmed at checkout.'),
            this.pay, this.paymentStatus, this.restart,
        );
    }

    protected override onMount(): void {
        const { basket: checkout, commerce: shopify } = this.services;
        this.context.eventManager.on(this.scope, this.restart, 'click', () => shopify.restartCheckout());
        shopify.invalidateCheckout();
        void shopify.availability.execute().catch(() => { /* Availability state is shown below. */ });
        this.context.eventManager.on(this.scope, this.pay, 'click', () => {
            if (shopify.checkout.loading.get()) return;
            const basket = structuredClone(checkout.basket.get());
            void shopify.checkout.execute(basket).then(cart => {
                if (!cart || !this.isMounted() || JSON.stringify(basket) !== JSON.stringify(checkout.basket.get())) return;
                const url = shopify.checkoutUrl();
                if (url) window.location.assign(url);
            }).catch(() => { /* Request error is displayed below. */ });
        });
        this.registerCleanup(effect(() => {
            const loading = shopify.checkout.loading.get();
            this.restart.hidden = loading || !shopify.checkout.error.get();
            this.pay.disabled = loading || !checkout.basket.get().length || !shopify.configured.get();
            this.pay.textContent = loading ? 'Preparing checkout…' : 'Continue to secure checkout';
            this.paymentStatus.textContent = shopify.checkout.error.get()?.message
                ?? (shopify.availability.loading.get() ? 'Checking checkout availability…' : shopify.configured.get()
                    ? shopify.availability.data.get()?.mock ? 'MOCK MODE: no real payment or shipping.' : 'Payment is completed securely with Shopify.' : 'Checkout is not available yet. Your basket stays saved in this browser.');
        }, { scheduler: this.context.scheduler }));
        this.registerCleanup(() => shopify.checkout.cancel());
        this.context.eventManager.on(this.scope, this.items, 'click', event => {
            const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-remove]') : null;
            if (button?.dataset.remove) { shopify.invalidateCheckout(); checkout.remove(button.dataset.remove); }
        });
        this.context.eventManager.on(this.scope, this.items, 'change', event => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || !input.dataset.item) return;
            if (!input.reportValidity()) {
                input.value = String(checkout.basket.get().find(item => item.id === input.dataset.item)?.quantity ?? 1);
                return;
            }
            shopify.invalidateCheckout();
            checkout.setQuantity(input.dataset.item, input.valueAsNumber);
        });
        this.registerCleanup(effect(() => this.renderBasket(), { scheduler: this.context.scheduler }));
    }

    private renderBasket(): void {
        const checkout = this.services.basket;
        const focused = document.activeElement;
        const focusedId = focused instanceof HTMLInputElement ? focused.dataset.item : undefined;
        const basket = checkout.basket.get();
        this.storageStatus.textContent = checkout.storageAvailable.get()
            ? 'Your basket is saved in this browser on this site.'
            : 'Browser storage is unavailable or full. Latest basket changes will be lost on reload.';
        this.items.replaceChildren(...basket.map((item, index) => {
            const quote = checkout.calculator.calculate(item.design);
            return this.builder.element('section', { className: 'checkout__item' }, [
                item.snapshot ? this.builder.element('img', {
                    className: 'checkout__snapshot',
                    attributes: { src: item.snapshot, alt: `Keyboard ${index + 1}: ${item.design.size} ${item.design.physical.toUpperCase()} layout with your selected colors and legends` },
                }) : null,
                this.builder.element('h2', {}, `Keyboard ${index + 1}`),
                this.builder.element('ul', {}, quote.items.map(line => this.builder.element('li', {}, `${line.label}${line.quantity !== 1 ? ` × ${line.quantity}` : ''}: ${checkout.calculator.format(line.totalCents)}`))),
                this.builder.element('label', {}, ['Quantity ', this.builder.element('input', {
                    attributes: { type: 'number', min: 1, max: 99, step: 1, required: true, 'aria-label': `Keyboard ${index + 1} quantity` },
                    properties: { value: item.quantity }, dataset: { item: item.id },
                })]),
                this.builder.element('p', {}, `Item subtotal: ${checkout.calculator.format(quote.totalCents * item.quantity)}`),
                this.builder.element('button', { attributes: { type: 'button', 'aria-label': `Remove keyboard ${index + 1}` }, dataset: { remove: item.id } }, 'Remove'),
            ]);
        }));
        if (!basket.length) this.items.append(this.builder.element('p', {}, 'Your basket is empty. Add a configuration from the builder’s Finalize panel.'));
        this.total.textContent = `Basket subtotal: ${checkout.calculator.format(checkout.totalCents())}`;
        if (focusedId) this.items.querySelector<HTMLInputElement>(`[data-item="${CSS.escape(focusedId)}"]`)?.focus();
    }
}
