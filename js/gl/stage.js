// WebGL2 glass stage: one fixed canvas renders the background, blobs, the wheel
// logo, folders and every glass surface. Glass is layered by `level`: items of
// level N refract everything drawn at levels < N.
import * as S from './shaders.js';

const LIGHT = [-0.7071, -0.7071, 0.8]; // Figma: light −45°, 80 %

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    this.dark = false;
    this.bg = [1, 1, 1];
    this.blobs = [];
    this.glass = [];
    this.logos = [];
    this.folders = [];
    this.textures = {};
    this.dpr = 1;
    this.w = this.h = 0;

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.p = {
      blit: this.prog(S.FULL_VS, S.BLIT_FS),
      bg: this.prog(S.FULL_VS, S.BG_FS),
      blob: this.prog(S.RECT_VS, S.BLOB_FS),
      glass: this.prog(S.RECT_VS, S.GLASS_FS),
      logo: this.prog(S.RECT_VS, S.LOGO_FS),
      folder: this.prog(S.FOLDER_VS, S.FOLDER_FS),
    };
    this.fbos = [this.fbo(), this.fbo(), this.fbo()];
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
    // the canvas can change size without a window resize (mobile URL bar, late layout)
    new ResizeObserver(() => { this.resize(); this.onResize?.(); }).observe(canvas);
  }

  prog(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        console.error(log, src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
        throw new Error(log);
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  fbo() {
    const gl = this.gl;
    const tex = gl.createTexture();
    const fb = gl.createFramebuffer();
    return { tex, fb, w: 0, h: 0 };
  }

  sizeFbo(f) {
    const gl = this.gl;
    if (f.w === this.cw && f.h === this.ch) return;
    gl.bindTexture(gl.TEXTURE_2D, f.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.cw, this.ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.tex, 0);
    f.w = this.cw; f.h = this.ch;
  }

  resize() {
    // phones: 1.5x is visually identical for soft glass and halves the fill cost
    this.coarse ??= matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, this.coarse ? 1.5 : 2);
    // the canvas box, not innerWidth: a visible scrollbar would otherwise stretch
    // every glass rect sideways (glass drifting off its button text)
    const w = this.canvas.clientWidth || document.documentElement.clientWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = dpr; this.w = w; this.h = h;
    this.cw = Math.round(w * dpr); this.ch = Math.round(h * dpr);
    this.canvas.width = this.cw; this.canvas.height = this.ch;
    this.fbos.forEach((f) => this.sizeFbo(f));
  }

  loadTexture(name, url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const gl = this.gl;
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.textures[name] = { t, w: img.width, h: img.height };
        res(this.textures[name]);
      };
      img.onerror = rej;
      img.src = url;
    });
  }

  setTheme(dark) {
    this.dark = dark;
    this.bg = dark ? [0, 0, 0] : [1, 1, 1];
  }

  common(pr) {
    const gl = this.gl, u = pr.u;
    if (u.u_view) gl.uniform2f(u.u_view, this.w, this.h);
    if (u.u_dpr) gl.uniform1f(u.u_dpr, this.dpr);
    if (u.u_dark) gl.uniform1f(u.u_dark, this.dark ? 1 : 0);
    if (u.u_light) gl.uniform3fv(u.u_light, LIGHT);
    if (u.u_time) gl.uniform1f(u.u_time, this.time);
    if (u.u_taps) gl.uniform1f(u.u_taps, this.coarse ? 4 : 8);
  }

  bindSrc(pr, tex) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(pr.u.u_src, 0);
  }

  target(f) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.fb : null);
    gl.viewport(0, 0, this.cw, this.ch);
  }

  blit(tex) {
    const gl = this.gl, pr = this.p.blit;
    gl.disable(gl.BLEND);
    gl.useProgram(pr.p);
    this.bindSrc(pr, tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  render(time) {
    const gl = this.gl;
    this.time = time;
    gl.bindVertexArray(this.vao);
    const [A] = this.fbos;

    // ---- scene: background + blobs
    this.target(A);
    gl.disable(gl.BLEND);
    let pr = this.p.bg;
    gl.useProgram(pr.p);
    this.common(pr);
    gl.uniform3fv(pr.u.u_bg, this.bg);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.BLEND);
    pr = this.p.blob;
    gl.useProgram(pr.p);
    this.common(pr);
    for (const b of this.blobs) {
      const tx = this.textures[b.tex];
      if (!tx || b.alpha <= 0.001) continue;
      if (b.x > this.w || b.y > this.h || b.x + b.w < 0 || b.y + b.h < 0) continue;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tx.t);
      gl.uniform1i(pr.u.u_tex, 1);
      gl.uniform4f(pr.u.u_rect, b.x, b.y, b.w, b.h);
      gl.uniform1f(pr.u.u_alpha, b.alpha);
      gl.uniform1f(pr.u.u_seed, b.seed || 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ---- glass levels
    const items = [];
    for (const g of this.glass) if (g.opacity > 0.002 && this.onScreen(g.x, g.y, g.w, g.h, 80)) items.push({ k: 'g', o: g, level: g.level || 2 });
    for (const l of this.logos) if (l.opacity > 0.002) items.push({ k: 'l', o: l, level: l.level || 1 });
    for (const f of this.folders) if (f.opacity > 0.002) items.push({ k: 'f', o: f, level: f.level || 2 });
    const levels = [...new Set(items.map((i) => i.level))].sort((a, b) => a - b);
    let src = A;
    if (!levels.length) { this.target(null); this.blit(src.tex); return; }
    levels.forEach((L, idx) => {
      const last = idx === levels.length - 1;
      const realDst = last ? null : (src === this.fbos[1] ? this.fbos[2] : this.fbos[1]);
      this.target(realDst);
      this.blit(src.tex);
      gl.enable(gl.BLEND);
      for (const it of items) {
        if (it.level !== L) continue;
        if (it.k === 'g') this.drawGlass(it.o, src.tex);
        else if (it.k === 'l') this.drawLogo(it.o, src.tex);
        else this.drawFolder(it.o, src.tex);
      }
      if (!last) src = realDst;
    });
  }

  onScreen(x, y, w, h, m) {
    return !(x > this.w + m || y > this.h + m || x + w < -m || y + h < -m);
  }

  drawGlass(g, tex) {
    const gl = this.gl, pr = this.p.glass, u = pr.u;
    gl.useProgram(pr.p);
    this.common(pr);
    this.bindSrc(pr, tex);
    const sh = g.shadow || [8, 22, 0, 0];
    const pad = sh[1] * 1.6 + Math.abs(sh[0]) + sh[3] + 4;
    gl.uniform4f(u.u_rect, g.x - pad, g.y - pad, g.w + pad * 2, g.h + pad * 2);
    gl.uniform2f(u.u_center, g.x + g.w / 2, g.y + g.h / 2);
    gl.uniform2f(u.u_half, g.w / 2, g.h / 2);
    const r = g.r ?? Math.min(g.w, g.h) / 2;
    const rr = Array.isArray(r) ? r : [r, r, r, r];
    const lim = Math.min(g.w, g.h) / 2;
    gl.uniform4f(u.u_radius, Math.min(rr[0], lim), Math.min(rr[1], lim), Math.min(rr[2], lim), Math.min(rr[3], lim));
    gl.uniform4f(u.u_optics, g.refr ?? 1, g.bevel ?? 18, g.disp ?? 1, g.frost ?? 4);
    gl.uniform1f(u.u_splay, g.splay ?? 1);
    gl.uniform4fv(u.u_fill, g.fill || (this.dark ? [1, 1, 1, 0.02] : [1, 1, 1, 0.2]));
    gl.uniform4fv(u.u_tint, g.tint || [0, 0, 0, 0]);
    gl.uniform4fv(u.u_shadow, sh);
    gl.uniform1f(u.u_opacity, g.opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawLogo(l, tex) {
    const gl = this.gl, pr = this.p.logo, u = pr.u;
    const lt = this.textures.logo;
    if (!lt) return;
    gl.useProgram(pr.p);
    this.common(pr);
    this.bindSrc(pr, tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lt.t);
    gl.uniform1i(u.u_logo, 1);
    const half = 262.5 * l.scale + 24;
    gl.uniform4f(u.u_rect, l.x - half, l.y - half, half * 2, half * 2);
    gl.uniform2f(u.u_center, l.x, l.y);
    gl.uniform1f(u.u_scale, l.scale);
    gl.uniform3f(u.u_ang, l.aRing, l.aInner, l.aPetal);
    gl.uniform1f(u.u_bloom, l.bloom);
    gl.uniform1f(u.u_opacity, l.opacity);
    const c = l.clip || [-1e5, -1e5, 1e5, 1e5];
    gl.uniform4f(u.u_clip, c[0], c[1], c[2], c[3]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawFolder(f, tex) {
    const gl = this.gl, pr = this.p.folder, u = pr.u;
    gl.useProgram(pr.p);
    this.common(pr);
    this.bindSrc(pr, tex);
    gl.uniformMatrix4fv(u.u_m, false, f.m);
    gl.uniform2f(u.u_size, f.w, f.h);
    gl.uniform1f(u.u_pad, 90);
    gl.uniform1f(u.u_scale, f.scale);
    gl.uniform1f(u.u_blur, f.blur);
    gl.uniform1f(u.u_open, f.open);
    gl.uniform1f(u.u_hover, f.hover);
    gl.uniform1f(u.u_opacity, f.opacity);
    gl.uniform1f(u.u_seed, f.seed || 0);
    gl.uniform1f(u.u_lift, f.lift ?? 1);
    const c = f.clip || [-1e5, -1e5, 1e5, 1e5];
    gl.uniform4f(u.u_clip, c[0], c[1], c[2], c[3]);
    gl.uniform1f(u.u_clipR, f.clipR || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
