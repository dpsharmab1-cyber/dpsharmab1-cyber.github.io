// Real glass. Each panel is a small WebGL canvas that refracts what lies
// under it: the title type (drawn into a texture exactly where the page sets
// it) or, in the footer, the wheel. Thick-glass optics, worked out per pixel:
//   bar     a horizontal band; the type is squeezed into it and folds back
//           over itself near the rims, splaying sideways toward the edges
//   slab    a tall pane on the left; frosted inside, its right rim mirrors
//           and stretches the letters beside it
//   sheets  stacked panes under the wheel: each reflects the wheel, bent at
//           its rim; plus the small glass dome at the wheel's foot
// Red and blue are bent a little more and less than green (dispersion), a
// glint travels across, the pointer brings a soft light and pulls the glass a
// few px toward itself. Coordinates are section px (Figma px).
const VERT = `attribute vec2 a; varying vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D T;
uniform vec4 TR, R, B, P;       // texture rect, canvas rect, band rect, params
uniform vec3 E, D, BG;          // sheet edges, dome (cx, cy, r), glass tint
uniform vec2 M;                 // pointer (section px)
uniform float MODE, TIME, MON, HAS_TEX;
vec4 tx(vec2 b){ vec2 u = (b - TR.xy) / TR.zw; if (u.x < 0. || u.y < 0. || u.x > 1. || u.y > 1. || HAS_TEX < .5) return vec4(0.); return texture2D(T, u); }
vec4 fr(vec2 b, float r){ if (r < .05) return tx(b);
  vec4 c = tx(b) * .28; c += (tx(b + vec2(r, 0.)) + tx(b - vec2(r, 0.)) + tx(b + vec2(0., r)) + tx(b - vec2(0., r))) * .12;
  c += (tx(b + vec2(r, r) * .7) + tx(b - vec2(r, r) * .7) + tx(b + vec2(r, -r) * .7) + tx(b - vec2(r, -r) * .7)) * .06; return c; }
float ch(vec4 c, int i, float bg){ float x = i == 0 ? c.r : i == 1 ? c.g : c.b; return mix(bg, x, c.a); }
void main(){
  vec2 p = R.xy + vec2(v.x, 1. - v.y) * R.zw;
  vec3 col = BG; float a = 1.;
  if (MODE < .5) {                                   // ---------------- bar
    if (p.y < B.y || p.y > B.y + B.w) discard;
    float t = (p.y - (B.y + B.w * .5)) / (B.w * .5);
    float d = 1.55 * t - 2.15 * t * t * t;
    float cx = M.x * MON * .0 + B.x + B.z * .5;
    for (int i = 0; i < 3; i++) {
      float f = 1. + (float(i) - 1.) * P.z;
      vec2 s = vec2(cx + (p.x - cx) * (1. - P.y * t * t * f), p.y + d * B.w * .5 * P.x * f);
      float bgc = i == 0 ? BG.r : i == 1 ? BG.g : BG.b;
      float val = ch(fr(s, P.w * (.6 + abs(t))), i, bgc);
      if (i == 0) col.r = val; else if (i == 1) col.g = val; else col.b = val;
    }
    col += .07 * pow(abs(t), 6.);
    float rim = min(p.y - B.y, B.y + B.w - p.y);
    col = mix(col, vec3(.27), smoothstep(1.3, 0., rim) * .9);
    float sx = mod(TIME * 170., R.z + 900.) - 450. + R.x;
    col += .11 * exp(-pow((p.x - sx + (p.y - B.y) * .7) / 46., 2.));
  } else if (MODE < 1.5) {                           // ---------------- slab
    float xr = B.x + B.z;
    if (p.x > xr) discard;
    float e = xr - p.x, dz = P.y, q = clamp(1. - e / dz, 0., 1.);
    float cy = B.y + B.w * .5;
    for (int i = 0; i < 3; i++) {
      float f = 1. + (float(i) - 1.) * P.z;
      float xf = xr - dz;
      float sx = e < dz ? xf - (p.x - xf) * P.x * f : p.x;
      float sy = cy + (p.y - cy) * (1. - .42 * q * q * f) + sin(p.y * .012 + TIME * .6) * 3. * q;
      float bgc = i == 0 ? BG.r : i == 1 ? BG.g : BG.b;
      float val = ch(fr(vec2(sx, sy), P.w + q * 2.5), i, bgc);
      if (i == 0) col.r = val; else if (i == 1) col.g = val; else col.b = val;
    }
    col += .08 * pow(q, 5.);
    col = mix(col, vec3(.2), smoothstep(1.3, 0., e) * .9);
    col = mix(col, vec3(.18), smoothstep(1.3, 0., abs(p.y - (B.y + B.w))) * .8);
    float sy = mod(TIME * 120., B.w + 700.) - 350. + B.y;
    col += .09 * exp(-pow((p.y - sy + p.x * .45) / 40., 2.));
  } else {                                           // ---------------- sheets + dome
    if (p.y < E.x) {
      vec2 dv = p - D.xy; float r = length(dv);
      if (r > D.z || p.y > D.y) discard;
      float rn = r / D.z;
      for (int i = 0; i < 3; i++) {
        float f = 1. + (float(i) - 1.) * .08;
        float m = rn < .74 ? .5 + .5 * rn * rn : 1.9 - (rn - .74) * 3.4;
        vec2 s = D.xy + dv * m * f;
        vec4 c = tx(s);
        float val = i == 0 ? c.r : i == 1 ? c.g : c.b;
        if (i == 0) col.r = val; else if (i == 1) col.g = val; else col.b = val;
      }
      float ring = smoothstep(.02, 0., abs(rn - .74)) + smoothstep(.03, 0., abs(rn - .99));
      col += vec3(.2, .85, .75) * ring * .6;
      col = mix(col, col * vec3(.3, 1.1, 1.) + vec3(0., .25, .3), smoothstep(.72, .8, rn) * .7);
    } else {
      float n = p.y >= E.z ? 2. : p.y >= E.y ? 1. : 0.;
      float top = n > 1.5 ? E.z : n > .5 ? E.y : E.x;
      float de = p.y - top;
      float k = clamp(1. - de / 26., 0., 1.); k *= k;
      float fall = exp(-(p.y - E.x) / 1100.);
      vec3 rc;
      for (int i = 0; i < 3; i++) {
        float f = 1. + (float(i) - 1.) * (.05 + .25 * k);
        float sx = D.x + (p.x - D.x) * (1. + .3 * k * f) ;
        float sy = 2. * E.x - p.y + k * 26. * f;
        vec4 c = fr(vec2(sx, sy), 1.2 + n * 1.3);
        float val = (i == 0 ? c.r : i == 1 ? c.g : c.b) * c.a;
        if (i == 0) rc.r = val; else if (i == 1) rc.g = val; else rc.b = val;
      }
      col = BG + vec3(.035) * exp(-de / 60.) + rc * (.95 - n * .07) * fall;
      col += vec3(.22) * exp(-de * de / 1.4);
      col += (vec3(.5, .08, .04) * exp(-pow(de - 2.5, 2.) / 2.) + vec3(.05, .2, .45) * exp(-pow(de - 5., 2.) / 3.)) * .18;
      float sx2 = mod(TIME * 140., R.z + 900.) - 450. + R.x;
      col += .06 * exp(-pow((p.x - sx2 + (p.y - E.x) * .5) / 70., 2.)) * exp(-de / 300.);
    }
  }
  col += MON * .12 * exp(-dot(p - M, p - M) / (2. * 130. * 130.));
  gl_FragColor = vec4(col, a);
}`;

