import { WebGlComponent, type ApplicationContext, type WebGlFrame } from '../../../engine';
import { reducedMotion } from '../../../shared/accessibility/accessibility.service';
import { readLocalValue } from '../../../shared/storage/local-storage';
import { normalizeKeyboardDesign } from '../../keyboard-builder/models/keyboard-design.validation';
import { KEYBOARD_STORAGE_KEY } from '../../keyboard-builder/services/keyboard-design.service';
import { keyboardGeometry } from '../../keyboard-builder/components/keyboard-interactive-engine/keyboard-geometry';
import { keyColor, keyColorId, legendColor } from '../../keyboard-builder/components/keyboard-interactive-engine/key-colors';
import { KeycapRenderer, rotationMatrix, transformPoint, type Vector3, type KeycapTrailSample } from '../sources/keycap-renderer';
import { KeycapMotion } from '../sources/keycap-motion';
import '../styles/keycap-journey.css';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t*t*(3-2*t); };
const mix = (a: number, b: number, t: number) => a+(b-a)*t;
const LANDING_ROTATION = [-.64, .40, 0] as const;

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
    private pointer = { x: 0, y: 0 };
    // Always start this scene animated. Accessibility and scene controls can
    // change it after initialization, but persisted or OS state must not start it stopped.
    private motionOverride: boolean | null = true;
    private hasScrolled = false;
    private lastScrollAt = 0;
    private animating = false;
    private manualLanding: { start: number; x: number; y: number; scale: number; settled: boolean } | null = null;
    private readonly movement = new KeycapMotion();
    private trail: KeycapTrailSample[] = [];
    private docked = false;
    private switchPressedAt: number | null = null;
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
            if (window.scrollY > 0) this.hasScrolled = true;
            this.lastScrollAt = performance.now();
            this.invalidate();
        };
        let previousReducedMotion = reducedMotion();
        let previousExplicitlyReduced = document.documentElement.dataset.a11yMotion === 'true';
        const onMotionChange = () => {
            const nextReducedMotion = reducedMotion();
            const explicitlyReduced = document.documentElement.dataset.a11yMotion === 'true';
            if (explicitlyReduced !== previousExplicitlyReduced || nextReducedMotion !== previousReducedMotion) {
                this.motionOverride = explicitlyReduced ? null : true;
                this.manualLanding = null;
                this.movement.reset(); this.trail = []; this.docked = false;
            }
            previousReducedMotion = nextReducedMotion;
            previousExplicitlyReduced = explicitlyReduced;
            this.updateMotionControl();
            this.invalidate();
        };
        const onMotionToggle = () => {
            this.motionOverride = this.isMotionReduced();
            this.manualLanding = null;
            this.movement.reset(); this.trail = []; this.docked = false;
            this.updateMotionControl();
            this.invalidate();
        };
        this.anchors.motionControl.addEventListener('click', onMotionToggle);
        const onSwitch = () => {
            this.switchPressedAt = performance.now();
            this.invalidate();
            if (!this.isMotionReduced() || this.manualLanding) return;
            const viewport = this.getViewportSnapshot();
            if (!viewport) return;
            const mobile = viewport.width <= 768;
            const scale = mobile ? Math.min(64, viewport.width*.16) : Math.min(125, viewport.width*.095);
            const hero = this.anchors.hero.getBoundingClientRect();
            this.manualLanding = {
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
            this.pointer = { x: (event.clientX / window.innerWidth - .5)*.12, y: (event.clientY / window.innerHeight - .5)*.10 };
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
        return super.getTargetFps() || (this.motionOverride === true || this.manualLanding?.settled === false || this.switchPressedAt !== null ? 30 : 0);
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
        const targetX = target.left + target.width/2;
        const targetY = target.top + target.height*.67;
        const mobile = width <= 768;
        // An explicit choice to animate this decoration overrides only this scene.
        // The shared quality profile must not re-disable it due to the OS preference.
        const staticMode = this.isMotionReduced();
        const manualProgress = this.manualLanding ? clamp((frame.time-this.manualLanding.start)/900) : 0;
        if (this.manualLanding && manualProgress === 1) this.manualLanding.settled = true;
        const manualPress = Math.sin(clamp((manualProgress-.86)/.14)*Math.PI);
        const clickProgress = this.switchPressedAt === null ? 1 : clamp((frame.time-this.switchPressedAt)/280);
        const clickPress = clickProgress < .3 ? ease(clickProgress/.3) : 1-ease((clickProgress-.3)/.7);
        if (clickProgress === 1) this.switchPressedAt = null;
        this.root.dataset.motion = staticMode ? this.manualLanding ? 'manual' : 'stopped' : 'scroll';
        const endScroll = Math.max(1, targetY + window.scrollY - height*.68);
        const progress = clamp(window.scrollY / endScroll);
        const approach = ease((height*1.45 - targetY) / (height*.77));
        const align = ease(approach / .64);
        const seat = ease((approach - .52) / .40);
        const press = ease((approach - .92) / .08);
        // Once the switch enters view, it owns the cap's position: no spring lag.
        const atFinalTouch = targetY <= height && this.anchors.landing.getBoundingClientRect().top < height;
        const switchPress = Math.max(clickPress, staticMode ? manualPress : atFinalTouch ? 0 : press);
        const landingScale = Math.min(mobile ? 82 : 110, target.width*.24, height*.15);
        const landingRotation = rotationMatrix(...LANDING_ROTATION);
        const switchPosition: Vector3 = [targetX, targetY, 0];

        this.renderer.begin(width, height);
        if (target.bottom > -100 && target.top < height+100) {
            this.renderer.switch(switchPosition, landingRotation, landingScale, switchPress, document.documentElement.dataset.theme === 'light');
        }

        let position: Vector3, rotation: Float32Array, scale: number;
        if (staticMode) {
            scale = mobile ? Math.min(64, width*.16) : Math.min(125, width*.095);
            position = [width*(mobile ? .67 : .82), hero.top + height*(mobile ? .73 : .60), 0];
            rotation = rotationMatrix(-.72, .38, -.14);
            if (this.manualLanding) {
                const travel = ease(manualProgress/.86);
                const offset = transformPoint(landingRotation, [0, (.69-.10*switchPress)*landingScale, 0]);
                position = [mix(this.manualLanding.x, targetX+offset[0], travel), mix(this.manualLanding.y, targetY+offset[1], travel), offset[2]*travel];
                scale = mix(this.manualLanding.scale, landingScale, travel);
                rotation = rotationMatrix(mix(-.72, LANDING_ROTATION[0], travel), mix(.38, LANDING_ROTATION[1], travel), mix(-.14, 0, travel));
            }
        } else if (atFinalTouch) {
            const offset = transformPoint(landingRotation, [0, (.69-.10*switchPress)*landingScale, 0]);
            position = [targetX+offset[0], targetY+offset[1], offset[2]];
            rotation = landingRotation;
            scale = landingScale;
            this.movement.snap(position[0], position[1], frame.time);
            this.docked = true;
            this.trail = [];
        } else {
            // Wide side-to-side arcs on desktop; a narrow right-hand path on mobile.
            const stops = [0.82, 0.90, 0.10, 0.90, 0.88];
            const step = Math.min(3.999, progress*4);
            const index = Math.floor(step);
            const heroExit = ease(window.scrollY / Math.max(hero.height*.7, 1));
            const x = mobile ? mix(width*.67, width-.65*68, heroExit) : width*mix(stops[index]!, stops[index+1]!, ease(step-index));
            const y = height*(mobile ? .73 : .60) + Math.sin(progress*Math.PI*2)*height*.055;
            const flightScale = mobile ? mix(Math.min(64, width*.16), 32, heroExit) : mix(Math.min(125, width*.095), 50, heroExit);
            scale = mix(flightScale, landingScale, align);
            const hovering = transformPoint(landingRotation, [0, landingScale*(.69+1.0*(1-seat)-.10*press), 0]);
            position = [mix(x, targetX+hovering[0], align), mix(y, targetY+hovering[1], align), mix(0, hovering[2], align)];
            const turn = Math.sin(progress*Math.PI*3);
            rotation = rotationMatrix(
                mix(-.72 + turn*.25 + this.pointer.y, LANDING_ROTATION[0], align),
                mix(.38 + Math.sin(progress*Math.PI*4)*.65 + this.pointer.x, LANDING_ROTATION[1], align),
                mix(-.14 + turn*.25, 0, align),
            );
            this.movement.follow(position[0], position[1], frame.time);
            this.docked = false;
            position = [this.movement.x, this.movement.y, position[2]];
            if (this.hasScrolled) {
                const settled = 1-ease(this.movement.speed/24);
                const idle = ease((frame.time-this.lastScrollAt-120)/500)*(1-align)*settled;
                position = [position[0]+Math.sin(frame.time*.0011)*2.8*idle, position[1]+Math.sin(frame.time*.0015)*2.2*idle, position[2]];
            }
        }
        const visible = position[1] > -scale*2 && position[1] < height+scale*2;
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
        this.heroShadow.dataset.visible = String(window.scrollY <= 0 && !this.manualLanding &&
            (staticMode || (this.movement.speed < 3 && Math.abs(position[0]-heroX) < 4 && Math.abs(position[1]-heroY) < 4)));
        this.trail = staticMode ? [] : this.trail.filter(sample => frame.time-sample.time < 420);
        if (!staticMode && visible && this.movement.speed > 65 && align < .95) {
            const previous = this.trail.at(-1);
            if (!previous || Math.hypot(position[0]-previous.position[0], position[1]-previous.position[1]) > 10) {
                this.trail.push({ position, rotation, scale, time: frame.time });
                if (this.trail.length > 6) this.trail.shift();
            }
        }
        if (this.trail.length) this.renderer.trail(this.trail, frame.time, this.color);
        if (visible) this.renderer.cap(position, rotation, scale, this.color);
        const manualFlight = this.manualLanding?.settled === false;
        this.animate(this.switchPressedAt !== null || manualFlight || this.trail.length > 0 || (!staticMode && this.hasScrolled && !this.docked && visible));
        this.updateHighlight(position, rotation, scale, staticMode);
        this.anchors.landing.dataset.landed = String(staticMode ? this.manualLanding?.settled === true : this.docked);
        this.anchors.switchButton.hidden = false;
        this.anchors.switchButton.disabled = manualFlight;
        this.anchors.switchButton.setAttribute('aria-label', staticMode && !this.manualLanding ? 'Bring the keycap to this switch' : 'Press the keyboard switch');
        const caption = staticMode && !this.manualLanding ? 'Click the switch to bring the keycap here.'
            : manualFlight ? 'Coming in for a landing…' : 'One key. Entirely yours.';
        if (this.anchors.caption.textContent !== caption) this.anchors.caption.textContent = caption;
    }

    private updateHighlight(position: Vector3, rotation: Float32Array, scale: number, staticMode: boolean): void {
        const highlight = this.anchors.highlight;
        const bounds = highlight.getBoundingClientRect();
        if (staticMode || bounds.bottom < 0 || bounds.top > window.innerHeight) {
            highlight.style.setProperty('--keycap-overlap', 'inset(100%)'); return;
        }
        // Convex silhouette of the beveled shell, rather than the old sphere mask.
        const points: [number, number][] = [];
        for (const [half, y, radius] of [[.91, -.38, .15], [.71, .44, .18]]) {
            for (let i = 0; i < 32; i++) {
                const corner = Math.floor(i/8), angle = (corner+(i%8)/7)*Math.PI/2;
                const local: Vector3 = [((corner === 0 || corner === 3 ? 1 : -1)*(half!-radius!)+Math.cos(angle)*radius!)*scale, y!*scale, ((corner < 2 ? 1 : -1)*(half!-radius!)+Math.sin(angle)*radius!)*scale];
                const p = transformPoint(rotation, local);
                points.push([position[0]+p[0]-bounds.left, position[1]+p[1]-bounds.top]);
            }
        }
        points.sort((a,b) => a[0]-b[0] || a[1]-b[1]);
        const cross = (a: number[], b: number[], c: number[]) => (b[0]!-a[0]!)*(c[1]!-a[1]!)-(b[1]!-a[1]!)*(c[0]!-a[0]!);
        const halfHull = (vertices: [number, number][]) => {
            const hull: [number, number][] = [];
            for (const p of vertices) {
                while (hull.length >= 2 && cross(hull[hull.length-2]!, hull[hull.length-1]!, p) <= 0) hull.pop();
                hull.push(p);
            }
            hull.pop(); return hull;
        };
        const hull = [...halfHull(points), ...halfHull([...points].reverse())];
        highlight.style.setProperty('--keycap-overlap', `polygon(${hull.map(p => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(',')})`);
    }
}
