#ifdef GL_ES
precision highp float;
#endif

// Global uniforms
uniform vec2 uResolution;
uniform float uTime;

// Individual square positions
uniform vec2 uSquare1Pos;
uniform vec2 uSquare2Pos;
uniform vec2 uSquare3Pos;

// Note: Rotation and scale uniforms removed - not currently used

// Shape properties
uniform float uSquareSize;
uniform float uCornerRadius;

// Gooey effect properties
uniform float uSmoothness;

// Distance-aware gooey controls
uniform float uMaxGooeyDistance;     // Maximum distance for any connection
uniform float uMinGooeyDistance;     // Distance where falloff starts  
uniform float uMinConnectionStrength; // Minimum strength multiplier (0.0-1.0)
uniform float uConnectionRange;      // Range where minimum strength is guaranteed

// Note: uSwap uniform removed - animation now handled in JavaScript

// Note: Removed unused blending functions (remap, remapClamped, smoothRange, gooeyBlend)
// These were experimental but opSmoothUnion works better for our use case

// --- SDF Functions ---
// Rounded rectangle SDF
float sdRoundedBox(vec2 p, vec2 size, float radius) {
    vec2 d = abs(p) - size + vec2(radius);
    return length(max(d, 0.0)) - radius;
}

// Individual square SDF (simplified - position only)
float squareSDF(vec2 uv, vec2 pos, float size, float cornerRadius) {
    vec2 p = uv - pos;  // Simple translation
    return sdRoundedBox(p, vec2(size), cornerRadius);
}

// --- Smooth union for combining SDF shapes ---
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    // --- Use uniform positions directly (JavaScript-controlled) ---
    vec2 pos1 = uSquare1Pos;
    vec2 pos2 = uSquare2Pos;
    vec2 pos3 = uSquare3Pos;

    // --- Calculate individual square distances ---
    float d1 = squareSDF(uv, pos1, uSquareSize, uCornerRadius);
    float d2 = squareSDF(uv, pos2, uSquareSize, uCornerRadius);
    float d3 = squareSDF(uv, pos3, uSquareSize, uCornerRadius);

    // --- Calculate distances between square centers ---
    float dist12 = distance(pos1, pos2);  // Distance between square 1 and 2
    float dist13 = distance(pos1, pos3);  // Distance between square 1 and 3
    float dist23 = distance(pos2, pos3);  // Distance between square 2 and 3

    // --- Calculate distance-aware gooey strength (fully controllable) ---
    // Calculate base gooey strengths using controllable parameters
    float gooeyStrength12 = uSmoothness * (1.0 - smoothstep(uMinGooeyDistance, uMaxGooeyDistance, dist12));
    float gooeyStrength13 = uSmoothness * (1.0 - smoothstep(uMinGooeyDistance, uMaxGooeyDistance, dist13));
    float gooeyStrength23 = uSmoothness * (1.0 - smoothstep(uMinGooeyDistance, uMaxGooeyDistance, dist23));
    
    // Apply minimum connection strength for close squares (controllable range and strength)
    float minStrength = uSmoothness * uMinConnectionStrength;
    gooeyStrength12 = max(gooeyStrength12, minStrength * (1.0 - step(uConnectionRange, dist12)));
    gooeyStrength13 = max(gooeyStrength13, minStrength * (1.0 - step(uConnectionRange, dist13)));
    gooeyStrength23 = max(gooeyStrength23, minStrength * (1.0 - step(uConnectionRange, dist23)));

    // --- Combine with distance-aware gooey blending ---
    // Back to opSmoothUnion - it works reliably
    float d = opSmoothUnion(d1, d2, gooeyStrength12);
    
    // Add square 3 with dynamic strength
    float gooeyStrength3 = max(gooeyStrength13, gooeyStrength23);
    d = opSmoothUnion(d, d3, gooeyStrength3);

    // --- Color output ---
    vec3 color = vec3(0.0); // background
    float inside = smoothstep(0.001, 0.0, d); // Sharp, clean edges
    color = mix(color, vec3(0.0, 1.0, 0.4), inside);

    gl_FragColor = vec4(color, 1.0);
}
