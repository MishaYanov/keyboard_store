export const VERTEX_SHADER_SOURCE = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;

uniform mat4 u_projection;
uniform vec3 u_translation;
uniform vec2 u_rotation;

out vec3 v_normal;
out vec3 v_worldPosition;

void main() {
    float sinX = sin(u_rotation.x);
    float cosX = cos(u_rotation.x);
    float sinY = sin(u_rotation.y);
    float cosY = cos(u_rotation.y);

    mat3 rotationX = mat3(
        1.0, 0.0, 0.0,
        0.0, cosX, sinX,
        0.0, -sinX, cosX
    );
    mat3 rotationY = mat3(
        cosY, 0.0, -sinY,
        0.0, 1.0, 0.0,
        sinY, 0.0, cosY
    );
    mat3 rotation = rotationY * rotationX;
    vec3 worldPosition = rotation * a_position + u_translation;

    v_normal = normalize(rotation * a_normal);
    v_worldPosition = worldPosition;
    gl_Position = u_projection * vec4(worldPosition, 1.0);
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_worldPosition;

out vec4 outputColor;

void main() {
    vec3 normal = normalize(v_normal);
    vec3 lightDirection = normalize(vec3(-0.45, 0.75, -1.0));
    vec3 viewDirection = normalize(-v_worldPosition);

    float diffuse = max(dot(normal, lightDirection), 0.0);
    float rim = pow(
        1.0 - max(dot(normal, viewDirection), 0.0),
        2.4
    );
    float verticalTint = normal.y * 0.5 + 0.5;

    vec3 lowerColor = vec3(0.10, 0.26, 0.86);
    vec3 upperColor = vec3(0.21, 0.91, 0.94);
    vec3 color = mix(lowerColor, upperColor, verticalTint);

    color *= 0.30 + diffuse * 0.85;
    color += rim * vec3(0.35, 0.55, 1.0);

    outputColor = vec4(color, 1.0);
}
`;
