#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform float uSmoothness;
uniform float uSwap;       // toggles between diagonal layouts
uniform float uSpacing;    // controls distance of squares from center

// --- Rounded rectangle SDF ---
float sdRoundedBox(vec2 p, vec2 size, float radius) {
    vec2 d = abs(p) - size + vec2(radius);
    return length(max(d, 0.0)) - radius;
}

// --- Smooth union (gooey bridge) ---
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    // --- Layout positions ---
    vec2 pos1_default = vec2(-uSpacing,  uSpacing);
    vec2 pos3_default = vec2( uSpacing, -uSpacing);

    vec2 pos1_swapped = vec2( uSpacing,  uSpacing);
    vec2 pos3_swapped = vec2(-uSpacing, -uSpacing);

    // --- Interpolate between default and swapped positions ---
    vec2 pos1 = uv - mix(pos1_default, pos1_swapped, uSwap);
    vec2 pos2 = uv - vec2(0.0, 0.0);
    vec2 pos3 = uv - mix(pos3_default, pos3_swapped, uSwap);

    // --- Shape properties ---
    float halfSize = 0.10;
    float cornerRadius = 0.03;

    // --- Distances for each square ---
    float d1 = sdRoundedBox(pos1, vec2(halfSize), cornerRadius);
    float d2 = sdRoundedBox(pos2, vec2(halfSize), cornerRadius);
    float d3 = sdRoundedBox(pos3, vec2(halfSize), cornerRadius);

    // --- Combine with gooey bridging ---
    float d = opSmoothUnion(d1, d2, uSmoothness);
    d = opSmoothUnion(d, d3, uSmoothness);

    // --- Color output ---
    vec3 color = vec3(0.0); // background
    float inside = smoothstep(0.005, 0.0, d);
    color = mix(color, vec3(0.0, 1.0, 0.4), inside);

    gl_FragColor = vec4(color, 1.0);
}
