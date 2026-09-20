import { Component, effect, type ApplicationContext } from '../../../engine';
import type { AdminDashboardData, AdminOrder, DashboardMetric, SalesPoint } from '../models/admin.types';
import { AdminService } from '../services/admin.service';
import '../styles/admin.css';

export class AdminComponent extends Component<HTMLElement> {
    private readonly content = this.builder.element('div', { className: 'admin-dashboard__content', attributes: { 'aria-live': 'polite' } }, 'Loading dashboard…');
    private readonly refresh = this.builder.element('button', { attributes: { type: 'button' } }, 'Refresh data');
    private readonly service = new AdminService();

    public constructor(private readonly context: ApplicationContext) {
        super(document.createElement('article'), { styleScope: 'admin-dashboard' });
        this.root.className = 'admin-dashboard';
        this.root.append(
            this.builder.element('header', { className: 'admin-dashboard__header' }, [
                this.builder.element('div', {}, [
                    this.builder.element('p', { className: 'admin-dashboard__eyebrow' }, 'CONTROL ROOM / 01'),
                    this.builder.element('h1', {}, 'Store overview'),
                    this.builder.element('p', {}, 'Orders, revenue, and production signals in one place.'),
                ]),
                this.refresh,
            ]),
            this.content,
        );
    }

    protected override onMount(): void {
        this.context.eventManager.on(this.scope, this.refresh, 'click', () => void this.load());
        this.registerCleanup(effect(() => {
            const request = this.service.dashboard.snapshot.get();
            this.refresh.disabled = request.loading;
            this.refresh.textContent = request.loading ? 'Refreshing…' : 'Refresh data';
            if (request.loading && !request.hasData) this.content.textContent = 'Loading dashboard…';
            if (request.error) this.content.textContent = 'Dashboard data could not be loaded.';
            if (request.data) this.render(request.data.data, request.data.source);
        }, { scheduler: this.context.scheduler }));
        this.registerCleanup(() => this.service.dashboard.dispose());
        void this.load();
    }

    private async load(): Promise<void> {
        await this.service.dashboard.execute().catch(() => { /* Error state renders reactively. */ });
    }

    private render(data: AdminDashboardData, source: 'api' | 'demo'): void {
        this.content.replaceChildren(
            this.builder.element('div', { className: 'admin-dashboard__status' }, [
                this.builder.element('span', { dataset: { source } }, source === 'api' ? 'LIVE BACKEND' : 'DEMO DATA'),
                this.builder.element('time', { attributes: { datetime: data.updatedAt } }, `Updated ${new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.updatedAt))}`),
            ]),
            this.builder.element('section', { className: 'admin-dashboard__metrics', attributes: { 'aria-label': 'Store performance' } }, data.metrics.map(metric => this.metric(metric))),
            this.builder.element('div', { className: 'admin-dashboard__grid' }, [
                this.panel('Sales this week', 'DAILY ORDERS', this.salesChart(data.sales), 'admin-dashboard__panel--chart'),
                this.panel('Production queue', 'LIVE WORKLOAD', this.builder.element('div', { className: 'admin-dashboard__stages' }, data.stages.map(stage => this.builder.element('div', { dataset: { tone: stage.tone } }, [
                    this.builder.element('strong', {}, stage.count), this.builder.element('span', {}, stage.label),
                ])))),
                this.panel('Recent orders', 'LATEST ACTIVITY', this.ordersTable(data.orders), 'admin-dashboard__panel--orders'),
                this.panel('Operations feed', 'TODAY', this.builder.element('ol', { className: 'admin-dashboard__activity' }, data.activity.map(item => this.builder.element('li', {}, [
                    this.builder.element('time', {}, item.time),
                    this.builder.element('div', {}, [this.builder.element('strong', {}, item.title), this.builder.element('p', {}, item.detail)]),
                ])))),
            ]),
        );
    }

    private metric(metric: DashboardMetric): HTMLElement {
        return this.builder.element('article', { className: 'admin-dashboard__metric' }, [
            this.builder.element('p', {}, metric.label),
            this.builder.element('strong', {}, metric.value),
            this.builder.element('span', { dataset: { direction: metric.direction } }, metric.change),
        ]);
    }

    private panel(title: string, label: string, body: HTMLElement, className = ''): HTMLElement {
        return this.builder.element('section', { className: `admin-dashboard__panel ${className}` }, [
            this.builder.element('header', {}, [this.builder.element('div', {}, [this.builder.element('p', { className: 'admin-dashboard__eyebrow' }, label), this.builder.element('h2', {}, title)])]),
            body,
        ]);
    }

    private salesChart(points: readonly SalesPoint[]): HTMLElement {
        const max = Math.max(1, ...points.map(point => point.value));
        return this.builder.element('div', { className: 'admin-dashboard__chart', attributes: { role: 'img', 'aria-label': points.map(point => `${point.label}: ${point.value} orders`).join(', ') } }, points.map(point =>
            this.builder.element('div', {}, [
                this.builder.element('span', { className: 'admin-dashboard__bar', style: { '--bar-size': `${point.value/max*100}%` }, attributes: { 'aria-hidden': 'true' } }),
                this.builder.element('span', {}, point.label),
            ]),
        ));
    }

    private ordersTable(orders: readonly AdminOrder[]): HTMLElement {
        return this.builder.element('div', { className: 'admin-dashboard__table-wrap' }, this.builder.element('table', {}, [
            this.builder.element('thead', {}, this.builder.element('tr', {}, ['Order', 'Customer', 'Configuration', 'Total', 'Status'].map(label => this.builder.element('th', { attributes: { scope: 'col' } }, label)))),
            this.builder.element('tbody', {}, orders.map(order => this.builder.element('tr', {}, [
                this.builder.element('th', { attributes: { scope: 'row' } }, order.id),
                this.builder.element('td', {}, order.customer),
                this.builder.element('td', {}, order.configuration),
                this.builder.element('td', {}, order.total),
                this.builder.element('td', {}, this.builder.element('span', {}, order.status)),
            ]))),
        ]));
    }
}
