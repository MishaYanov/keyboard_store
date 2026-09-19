import { reducedMotion } from '../accessibility/accessibility.service';
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
    private readonly resizeHandle: HTMLDivElement;
    private panelWidth: number | null = null;
    private stopResize: (() => void) | null = null;
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
        this.sidebar = this.builder.element('aside', { className: 'view-grid__sidebar', attributes: { id: `${prefix}-sidebar`, 'aria-label': 'View settings', hidden: true } });
        this.resizeHandle = this.builder.element('div', {
            className: 'view-grid__resize-handle',
            attributes: { role: 'separator', tabindex: 0, 'aria-orientation': 'vertical', 'aria-label': 'Resize settings panel', 'aria-controls': `${prefix}-sidebar`, title: 'Drag to resize. Use arrow keys when focused.', hidden: true },
        });
        this.body = this.builder.element('div', { className: 'view-grid__body', dataset: { resizable: Boolean(config.resizablePanel) } }, [this.window, this.resizeHandle, this.sidebar]);
        this.root.append(this.builder.element('div', {
            className: 'view-grid__columns', attributes: { role: 'tablist', 'aria-label': config.label },
        }, this.buttons), this.body);
        this.canvas = new GridCanvasComponent(context, config);
    }

    public setPanel(panel: HTMLElement | null): void {
        this.sidebar.replaceChildren(...(panel ? [panel] : []));
        this.sidebar.hidden = panel === null;
        this.resizeHandle.hidden = panel === null || !this.config.resizablePanel;
        this.body.dataset.panel = String(panel !== null);
        if (!panel) this.stopResize?.();
        else if (this.config.resizablePanel) this.updatePanelWidth();
    }

    public refresh(area?: import('./grid.types').IGridArea): void {
        this.canvas.refresh(area);
    }

    public captureSnapshot(): string | null {
        return this.canvas.captureSnapshot();
    }

    protected override onMount(): void {
        this.attach(this.canvas, this.window);
        if (this.config.resizablePanel) this.setupPanelResize();
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

    private panelBounds(): { min: number; max: number } {
        const available = Math.max(0, this.body.clientWidth - 20);
        const max = Math.max(0, available - Math.min(100, available * .25));
        return { min: Math.min(220, max), max };
    }

    private updatePanelWidth(requested = this.panelWidth ?? Math.min(352, this.body.clientWidth * .5)): void {
        if (this.body.clientWidth === 0) return;
        const { min, max } = this.panelBounds();
        this.panelWidth = Math.round(Math.max(min, Math.min(max, requested)));
        this.body.style.setProperty('--panel-width', `${this.panelWidth}px`);
        this.resizeHandle.setAttribute('aria-valuemin', String(Math.ceil(min)));
        this.resizeHandle.setAttribute('aria-valuemax', String(Math.floor(max)));
        this.resizeHandle.setAttribute('aria-valuenow', String(this.panelWidth));
        this.resizeHandle.setAttribute('aria-valuetext', `${this.panelWidth} pixels wide`);
    }

    private setupPanelResize(): void {
        const controller = new AbortController();
        const options = { signal: controller.signal };
        let pointer: number | null = null;
        let startPosition = 0;
        let rotated = false;
        let startWidth = 0;
        const stop = () => {
            const captured = pointer;
            pointer = null;
            delete this.body.dataset.resizing;
            if (captured !== null && this.resizeHandle.hasPointerCapture(captured)) this.resizeHandle.releasePointerCapture(captured);
        };
        this.stopResize = stop;
        this.resizeHandle.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
            event.preventDefault();
            this.resizeHandle.focus({ preventScroll: true });
            pointer = event.pointerId;
            rotated = getComputedStyle(this.root).getPropertyValue('--builder-rotated').trim() === '1';
            startPosition = rotated ? event.clientY : event.clientX;
            // offsetWidth stays in layout coordinates when the mobile builder is rotated.
            startWidth = this.sidebar.offsetWidth;
            this.resizeHandle.setPointerCapture(pointer);
            this.body.dataset.resizing = 'true';
        }, options);
        this.resizeHandle.addEventListener('pointermove', event => {
            if (event.pointerId === pointer) {
                const position = rotated ? event.clientY : event.clientX;
                this.updatePanelWidth(startWidth + startPosition - position);
            }
        }, options);
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            this.resizeHandle.addEventListener(event, stop, options);
        }
        this.resizeHandle.addEventListener('keydown', event => {
            const { min, max } = this.panelBounds();
            const step = event.shiftKey ? 50 : 10;
            const width = this.panelWidth ?? this.sidebar.offsetWidth;
            const isRotated = getComputedStyle(this.root).getPropertyValue('--builder-rotated').trim() === '1';
            const grow = isRotated ? 'ArrowUp' : 'ArrowLeft';
            const shrink = isRotated ? 'ArrowDown' : 'ArrowRight';
            const next = event.key === grow ? width + step : event.key === shrink ? width - step : event.key === 'Home' ? min : event.key === 'End' ? max : null;
            if (next !== null) { event.preventDefault(); this.updatePanelWidth(next); }
        }, options);
        window.addEventListener('blur', stop, options);
        const observer = new ResizeObserver(() => {
            stop();
            this.updatePanelWidth();
            const isRotated = getComputedStyle(this.root).getPropertyValue('--builder-rotated').trim() === '1';
            this.resizeHandle.setAttribute('aria-orientation', isRotated ? 'horizontal' : 'vertical');
            this.resizeHandle.style.cursor = isRotated ? 'row-resize' : 'col-resize';
        });
        observer.observe(this.body);
        this.registerCleanup(() => { stop(); controller.abort(); observer.disconnect(); this.stopResize = null; });
    }

    private async select(index: number): Promise<void> {
        const selection = ++this.selection;
        this.animation?.cancel();
        this.root.setAttribute('aria-busy', 'true');
        const duration = reducedMotion() ? 0 : this.config.fillDuration ?? 320;
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
