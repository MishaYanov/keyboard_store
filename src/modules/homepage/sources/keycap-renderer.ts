import { KEYCAP_FRAGMENT_SHADER, KEYCAP_VERTEX_SHADER } from './shaders/keycap.shaders';
import { createHousingMesh, createKeycapMeshes, type KeycapMesh } from './keycap-mesh';

export type Vector3 = readonly [number, number, number];
export interface KeycapTrailSample { position: Vector3; rotation: Float32Array; scale: number; time: number }
interface MeshResource { vao: WebGLVertexArrayObject; vertices: WebGLBuffer; indices: WebGLBuffer; count: number }

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

export class KeycapRenderer {
    private program: WebGLProgram | null = null;
    private texture: WebGLTexture | null = null;
    private meshes: Partial<Record<'shell' | 'top' | 'base' | 'housing' | 'stem', MeshResource>> = {};
    private uniforms: Record<string, WebGLUniformLocation> = {};

    public constructor(private readonly gl: WebGL2RenderingContext) {
        try {
            const vertex = this.compile(gl.VERTEX_SHADER, KEYCAP_VERTEX_SHADER);
            let fragment: WebGLShader | null = null;
            try {
                fragment = this.compile(gl.FRAGMENT_SHADER, KEYCAP_FRAGMENT_SHADER);
                this.program = gl.createProgram();
                if (!this.program) throw new Error('Unable to allocate keycap program');
                gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
                if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program) ?? 'Keycap link failed');
            } finally { gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); }
            for (const name of ['rotation', 'translation', 'scale', 'viewport', 'color', 'legend', 'opacity', 'ghost']) {
                const uniform = gl.getUniformLocation(this.program, `u_${name}`);
                if (uniform === null) throw new Error(`Missing keycap uniform: ${name}`);
                this.uniforms[name] = uniform;
            }
            const cap = createKeycapMeshes();
            this.meshes.shell = this.upload(cap.shell);
            this.meshes.top = this.upload(cap.top);
            this.meshes.base = this.upload(createHousingMesh(.77, -.48, -.32));
            this.meshes.housing = this.upload(createHousingMesh(.65, -.32, .20));
            this.meshes.stem = this.upload(createHousingMesh(.29, .20, .60));
            this.texture = gl.createTexture();
            if (!this.texture) throw new Error('Unable to allocate keycap legend');
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } catch (error) { this.dispose(); throw error; }
    }

    public setLegend(legend: string, ink: string): void {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const paint = canvas.getContext('2d');
        if (!paint) throw new Error('Unable to paint keycap legend');
        paint.fillStyle = ink;
        paint.textAlign = 'center'; paint.textBaseline = 'middle';
        paint.font = '600 104px "Geist Mono", monospace';
        const lines = legend.length > 10 && legend.includes(' ') ? legend.split(/\s+/) : [legend];
        const textLines = lines.length > 2 ? [lines.slice(0, Math.ceil(lines.length/2)).join(' '), lines.slice(Math.ceil(lines.length/2)).join(' ')] : lines;
        textLines.forEach((line, i) => paint.fillText(line, 256, 256 + (i - (textLines.length-1)/2) * 108, 350));
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }

    public begin(width: number, height: number): void {
        const gl = this.gl;
        gl.clearColor(0, 0, 0, 0); gl.clearDepth(1);
        gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.uniform2f(this.uniforms.viewport!, width, height);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.uniforms.legend!, 0);
        gl.uniform1f(this.uniforms.opacity!, 1);
        gl.uniform1f(this.uniforms.ghost!, 0);
    }

    public trail(samples: readonly KeycapTrailSample[], time: number, color: string): void {
        const gl = this.gl;
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(this.uniforms.ghost!, 1);
        for (const sample of samples) {
            const life = Math.max(0, 1-(time-sample.time)/420);
            gl.uniform1f(this.uniforms.opacity!, .075*life*life);
            this.cap(sample.position, sample.rotation, sample.scale, color);
        }
        gl.uniform1f(this.uniforms.opacity!, 1);
        gl.uniform1f(this.uniforms.ghost!, 0);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }

    public cap(position: Vector3, rotation: Float32Array, scale: number, color: string): void {
        this.draw('shell', position, rotation, [scale, scale, scale], color);
        this.draw('top', position, rotation, [scale, scale, scale], color);
    }

    public switch(position: Vector3, rotation: Float32Array, scale: number, press: number, light: boolean): void {
        this.draw('base', position, rotation, [scale, scale, scale], light ? '#303640' : '#424a59');
        this.draw('housing', position, rotation, [scale, scale, scale], light ? '#8a98a2' : '#8493a5');
        const offset = transformPoint(rotation, [0, -.10*press*scale, 0]);
        const stem = position.map((v, i) => v + offset[i]!) as unknown as Vector3;
        this.draw('stem', stem, rotation, [scale, scale, scale*.30], '#d9b44a');
        this.draw('stem', stem, rotation, [scale*.30, scale, scale], '#d9b44a');
    }

    private draw(name: keyof KeycapRenderer['meshes'], position: Vector3, rotation: Float32Array, scale: Vector3, color: string): void {
        const gl = this.gl, mesh = this.meshes[name]!;
        gl.uniformMatrix3fv(this.uniforms.rotation!, false, rotation);
        gl.uniform3fv(this.uniforms.translation!, position);
        gl.uniform3fv(this.uniforms.scale!, scale);
        gl.uniform3f(this.uniforms.color!, ...[1, 3, 5].map(i => parseInt(color.slice(i, i+2), 16) / 255) as [number, number, number]);
        gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    private compile(type: number, source: string): WebGLShader {
        const gl = this.gl, shader = gl.createShader(type);
        if (!shader) throw new Error('Unable to allocate keycap shader');
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
            throw new Error(error ?? 'Keycap shader failed');
        }
        return shader;
    }

    private upload(mesh: KeycapMesh): MeshResource {
        const gl = this.gl, vao = gl.createVertexArray(), vertices = gl.createBuffer(), indices = gl.createBuffer();
        if (!vao || !vertices || !indices) {
            gl.deleteVertexArray(vao); gl.deleteBuffer(vertices); gl.deleteBuffer(indices);
            throw new Error('Unable to allocate keycap mesh');
        }
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
        for (let i = 0; i < 3; i++) {
            gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, i*12);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        return { vao, vertices, indices, count: mesh.indices.length };
    }

    public dispose(): void {
        for (const mesh of Object.values(this.meshes)) {
            this.gl.deleteVertexArray(mesh.vao); this.gl.deleteBuffer(mesh.vertices); this.gl.deleteBuffer(mesh.indices);
        }
        this.gl.deleteTexture(this.texture); this.gl.deleteProgram(this.program);
        this.meshes = {}; this.texture = null; this.program = null;
    }
}
