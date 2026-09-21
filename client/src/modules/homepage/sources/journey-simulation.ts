import { rotationMatrix, transformPoint, type Vector3 } from './keycap-transform';
import type { KeycapTrailSample } from './keycap-renderer';
import { KeycapMotion } from './keycap-motion';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t*t*(3-2*t); };
const mix = (a: number, b: number, t: number) => a+(b-a)*t;
const LANDING_ROTATION = [-.64, .40, 0] as const;


export interface JourneyBounds { left: number; top: number; width: number; height: number; bottom: number }
export interface JourneyInput {
    width: number; height: number; time: number; scrollY: number;
    hero: JourneyBounds; target: JourneyBounds; landingTop: number; staticMode: boolean;
}

/** Deterministic animation state; no DOM, browser clock, storage or WebGL calls. */
export class JourneySimulation {
    public pointer = { x: 0, y: 0 };
    public hasScrolled = false;
    public lastScrollAt = 0;
    public manualLanding: { start: number; x: number; y: number; scale: number; settled: boolean } | null = null;
    public readonly movement = new KeycapMotion();
    public trail: KeycapTrailSample[] = [];
    public docked = false;
    public switchPressedAt: number | null = null;
    public evaluate(frame: JourneyInput) {
        const { width, height, scrollY, target, hero, landingTop, staticMode } = frame;
        const targetX = target.left + target.width/2;
        const targetY = target.top + target.height*.67;
        const mobile = width <= 768;
        // An explicit choice to animate this decoration overrides only this scene.
        // The shared quality profile must not re-disable it due to the OS preference.
        const manualProgress = this.manualLanding ? clamp((frame.time-this.manualLanding.start)/900) : 0;
        if (this.manualLanding && manualProgress === 1) this.manualLanding.settled = true;
        const manualPress = Math.sin(clamp((manualProgress-.86)/.14)*Math.PI);
        const clickProgress = this.switchPressedAt === null ? 1 : clamp((frame.time-this.switchPressedAt)/280);
        const clickPress = clickProgress < .3 ? ease(clickProgress/.3) : 1-ease((clickProgress-.3)/.7);
        if (clickProgress === 1) this.switchPressedAt = null;
        const endScroll = Math.max(1, targetY + scrollY - height*.68);
        const progress = clamp(scrollY / endScroll);
        const approach = ease((height*1.45 - targetY) / (height*.77));
        const align = ease(approach / .64);
        const seat = ease((approach - .52) / .40);
        const press = ease((approach - .92) / .08);
        // Once the switch enters view, it owns the cap's position: no spring lag.
        const atFinalTouch = targetY <= height && landingTop < height;
        const switchPress = Math.max(clickPress, staticMode ? manualPress : atFinalTouch ? 0 : press);
        const landingScale = Math.min(mobile ? 82 : 110, target.width*.24, height*.15);
        const landingRotation = rotationMatrix(...LANDING_ROTATION);
        const switchPosition: Vector3 = [targetX, targetY, 0];

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
            // Keep mobile arcs inside the viewport, rather than pinning to its edge.
            const stops = mobile ? [.67, .76, .24, .72, .5] : [.82, .90, .10, .90, .88];
            const step = Math.min(3.999, progress*4);
            const index = Math.floor(step);
            const heroExit = ease(scrollY / Math.max(hero.height*.7, 1));
            const x = width*mix(stops[index]!, stops[index+1]!, ease(step-index));
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
        this.trail = staticMode ? [] : this.trail.filter(sample => frame.time-sample.time < 420);
        if (!staticMode && visible && this.movement.speed > 65 && align < .95) {
            const previous = this.trail.at(-1);
            if (!previous || Math.hypot(position[0]-previous.position[0], position[1]-previous.position[1]) > 10) {
                this.trail.push({ position, rotation, scale, time: frame.time });
                if (this.trail.length > 6) this.trail.shift();
            }
        }

        const manualFlight = this.manualLanding?.settled === false;
        return {
            position, rotation, scale, visible, manualFlight,
            switchPosition, landingRotation, landingScale, switchPress,
            active: this.switchPressedAt !== null || manualFlight || this.trail.length > 0 || (!staticMode && this.hasScrolled && !this.docked && visible),
            landed: staticMode ? this.manualLanding?.settled === true : this.docked,
        };
    }
}
