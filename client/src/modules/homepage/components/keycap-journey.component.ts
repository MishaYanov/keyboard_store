import { WebGlComponent, type ApplicationContext, type WebGlFrame } from '../../../engine';
import { reducedMotion } from '../../../shared/accessibility/accessibility.service';
import { readLocalValue } from '../../../shared/storage/local-storage';
import { normalizeKeyboardDesign } from '@keycaps/domain/keyboard-design.validation';
import { KEYBOARD_STORAGE_KEY } from '../../keyboard-builder/services/keyboard-design.service';
import { keyboardGeometry } from '@keycaps/domain/keyboard-geometry';
import { keyColor, keyColorId, legendColor } from '@keycaps/domain/key-colors';
import { KeycapRenderer } from '../sources/keycap-renderer';
import { keycapSilhouette } from '../sources/keycap-silhouette';
import type { Vector3 } from '../sources/keycap-transform';
import { JourneySimulation } from '../sources/journey-simulation';
import '../styles/keycap-journey.css';

interface JourneyAnchors {
    page: HTMLElement;
    hero: HTMLElement;
    landing: HTMLElement;
    target: HTMLElement;
    highlight: HTMLElement;
    motionControl: HTMLButtonElement;
    switchButton: HTMLButtonElement;
    caption: HTMLElement;
}

/** Shared scheduler runs while drifting or landing; stationary scenes redraw on input. */
export class KeycapJourneyComponent extends WebGlComponent {
    private renderer: KeycapRenderer | null = null;
    private color = '#e8e2d6';
    private legend = 'BUILD';
    // Always start this scene animated. Accessibility and scene controls can
    // change it after initialization, but persisted or OS state must not start it stopped.
    private motionOverride: boolean | null = true;
    private animating = false;
    private readonly simulation = new JourneySimulation();
    private readonly heroShadow = document.createElement('span');

    public constructor(context: ApplicationContext, private readonly anchors: JourneyAnchors) {
        super(context, { className: 'keycap-journey', contextAttributes: { alpha: true, antialias: true, depth: true } });
        this.root.dataset.styleScope = 'keycap-journey';
        this.root.setAttribute('aria-hidden', 'true');
    }

