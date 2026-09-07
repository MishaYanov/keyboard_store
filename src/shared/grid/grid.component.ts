import './grid.css';
import { Component, type ApplicationContext } from '../../engine';
import { GridCanvasComponent } from './grid-canvas.component';
import type { IGridColumn, IGridStructure } from './grid.types';
export type { IGridStructure, IGridColumn, IGridArea, IGridViewContext } from './grid.types';

let nextGridId = 0;

/** A tabular view selector and one persistent canvas, shared by every view. */
export class GridComponent extends Component<HTMLElement> {
    private readonly canvas: GridCanvasComponent;
    private readonly window: HTMLDivElement;
    private readonly buttons: HTMLButtonElement[];
    private readonly body: HTMLDivElement;
    private readonly sidebar: HTMLElement;
    private animation: Animation | null = null;
    private viewAbort: AbortController | null = null;
    private selection = 0;

    public constructor(private readonly context: ApplicationContext, private readonly config: IGridStructure) {
        super(document.createElement('section'), { styleScope: 'view-grid' });
        if (!config.columns.length || new Set(config.columns.map(column => column.id)).size !== config.columns.length) throw new Error('Grid columns must have unique IDs and include at least one view');
        for (const column of config.columns) {
            if (![column.area.x, column.area.y, column.area.width, column.area.height].every(Number.isFinite) || column.area.width <= 0 || column.area.height <= 0) throw new Error('Grid areas must be finite and have positive dimensions');
        }
        this.root.className = `view-grid ${config.className ?? ''}`;
        const prefix = `view-grid-${++nextGridId}`;
        this.window = this.builder.element('div', {
            className: 'view-grid__window',
            attributes: { id: `${prefix}-window`, role: 'tabpanel', tabindex: 0 },
        });
        this.buttons = config.columns.map((column, index) => this.builder.element('button', {
            className: 'view-grid__column',
            attributes: { id: `${prefix}-${index}`, type: 'button', role: 'tab', 'aria-selected': 'false', 'aria-controls': `${prefix}-window`, tabindex: index === 0 ? 0 : -1 },
        }, [
            this.builder.element('span', { className: 'view-grid__fill', attributes: { 'aria-hidden': 'true' } }),
            this.builder.element('span', { className: 'view-grid__label' }, column.label),
        ]));
        this.sidebar = this.builder.element('aside', { className: 'view-grid__sidebar', attributes: { 'aria-label': 'View settings', hidden: true } });
        this.body = this.builder.element('div', { className: 'view-grid__body' }, [this.window, this.sidebar]);
        this.root.append(this.builder.element('div', {
            className: 'view-grid__columns', attributes: { role: 'tablist', 'aria-label': config.label },
        }, this.buttons), this.body);
        this.canvas = new GridCanvasComponent(context, config);
    }

    public setPanel(panel: HTMLElement | null): void {
        this.sidebar.replaceChildren(...(panel ? [panel] : []));
        this.sidebar.hidden = panel === null;
        this.body.dataset.panel = String(panel !== null);
    }

    public refresh(area?: import('./grid.types').IGridArea): void {
        this.canvas.refresh(area);
    }

    protected override onMount(): void {
        this.attach(this.canvas, this.window);
        this.buttons.forEach((button, index) => {
            this.context.eventManager.on(this.scope, button, 'click', () => { void this.select(index); });
            this.context.eventManager.on(this.scope, button, 'keydown', event => {
                const next = event.key === 'ArrowRight' ? (index + 1) % this.buttons.length : event.key === 'ArrowLeft' ? (index + this.buttons.length - 1) % this.buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? this.buttons.length - 1 : null;
                if (next !== null) { event.preventDefault(); this.buttons[next]!.focus(); void this.select(next); }
            });
        });
        this.activate(0);
    }

    protected override onUnmount(): void {
        this.selection += 1;
        this.animation?.cancel();
        this.viewAbort?.abort();
    }

    private async select(index: number): Promise<void> {
        const selection = ++this.selection;
        this.animation?.cancel();
        this.root.setAttribute('aria-busy', 'true');
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : this.config.fillDuration ?? 320;
        const fill = this.buttons[index]!.querySelector<HTMLElement>('.view-grid__fill')!;
        const animation = fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration, easing: 'ease-out', fill: 'forwards' });
        this.animation = animation;
        try { await animation.finished; } catch { return; }
        if (selection !== this.selection || !this.isMounted()) return;
        try { this.activate(index); }
        finally {
            animation.cancel();
            this.animation = null;
            this.root.removeAttribute('aria-busy');
        }
    }

    private activate(index: number): void {
        const column: IGridColumn = this.config.columns[index]!;
        this.buttons.forEach((button, position) => {
            button.setAttribute('aria-selected', String(index === position));
            button.tabIndex = index === position ? 0 : -1;
        });
        this.window.setAttribute('aria-labelledby', this.buttons[index]!.id);
        this.root.dataset.view = column.id;
        this.viewAbort?.abort();
        this.viewAbort = new AbortController();
        const view = this.canvas.enter(column.id, column.area, this.viewAbort.signal);
        column.onEnter?.(view);
    }
}
