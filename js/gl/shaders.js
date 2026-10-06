// GLSL for the glass stage. Coordinates in fragment code are CSS px, y down.

const HEAD = `#version 300 es
precision highp float;
`;

// screen-space quad in CSS px
export const RECT_VS = HEAD + `
in vec2 a_pos;
uniform vec4 u_rect;   // x, y, w, h (css px)
uniform vec2 u_view;   // css viewport
out vec2 v_uv;
void main() {
  vec2 p = u_rect.xy + a_pos * u_rect.zw;
  v_uv = a_pos;
  gl_Position = vec4(p.x / u_view.x * 2.0 - 1.0, 1.0 - p.y / u_view.y * 2.0, 0.0, 1.0);
}`;

export const FULL_VS = HEAD + `
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos; gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`;

export const BLIT_FS = HEAD + `
in vec2 v_uv;
uniform sampler2D u_src;
out vec4 o;
void main() { o = texture(u_src, v_uv); }`;

export const BG_FS = HEAD + `
uniform vec3 u_bg;
uniform vec2 u_view;
uniform float u_dpr;
uniform float u_time;
uniform float u_dark;
out vec4 o;
void main() {
  vec2 p = gl_FragCoord.xy / u_dpr / u_view;
  o = vec4(u_bg, 1.0);
}`;

export const BLOB_FS = HEAD + `
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform float u_time;
uniform float u_seed;
uniform float u_dark;
out vec4 o;
void main() {
  vec2 uv = v_uv;
  float t = u_time * 0.16 + u_seed * 6.2831;
  // very slow low-frequency drift: the blob breathes, never wobbles
  vec2 w = vec2(sin(uv.y * 3.1 + t * 1.3) + 0.5 * sin(uv.y * 5.3 - t * 0.8),
                cos(uv.x * 2.7 + t * 1.1) + 0.5 * cos(uv.x * 6.1 + t * 0.6));
  uv += w * 0.0045;
  vec4 c = texture(u_tex, uv);
  float edge = smoothstep(0.0, 0.015, uv.x) * smoothstep(1.0, 0.985, uv.x) * smoothstep(0.0, 0.015, uv.y) * smoothstep(1.0, 0.985, uv.y);
  float a = c.a * u_alpha * edge;
  vec3 col = c.rgb;
  if (u_dark > 0.5) col = mix(col, col * vec3(1.0, 0.9, 0.9), 0.3);
  o = vec4(col * a, a);
}`;

