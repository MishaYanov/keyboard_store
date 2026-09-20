import { Component, effect, type ApplicationContext } from '../../../engine';
import type { PurchaseRecord, SavedConfiguration, ShippingAddress, UserSpaceData } from '../models/client.types';
import { ClientService } from '../services/client.service';
import '../styles/client.css';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents/100);
const date = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));

export class ClientComponent extends Component<HTMLElement> {
    private readonly content = this.builder.element('div', { className: 'client-space__body', attributes: { 'aria-live': 'polite' } }, 'Loading your space…');
    private readonly service = new ClientService();

    public constructor(private readonly context: ApplicationContext) {
        super(document.createElement('article'), { styleScope: 'client-space' });
        this.root.className = 'client-space';
        this.root.append(
            this.builder.element('header', { className: 'client-space__hero' }, [
                this.builder.element('p', { className: 'client-space__eyebrow' }, 'YOUR SPACE / 01'),
                this.builder.element('h1', {}, 'Everything you make, kept close.'),
                this.builder.element('p', {}, 'Review orders, return to saved keyboards, and keep delivery details ready for the next build.'),
            ]),
            this.content,
        );
    }

    protected override onMount(): void {
        this.registerCleanup(effect(() => {
            const request = this.service.overview.snapshot.get();
            if (request.loading && !request.hasData) this.content.textContent = 'Loading your space…';
            if (request.error) this.content.textContent = 'Your space could not be loaded. Please try again.';
            if (request.data) this.render(request.data.data, request.data.source);
        }, { scheduler: this.context.scheduler }));
        this.registerCleanup(() => this.service.overview.dispose());
        void this.service.overview.execute().catch(() => { /* Error state renders reactively. */ });
    }

    private render(data: UserSpaceData, source: 'api' | 'demo'): void {
        this.content.replaceChildren(
            this.builder.element('div', { className: 'client-space__intro' }, [
                this.builder.element('div', {}, [
                    this.builder.element('p', { className: 'client-space__eyebrow' }, 'OVERVIEW'),
                    this.builder.element('h2', {}, `Hello, ${data.firstName}.`),
                    this.builder.element('p', {}, `Member since ${data.memberSince} · ${data.orders.length} orders · ${data.saved.length} saved designs`),
                ]),
                this.builder.element('span', { className: 'client-space__source', attributes: { title: source === 'api' ? 'Loaded from the account API' : 'The backend is not connected yet' } }, source === 'api' ? 'LIVE ACCOUNT' : 'DEMO DATA'),
            ]),
            this.section('Purchase history', 'Completed and active orders.', this.renderOrders(data.orders), '02'),
            this.section('Saved for later', 'Ideas waiting for their next adjustment.', this.renderSaved(data.saved), '03'),
            this.section('Shipping information', 'The default destination used during checkout.', this.renderShipping(data.shipping), '04'),
        );
    }

    private section(title: string, description: string, body: HTMLElement, index: string): HTMLElement {
        return this.builder.element('section', { className: 'client-space__section', attributes: { 'aria-labelledby': `client-section-${index}` } }, [
            this.builder.element('header', {}, [
                this.builder.element('p', { className: 'client-space__eyebrow' }, `${index} / ACCOUNT`),
                this.builder.element('h2', { attributes: { id: `client-section-${index}` } }, title),
                this.builder.element('p', {}, description),
            ]),
            body,
        ]);
    }

    private renderOrders(orders: readonly PurchaseRecord[]): HTMLElement {
        const list = this.builder.element('div', { className: 'client-space__orders' });
        list.append(...orders.map(order => this.builder.element('article', { className: 'client-space__order' }, [
            this.builder.element('div', { className: 'client-space__order-meta' }, [
                this.builder.element('span', {}, order.id),
                this.builder.element('time', { attributes: { datetime: order.placedAt } }, date(order.placedAt)),
                this.builder.element('span', { className: 'client-space__status', dataset: { status: order.status.toLowerCase().replace(' ', '-') } }, order.status),
            ]),
            this.builder.element('div', {}, [this.builder.element('h3', {}, order.name), this.builder.element('p', {}, order.details)]),
            this.builder.element('p', { className: 'client-space__price' }, money(order.totalCents)),
        ])));
        if (!orders.length) list.append(this.builder.element('p', { className: 'client-space__empty' }, 'No purchases yet. Your first completed order will appear here.'));
        return list;
    }

    private renderSaved(items: readonly SavedConfiguration[]): HTMLElement {
        const grid = this.builder.element('div', { className: 'client-space__saved' });
        grid.append(...items.map(item => this.builder.element('article', { className: 'client-space__saved-card', dataset: { color: item.color } }, [
            this.builder.element('div', { className: 'client-space__key-preview', attributes: { 'aria-hidden': 'true' } }, 'ESC'),
            this.builder.element('p', { className: 'client-space__eyebrow' }, item.id.toUpperCase()),
            this.builder.element('h3', {}, item.name),
            this.builder.element('p', {}, item.details),
            this.builder.element('div', { className: 'client-space__saved-footer' }, [
                this.builder.element('strong', {}, money(item.priceCents)),
                this.builder.element('a', { attributes: { href: '#/builder' } }, 'Continue build →'),
            ]),
        ])));
        return grid;
    }

    private renderShipping(shipping: ShippingAddress | null): HTMLElement {
        if (!shipping) return this.builder.element('div', { className: 'client-space__shipping' }, [
            this.builder.element('p', {}, 'No shipping address saved yet.'),
            this.builder.element('a', { attributes: { href: '#/checkout' } }, 'Add one at checkout →'),
        ]);
        return this.builder.element('address', { className: 'client-space__shipping' }, [
            this.builder.element('strong', {}, shipping.recipient),
            ...shipping.lines.map(line => this.builder.element('span', {}, line)),
            this.builder.element('span', {}, shipping.locality),
            this.builder.element('span', {}, shipping.country),
            this.builder.element('a', { attributes: { href: '#/checkout' } }, 'Update at checkout →'),
        ]);
    }
}
