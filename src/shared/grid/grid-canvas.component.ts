import { WebGlComponent, type ApplicationContext, type WebGlFrame } from '../../engine';
import type { IGridArea, IGridStructure, IGridViewContext } from './grid.types';
import { fitGridArea } from './grid-projection';

export class GridCanvasComponent extends WebGlComponent {
    private area: IGridArea;
    private movement: { from: IGridArea; to: IGridArea; start: number; duration: number } | null = null;

    public constructor(context: ApplicationContext, private readonly config: IGridStructure) {
        super(context, { className: 'view-grid__canvas', contextAttributes: { alpha: true, antialias: true } });
        this.area = { ...(config.initialArea ?? config.columns[0]!.area) };
        this.root.setAttribute('aria-label', config.label);
        this.root.setAttribute('role', 'img');
    }

    public enter(id: string, area: IGridArea, signal: AbortSignal): IGridViewContext {
        this.refresh(area);
        return { id, area: { ...area }, context: this.context, signal, invalidate: () => { if (!signal.aborted) this.invalidate(); } };
    }

    public refresh(area?: IGridArea): void {
        if (!this.isMounted()) return;
        if (!area) { this.invalidate(); return; }
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : this.config.moveDuration ?? 450;
        this.movement = { from: { ...this.area }, to: { ...area }, start: performance.now(), duration };
        this.setContinuousAnimation(duration > 0);
        this.invalidate();
    }

    protected override onWebGlMount(): void {
        this.config.scene.mount(this.context);
        const onClick = (event: MouseEvent) => {
            if (event.button !== 0 || !this.config.scene.pointer) return;
            const bounds = this.root.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) return;
            const area = fitGridArea(this.area, bounds.width, bounds.height);
            this.config.scene.pointer({ x: area.x + (event.clientX - bounds.left) / bounds.width * area.width, y: area.y + (event.clientY - bounds.top) / bounds.height * area.height });
        };
        this.root.addEventListener('click', onClick);
        this.registerCleanup(() => this.root.removeEventListener('click', onClick));
    }
    protected override onWebGlUnmount(): void { this.config.scene.dispose(this.context); }
    protected override onWebGlContextRestored(): void { this.config.scene.mount(this.context); }

    protected override paint(frame: WebGlFrame): void {
        const move = this.movement;
        if (move) {
            const progress = !frame.quality.animations || move.duration === 0 ? 1 : Math.min(1, Math.max(0, (frame.time - move.start) / move.duration));
            const eased = progress * progress * (3 - 2 * progress);
            for (const key of ['x', 'y', 'width', 'height'] as const) this.area[key] = move.from[key] + (move.to[key] - move.from[key]) * eased;
            if (progress === 1) { this.movement = null; this.setContinuousAnimation(false); }
        }
        this.config.scene.paint(frame, this.area);
    }
}
