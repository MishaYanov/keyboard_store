import type { IGridStructure } from '../../../../shared/grid/grid.types';
import type { KeyboardDesign, LegendLanguage } from '@keycaps/domain/keyboard.types';
import { keyboardGeometry, type PreviewKey } from '@keycaps/domain/keyboard-geometry';
import { keyColor, keyColorId, legendColor } from '@keycaps/domain/key-colors';
import { fitGridArea } from '../../../../shared/grid/grid-projection';

// Custom print layers, not OS keymap definitions. Latin layers follow the chosen letter arrangement.
const scriptRows: Partial<Record<LegendLanguage, readonly (readonly string[])[]>> = {
    he: [Array.from("'/קראטוןםפ"), Array.from('שדגכעיחלך'), Array.from('זסבהנמצ')],
    ar: [Array.from('ضصثقفغعهخح'), Array.from('شسيبلاتنم'), ['ئ','ء','ؤ','ر','لا','ى','ة']],
    ru: [Array.from('йцукенгшщз'), Array.from('фывапролд'), Array.from('ячсмить')],
};
export function keyLegend(key: PreviewKey, language: LegendLanguage): string {
    if (key.row === undefined || key.letter === undefined) return key.label;
    return scriptRows[language]?.[key.row]?.[key.letter] ?? key.label;
}

/** Rasterized legends are uploaded only when the design changes; WebGL handles the camera. */
export function createKeyboardScene(getDesign: () => KeyboardDesign, getSelected: () => string | null = () => null): IGridStructure['scene'] {
    let program: WebGLProgram | null = null;
    let texture: WebGLTexture | null = null;
    let camera: WebGLUniformLocation | null = null;
    let board: WebGLUniformLocation | null = null;
    let previous: KeyboardDesign | null = null;
    let previousSelected: string | null = null;
    const surface = document.createElement('canvas');
    const paint = surface.getContext('2d')!;
    let width = 1, height = 1;
    function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error ?? 'Shader compilation failed'); }
        return shader;
    }
    function update(gl: WebGL2RenderingContext, design: KeyboardDesign) {
        const geometry = keyboardGeometry(design);
        width = geometry.width; height = geometry.height;
        const unit = 72;
        surface.width = Math.ceil(width * unit); surface.height = Math.ceil(height * unit);
        paint.scale(unit, unit);
        paint.fillStyle = '#1e2636'; paint.fillRect(0, 0, width, height);
        for (const key of geometry.keys) {
            const id = keyColorId(design, key);
            const x = key.x + 0.35, y = key.y + 0.35, w = key.width - 0.1, h = key.height - 0.1;
            const background = keyColor(design, key);
            paint.fillStyle = background;
            paint.beginPath();
            if (key.iso) {
                paint.moveTo(x,y); paint.lineTo(x+w,y); paint.lineTo(x+w,y+h); paint.lineTo(x+0.25,y+h); paint.lineTo(x+0.25,y+0.95); paint.lineTo(x,y+0.95); paint.closePath();
            } else paint.roundRect(x, y, w, h, 0.07);
            paint.fill();
            if (id === getSelected()) {
                paint.strokeStyle = '#ffb900'; paint.lineWidth = 0.075; paint.stroke();
            }
            paint.fillStyle = legendColor(background);
            const customLegend = design.keyLegends[id];
            if (customLegend) {
                paint.textAlign = 'center'; paint.textBaseline = 'middle'; paint.font = '500 0.21px "Geist Mono", sans-serif';
                paint.fillText(customLegend, x+w/2, y+h/2, w-0.16);
            } else if (key.row !== undefined) {
                design.languages.forEach((language, index) => {
                    const left = index === 0 ? design.primaryCorner === 'top-left' : design.primaryCorner !== 'top-left';
                    paint.textAlign = left ? 'left' : 'right'; paint.textBaseline = index === 0 ? 'top' : 'bottom';
                    paint.font = '500 0.26px "Geist Mono", sans-serif';
                    paint.fillText(keyLegend(key, language), left ? x+0.1 : x+w-0.1, index === 0 ? y+0.1 : y+h-0.1, w-0.2);
                });
            } else {
                paint.textAlign = 'center'; paint.textBaseline = 'middle'; paint.font = '500 0.19px "Geist Mono", sans-serif';
                paint.fillText(key.label, x+w/2, y+h/2, w-0.12);
            }
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
        previous = design;
        previousSelected = getSelected();
    }
    return {
        snapshot(gl) {
            // Reuse the exact keyboard artwork, without camera padding or mobile CSS rotation.
            update(gl, getDesign());
            const thumbnail = document.createElement('canvas');
            thumbnail.width = Math.min(640, surface.width);
            thumbnail.height = Math.max(1, Math.round(surface.height * thumbnail.width / surface.width));
            const ctx = thumbnail.getContext('2d');
            if (!ctx) throw new Error('Unable to capture keyboard preview');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(surface, 0, 0, thumbnail.width, thumbnail.height);
            return thumbnail.toDataURL('image/png');
        },
        mount(gl) {
            const vertex = compile(gl, gl.VERTEX_SHADER, `#version 300 es
                uniform vec4 u_camera; uniform vec2 u_board; out vec2 uv;
                void main() {
                    vec2 v[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
                    uv=v[gl_VertexID]; vec2 p=(uv*u_board-u_camera.xy)/u_camera.zw*2.0-1.0;
                    gl_Position=vec4(p.x,-p.y,0,1);
                }`);
            let fragment: WebGLShader | null = null;
            try {
                fragment=compile(gl,gl.FRAGMENT_SHADER,`#version 300 es
                    precision mediump float; in vec2 uv; uniform sampler2D u_image; out vec4 color;
                    void main(){color=texture(u_image,uv);}`);
                program=gl.createProgram(); if(!program) throw new Error('Could not create preview');
                gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program);
                if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Preview link failed');
                camera=gl.getUniformLocation(program,'u_camera'); board=gl.getUniformLocation(program,'u_board');
                texture=gl.createTexture(); if(!texture) throw new Error('Could not allocate preview texture');
                gl.bindTexture(gl.TEXTURE_2D,texture);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
                previous=null;
            } catch(error) { if(program) gl.deleteProgram(program); if(texture) gl.deleteTexture(texture); throw error; }
            finally {gl.deleteShader(vertex); if(fragment) gl.deleteShader(fragment);}
        },
        paint(frame,area) {
            if(!program || frame.width<=0 || frame.height<=0) return;
            const gl=frame.context, design=getDesign();
            if(previous!==design || previousSelected!==getSelected()) update(gl,design);
            gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
            const fitted = fitGridArea(area, frame.width, frame.height);
            gl.uniform4f(camera,fitted.x,fitted.y,fitted.width,fitted.height);
            gl.uniform2f(board,width,height);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture); gl.drawArrays(gl.TRIANGLES,0,6);
        },
        dispose(gl) { if(program) gl.deleteProgram(program); if(texture) gl.deleteTexture(texture); program=null; texture=null; previous=null; },
    };
}
