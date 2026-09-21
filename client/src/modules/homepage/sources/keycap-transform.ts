export type Vector3 = readonly [number, number, number];

/** Local Y points up; the final reflection maps it to screen coordinates. */
export function rotationMatrix(x: number, y: number, z: number): Float32Array {
    const sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y), sz = Math.sin(z), cz = Math.cos(z);
    return new Float32Array([
        cz*cy, -sz*cy, -sy,
        cz*sy*sx-sz*cx, -(sz*sy*sx+cz*cx), cy*sx,
        cz*sy*cx+sz*sx, -(sz*sy*cx-cz*sx), cy*cx,
    ]);
}

export function transformPoint(matrix: Float32Array, point: Vector3): Vector3 {
    return [0, 1, 2].map(row => matrix[row]! * point[0] + matrix[row+3]! * point[1] + matrix[row+6]! * point[2]) as unknown as Vector3;
}
