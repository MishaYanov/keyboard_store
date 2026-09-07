import './panel.css';
import { Component } from '../../engine';
import type { IPanelArea, IPanelLayout, IPanelPosition, IPanelStructure, PanelContent } from './panel.types';

const POSITION_PROPERTIES = {
    position: 'position', top: 'top', right: 'right', bottom: 'bottom', left: 'left',
    zIndex: 'z-index', overflow: 'overflow', transform: 'transform', height: 'height',
    minHeight: 'min-height', padding: 'padding',
} as const;

export class PanelComponent extends Component<HTMLElement> {
    private readonly grid: HTMLDivElement;
    private readonly textArea: HTMLDivElement;
    private readonly contentArea: HTMLDivElement;
    private readonly contentSlot: HTMLDivElement;
    private readonly mask: HTMLDivElement;

    public constructor(private readonly config: IPanelStructure) {
        super(document.createElement('section'), { styleScope: 'panel' });
        const breakpoint = config.mobileBreakpoint ?? 768;
        if (!Number.isFinite(breakpoint) || breakpoint < 0) throw new Error('Panel breakpoint must be a non-negative number');
        const opacity = config.mobile?.mask?.opacity ?? 0.45;
        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error('Panel mask opacity must be between 0 and 1');

        // Use the builder's class handling for the component root as well.
        this.root.className = this.builder.element('div', { className: ['panel', config.classNames?.root] }).className;
        if (config.ariaLabel) this.root.setAttribute('aria-label', config.ariaLabel);
        this.textArea = this.builder.element('div', { className: ['panel__text', config.classNames?.text] });
        this.contentSlot = this.builder.element('div', { className: 'panel__content-slot' });
        this.mask = this.builder.element('div', {
            className: ['panel__mask', config.classNames?.mask],
            attributes: { 'aria-hidden': 'true' },
        });
        this.contentArea = this.builder.element('div', {
            className: ['panel__content', config.classNames?.content],
        }, [this.contentSlot, this.mask]);
        this.grid = this.builder.element('div', {
            className: ['panel__grid', config.classNames?.grid],
        }, [this.textArea, this.contentArea]);
        this.root.appendChild(this.grid);
        this.applyPosition(this.root, config.position);
        this.mask.dataset.mode = config.mobile?.mask?.mode ?? 'theme';
        this.mask.style.setProperty('--panel-mask-opacity', String(opacity));
    }

    protected override onMount(): void {
        const media = window.matchMedia(`(max-width: ${this.config.mobileBreakpoint ?? 768}px)`);
        const update = () => this.applyLayout(media.matches);
        update();
        media.addEventListener('change', update);
        this.registerCleanup(() => media.removeEventListener('change', update));
        const projected = new Set<Node | Component>();
        this.project(this.config.text, this.textArea, projected);
        this.project(this.config.content, this.contentSlot, projected);
    }

    private project(value: PanelContent, target: HTMLElement, projected: Set<Node | Component>): void {
        if (Array.isArray(value)) {
            for (const child of value) this.project(child, target, projected);
        } else if (value instanceof Component || value instanceof Node) {
            const identity = value instanceof Component ? value.getRoot() : value;
            if (projected.has(identity)) throw new Error('A panel node can only be projected once');
            projected.add(identity);
            if (value instanceof Component) this.attach(value, target);
            else target.appendChild(value);
        } else if (typeof value === 'string' || typeof value === 'number') {
            target.appendChild(document.createTextNode(String(value)));
        }
    }

    private applyLayout(mobile: boolean): void {
        const layout: IPanelLayout = (mobile ? this.config.mobile : this.config.desktop) ?? {};
        this.root.dataset.layout = mobile ? 'mobile' : 'desktop';
        this.applyPosition(this.grid, layout.grid);
        const grid = layout.grid;
        this.set(this.grid, 'columns', grid?.columns ?? (mobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))'));
        this.set(this.grid, 'rows', grid?.rows ?? 'auto');
        this.set(this.grid, 'areas', grid?.areas);
        this.set(this.grid, 'gap', grid?.gap, true);
        this.set(this.grid, 'align-items', grid?.alignItems);
        this.applyArea(this.textArea, layout.text, '1', '1');
        this.applyArea(this.contentArea, layout.content, mobile ? '1' : '2', '1');
        if (mobile) {
            // Mobile always keeps text above the entire content/mask stack.
            const contentZ = layout.content?.zIndex ?? 0;
            this.set(this.textArea, 'z-index', Math.max(layout.text?.zIndex ?? 2, contentZ + 1));
        }
    }

    private applyArea(element: HTMLElement, area: IPanelArea | undefined, column: string, row: string): void {
        this.applyPosition(element, area);
        const parts = area?.gridArea?.split('/').map(part => part.trim());
        const areaRow = parts ? (parts.length === 1 ? parts[0] : `${parts[0]} / ${parts[2] ?? 'auto'}`) : row;
        const areaColumn = parts ? (parts.length === 1 ? parts[0] : `${parts[1] ?? 'auto'} / ${parts[3] ?? 'auto'}`) : column;
        this.set(element, 'column', area?.gridColumn ?? areaColumn);
        this.set(element, 'row', area?.gridRow ?? areaRow);
        this.set(element, 'align-self', area?.alignSelf);
        this.set(element, 'justify-self', area?.justifySelf);
    }

    private applyPosition(element: HTMLElement, config?: IPanelPosition): void {
        for (const [key, property] of Object.entries(POSITION_PROPERTIES)) {
            this.set(element, property, config?.[key as keyof IPanelPosition], key !== 'zIndex');
        }
    }

    private set(element: HTMLElement, property: string, value: string | number | undefined, pixels = false): void {
        const name = `--panel-${property}`;
        if (value === undefined) element.style.removeProperty(name);
        else element.style.setProperty(name, typeof value === 'number' && pixels ? `${value}px` : String(value));
    }
}