export class Glass {
  // opts: mode ('bar' | 'slab' | 'sheets'), rect (canvas, section px),
  // band, params [R, D/splay, chroma, frost], source (draw(ctx) in section px), texRect
  constructor(parent, opts) {
    this.o = opts;
    this.mode = { bar: 0, slab: 1, sheets: 2 }[opts.mode];
    this.c = document.createElement('canvas');
    this.c.className = 'glass ' + (opts.cls || '');
    parent.append(this.c);
    const gl = (this.gl = this.c.getContext('webgl', { premultipliedAlpha: false, antialias: false, alpha: true }));
    this.ok = !!gl;
    this.off = { x: 0, y: 0, w: 0 };       // magnet offsets
    this.mouse = [-9999, -9999]; this.mon = 0; this.monT = 0;
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
    const pr = (this.pr = gl.createProgram());
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['T', 'TR', 'R', 'B', 'P', 'E', 'D', 'BG', 'M', 'MODE', 'TIME', 'MON', 'HAS_TEX']) this.u[n] = gl.getUniformLocation(pr, n);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.hasTex = 0;
    this.place(opts.rect);
  }

  place(rect) {
    this.rect = rect;
    Object.assign(this.c.style, { left: rect[0] + 'px', top: rect[1] + 'px', width: rect[2] + 'px', height: rect[3] + 'px' });
    this.sized = false;
  }

  // the source pixels, drawn at the screen's own resolution
  async texture(k) {
    const [x, y, w, h] = this.o.texRect;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
    const ctx = cv.getContext('2d');
    ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
    await this.o.source(ctx);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    this.hasTex = 1;
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    const cap = 2.2e6;                               // keep every pane cheap
    if (W * H > cap) { const f = Math.sqrt(cap / (W * H)); W = Math.round(W * f); H = Math.round(H * f); }
    this.c.width = W; this.c.height = H;
    const k = Math.min(3, (W / this.rect[2]) * 1.25);
    if (Math.abs((this.texK || 0) - k) > 0.15) { this.texK = k; this.texture(k); }
    this.sized = true;
    return true;
  }

  pointer(clientX, clientY, on) {
    const r = this.c.getBoundingClientRect();
    if (!r.width) return;
    const sx = this.rect[2] / r.width;
    this.mouse = [this.rect[0] + (clientX - r.left) * sx, this.rect[1] + (clientY - r.top) * sx];
    this.monT = on ? 1 : 0;
  }

  draw(t) {
    if (!this.ok || !this.hasTex && !this.sized) { if (this.ok && !this.sized) this.resize(); }
    if (!this.ok) return;
    if (!this.sized && !this.resize()) return;
    const gl = this.gl, u = this.u, o = this.o, b = o.band;
    this.mon += (this.monT - this.mon) * 0.08;
    gl.viewport(0, 0, this.c.width, this.c.height);
    gl.uniform4f(u.TR, ...o.texRect);
    gl.uniform4f(u.R, ...this.rect);
    gl.uniform4f(u.B, b[0] + this.off.x, b[1] + this.off.y, b[2] + this.off.w, b[3]);
    gl.uniform4f(u.P, ...o.params);
    gl.uniform3f(u.E, ...(o.edges || [0, 0, 0]));
    gl.uniform3f(u.D, ...(o.dome || [0, 0, 0]));
    gl.uniform3f(u.BG, ...(o.bg || [0.015, 0.015, 0.017]));
    gl.uniform2f(u.M, this.mouse[0], this.mouse[1]);
    gl.uniform1f(u.MODE, this.mode);
    gl.uniform1f(u.TIME, t);
    gl.uniform1f(u.MON, this.mon);
    gl.uniform1f(u.HAS_TEX, this.hasTex);
    gl.uniform1i(u.T, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// draw a line of type the way the page sets it (baseline in section px)
export const type = (ctx, text, x, baseline, size, color, family = 'Anton') => {
  ctx.font = `400 ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, baseline);
};
