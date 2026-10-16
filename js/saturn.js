// Saturn in 3D, one fragment shader: a lit planet with soft red bands that
// turn slowly, fine rings with a little sparkle and a Cassini gap, and true
// shadows (the rings' band across the planet, the planet's soft shadow across
// the rings). The motion is kept very quiet: a slow turn and a faint sway.
const VERT = `attribute vec2 a; varying vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform vec4 R;          // canvas rect (section px)
uniform vec3 C;          // planet centre x, y, radius (section px)
uniform float TIME, ROLL, INC, SPIN, RIP;
float h1(float n){ return fract(sin(n) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h1(i), h1(i + 1.), f); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
const float RI = 1.24, RO = 2.25;
float ringD(float r){
  if (r < RI || r > RO) return 0.;
  float d = .5 + .5 * sin(r * 61.) * .35 + n1(r * 140.) * .35 + n1(r * 31.) * .3;
  d *= smoothstep(RI, RI + .05, r) * (1. - smoothstep(RO - .06, RO, r));
  d *= 1. - .9 * smoothstep(1.62, 1.64, r) * (1. - smoothstep(1.69, 1.71, r));     // Cassini gap
  d *= 1. - .6 * smoothstep(2.03, 2.04, r) * (1. - smoothstep(2.06, 2.07, r));
  d *= mix(.35, 1., smoothstep(RI, 1.45, r));                                       // thin inner C ring
  return clamp(d, 0., 1.);
}
void main(){
  vec2 px = R.xy + vec2(v.x, 1. - v.y) * R.zw;
  vec2 q = (px - C.xy) / C.z; q.y = -q.y;
  vec3 ro = vec3(q, 6.), rd = vec3(0., 0., -1.);
  mat3 W = rotZ(ROLL) * rotX(INC);
  vec3 ax = W * vec3(0., 0., 1.);
  vec3 L = normalize(vec3(-.6, .45, .66));
  vec4 col = vec4(0.);
  // ---- planet
  float b = dot(ro, rd), c = dot(ro, ro) - 1., hh = b * b - c;
  float tS = 1e9;
  if (hh > 0.) {
    tS = -b - sqrt(hh);
    vec3 p = ro + rd * tS, n = normalize(p), lp = p * W;
    float lat = lp.z, lon = atan(lp.y, lp.x) + SPIN;
    float w = n2(vec2(lon * 1.6, lat * 5.)) * .5 + n2(vec2(lon * 4., lat * 14.)) * .25;
    float band = sin((lat + w * .05) * 12.5) * .5 + .5;
    float fine = sin((lat + w * .03) * 44.) * .5 + .5;
    vec3 base = mix(vec3(.9, .03, .03), vec3(1., .42, .36), smoothstep(.5, .95, band) * .8);
    base = mix(base, vec3(.72, 0., .03), smoothstep(.32, .0, band) * .45);
    base *= .94 + fine * .12;
    float dif = max(dot(n, L), 0.);
    // the rings' shadow on the planet: one clean band, as dense as the rings are
    float sh = 1.;
    float tr = -dot(p, ax) / dot(L, ax);
    if (tr > 0.) { vec3 hp = p + L * tr; sh = 1. - .78 * ringD(length(hp)); }
    float lit = smoothstep(-.05, .35, dot(n, L));
    vec3 pc = base * (.16 + .95 * dif * sh);
    pc += vec3(1., .55, .5) * pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 30.) * .2 * sh;
    float fres = pow(1. - max(n.z, 0.), 3.);
    pc += vec3(1., .25, .2) * fres * .35 * lit;                                     // lit limb glows
    col = vec4(pc, 1.);
  }
  // ---- rings
  float dn = dot(rd, ax);
  if (abs(dn) > 1e-4) {
    float t = -dot(ro, ax) / dn;
    vec3 p = ro + rd * t;
    float r = length(p);
    float d = ringD(r);
    if (d > 0. && t > 0.) {
      vec3 rc = mix(vec3(.38), vec3(.98, .97, .95), pow(n1(r * 90.) * .6 + n1(r * 23.) * .4, 1.3));
      float spark = step(.985, h2(floor(vec2(r * 900., atan(p.y, p.x) * 260. + TIME * .3)))) * (.5 + .5 * sin(TIME * 3. + r * 50.));
      rc += spark * .6;
      // the planet's soft shadow across the rings
      float tc = -dot(p, L);
      if (tc > 0.) rc *= mix(.1, 1., smoothstep(.95, 1.05, length(p + L * tc)));
      // a click: a bright wave travelling outward
      float wave = exp(-pow((r - (RI + RIP * 1.6)) * 14., 2.)) * exp(-RIP * 1.3) * step(0., RIP);
      rc += vec3(1., .5, .4) * wave * 1.2;
      float a = d * .92;
      if (t < tS) col = vec4(mix(col.rgb, rc, a), max(col.a, a));
    }
  }
  // ---- red glow round the planet
  float dd = length(q);
  if (col.a < 1.) { float g = exp(-(dd - 1.) * 4.2) * smoothstep(.98, 1.03, dd) * .5; col.rgb += vec3(1., .02, 0.) * g * (1. - col.a); col.a = max(col.a, g); }
  gl_FragColor = vec4(col.rgb * col.a, col.a);
}`;

export class Saturn {
  constructor(parent) {
    this.box = parent;
    this.c = document.createElement('canvas');
    this.c.className = 'saturn-gl';
    parent.append(this.c);
    const gl = (this.gl = this.c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }));
    this.ok = !!gl;
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this.spin = 0; this.spinV = 0.05; this.rip = -1;
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['R', 'C', 'TIME', 'ROLL', 'INC', 'SPIN', 'RIP']) this.u[n] = gl.getUniformLocation(pr, n);
    this.place(0);
  }

  // the canvas spans the visible width; the planet grows on wide screens
  place(x0) {
    const W = 1512 - 2 * x0;
    this.f = 1;                                   // Figma size, on every screen
    this.rect = [x0, 0, W, 1180];
    
    this.centre = [756, 475 - (this.f - 1) * 150, 300 * this.f];
    this.sized = false;
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    let W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    const cap = 1.5e6;
    if (W * H > cap) { const f = Math.sqrt(cap / (W * H)); W = Math.round(W * f); H = Math.round(H * f); }
    this.c.width = W; this.c.height = H;
    this.sized = true;
    return true;
  }

  draw(t, dt) {
    if (!this.ok || (!this.sized && !this.resize())) return;
    const gl = this.gl, u = this.u;
    
    // a drag spins it faster; it eases back to its own slow turn
    this.spinV = 0.04;
    this.spin += this.spinV * dt;
    if (this.rip >= 0) { this.rip += dt; if (this.rip > 3) this.rip = -1; }
    gl.viewport(0, 0, this.c.width, this.c.height);
    gl.uniform4f(u.R, ...this.rect);
    gl.uniform3f(u.C, ...this.centre);
    gl.uniform1f(u.TIME, t);
    gl.uniform1f(u.SPIN, this.spin);
    gl.uniform1f(u.RIP, this.rip);
    gl.uniform1f(u.ROLL, 0.36 + Math.sin(t * 0.1) * 0.01);
    gl.uniform1f(u.INC, 1.9 + Math.sin(t * 0.08) * 0.008);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