    protected override onWebGlMount(): void {
        this.readDesign();
        this.createRenderer();
        this.heroShadow.className = 'keycap-hero-shadow';
        this.heroShadow.setAttribute('aria-hidden', 'true');
        this.anchors.hero.append(this.heroShadow);
        this.registerCleanup(() => this.heroShadow.remove());
        const refresh = () => this.invalidate();
        const onScroll = () => {
            if (window.scrollY > 0) this.simulation.hasScrolled = true;
            this.simulation.lastScrollAt = performance.now();
            this.invalidate();
        };
        let previousReducedMotion = reducedMotion();
        let previousExplicitlyReduced = document.documentElement.dataset.a11yMotion === 'true';
        const onMotionChange = () => {
            const nextReducedMotion = reducedMotion();
            const explicitlyReduced = document.documentElement.dataset.a11yMotion === 'true';
            if (explicitlyReduced !== previousExplicitlyReduced || nextReducedMotion !== previousReducedMotion) {
                this.motionOverride = explicitlyReduced ? null : true;
                this.simulation.manualLanding = null;
                this.simulation.movement.reset(); this.simulation.trail = []; this.simulation.docked = false;
            }
            previousReducedMotion = nextReducedMotion;
            previousExplicitlyReduced = explicitlyReduced;
            this.updateMotionControl();
            this.invalidate();
        };
        const onMotionToggle = () => {
            this.motionOverride = this.isMotionReduced();
            this.simulation.manualLanding = null;
            this.simulation.movement.reset(); this.simulation.trail = []; this.simulation.docked = false;
            this.updateMotionControl();
            this.invalidate();
        };
        this.anchors.motionControl.addEventListener('click', onMotionToggle);
        const onSwitch = () => {
            this.simulation.switchPressedAt = performance.now();
            this.invalidate();
            if (!this.isMotionReduced() || this.simulation.manualLanding) return;
            const viewport = this.getViewportSnapshot();
            if (!viewport) return;
            const mobile = viewport.width <= 768;
            const scale = mobile ? Math.min(64, viewport.width*.16) : Math.min(125, viewport.width*.095);
            const hero = this.anchors.hero.getBoundingClientRect();
            this.simulation.manualLanding = {
                start: performance.now(),
                x: viewport.width*(mobile ? .67 : .82),
                // If the hero has scrolled away, enter from the top of the viewport.
                y: Math.max(-scale*1.5, hero.top + viewport.height*(mobile ? .73 : .60)),
                scale,
                settled: false,
            };
            this.invalidate();
        };
        this.anchors.switchButton.addEventListener('click', onSwitch);
        const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        motionPreference.addEventListener('change', onMotionChange);
        this.updateMotionControl();
        const onStorage = (event: StorageEvent) => {
            if (event.key !== KEYBOARD_STORAGE_KEY && event.key !== null) return;
            this.readDesign(); this.renderer?.setLegend(this.legend, legendColor(this.color)); this.invalidate();
        };
        const onPointer = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse' || this.isMotionReduced() || window.innerWidth <= 768) return;
            this.simulation.pointer = { x: (event.clientX / window.innerWidth - .5)*.12, y: (event.clientY / window.innerHeight - .5)*.10 };
            this.invalidate();
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', refresh);
        window.addEventListener('accessibilitychange', onMotionChange);
        window.addEventListener('storage', onStorage);
        window.addEventListener('pointermove', onPointer, { passive: true });
        const resize = new ResizeObserver(refresh);
        resize.observe(this.anchors.page); resize.observe(this.anchors.target);
        const theme = new MutationObserver(refresh);
        theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        this.registerCleanup(() => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', refresh);
            window.removeEventListener('accessibilitychange', onMotionChange);
            motionPreference.removeEventListener('change', onMotionChange);
            this.anchors.motionControl.removeEventListener('click', onMotionToggle);
            this.anchors.switchButton.removeEventListener('click', onSwitch);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('pointermove', onPointer);
            resize.disconnect(); theme.disconnect();
            this.anchors.highlight.style.removeProperty('--keycap-overlap');
        });
        void document.fonts.ready.then(() => {
            if (!this.isMounted()) return;
            this.renderer?.setLegend(this.legend, legendColor(this.color)); this.invalidate();
        });
    }

    protected override onWebGlUnmount(): void { this.renderer?.dispose(); this.renderer = null; }
    protected override onWebGlContextLost(): void { this.renderer = null; }
    protected override onWebGlContextRestored(): void { this.createRenderer(); }

    private createRenderer(): void {
        this.renderer = new KeycapRenderer(this.context);
        this.renderer.setLegend(this.legend, legendColor(this.color));
    }

    private isMotionReduced(): boolean {
        return this.motionOverride === null ? reducedMotion() : !this.motionOverride;
    }

    public override getTargetFps(): number {
        // A switch click is an explicit request for a single short flight, including
        // when the device's reduced-motion profile normally has a zero FPS budget.
        return super.getTargetFps() || (this.motionOverride === true || this.simulation.manualLanding?.settled === false || this.simulation.switchPressedAt !== null ? 30 : 0);
    }

    private animate(enabled: boolean): void {
        if (this.animating === enabled) return;
        this.animating = enabled;
        this.setContinuousAnimation(enabled);
    }

    private updateMotionControl(): void {
        const button = this.anchors.motionControl;
        button.hidden = false;
        button.textContent = this.isMotionReduced()
            ? reducedMotion() ? 'Motion is reduced · Animate keycap' : 'Animate keycap'
            : 'Stop keycap animation';
        button.setAttribute('aria-pressed', String(!this.isMotionReduced()));
    }

    private readDesign(): void {
        this.color = '#e8e2d6'; this.legend = 'BUILD';
        const design = normalizeKeyboardDesign(readLocalValue(KEYBOARD_STORAGE_KEY));
        if (!design) return;
        const keys = keyboardGeometry(design).keys;
        const key = keys.find(item => design.keyLegends[keyColorId(design, item)] !== undefined)
            ?? keys.find(item => design.keyColors[keyColorId(design, item)] !== undefined);
        if (!key) return;
        this.color = keyColor(design, key);
        this.legend = design.keyLegends[keyColorId(design, key)] ?? key.label;
    }

    protected override paint(frame: WebGlFrame): void {
        if (!this.renderer || frame.width <= 0 || frame.height <= 0) return;
        const { width, height } = frame;
        const target = this.anchors.target.getBoundingClientRect();
        const hero = this.anchors.hero.getBoundingClientRect();
        const staticMode = this.isMotionReduced();
        const state = this.simulation.evaluate({
            width, height, time: frame.time, scrollY: window.scrollY, hero, target,
            landingTop: this.anchors.landing.getBoundingClientRect().top, staticMode,
        });
        const { position, rotation, scale, visible, manualFlight } = state;
        const mobile = width <= 768;
        this.root.dataset.motion = staticMode ? this.simulation.manualLanding ? 'manual' : 'stopped' : 'scroll';
        this.renderer.begin(width, height);
        if (target.bottom > -100 && target.top < height + 100) {
            this.renderer.switch(state.switchPosition, state.landingRotation, state.landingScale,
                state.switchPress, document.documentElement.dataset.theme === 'light');
        }
        // Anchor the shadow to the hero floor, not to the travelling keycap.
        // Collapse it immediately on departure, before the cap can cross it.
        const heroScale = mobile ? Math.min(64, width*.16) : Math.min(125, width*.095);
        const heroX = width*(mobile ? .67 : .82);
        const heroY = height*(mobile ? .73 : .60);
        this.heroShadow.style.left = `${heroX-hero.left}px`;
        this.heroShadow.style.top = `${heroY+heroScale*1.45-(staticMode ? 0 : hero.top+window.scrollY)}px`;
        this.heroShadow.style.width = `${heroScale*2.5}px`;
        this.heroShadow.style.height = `${heroScale*.55}px`;
        this.heroShadow.dataset.reducedMotion = String(reducedMotion());
        this.heroShadow.dataset.visible = String(window.scrollY <= 0 && !this.simulation.manualLanding &&
            (staticMode || (this.simulation.movement.speed < 3 && Math.abs(position[0]-heroX) < 4 && Math.abs(position[1]-heroY) < 4)));
        if (this.simulation.trail.length) this.renderer.trail(this.simulation.trail, frame.time, this.color);
        if (visible) this.renderer.cap(position, rotation, scale, this.color);
        this.animate(state.active);
        this.updateHighlight(position, rotation, scale, staticMode);
        this.anchors.landing.dataset.landed = String(state.landed);
        this.anchors.switchButton.hidden = false;
        this.anchors.switchButton.disabled = manualFlight;
        this.anchors.switchButton.setAttribute('aria-label', staticMode && !this.simulation.manualLanding ? 'Bring the keycap to this switch' : 'Press the keyboard switch');
        const caption = staticMode && !this.simulation.manualLanding ? 'Click the switch to bring the keycap here.'
            : manualFlight ? 'Coming in for a landing…' : 'One key. Entirely yours.';
        if (this.anchors.caption.textContent !== caption) this.anchors.caption.textContent = caption;
    }

    private updateHighlight(position: Vector3, rotation: Float32Array, scale: number, staticMode: boolean): void {
        const highlight = this.anchors.highlight;
        const bounds = highlight.getBoundingClientRect();
        if (staticMode || bounds.bottom < 0 || bounds.top > window.innerHeight) {
            highlight.style.setProperty('--keycap-overlap', 'inset(100%)'); return;
        }
        highlight.style.setProperty('--keycap-overlap', keycapSilhouette(position, rotation, scale, bounds));
    }
}
