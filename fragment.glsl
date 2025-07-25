#ifdef GL_ES
precision highp float;
#endif

// Global uniforms
uniform vec2 uResolution;
uniform float uTime;

// Independent square positions
uniform vec2 uSquare1Pos;
uniform vec2 uSquare2Pos;
uniform vec2 uSquare3Pos;

// Shape properties
uniform float uSquareSize;
uniform float uCornerRadius;

// Gooey effect properties
uniform float uSmoothness;   // thickness (fixed)
uniform float uElasticity;   // user control (default 1.0)

// Distance-aware gooey controls
uniform float uMaxGooeyDistance;
uniform float uMinGooeyDistance;
uniform float uMinConnectionStrength;
uniform float uConnectionRange;

// --- Rounded rectangle SDF ---
float sdRoundedBox(vec2 p, vec2 size, float radius) {
    vec2 d = abs(p) - size + vec2(radius);
    return length(max(d, 0.0)) - radius;
}

// --- Square SDF wrapper ---
float squareSDF(vec2 uv, vec2 pos, float size, float cornerRadius) {
    vec2 p = uv - pos;
    return sdRoundedBox(p, vec2(size), cornerRadius);
}

// --- Smooth union for thickness ---
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// --- Gooey union with gum elasticity ---
float gooeyUnion(float d1, float d2, float centerDistance, float smoothness) {
    // --- Gum-like stretch factor ---
    float stretchNorm = clamp(centerDistance / uMaxGooeyDistance, 0.0, 1.0);
    float gumFactor   = pow(stretchNorm, 1.5);   // strong response as distance grows

    // --- Adjusted mask fade zone ---
    float connectionMask = 1.0 - smoothstep(
        uMinGooeyDistance,
        uMaxGooeyDistance * (1.0 + gumFactor) * uElasticity,
        centerDistance
    );

    // --- Apply union with fixed thickness ---
    float unioned = opSmoothUnion(d1, d2, smoothness);
    return mix(min(d1, d2), unioned, connectionMask);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    // Square positions
    vec2 pos1 = uSquare1Pos;
    vec2 pos2 = uSquare2Pos;
    vec2 pos3 = uSquare3Pos;

    // Distances between centers
    float dist12 = distance(pos1, pos2);
    float dist23 = distance(pos2, pos3);

    // Shape SDFs
    float d1 = squareSDF(uv, pos1, uSquareSize, uCornerRadius);
    float d2 = squareSDF(uv, pos2, uSquareSize, uCornerRadius);
    float d3 = squareSDF(uv, pos3, uSquareSize, uCornerRadius);

    // --- Independent unions (each bridge uses its own gum factor) ---
    float d12 = gooeyUnion(d1, d2, dist12, uSmoothness);
    float d   = gooeyUnion(d12, d3, dist23, uSmoothness);

    // Color output
    float inside = smoothstep(0.001, 0.0, d);
    vec3 color   = mix(vec3(0.0), vec3(0.0, 1.0, 0.4), inside);

    gl_FragColor = vec4(color, 1.0);
}