// Custom GLSL shaders for Ward of the Fallen Field

export const wardVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Pulsing protective glyph ward — concentric rings + rotating rune ticks
export const wardFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uProgress; // 0 -> spawning, 1 -> fully active, then fades
  uniform vec3  uColor;
  uniform vec3  uColor2;
  uniform float uIntensity;

  float ring(float d, float r, float w) {
    return smoothstep(w, 0.0, abs(d - r));
  }

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0; // 0 center -> 1 edge
    float ang = atan(p.y, p.x);

    // expanding burst on spawn
    float burst = smoothstep(uProgress, uProgress - 0.15, d);

    // pulsing inner glow
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
    float core = smoothstep(0.55, 0.0, d) * (0.35 + 0.4 * pulse);

    // animated outer ring
    float outer = ring(d, 0.86, 0.05) * (0.8 + 0.2 * pulse);
    float mid   = ring(d, 0.62 + 0.03 * sin(uTime * 2.0), 0.025);

    // rotating rune ticks around the rim
    float ticks = abs(sin(ang * 12.0 + uTime * 1.5));
    ticks = smoothstep(0.85, 1.0, ticks) * ring(d, 0.78, 0.06);

    float glyph = core + outer + mid + ticks;
    glyph *= burst;

    vec3 col = mix(uColor, uColor2, d);
    col += uColor2 * ticks * 1.5;

    float alpha = clamp(glyph, 0.0, 1.0) * uIntensity;
    // soft fade at very edge
    alpha *= smoothstep(1.02, 0.95, d);

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

// Ground fog patch — drifting alpha noise, fades in/out
export const fogVertex = wardVertex;

export const fogFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;

  // cheap value noise
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0; float amp = 0.5;
    for (int i = 0; i < 4; i++){ v += amp * noise(p); p *= 2.0; amp *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.04;
    float n = fbm(uv * 3.0 + vec2(t, t * 0.5));
    n *= fbm(uv * 6.0 - vec2(t * 0.7, t));

    float edge = smoothstep(0.5, 0.0, length(vUv - 0.5));
    float a = n * edge * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;
