import { transformPoint, type Vector3 } from './keycap-transform';

/** Screen-space silhouette; independent of CSS and element measurements. */
export function keycapSilhouette(position: Vector3, rotation: Float32Array, scale: number, bounds: { left: number; top: number }): string {
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
        return `polygon(${hull.map(p => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(',')})`;
}
