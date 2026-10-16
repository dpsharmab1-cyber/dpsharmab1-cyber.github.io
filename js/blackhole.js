// The black hole, live, in the Figma art style: the frame's angle and shape
// (a wide disc rising to the right, the black sphere sitting in it), drawn
// as flat layered reds that actually turn. Every pixel's ray is traced back
// through a Schwarzschild-like pull (a = -1.5 h² r / |r|^5), so the far side
// of the disc arches over the sphere and a thin photon ring hugs its edge.
// Units: rs = 1 (horizon); the shadow reads about 2.6 rs wide.
const VERT = `attribute vec2 a; varying vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform vec2 RES;          // canvas px
uniform vec3 C;            // centre (fraction of width, fraction of height), rs in px
uniform float TIME, EL, ROLL;
const float GK = .38;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.07; a *= .5; } return s; }
const float RIN = 1.7, ROUT = 4.6;
vec4 disc(vec3 p, vec3 rd){
  float r = length(p.xz);
  if (r < RIN || r > ROUT) return vec4(0.);
  float phi = atan(p.z, p.x);
  float ang = phi + TIME * .9 / pow(r, 1.5);          // inner rings turn faster
  float u = (r - RIN) / (ROUT - RIN);
  // the frame's layers: bright red inside, two darker rims outside
  vec3 col = vec3(1., .02, .01);
  col = mix(col, vec3(.78, 0., 0.), smoothstep(.62, .64, u));
  col = mix(col, vec3(.5, 0., 0.), smoothstep(.83, .85, u));
  // fine orbiting bands, so the disc reads as alive (kept subtle, flat)
  float bands = sin(r * 26. + n2(vec2(ang * 3., r * 2.)) * 3.) * .5 + .5;
  float streak = smoothstep(.72, 1., n2(vec2(ang * 2.4, r * 7.)));
  col *= .9 + .12 * bands;
  col += vec3(1., .45, .35) * streak * .22 * (1. - u);
  // the side turning toward you is a touch brighter, and the inner edge glows
  vec3 orbit = normalize(vec3(-sin(phi), 0., cos(phi)));
  col *= 1. + .25 * dot(orbit, -rd);
  col += vec3(1., .35, .25) * smoothstep(.12, 0., u) * .45;
  float a = smoothstep(RIN, RIN + .08, r) * (1. - smoothstep(ROUT - .05, ROUT, r));
  return vec4(col, a);
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
    vec3 acc = -1.5 * GK * h2 * pos / pow(r, 5.);   // GK < 1: a gentler bend, true to the frame's flat disc
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
  // photon ring, and inside the sphere the red light of the frame's art
  float ring = exp(-pow((minR - 1.08) * 14., 2.)) * (hole ? 0. : 1.);
  col += (1. - al) * vec3(1., .12, .06) * ring * .85;
  float glow = hole ? 0. : exp(-max(minR - 1.1, 0.) * 2.6) * .18;
  col += (1. - al) * vec3(.85, 0., 0.) * glow;
  if (hole) {
    float rr = length(uv) / 1.35;
    float side = max(0., dot(normalize(uv), normalize(vec2(.62, .78))));
    col += (1. - al) * vec3(.55, 0., 0.) * pow(side, 2.2) * smoothstep(.35, 1., rr) * (.85 + .15 * sin(TIME * .7));
  }
  float A = hole ? 1. : clamp(al + ring * .85 + glow, 0., 1.);
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
    // centre and size in the 1800 x 1450 box (Figma: shadow r 340 at 1198.5, 379)
    this.cx = 998.5 / 1800; this.cy = 729 / 1450; this.rs = 200 / 1800;
    this.sized = false;
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    let W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    const cap = 1.6e6;
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
    gl.uniform1f(u.EL, 0.22 + Math.sin(t * 0.07) * 0.008);
    gl.uniform1f(u.ROLL, -0.5 + Math.sin(t * 0.05) * 0.005);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