// ---------------------------------------------------------------------------
// shared optics
const OPTICS = `
uniform sampler2D u_src;
uniform vec2 u_view;
uniform float u_dpr;
uniform float u_dark;
uniform float u_time;

vec2 cssP() { return vec2(gl_FragCoord.x, u_view.y * u_dpr - gl_FragCoord.y) / u_dpr; }
vec3 scene(vec2 p) { return texture(u_src, vec2(p.x / u_view.x, 1.0 - p.y / u_view.y)).rgb; }

vec3 spectrum(float x) {
  x = clamp(x, 0.0, 1.0) * 0.82;
  return clamp(vec3(abs(x * 6.0 - 3.0) - 1.0, 2.0 - abs(x * 6.0 - 2.0), 2.0 - abs(x * 6.0 - 4.0)), 0.0, 1.0);
}

// up to 8 taps: frost (jittered disc) + dispersion (per-tap wavelength) in one
// loop. Phones use 4; a pixel with no offset and no frost needs only one.
uniform float u_taps;
vec3 refractSample(vec2 p, vec2 off, float disp, float frost) {
  if (frost < 0.05 && dot(off, off) * disp < 0.04) return scene(p + off);
  vec3 acc = vec3(0.0), wsum = vec3(0.0);
  float n = max(u_taps, 2.0);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float wl = fi / (n - 1.0);
    float k = 1.0 + disp * (wl - 0.5) * 1.8;          // dispersion (doubled)
    float ang = fi * 2.39996 + 0.7;
    float rad = sqrt((fi + 0.5) / n) * frost;
    vec2 j = vec2(cos(ang), sin(ang)) * rad;
    vec3 w = mix(vec3(1.0), spectrum(wl) + 0.08, clamp(disp, 0.0, 1.0) * clamp(length(off) / 6.0, 0.0, 1.0));
    acc += scene(p + off * k + j) * w;
    wsum += w;
  }
  return acc / wsum;
}

// glass colour for a surface pixel.
//  d: signed distance (px, <0 inside), n: outward normal, bevel: bevel width (px)
// ---------------------------------------------------------------------------
// Glass: a port of liquidGL's lens shader (MIT, (c) NaughtyDuk,
// github.com/naughtyduk/liquidGL). An edge factor over a bevel 15 % of the short
// side, offset = edge * refraction + edge^10 * bevelDepth along the corner-aware
// direction (faded out at the centre), red / blue split by the aberration, a
// light 5-tap smoothing, and two drifting specular highlights: the shimmer.
const float LGL_REFRACTION = 0.02;   // liquidGL refraction (doubled)
const float LGL_BEVEL_DEPTH = 0.16;  // liquidGL bevelDepth (doubled)
const float LGL_BEVEL_WIDTH = 0.15;  // liquidGL bevelWidth
const float LGL_ABERRATION = 0.6;    // liquidGL aberration

vec2 lglCornerNormal(vec2 p, vec2 b, float r, vec2 fallback) {
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float l = length(m);
  if (l <= 0.0) return fallback;
  float w = smoothstep(0.0, max(r * 0.5, 1.0), min(m.x, m.y));
  if (w <= 0.0) return fallback;
  vec2 sg = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  return normalize(mix(fallback, sg * (m / l), w));
}

// the shimmer: two soft highlights drifting over the pane (uv 0..1)
float lglShimmer(vec2 uv, float seed) {
  float t = u_time + seed;
  vec2 lp1 = vec2(sin(t * 0.2), cos(t * 0.3)) * 0.6 + 0.5;
  vec2 lp2 = vec2(sin(t * -0.4 + 1.5), cos(t * 0.25 - 0.5)) * 0.6 + 0.5;
  return smoothstep(0.4, 0.0, distance(uv, lp1)) * 0.1 + smoothstep(0.5, 0.0, distance(uv, lp2)) * 0.08;
}

vec3 glassShade(vec2 p, vec2 q, vec2 halfSz, float d, vec2 n, float bevel, float refr, float disp,
                float frost, float splay, vec4 fill, vec4 tint, vec3 light, float strength) {
  float minSide = 2.0 * min(halfSz.x, halfSz.y);
  // liquidGL sizes the bevel to the pane; on page-wide sheets that becomes a
  // 60 px smear, so the band and the bend are capped for very large panes
  float bevelPx = min(LGL_BEVEL_WIDTH * minSide, 34.0);
  float edge = 1.0 - smoothstep(0.0, bevelPx, -d);
  float scale = min(u_view.x, u_view.y);
  float offsetAmt = (edge * LGL_REFRACTION * refr + pow(edge, 10.0) * LGL_BEVEL_DEPTH) * scale * strength;
  offsetAmt = min(offsetAmt, bevelPx * 1.4);
  vec2 pn = q / max(2.0 * halfSz.y, 1.0);
  float centreBlend = smoothstep(0.15, 0.45, length(pn));
  float rad = min(halfSz.x, halfSz.y);
  vec2 dir = lglCornerNormal(q, halfSz, min(bevel * 4.0, rad), normalize(pn + 1e-6));
  vec2 offset = -dir * offsetAmt * centreBlend;           // in towards the centre, like a lens
  vec2 s = p + offset;
  vec2 chroma = offset * LGL_ABERRATION * disp;
  vec3 col = (scene(s) + scene(s + vec2(1.0, 0.0)) + scene(s - vec2(1.0, 0.0)) + scene(s + vec2(0.0, 1.0)) + scene(s - vec2(0.0, 1.0))) / 5.0;
  col.r = scene(s - chroma).r;
  col.b = scene(s + chroma).b;
  col = mix(col, fill.rgb, fill.a);
  col = mix(col, tint.rgb, tint.a);
  vec2 uv = q / max(2.0 * halfSz, vec2(1.0)) + 0.5;
  col += lglShimmer(uv, dot(p - q, vec2(0.013, 0.007)) * 9.0) * strength;
  return col;
}
`;

