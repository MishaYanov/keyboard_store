import { reducedMotion } from '../../../shared/accessibility/accessibility.service';
import '../styles/hero-ball-canvas.component.css';
import {
    type ApplicationContext, WebGlComponent,
    type WebGlFrame,
} from '../../../engine';
import {FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE} from "../sources/shaders/hero.shaders";


const FIELD_OF_VIEW_RADIANS = 50 * Math.PI / 180;
const SPHERE_RADIUS = 0.65;
const START_DEPTH = 10;
const END_DEPTH = 3;

interface SphereMesh {
    readonly indices: Uint16Array;
    readonly vertices: Float32Array;
}

interface SphereResources {
    readonly indexBuffer: WebGLBuffer;
    readonly indexCount: number;
    readonly program: WebGLProgram;
    readonly projectionUniform: WebGLUniformLocation;
    readonly rotationUniform: WebGLUniformLocation;
    readonly translationUniform: WebGLUniformLocation;
    readonly vertexArray: WebGLVertexArrayObject;
    readonly vertexBuffer: WebGLBuffer;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function mix(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
}

function smoothStep(progress: number): number {
    return progress * progress * (3 - 2 * progress);
}

function createPerspectiveMatrix(aspect: number, near: number, far: number): Float32Array {
    const focalLength = 1 / Math.tan(FIELD_OF_VIEW_RADIANS / 2);
    const depthRange = far - near;

    // Left-handed projection: the camera looks along positive Z, matching the
    // requested world positions of z=10 moving toward z=3.
    return new Float32Array([
        focalLength / Math.max(aspect, 0.0001), 0, 0, 0,
        0, focalLength, 0, 0,
        0, 0, (far + near) / depthRange, 1,
        0, 0, (-2 * far * near) / depthRange, 0,
    ]);
}

function createSphereMesh(
    latitudeSegments: number,
    longitudeSegments: number,
): SphereMesh {
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let latitude = 0; latitude <= latitudeSegments; latitude += 1) {
        const theta = latitude * Math.PI / latitudeSegments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (
            let longitude = 0;
            longitude <= longitudeSegments;
            longitude += 1
        ) {
            const phi = longitude * Math.PI * 2 / longitudeSegments;
            const x = sinTheta * Math.cos(phi);
            const y = cosTheta;
            const z = sinTheta * Math.sin(phi);

            // Interleaved position and normal data. A unit sphere's position
            // is also its normal; position is scaled to the desired radius.
            vertices.push(
                x * SPHERE_RADIUS,
                y * SPHERE_RADIUS,
                z * SPHERE_RADIUS,
                x,
                y,
                z,
            );
        }
    }

    const rowLength = longitudeSegments + 1;

    for (let latitude = 0; latitude < latitudeSegments; latitude += 1) {
        for (
            let longitude = 0;
            longitude < longitudeSegments;
            longitude += 1
        ) {
            const first = latitude * rowLength + longitude;
            const second = first + rowLength;

            indices.push(
                first,
                second,
                first + 1,
                second,
                second + 1,
                first + 1,
            );
        }
    }

    return {
        indices: new Uint16Array(indices),
        vertices: new Float32Array(vertices),
    };
}

function compileShader(
    context: WebGL2RenderingContext,
    type: number,
    source: string,
): WebGLShader {
    const shader = context.createShader(type);

    if (!shader) {
        throw new Error('Unable to create WebGL shader');
    }

    context.shaderSource(shader, source);
    context.compileShader(shader);

    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        const message = context.getShaderInfoLog(shader)
            ?? 'Unknown shader compilation error';

        context.deleteShader(shader);
        throw new Error(message);
    }

    return shader;
}

function createProgram(context: WebGL2RenderingContext): WebGLProgram {
    const vertexShader = compileShader(
        context,
        context.VERTEX_SHADER,
        VERTEX_SHADER_SOURCE,
    );
    let fragmentShader: WebGLShader | null = null;

    try {
        fragmentShader = compileShader(
            context,
            context.FRAGMENT_SHADER,
            FRAGMENT_SHADER_SOURCE,
        );

        const program = context.createProgram();

        if (!program) {
            throw new Error('Unable to create WebGL program');
        }

        context.attachShader(program, vertexShader);
        context.attachShader(program, fragmentShader);
        context.linkProgram(program);

        if (!context.getProgramParameter(program, context.LINK_STATUS)) {
            const message = context.getProgramInfoLog(program)
                ?? 'Unknown WebGL program link error';

            context.deleteProgram(program);
            throw new Error(message);
        }

        return program;
    } finally {
        context.deleteShader(vertexShader);

        if (fragmentShader) {
            context.deleteShader(fragmentShader);
        }
    }
}

