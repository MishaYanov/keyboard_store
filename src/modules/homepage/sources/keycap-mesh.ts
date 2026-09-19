type Point = readonly [number, number, number];
export interface KeycapMesh { vertices: Float32Array; indices: Uint16Array }
interface Ring { half: number; radius: number; y: number }

/** Rounded square sections, with shared normals for the molded plastic bevels. */
function ringsMesh(rings: readonly Ring[], printed = false): KeycapMesh {
    const positions: Point[] = [];
    const indices: number[] = [];
    const segments = 32;
    for (const ring of rings) {
        for (let i = 0; i < segments; i++) {
            const corner = Math.floor(i / 8);
            const angle = (corner + (i % 8) / 7) * Math.PI / 2;
            const cx = corner === 0 || corner === 3 ? 1 : -1;
            const cz = corner < 2 ? 1 : -1;
            positions.push([
                cx * (ring.half - ring.radius) + Math.cos(angle) * ring.radius,
                ring.y,
                cz * (ring.half - ring.radius) + Math.sin(angle) * ring.radius,
            ]);
        }
    }
    for (let ring = 0; ring < rings.length - 1; ring++) {
        for (let i = 0; i < segments; i++) {
            const a = ring * segments + i, b = a + segments;
            const c = ring * segments + (i + 1) % segments, d = c + segments;
            indices.push(a, b, c, c, b, d);
        }
    }
    const normals = positions.map(() => [0, 0, 0]);
    for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i]!, ib = indices[i+1]!, ic = indices[i+2]!;
        const a = positions[ia]!, b = positions[ib]!, c = positions[ic]!;
        const ab = b.map((v, axis) => v - a[axis]!);
        const ac = c.map((v, axis) => v - a[axis]!);
        const n = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
        for (const id of [ia, ib, ic]) for (let axis = 0; axis < 3; axis++) normals[id]![axis]! += n[axis]!;
    }
    return {
        vertices: new Float32Array(positions.flatMap((p, i) => {
            const n = normals[i]!, length = Math.hypot(...n) || 1;
            return [...p, ...n.map(v => v / length), p[0] / 1.42 + .5, .5 - p[2] / 1.42, printed ? 1 : 0];
        })),
        indices: new Uint16Array(indices),
    };
}

export function createKeycapMeshes(): { shell: KeycapMesh; top: KeycapMesh } {
    return {
        shell: ringsMesh([
            { half: .86, radius: .13, y: -.44 },
            { half: .91, radius: .15, y: -.38 },
            { half: .90, radius: .15, y: -.30 },
            { half: .73, radius: .17, y: .38 },
            { half: .71, radius: .18, y: .44 },
        ]),
        top: ringsMesh([
            { half: .71, radius: .18, y: .44 },
            { half: .65, radius: .18, y: .46 },
            { half: .54, radius: .17, y: .415 },
            { half: .36, radius: .14, y: .365 },
            { half: .18, radius: .08, y: .34 },
            { half: 0, radius: 0, y: .33 },
        ], true),
    };
}

/** Closed housing with small bevels. Also reused for the switch's cross stem. */
export function createHousingMesh(half: number, bottom: number, top: number): KeycapMesh {
    const bevel = .035;
    return ringsMesh([
        { half: 0, radius: 0, y: bottom },
        { half: half - bevel, radius: .07, y: bottom },
        { half, radius: .09, y: bottom + bevel },
        { half, radius: .09, y: top - bevel },
        { half: half - bevel, radius: .07, y: top },
        { half: 0, radius: 0, y: top },
    ]);
}