export const GLASS_FS = HEAD + OPTICS + `
uniform vec2 u_center;
uniform vec2 u_half;
uniform vec4 u_radius;     // br, tr, bl, tl
uniform vec4 u_optics;     // refraction, bevel px, dispersion, frost px
uniform float u_splay;
uniform vec4 u_fill;
uniform vec4 u_tint;
uniform vec3 u_light;
uniform vec4 u_shadow;     // offsetY, blur, alpha, spread
uniform float u_opacity;
out vec4 o;

float sdRB(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}

void main() {
  vec2 p = cssP();
  vec2 q = p - u_center;
  float d = sdRB(q, u_half, u_radius);
  float sd = sdRB(q - vec2(0.0, u_shadow.x), u_half + u_shadow.w, u_radius);
  float sh = u_shadow.z * (1.0 - smoothstep(-u_shadow.y * 0.6, u_shadow.y, sd)) * u_opacity;
  float a = clamp(0.5 - d * u_dpr, 0.0, 1.0) * u_opacity;
  if (a <= 0.0) { o = vec4(0.0, 0.0, 0.0, sh); return; }
  vec2 ex = vec2(0.6, 0.0);
  vec2 n = normalize(vec2(sdRB(q + ex, u_half, u_radius) - sdRB(q - ex, u_half, u_radius),
                          sdRB(q + ex.yx, u_half, u_radius) - sdRB(q - ex.yx, u_half, u_radius)) + 1e-6);
  float bevel = min(u_optics.y, min(u_half.x, u_half.y));
  vec3 col = glassShade(p, q, u_half, d, n, bevel, u_optics.x, u_optics.z, u_optics.w, u_splay,
                        u_fill, u_tint, u_light, sqrt(u_opacity));
  o = vec4(col * a, a) + vec4(0.0, 0.0, 0.0, sh) * (1.0 - a);
}`;

// ---------------------------------------------------------------------------
// the wheel logo: ring / petals / hub as SDF glass, sanskrit text engraved
export const LOGO_FS = HEAD + OPTICS + `
uniform sampler2D u_logo;
uniform vec2 u_center;
uniform float u_scale;       // css px per logo unit
uniform vec3 u_ang;          // ring+outer text, inner text, petals
uniform float u_bloom;       // petals 0..1
uniform float u_opacity;
uniform vec4 u_clip;         // section bounds (css px): x0, y0, x1, y1
uniform vec3 u_light;
out vec4 o;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec4 tap(vec2 u) {
  vec2 uv = (u + 262.5) / 525.0;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture(u_logo, uv);
}
float dist(float v) { return (0.5 - v) * 28.0; }

// the wheel keeps its own glass: refraction through a round bevel with spectral
// dispersion and a crisp rim (liquidGL's pane lens over-splits a red backdrop)
vec3 wheelGlass(vec2 p, float d, vec2 n, float bevel, float refr, float splay, vec2 q, float rad, vec4 fill, vec3 light, float strength) {
  float e = clamp(1.0 + d / bevel, 0.0, 1.0);
  float h = 1.0 - sqrt(max(1.0 - e * e, 0.0));
  vec2 off = -n * h * bevel * 1.8 * refr * strength - q / max(rad, 1.0) * splay * 14.0 * strength;
  vec3 col = refractSample(p, off, strength, 0.0);
  col = mix(col, fill.rgb, fill.a);
  vec2 L = normalize(light.xy);
  float lit = max(dot(n, L), 0.0);
  float rim = 1.0 - smoothstep(0.0, 1.1, -d);
  col = mix(col, vec3(1.0), rim * (0.25 + 0.55 * lit) * light.z * strength);
  return col;
}

void main() {
  vec2 p = cssP();
  if (p.x < u_clip.x || p.y < u_clip.y || p.x > u_clip.z || p.y > u_clip.w) discard;
  vec2 u = (p - u_center) / u_scale;
  float r = length(u);
  vec2 uR = rot(u_ang.x) * u;
  vec2 uP = rot(u_ang.z) * u / max(u_bloom, 0.05);
  float dR = dist(tap(uR).r) * u_scale;
  float dP = dist(tap(uP).g) * u_scale * max(u_bloom, 0.05);
  float dH = dist(tap(u).b) * u_scale;
  float tR = tap(uR).a, tI = tap(rot(u_ang.y) * u).a;
  float text = r > 200.0 ? tR : tI;

  // normals from screen derivatives (computed for every layer, outside branches)
  vec2 nR = normalize(vec2(dFdx(dR), -dFdy(dR)) + 1e-6);
  vec2 nP = normalize(vec2(dFdx(dP), -dFdy(dP)) + 1e-6);
  vec2 nH = normalize(vec2(dFdx(dH), -dFdy(dH)) + 1e-6);

  float aR = clamp(0.5 - dR * u_dpr, 0.0, 1.0);
  float aP = clamp(0.5 - dP * u_dpr, 0.0, 1.0) * smoothstep(0.0, 0.25, u_bloom);
  float aH = clamp(0.5 - dH * u_dpr, 0.0, 1.0);

  float st = sqrt(u_opacity);
  vec4 noTint = vec4(0.0);
  vec3 base = scene(p);
  vec3 col = base;
  float alpha = 0.0;
  vec2 hs = vec2(242.5 * u_scale);
  if (aR > 0.0) {
    vec3 g = wheelGlass(p, dR, nR, 9.0 * u_scale, 1.0, 0.0, p - u_center, hs.x,
                        vec4(0.82, 0.82, 0.84, u_dark > 0.5 ? 0.10 : 0.28), u_light, st);
    col = mix(col, g, aR); alpha = max(alpha, aR);
  }
  if (aP > 0.0) {
    vec3 g = wheelGlass(p, dP, nP, 7.0 * u_scale, 1.0, 0.3, p - u_center, hs.x,
                        vec4(0.88, 0.88, 0.91, u_dark > 0.5 ? 0.06 : 0.34), u_light, st);
    col = mix(col, g, aP); alpha = max(alpha, aP);
  }
  if (aH > 0.0) {
    vec3 g = wheelGlass(p, dH, nH, 12.0 * u_scale, 1.2, 0.6, p - u_center, 30.0 * u_scale,
                        vec4(0.8, 0.8, 0.82, u_dark > 0.5 ? 0.12 : 0.3), u_light, st);
    col = mix(col, g, aH); alpha = max(alpha, aH);
  }
  // engraved text: multiply grey in light, soft silver in dark
  vec3 ink = u_dark > 0.5 ? vec3(0.62) : vec3(0.70);
  float ta = text * 0.92;
  col = u_dark > 0.5 ? mix(col, ink, ta) : mix(col, col * ink, ta);
  alpha = max(alpha, ta);
  // soft drop shadow from the ring + hub
  float shR = (1.0 - smoothstep(-2.0 * u_scale, 10.0 * u_scale, dist(tap(rot(u_ang.x) * (u - vec2(0.0, 4.0))).r) * u_scale)) * 0.0;
  float a = alpha * u_opacity;
  vec4 glassC = vec4(col * a, a);
  float shA = shR * (1.0 - alpha) * u_opacity;
  o = glassC + vec4(0.0, 0.0, 0.0, shA);
}`;

