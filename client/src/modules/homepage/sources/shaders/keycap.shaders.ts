export const KEYCAP_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_print;
uniform mat3 u_rotation;
uniform vec3 u_translation;
uniform vec3 u_scale;
uniform vec2 u_viewport;
out vec3 v_normal;
out vec3 v_print;
void main() {
    vec3 position = u_rotation * (a_position * u_scale) + u_translation;
    v_normal = normalize(u_rotation * (a_normal / u_scale));
    v_print = a_print;
    gl_Position = vec4(position.x * 2.0 / u_viewport.x - 1.0,
        1.0 - position.y * 2.0 / u_viewport.y, position.z / 2000.0, 1.0);
}`;

export const KEYCAP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_print;
uniform vec3 u_color;
uniform sampler2D u_legend;
uniform float u_opacity;
uniform float u_ghost;
out vec4 outputColor;
void main() {
    vec3 normal = normalize(v_normal);
    vec3 light = normalize(vec3(-0.45, -0.8, -1.0));
    float diffuse = max(dot(normal, light), 0.0);
    vec3 halfVector = normalize(light + vec3(0.0, 0.0, -1.0));
    float highlight = pow(max(dot(normal, halfVector), 0.0), 48.0);
    vec4 ink = texture(u_legend, v_print.xy);
    vec3 color = mix(u_color, ink.rgb, ink.a * v_print.z * (1.0-u_ghost));
    color = color * (0.48 + diffuse * 0.58) + highlight * 0.13;
    outputColor = vec4(color, u_opacity);
}`;
