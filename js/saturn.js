// Saturn in 3D, drawn by one fragment shader: a lit sphere with red bands
// that turn slowly, rings of fine grey and white stripes, the rings' shadow on
// the planet and the planet's shadow on the rings, and a red glow around it.
// It replaces the flat Figma planet but keeps its colours, size and tilt.
const VERT = `attribute vec2 a; varying vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform vec4 R;          // canvas rect (section px)
uniform vec3 C;          // planet centre x, y, radius (section px)
uniform float TIME, ROLL, INC;
float h1(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h1(i), h1(i + 1.), f); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
void main(){
  vec2 px = R.xy + vec2(v.x, 1. - v.y) * R.zw;
  vec2 q = (px - C.xy) / C.z;              // planet radii, y down
  q.y = -q.y;
  vec3 ro = vec3(q, 4.), rd = vec3(0., 0., -1.);
  mat3 W = rotZ(ROLL) * rotX(INC);         // planet frame -> view
  vec3 ax = W * vec3(0., 0., 1.);          // ring normal / spin axis
  vec3 L = normalize(vec3(-.55, .5, .65));
  vec4 col = vec4(0.);
  // sphere
  float b = dot(ro, rd), c = dot(ro, ro) - 1., h = b * b - c;
  float tS = 1e9; vec3 planet = vec3(0.);
  if (h > 0.) {
    tS = -b - sqrt(h);
    vec3 p = ro + rd * tS, n = normalize(p);
    vec3 lp = p * W;                       // into planet frame
    float lat = lp.z;
    float lon = atan(lp.y, lp.x) + TIME * .05;
    // clean latitude bands, lightly stirred along the longitude so the turn reads
    float w = n1(lon * 2.5 + lat * 6.) * .35;
    float band = sin((lat + w * .08) * 13.) * .5 + .5;
    float fine = sin((lat + w * .05) * 47.) * .5 + .5;
    vec3 base = mix(vec3(.93, .02, .02), vec3(1., .38, .34), smoothstep(.55, .95, band) * .85);
    base = mix(base, vec3(.78, 0., .02), smoothstep(.35, .0, band) * .5);
    base = mix(base, base * 1.12, fine * .25);
    float dif = max(dot(n, L), 0.);
    float rim = pow(1. - max(n.z, 0.), 2.5);
    float tr = -dot(p, ax) / dot(L, ax);
    float sh = 1.;
    if (tr > 0.) { vec3 hp = p + L * tr; float rr = length(hp); if (rr > 1.22 && rr < 2.24) sh = .55 + .2 * n1(rr * 40.); }
    planet = base * (.5 + .62 * dif * sh) * mix(1., sh, .5);
    planet += vec3(1., .5, .45) * pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 24.) * .18;
    planet = mix(planet, vec3(.5, 0., 0.), rim * .5);
    col = vec4(planet, 1.);
  }
  // rings
  float dn = dot(rd, ax);
  if (abs(dn) > 1e-4) {
    float t = -dot(ro, ax) / dn;
    vec3 p = ro + rd * t;
    float r = length(p);
    if (r > 1.22 && r < 2.24 && t > 0.) {
      float s = n1(r * 90.) * .55 + n1(r * 23.) * .45;
      float a = smoothstep(1.22, 1.3, r) * (1. - smoothstep(2.15, 2.24, r));
      a *= mix(.25, 1., s);
      a *= 1. - smoothstep(1.58, 1.61, r) * (1. - smoothstep(1.66, 1.69, r)) * .85;   // the dark gap
      a *= 1. - smoothstep(1.98, 2.0, r) * (1. - smoothstep(2.02, 2.04, r)) * .7;
      vec3 rc = mix(vec3(.32), vec3(.97), pow(s, 1.4));
      // the planet's shadow on the rings
      float bb = dot(p, L), cc = dot(p, p) - 1.;
      if (bb < 0. && bb * bb - cc > 0.) rc *= .18;
      rc *= .55 + .45 * max(dot(ax * sign(dot(ax, L)), L), 0.) + .2;
      if (t < tS) col = vec4(mix(col.rgb, rc, a), max(col.a, a));
    }
  }
  // red glow round the planet
  float d = length(q);
  if (col.a < 1.) { float g = exp(-(d - 1.) * 5.) * smoothstep(.98, 1.02, d) * .55; col.rgb += vec3(1., 0., 0.) * g * (1. - col.a); col.a = max(col.a, g); }
  gl_FragColor = vec4(col.rgb * col.a, col.a);
}`;

export class Saturn {
  constructor(parent) {
    this.c = document.createElement('canvas');
    this.c.className = 'saturn-gl';
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
    for (const n of ['R', 'C', 'TIME', 'ROLL', 'INC']) this.u[n] = gl.getUniformLocation(pr, n);
    this.rect = [0, 60, 1512, 800];
    this.sized = false;
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(2, devicePixelRatio || 1);
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
    gl.uniform4f(u.R, ...this.rect);
    gl.uniform3f(u.C, 756, 475, 300);
    gl.uniform1f(u.TIME, t);
    // the Figma tilt: rings rising to the right, seen from a little above
    gl.uniform1f(u.ROLL, 0.36 + Math.sin(t * 0.12) * 0.02);
    gl.uniform1f(u.INC, 1.24 + Math.sin(t * 0.09) * 0.015);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
