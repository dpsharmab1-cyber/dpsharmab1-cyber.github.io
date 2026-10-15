// The black hole, in 3D. Every pixel's ray of light is traced back through a
// Schwarzschild-like pull (a = -1.5 h² r / |r|^5), so light from the far side
// of the disc bends over and under the shadow, the way Interstellar showed
// it. The disc is red, hottest at its inner edge, spins (faster inside), and
// is brighter on the side turning toward you. A thin photon ring hugs the
// shadow. Units: rs = 1 (horizon); the shadow reads about 2.6 rs wide.
const VERT = `attribute vec2 a; varying vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform vec2 RES;          // canvas px
uniform vec3 C;            // centre (fraction of width, fraction of height), rs in px
uniform float TIME, EL, ROLL;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.07; a *= .5; } return s; }
const float RIN = 2.3, ROUT = 5.8;
vec4 disc(vec3 p, vec3 rd){
  float r = length(p.xz);
  if (r < RIN || r > ROUT) return vec4(0.);
  float phi = atan(p.z, p.x);
  float w = 1.1 / pow(r, 1.5);                       // faster inside
  float ang = phi + TIME * w;
  float t = fbm(vec2(r * 3.2, ang * 2.2)) * .65 + fbm(vec2(r * 9., ang * 5.)) * .35;
  float heat = pow(RIN / r, 1.6);
  vec3 col = mix(vec3(.38, 0., 0.), vec3(1., .07, .04), smoothstep(.15, .55, heat));
  col = mix(col, vec3(1., .62, .5), smoothstep(.62, 1., heat) * .85);
  vec3 orbit = normalize(vec3(-sin(phi), 0., cos(phi)));
  float dop = dot(orbit, -rd);                       // turning toward you
  float beam = pow(1. + .55 * dop, 3.);
  float edge = smoothstep(RIN, RIN + .25, r) * (1. - smoothstep(ROUT - 1.4, ROUT, r));
  float a = edge * (.45 + .55 * t);
  return vec4(col * (.55 + .9 * t) * beam * (.7 + 1.3 * heat), a);
}
void main(){
  vec2 px = v * RES;
  vec2 uv = (px - vec2(C.x * RES.x, (1. - C.y) * RES.y)) / C.z;
  float cr = cos(ROLL), sr = sin(ROLL);
  uv = vec2(cr * uv.x - sr * uv.y, sr * uv.x + cr * uv.y);
  vec3 f = normalize(vec3(0., -sin(EL), -cos(EL)));
  vec3 rt = vec3(1., 0., 0.), up = cross(rt, f);
  vec3 pos = -f * 26. + rt * uv.x + up * uv.y, vel = f;
  float h2 = dot(cross(pos, vel), cross(pos, vel));
  vec3 col = vec3(0.); float al = 0., minR = 1e3; bool hole = false;
  for (int i = 0; i < 110; i++) {
    float r = length(pos);
    minR = min(minR, r);
    if (r < 1.) { hole = true; break; }
    if (r > 30. && dot(pos, vel) > 0.) break;
    float dt = clamp(.06 * r, .03, .9);
    vec3 acc = -1.5 * h2 * pos / pow(r, 5.);
    vec3 prev = pos;
    vel += acc * dt;
    pos += vel * dt;
    if (prev.y * pos.y < 0.) {                       // crossed the disc plane
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      vec4 d = disc(hit, normalize(vel));
      col += (1. - al) * d.rgb * d.a; al += (1. - al) * d.a;
      if (al > .98) break;
    }
  }
  float ring = exp(-pow((minR - 1.55) * 7., 2.)) * (hole ? 0. : 1.);
  col += (1. - al) * vec3(1., .2, .12) * ring * .9;
  float glow = hole ? 0. : exp(-max(minR - 1.6, 0.) * 1.6) * .22;
  col += (1. - al) * vec3(.9, 0., 0.) * glow;
  float A = hole ? 1. : clamp(al + ring * .9 + glow, 0., 1.);
  gl_FragColor = vec4(col, A);
}`;

export class BlackHole {
  constructor(parent) {
    this.c = document.createElement('canvas');
    this.c.className = 'bh-gl';
    parent.append(this.c);
    const gl = (this.gl = this.c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }));
    this.ok = !!gl;
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['RES', 'C', 'TIME', 'EL', 'ROLL']) this.u[n] = gl.getUniformLocation(pr, n);
    // centre and size in the 1400 x 1180 box (Figma: shadow r 340 at 1198.5, 379)
    this.cx = 638.5 / 1400; this.cy = 579 / 1180; this.rs = 112 / 1400;
    this.sized = false;
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    let W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    const cap = 1.3e6;
    if (W * H > cap) { const f = Math.sqrt(cap / (W * H)); W = Math.round(W * f); H = Math.round(H * f); }
    this.c.width = W; this.c.height = H;
    this.sized = true;
    return true;
  }

  draw(t) {
    if (!this.ok || (!this.sized && !this.resize())) return;
    const gl = this.gl, u = this.u;
    gl.viewport(0, 0, this.c.width, this.c.height);
    gl.uniform2f(u.RES, this.c.width, this.c.height);
    gl.uniform3f(u.C, this.cx, this.cy, this.rs * this.c.width);
    gl.uniform1f(u.TIME, t);
    gl.uniform1f(u.EL, 0.2 + Math.sin(t * 0.07) * 0.015);
    gl.uniform1f(u.ROLL, -0.58 + Math.sin(t * 0.05) * 0.01);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