function requireUniform(context: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
    const location = context.getUniformLocation(program, name);

    if (!location) {
        throw new Error(`WebGL uniform "${name}" was not found`);
    }

    return location;
}

export class HeroBallCanvasComponent extends WebGlComponent {

    private resources: SphereResources | null = null;
    private scrollProgress = 0;

    public constructor(
        context: ApplicationContext,
        private readonly titleHighlight?: HTMLElement,
    ) {
        super(context, {
            className: 'hero__ball-canvas',
            contextAttributes: {
                alpha: true,
                antialias: true,
                depth: true,
                powerPreference: 'default',
                preserveDrawingBuffer: false,
            },
        });


        this.root.dataset.styleScope = 'hero-ball-canvas';
        this.root.setAttribute('aria-hidden', 'true');
    }

    protected override onWebGlMount(): void {
        this.createResources();
        this.updateScrollProgress();

        const onScroll = () => this.invalidate();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('accessibilitychange', onScroll);
        const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        motionPreference.addEventListener('change', onScroll);
        this.registerCleanup(() => motionPreference.removeEventListener('change', onScroll));
        this.registerCleanup(() => window.removeEventListener('accessibilitychange', onScroll));
        this.registerCleanup(() => window.removeEventListener('scroll', onScroll));
    }

    protected override onWebGlUnmount(): void {
        this.destroyResources();
    }

    protected override onWebGlContextLost(): void {
        this.resources = null;
    }

    protected override onWebGlContextRestored(): void {
        this.createResources();
    }

    protected override paint(frame: WebGlFrame): void {
        const resources = this.resources;

        if (!resources || frame.width <= 0 || frame.height <= 0) {
            return;
        }

        const context = frame.context;
        this.updateScrollProgress();
        const rawProgress = reducedMotion() ? 0 : clamp01(this.scrollProgress);
        const progress = frame.quality.animations
            ? smoothStep(rawProgress)
            : rawProgress < 0.5 ? 0 : 1;
        const depth = mix(START_DEPTH, END_DEPTH, progress);
        const aspect = frame.width / frame.height;
        const verticalSlope = Math.tan(FIELD_OF_VIEW_RADIANS / 2);
        const horizontalSlope = verticalSlope * aspect;
        const horizontalExtent = Math.max(0,
            depth * horizontalSlope - SPHERE_RADIUS * Math.hypot(1, horizontalSlope));
        const verticalExtent = Math.max(0,
            depth * verticalSlope - SPHERE_RADIUS * Math.hypot(1, verticalSlope));
        const x = mix(-horizontalExtent, horizontalExtent, progress);
        const y = mix(verticalExtent, -verticalExtent, progress);
        const projection = createPerspectiveMatrix(aspect, 0.1, 100);
        this.updateTitleHighlight(x, y, depth, frame);

        context.clearColor(0, 0, 0, 0);
        context.clearDepth(1);
        context.enable(context.DEPTH_TEST);
        context.depthFunc(context.LEQUAL);
        context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);

