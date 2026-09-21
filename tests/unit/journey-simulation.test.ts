import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JourneySimulation, type JourneyInput } from '../../client/src/modules/homepage/sources/journey-simulation';
import { rotationMatrix } from '../../client/src/modules/homepage/sources/keycap-transform';
import { keycapSilhouette } from '../../client/src/modules/homepage/sources/keycap-silhouette';

function frame(width = 390, changes: Partial<JourneyInput> = {}): JourneyInput {
    return { width, height: 844, time: 0, scrollY: 0, staticMode: false,
        hero: { left: 0, top: 0, width, height: 1000, bottom: 1000 },
        target: { left: 20, top: 4000, width: width - 40, height: 420, bottom: 4420 },
        landingTop: 3800, ...changes };
}

test('mobile and desktop begin at the hero and static mode stays anchored to it', () => {
    for (const width of [390, 1280]) {
        const scene = new JourneySimulation();
        const initial = scene.evaluate(frame(width));
        assert.equal(initial.position[0], width * (width <= 768 ? .67 : .82));
        assert.equal(initial.position[1], 844 * (width <= 768 ? .73 : .60));
        assert.equal(initial.active, false);
        const stopped = scene.evaluate(frame(width, { staticMode: true, scrollY: 300,
            hero: { ...frame(width).hero, top: -300 } }));
        assert.equal(stopped.position[1], initial.position[1] - 300);
        assert.equal(stopped.manualFlight, false);
    }
});

test('manual flight lands, stops scheduling, and switch clicks return to rest', () => {
    const scene = new JourneySimulation();
    scene.manualLanding = { start: 0, x: 250, y: 500, scale: 60, settled: false };
    const input = frame(390, { staticMode: true, target: { left: 20, top: 200, width: 350, height: 420, bottom: 620 }, landingTop: 100 });
    assert.equal(scene.evaluate({ ...input, time: 450 }).manualFlight, true);
    const landed = scene.evaluate({ ...input, time: 900 });
    assert.equal(landed.landed, true);
    assert.equal(landed.active, false);
    scene.switchPressedAt = 1000;
    const pressed = scene.evaluate({ ...input, time: 1084 });
    assert.ok(pressed.switchPress > .99);
    assert.notDeepEqual(pressed.position, landed.position);
    const resting = scene.evaluate({ ...input, time: 1280 });
    assert.deepEqual(resting.position, landed.position);
    assert.equal(resting.active, false);
});

test('scroll preserves momentum and bounded trails, final touch removes both', () => {
    const scene = new JourneySimulation();
    scene.evaluate(frame());
    scene.hasScrolled = true;
    scene.lastScrollAt = 16;
    let flight = scene.evaluate(frame(390, { time: 16, scrollY: 1200 }));
    assert.ok(scene.movement.speed > 0);
    for (let time = 32; time < 400; time += 16) {
        flight = scene.evaluate(frame(390, { time, scrollY: 1200 }));
        assert.ok(scene.trail.length <= 6);
        assert.ok(flight.position.every(Number.isFinite));
    }
    const dockInput = frame(390, { time: 416, scrollY: 3600, landingTop: 0,
        target: { left: 20, top: 200, width: 350, height: 420, bottom: 620 } });
    const dock = scene.evaluate(dockInput);
    assert.equal(dock.landed, true);
    assert.equal(scene.movement.speed, 0);
    assert.equal(scene.trail.length, 0);
    assert.equal(dock.active, false);
    assert.deepEqual(scene.evaluate({ ...dockInput, time: 3000 }).position, dock.position);
});

test('mobile path is lateral, deterministic, and silhouette contains finite coordinates', () => {
    const positions = [0, 1000, 2000].map(scrollY => new JourneySimulation().evaluate(frame(390, { scrollY })).position[0]);
    assert.ok(Math.max(...positions) - Math.min(...positions) > 30);
    const rotation = rotationMatrix(-.72, .38, -.14);
    const mask = keycapSilhouette([250, 600, 0], rotation, 64, { left: 20, top: 30 });
    assert.match(mask, /^polygon\(/);
    assert.ok(!/NaN|Infinity/.test(mask));
    assert.equal(mask, keycapSilhouette([250, 600, 0], rotation, 64, { left: 20, top: 30 }));
});
