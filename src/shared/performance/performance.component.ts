import { Component } from '../../engine';
import { PerformanceService, type PerformanceSample } from './performance.service';
import './performance.css';

export class PerformanceComponent extends Component<HTMLElement> {
    private readonly service = new PerformanceService();
    private readonly desktop = window.matchMedia('(min-width: 769px)');
    private trigger: HTMLButtonElement | null = null;
    private readonly values = new Map<keyof PerformanceSample, HTMLElement>();
    private readonly statusLabel = this.builder.element('p', { className: 'performance-screen__status' }, 'AWAITING SIGNAL');
    private readonly closeButton = this.builder.element('button', { attributes: { type: 'button', 'aria-label': 'Close performance display' } }, 'OFF ×');

    public constructor() {
        super(document.createElement('section'));
        this.root.className = 'performance-screen';
        this.root.hidden = true;
        this.root.setAttribute('aria-label', 'Site performance monitor');
        const labels: [keyof PerformanceSample, string][] = [
            ['fps', 'FPS / BROWSER'], ['frameMs', 'FRAME / MS'], ['heapMiB', 'JS HEAP / MiB'],
            ['longTasks', 'LONG TASKS'], ['nodes', 'DOM NODES'], ['canvasMegapixels', 'CANVAS / MP'],
        ];
        this.root.append(
            this.builder.element('header', {}, [this.builder.element('h2', {}, 'SYSTEM / 01'), this.closeButton]),
            this.statusLabel,
            this.builder.element('dl', {}, labels.map(([key, label]) => {
                const value = this.builder.element('dd', {}, '—');
                this.values.set(key, value);
                return this.builder.element('div', {}, [this.builder.element('dt', {}, label), value]);
            })),
            this.builder.element('p', { className: 'performance-screen__note' }, 'LIVE · 1 SECOND SAMPLE · LOCAL ONLY'),
            this.builder.element('p', { className: 'performance-screen__note' }, 'FPS = browser frame cadence. Heap is approximate JavaScript memory, not total RAM. N/A = unavailable. Long tasks >50 ms counted while sampling; resets on resume.'),
        );
    }

    public toggle(trigger: HTMLButtonElement): void {
        if (!this.desktop.matches) return;
        if (!this.root.hidden) { this.close(); return; }
        this.trigger = trigger;
        trigger.setAttribute('aria-expanded', 'true');
        this.root.hidden = false;
        this.closeButton.focus({ preventScroll: true });
        this.resume();
    }

    private close(restoreFocus = true): void {
        this.service.stop();
        this.root.hidden = true;
        this.trigger?.setAttribute('aria-expanded', 'false');
        if (restoreFocus) this.trigger?.focus({ preventScroll: true });
    }

    private resume(): void {
        if (this.root.hidden || document.hidden) return;
        this.statusLabel.textContent = '● LIVE / SAMPLING';
        for (const value of this.values.values()) value.textContent = '—';
        this.service.start(sample => {
            for (const [key, element] of this.values) {
                const value = sample[key];
                element.textContent = value === null ? 'N/A' : value.toFixed(key === 'fps' || key === 'nodes' || key === 'longTasks' ? 0 : 1);
            }
        });
    }

    protected override onMount(): void {
        const controller = new AbortController();
        const options = { signal: controller.signal };
        this.closeButton.addEventListener('click', () => this.close(), options);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !this.root.hidden) { event.preventDefault(); this.close(); }
        }, options);
        this.desktop.addEventListener('change', () => { if (!this.desktop.matches) this.close(false); }, options);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { this.service.stop(); this.statusLabel.textContent = 'PAUSED'; }
            else this.resume();
        }, options);
        this.registerCleanup(() => { controller.abort(); this.close(false); });
    }
}