        context.useProgram(resources.program);
        context.bindVertexArray(resources.vertexArray);
        context.uniformMatrix4fv(
            resources.projectionUniform,
            false,
            projection,
        );
        context.uniform3f(resources.translationUniform, x, y, depth);
        context.uniform2f(
            resources.rotationUniform,
            progress * Math.PI * 0.35,
            progress * Math.PI * 1.5,
        );
        context.drawElements(
            context.TRIANGLES,
            resources.indexCount,
            context.UNSIGNED_SHORT,
            0,
        );
        context.bindVertexArray(null);
    }

    private updateTitleHighlight(x: number, y: number, z: number, frame: WebGlFrame): void {
        const highlight = this.titleHighlight;
        if (!highlight) return;
        const canvasBounds = this.root.getBoundingClientRect();
        const textBounds = highlight.getBoundingClientRect();
        const distance = Math.hypot(x, y, z);
        const factor = 1 - SPHERE_RADIUS ** 2 / distance ** 2;
        const radius = SPHERE_RADIUS * Math.sqrt(factor);
        // Project the tangent circle to follow the sphere's perspective silhouette.
        const horizontal = Math.hypot(x, z);
        const ux = z / horizontal;
        const uz = -x / horizontal;
        const vx = y / distance * uz;
        const vy = z / distance * ux - x / distance * uz;
        const vz = -y / distance * ux;
        const scale = frame.height / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
        const points: string[] = [];
        for (let index = 0; index < 96; index += 1) {
            const angle = index / 96 * Math.PI * 2;
            const cosine = Math.cos(angle) * radius;
            const sine = Math.sin(angle) * radius;
            const px = x * factor + ux * cosine + vx * sine;
            const py = y * factor + vy * sine;
            const pz = z * factor + uz * cosine + vz * sine;
            const screenX = canvasBounds.left - textBounds.left + frame.width / 2 + scale * px / pz;
            const screenY = canvasBounds.top - textBounds.top + frame.height / 2 - scale * py / pz;
            points.push(`${screenX.toFixed(2)}px ${screenY.toFixed(2)}px`);
        }
        highlight.style.setProperty('--ball-overlap', `polygon(${points.join(',')})`);
    }

    private updateScrollProgress(): void {
        const bounds = this.root.getBoundingClientRect();
        const maximumScroll = Math.max(
            0,
            bounds.height - document.documentElement.clientHeight,
        );

        this.scrollProgress = maximumScroll === 0
            ? 0
            : clamp01(-bounds.top / maximumScroll);
    }

    private createResources(): void {
        this.destroyResources();

        const context = this.context;
        const mesh = createSphereMesh(24, 32);
        const program = createProgram(context);
        const vertexArray = context.createVertexArray();
        const vertexBuffer = context.createBuffer();
        const indexBuffer = context.createBuffer();

        if (!vertexArray || !vertexBuffer || !indexBuffer) {
            context.deleteVertexArray(vertexArray);
            context.deleteBuffer(vertexBuffer);
            context.deleteBuffer(indexBuffer);
            context.deleteProgram(program);
            throw new Error('Unable to allocate WebGL sphere buffers');
        }

        try {
            context.bindVertexArray(vertexArray);
            context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
            context.bufferData(
                context.ARRAY_BUFFER,
                mesh.vertices,
                context.STATIC_DRAW,
            );
            context.enableVertexAttribArray(0);
            context.vertexAttribPointer(
                0,
                3,
                context.FLOAT,
                false,
                6 * Float32Array.BYTES_PER_ELEMENT,
                0,
            );
            context.enableVertexAttribArray(1);
            context.vertexAttribPointer(
                1,
                3,
                context.FLOAT,
                false,
                6 * Float32Array.BYTES_PER_ELEMENT,
                3 * Float32Array.BYTES_PER_ELEMENT,
            );

            context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
            context.bufferData(
                context.ELEMENT_ARRAY_BUFFER,
                mesh.indices,
                context.STATIC_DRAW,
            );

            this.resources = {
                indexBuffer,
                indexCount: mesh.indices.length,
                program,
                projectionUniform: requireUniform(
                    context,
                    program,
                    'u_projection',
                ),
                rotationUniform: requireUniform(
                    context,
                    program,
                    'u_rotation',
                ),
                translationUniform: requireUniform(
                    context,
                    program,
                    'u_translation',
                ),
                vertexArray,
                vertexBuffer,
            };
        } catch (error: unknown) {
            context.deleteVertexArray(vertexArray);
            context.deleteBuffer(vertexBuffer);
            context.deleteBuffer(indexBuffer);
            context.deleteProgram(program);

            throw error;
        } finally {
            context.bindVertexArray(null);
            context.bindBuffer(context.ARRAY_BUFFER, null);
        }
    }

    private destroyResources(): void {
        const resources = this.resources;

        if (!resources) {
            return;
        }

        this.resources = null;
        this.context.deleteVertexArray(resources.vertexArray);
        this.context.deleteBuffer(resources.vertexBuffer);
        this.context.deleteBuffer(resources.indexBuffer);
        this.context.deleteProgram(resources.program);
    }
}