// ---------------------------------------------------------------------------
// folder card: back panel, three papers and a glass pocket, all in one pass.
// Rendered through the same CSS matrix3d as its DOM twin.
export const FOLDER_VS = HEAD + `
in vec2 a_pos;
uniform mat4 u_m;       // css matrix (css px, y down) incl. perspective
uniform vec2 u_size;    // local card size
uniform vec2 u_view;
uniform float u_pad;
out vec2 v_local;
void main() {
  vec2 l = -u_pad + a_pos * (u_size + 2.0 * u_pad);
  v_local = l;
  vec4 c = u_m * vec4(l, 0.0, 1.0);
  gl_Position = vec4(2.0 * c.x / u_view.x - c.w, c.w - 2.0 * c.y / u_view.y, 0.0, c.w);
}`;

export const FOLDER_FS = HEAD + OPTICS + `
in vec2 v_local;
uniform vec4 u_clip;      // x0, y0, x1, y1
uniform float u_clipR;
uniform vec2 u_size;
uniform float u_scale;    // local -> screen px (approx)
uniform float u_blur;     // depth of field, px
uniform float u_open;     // 0..1
uniform float u_hover;    // 0..1
uniform float u_opacity;
uniform vec3 u_light;
uniform float u_seed;
uniform float u_lift;     // how far the papers rise when open
out vec4 o;

float sdRB(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float aw;  // anti-alias width in local px (grows with blur)
float cov(float d) { return 1.0 - smoothstep(-aw, aw, d); }

// Figma "folders section update": local card 360 x 316 (frame px), origin at
// the pocket's top-left corner minus the paper overhang. A tabbed back strip,
// three grey papers (black 20 %) with soft drop shadows, and a tapered pocket of
// dark glass (fill #000 20 %, frost 4, refraction / depth / dispersion / splay 100).
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }

float sdBack(vec2 l) {
  float mb = sdBox(l - vec2(180.25, 71.9), vec2(160.65, 38.1), 17.5);
  float tab = sdBox(l - vec2(84.8, 33.35), vec2(65.2, 26.65), 17.5);
  return smin(mb, tab, 18.0);
}

// isosceles trapezoid (iq), y down: half widths at the top and bottom edges
float sdTrap(vec2 p, float rTop, float rBot, float he) {
  p.y = -p.y;
  vec2 k1 = vec2(rTop, he), k2 = vec2(rTop - rBot, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? rBot : rTop), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float sg = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return sg * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
const vec2 PC = vec2(180.2, 204.35);     // pocket centre (top 93.3, bottom 315.4)
float sdPocket(vec2 l) { return sdTrap(l - PC, 180.2 - 22.0, 169.35 - 22.0, 111.05 - 22.0) - 22.0; }

// Every part of the folder is glass (Figma: black 20 % fills over the scene):
// the back strip and the three notes let the page show through, bend it in
// along their rims with a slight red / blue split, and carry a crisp rim light
// and the drifting shimmer. The notes' lines are etched a little darker.
vec2 sdGrad(vec2 l, float d0, float dx, float dy) { return normalize(vec2(dx - d0, dy - d0) + 1e-6); }

// the back strip as glass over the scene (no papers): what the notes refract
vec3 backLayer(vec2 l, vec2 p) {
  vec3 c = scene(p);
  float d = sdBack(l);
  float a = cov(d);
  if (a <= 0.0) return c;
  return mix(c, c * 0.86, a);
}

// back strip glass at this pixel (with its rim bend + light)
vec3 backGlass(vec2 l, vec2 p, out float a) {
  vec3 c = scene(p);
  float d = sdBack(l);
  a = cov(d);
  if (a <= 0.0) return c;
  vec2 n = sdGrad(l, d, sdBack(l + vec2(0.7, 0.0)), sdBack(l + vec2(0.0, 0.7)));
  float edge = 1.0 - smoothstep(0.0, 14.0, -d);
  vec3 g = c;
  if (edge > 0.01) {
    vec2 off = -n * edge * edge * 12.0, ch = off * 0.4;
    g = vec3(scene(p + (off - ch) * u_scale).r, scene(p + off * u_scale).g, scene(p + (off + ch) * u_scale).b);
  }
  g *= 0.86;                                                     // black 14 %
  float rim = 1.0 - smoothstep(0.0, 1.4 + aw * 1.5, -d);
  g += rim * (0.32 + 0.22 * clamp(dot(-n, vec2(0.45, 0.9)), 0.0, 1.0));
  g += lglShimmer(l / vec2(360.0, 110.0), u_seed * 3.0) * 0.8;
  return mix(c, g, a);
}

float paperSD(vec2 l, vec2 c, float ang) { return sdBox(rot(ang) * (l - c), vec2(76.84, 106.79), 5.0); }

// one glass note over col; adds its drop shadow to sh
float paper(vec2 l, vec2 p, vec2 c, float ang, inout vec3 col, inout float sh) {
  vec2 hs = vec2(76.84, 106.79);
  vec2 q = rot(ang) * (l - c);
  float d = sdBox(q, hs, 5.0);
  float ds = paperSD(l - vec2(0.0, 4.0), c, ang);
  float s = (1.0 - smoothstep(-6.2, 12.4 + u_blur * 2.0, ds)) * 0.1;
  sh = max(sh, s);
  col *= 1.0 - s * (1.0 - cov(d));
  float a = cov(d);
  if (a <= 0.0) return 0.0;
  vec2 n = sdGrad(l, d, paperSD(l + vec2(0.7, 0.0), c, ang), paperSD(l + vec2(0.0, 0.7), c, ang));
  // inside: what is already there (the notes beneath stay visible through it);
  // along the rim: the scene bent inwards, split red / blue
  vec3 g = col;
  float edge = 1.0 - smoothstep(0.0, 16.0, -d);
  if (edge > 0.01) {
    vec2 off = -n * edge * edge * 13.0, ch = off * 0.4;
    vec3 bent = vec3(backLayer(l + off - ch, p + (off - ch) * u_scale).r,
                     backLayer(l + off, p + off * u_scale).g,
                     backLayer(l + off + ch, p + (off + ch) * u_scale).b);
    g = mix(g, bent, edge * 0.85);
  }
  g *= 0.8;                                                      // black 20 %
  // the note's lines, etched into the glass
  vec2 u = q + hs;
  float m = cov(sdBox(u - vec2(42.96, 20.45), vec2(32.56, 6.41), 6.41));
  for (int i = 0; i < 3; i++) {
    float y = 47.89 + float(i) * 15.85;
    m = max(m, cov(sdBox(u - vec2(76.82, y), vec2(66.42, 5.29), 5.29)));
  }
  for (int i = 0; i < 5; i++) {
    float y = 94.01 + float(i) * 12.7;
    m = max(m, cov(sdBox(u - vec2(42.46, y), vec2(32.5, 2.31), 2.31)));
    m = max(m, cov(sdBox(u - vec2(110.6, y), vec2(32.5, 2.31), 2.31)));
  }
  m = max(m, cov(sdBox(u - vec2(76.78, 177.79), vec2(66.42, 22.79), 22.79)));
  m = max(m, cov(length(u - vec2(131.05, 25.77)) - 11.72));
  g = mix(g, g * 0.78, m);
  float rim = 1.0 - smoothstep(0.0, 1.3 + aw * 1.5, -d);
  g += rim * (0.34 + 0.24 * clamp(dot(-n, vec2(0.45, 0.9)), 0.0, 1.0));
  g += lglShimmer(u / (2.0 * hs), u_seed * 5.0 + c.x * 0.01) * 0.9;
  col = mix(col, g, a);
  return a;
}

// the three notes over col (left, right, then the middle one on top)
float papers(vec2 l, vec2 p, inout vec3 col, inout float sh) {
  float lift = -10.0 * u_hover - 16.0 * u_open * u_lift;
  float fan = 1.0 + 0.18 * u_hover;
  float a1 = paper(l, p, vec2(104.5 - 5.0 * u_hover, 125.3 + lift), -0.3176 * fan, col, sh);
  float a2 = paper(l, p, vec2(269.1 + 5.0 * u_hover, 135.4 + lift), 0.1682 * fan, col, sh);
  float a3 = paper(l, p, vec2(198.2, 123.0 + lift * 1.2), 0.0, col, sh);
  return max(a1, max(a2, a3));
}

// what you see behind the pocket at local point l / screen point p
vec3 behind(vec2 l, vec2 p) {
  float aB;
  vec3 col = backGlass(l, p, aB);
  float sh = 0.0;
  papers(l, p, col, sh);
  return col;
}

void main() {
  vec2 l = v_local;
  vec2 p = cssP();
  aw = 0.7 / max(u_scale, 0.3) + u_blur * 1.6;
  // ---- back strip + notes, all glass
  float aB;
  vec3 col = backGlass(l, p, aB);
  float sh = 0.0;
  float aPapers = papers(l, p, col, sh);

  // ---- pocket glass
  float dPk = sdPocket(l);
  float aPk = cov(dPk);
  if (aPk > 0.0) {
    vec2 ex = vec2(0.6, 0.0);
    vec2 n = normalize(vec2(sdPocket(l + ex) - sdPocket(l - ex), sdPocket(l + ex.yx) - sdPocket(l - ex.yx)) + 1e-6);
    // liquidGL lens on the pocket (local px; 360 x 222 face)
    float edge = 1.0 - smoothstep(0.0, LGL_BEVEL_WIDTH * 222.0, -dPk);
    float scaleL = min(u_view.x, u_view.y) / max(u_scale, 0.3);
    float offsetAmt = (edge * LGL_REFRACTION + pow(edge, 10.0) * LGL_BEVEL_DEPTH) * scaleL;
    vec2 pn = (l - PC) / 222.0;
    float centreBlend = smoothstep(0.15, 0.45, length(pn));
    vec2 offL = -n * offsetAmt * centreBlend;
    vec2 ch = offL * LGL_ABERRATION;
    vec3 g = behind(l + offL, p + offL * u_scale);
    g.r = behind(l + offL - ch, p + (offL - ch) * u_scale).r;
    g.b = behind(l + offL + ch, p + (offL + ch) * u_scale).b;
    g = mix(g, g * 0.0, u_dark > 0.5 ? 0.3 : 0.2);                  // tint #000, 20 %
    g += lglShimmer((l - PC) / vec2(360.0, 222.0) + 0.5, u_seed * 7.0);
    col = mix(col, g, aPk);
  }
  float a = max(max(aB, aPapers), aPk) * u_opacity;
  o = vec4(col * a, a) + vec4(0.0, 0.0, 0.0, sh * u_opacity) * (1.0 - a);
  // masked to the glass sheet it sits on (rounded rect, css px)
  vec2 cp = cssP();
  vec2 cq = abs(cp - (u_clip.xy + u_clip.zw) * 0.5) - (u_clip.zw - u_clip.xy) * 0.5 + u_clipR;
  float cd = min(max(cq.x, cq.y), 0.0) + length(max(cq, 0.0)) - u_clipR;
  o *= clamp(0.5 - cd * u_dpr, 0.0, 1.0);
}`;
