// Folding 3D preview. Panels live in a parent/child tree mirroring the net, so
// folding one panel carries everything attached to it, like real board.

import * as T from './vendor/three.bundle.mjs';
import { panelProgress } from './engine.js';

export class Viewer {
  constructor(el) {
    this.el = el;
    const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    el.appendChild(r.domElement);

    this.scene = new T.Scene();
    const pm = new T.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;

    this.camera = new T.PerspectiveCamera(32, 1, 1, 20000);
    this.controls = new T.OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.addEventListener('change', () => (this.dirty = true));

    this.scene.add(new T.HemisphereLight(0xffffff, 0xd8d2c4, 0.55));
    const sun = this.sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 6;
    this.scene.add(sun, sun.target);

    this.ground = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: 0.16 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.root = new T.Group();
    this.scene.add(this.root);

    this.frontMat = new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0, side: T.FrontSide });
    this.backMat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: T.BackSide });
    this.edgeMat = new T.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 });

    this.fold = 1;
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      if (this.controls.update() || this.dirty) { this.dirty = false; r.render(this.scene, this.camera); }
    };
    loop();
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  setModel(model, { refit = true } = {}) {
    this.model = model;
    this.root.clear();
    this.root.position.set(0, 0, 0);
    this.root.quaternion.identity();
    this.nodes = [];
    this.backMat.color.set(model.material.inside);
    this.edgeMat.color.set(model.material.edge);
    this.eps = Math.max(0.3, model.material.t);
    if (model.kind === 'wrap') this.buildWrap(model);
    else if (model.kind === 'pouch') this.buildPouch(model);
    else if (model.kind === 'tube') this.buildTube(model);
    else this.buildNet(model);
    this.placeOnGround(refit);
    this.setFold(this.fold);
  }

  buildNet(model) {
    if (model.orient === 'tray') {
      const qx = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2);
      this.root.quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI).multiply(qx);
    }
    this.pivot = new T.Group();
    this.root.add(this.pivot);
    const byNode = {};
    // parents first
    const order = [], seen = new Set();
    const visit = (q) => { if (seen.has(q.id)) return; if (q.parent) visit(model.byId[q.parent]); seen.add(q.id); order.push(q); };
    model.panels.forEach(visit);
    for (const q of order) {
      const node = new T.Group();
      node.matrixAutoUpdate = false;
      (q.parent ? byNode[q.parent] : this.pivot).add(node);
      byNode[q.id] = node;
      const geo = polyGeometry(q.pts, model.art);
      const front = new T.Mesh(geo, this.frontMat), back = new T.Mesh(geo, this.backMat);
      front.castShadow = back.castShadow = true;
      front.receiveShadow = true;
      const outline = new T.BufferGeometry();
      outline.setAttribute('position', new T.Float32BufferAttribute(q.pts.flatMap((p, i) => {
        const n = q.pts[(i + 1) % q.pts.length];
        return [p[0], p[1], 0.02, n[0], n[1], 0.02];
      }), 3));
      node.add(front, back, new T.LineSegments(outline, this.edgeMat));
      this.nodes.push({ q, node });
    }
    // rope handles ride on their panel, so they fold with it
    for (const ex of model.spec.extras || []) {
      if (ex.type !== 'handle') continue;
      const rope = new T.MeshStandardMaterial({ color: model.material.edge, roughness: 0.7 });
      const m = new T.Mesh(new T.TorusGeometry(ex.w / 2, 2.2, 8, 40, Math.PI), rope);
      m.position.set(ex.cx, ex.y, -1.2);
      m.scale.set(1, ex.h / (ex.w / 2), 1);
      m.castShadow = true;
      byNode[ex.panel].add(m);
    }
  }

  // Squeeze tube: the print wraps into a cylinder that flattens to the crimp seal.
  buildTube(model) {
    const s = model.spec, { r, L, C } = s;
    const capH = Math.max(10, r * 0.9), shoulder = Math.max(5, r * 0.45), y0 = capH + shoulder;
    const white = new T.MeshPhysicalMaterial({ color: 0xf3f3f1, roughness: 0.3, clearcoat: 0.6 });
    const V = (x, y) => new T.Vector2(x, y);
    const sh = new T.Mesh(new T.LatheGeometry([V(r * 0.42, capH - 0.5), V(r * 0.42, capH + 0.5), V(r * 0.85, capH + shoulder * 0.6), V(r, y0 + 0.5)], 64), white);
    const cap = new T.Mesh(new T.CylinderGeometry(r * 0.78, r * 0.82, capH, 48), new T.MeshPhysicalMaterial({ color: 0x22292c, roughness: 0.35, clearcoat: 0.5 }));
    cap.position.y = capH / 2;
    for (const m of [sh, cap]) { m.castShadow = true; this.root.add(m); }

    const NU = 96, NV = 40, flat = [], uvs = [], idx = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const x = (i / NU) * C, y = (j / NV) * L;
      flat.push([x, y]);
      uvs.push((x - model.art.minX) / model.art.w, (y - model.art.minY) / model.art.h);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(flat.length * 3), 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    const front = new T.Mesh(geo, this.frontMat), back = new T.Mesh(geo, this.backMat);
    front.castShadow = true;
    this.root.add(front, back);
    this.tube = { geo, flat, r, L, C, y0, crimpFrom: 1 - (s.crimp * 4) / L };
  }

  morphTube(t) {
    const { geo, flat, r, L, C, y0, crimpFrom } = this.tube;
    const pos = geo.attributes.position, e = t * t * (3 - 2 * t), k = Math.max(1e-5, e) / r, xc = C / 2;
    for (let i = 0; i < flat.length; i++) {
      const [x, y] = flat[i], v = y / L;
      let px, pz;
      if (e < 1e-4) { px = x - xc; pz = r; }
      else { const R = 1 / k, th = (x - xc) / R; px = R * Math.sin(th); pz = R * Math.cos(th) - R + r; }
      // flatten toward the crimp: circle (r) → flat seal (πr/2 wide)
      const f = Math.min(1, Math.max(0, (v - Math.min(0.5, crimpFrom)) / (1 - Math.min(0.5, crimpFrom))));
      const fl = f * f * (3 - 2 * f) * e;
      const ax = 1 + (Math.PI / 2 - 1) * fl, az = 1 - fl * 0.97;
      pos.setXYZ(i, px * ax, y0 + y, pz * az);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
  }

  buildWrap(model) {
    const s = model.spec, r = s.r;
    for (const m of containerMeshes(s)) { m.castShadow = true; this.root.add(m); }

    const W = s.labelW + s.overlap, segs = 120;
    const geo = new T.PlaneGeometry(W, s.labelH, segs, 1);
    const pos = geo.attributes.position, uv = geo.attributes.uv, flat = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + W / 2, y = pos.getY(i) + s.labelH / 2;
      flat.push([x, y]);
      uv.setXY(i, (x - model.art.minX) / model.art.w, (y - model.art.minY) / model.art.h);
    }
    const label = new T.Group();
    label.position.y = s.labelY;
    const front = new T.Mesh(geo, this.frontMat), back = new T.Mesh(geo, this.backMat);
    front.castShadow = true;
    label.add(front, back);
    this.root.add(label);
    this.wrap = { geo, flat, r, xc: s.xc, seam: s.labelW };
  }

  // Pouch surfaces as grids. Each vertex knows its spot on the flat film and on
  // the filled pouch; the fold slider morphs between the two.
  buildPouch(model) {
    const s = model.spec, { W, H, G, seal, topSeal } = s;
    const dmax = G ? G / 2 : Math.min(W, H) * 0.09;
    const sideS = (u) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (u * W - seal) / (W - 2 * seal)))), 0.55);
    const topR = 1 - topSeal / H;
    const prof = (r) => {
      if (r >= topR) return 0;
      const k = r / topR;
      if (G) return Math.pow(Math.cos(k * Math.PI / 2), 0.7) * (0.82 + 0.18 * (1 - k));
      return Math.pow(Math.sin(Math.PI * k), 0.6);
    };
    const pinch = (u, r) => 1 - 0.06 * sideS(u) * prof(r);
    const surfaces = [];
    const NX = 36, NY = 44, NQ = 10;
    const grid = (nu, nv, fn, flip) => {
      const flatPts = [], target = [], side = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const o = fn(i / nu, j / nv);
        flatPts.push(o.flat); target.push(o.target); side.push(o.side);
      }
      const idx = [];
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(flatPts.length * 3), 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(flatPts.flatMap(([x, y]) => [(x - model.art.minX) / model.art.w, (y - model.art.minY) / model.art.h]), 2));
      geo.setIndex(idx);
      surfaces.push({ geo, flatPts, target, side });
    };
    // front: u across, v = r (bottom → top)
    grid(NX, NY, (u, r) => ({ flat: [u * W, H + G + r * H], target: [(u - 0.5) * W * pinch(u, r), r * H, 0.3 + dmax * sideS(u) * prof(r)], side: 1 }), false);
    // back: same surface mirrored behind; on the film it runs from the gusset downward
    grid(NX, NY, (u, r) => ({ flat: [u * W, H - r * H], target: [(u - 0.5) * W * pinch(u, r), r * H, -0.3 - dmax * sideS(u) * prof(r)], side: -1 }), true);
    if (G) {
      grid(NX, NQ, (u, q) => ({
        flat: [u * W, H + q * G],
        target: [(u - 0.5) * W * pinch(u, 0), G * 0.1 * Math.sin(Math.PI * q) * sideS(u), (2 * q - 1) * dmax * sideS(u) * prof(0)],
        side: -0.5,
      }), false);
    }
    for (const sf of surfaces) {
      const front = new T.Mesh(sf.geo, this.frontMat), back = new T.Mesh(sf.geo, this.backMat);
      front.castShadow = back.castShadow = true;
      this.root.add(front, back);
    }
    this.pouch = { surfaces, H, W, lift: H * 0.28 };
  }

  morphPouch(t) {
    const { surfaces, W, lift } = this.pouch;
    const e = t * t * (3 - 2 * t), arc = Math.sin(Math.PI * e) * lift;
    for (const sf of surfaces) {
      const pos = sf.geo.attributes.position;
      for (let i = 0; i < sf.flatPts.length; i++) {
        const [fx, fy] = sf.flatPts[i], [tx, ty, tz] = sf.target[i];
        pos.setXYZ(i, (fx - W / 2) * (1 - e) + tx * e, fy * (1 - e) + ty * e, tz * e + sf.side[i] * arc);
      }
      pos.needsUpdate = true;
      sf.geo.computeVertexNormals();
      sf.geo.computeBoundingSphere();
      sf.geo.computeBoundingBox();
    }
  }

  placeOnGround(refit) {
    const keep = this.fold;
    this.applyFold(1);
    this.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(this.root);
    const c = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
    this.root.position.set(-c.x, -box.min.y, -c.z);
    this.applyFold(keep);
    const big = Math.max(size.x, size.y, size.z);
    this.size = size;
    this.ground.scale.set(big * 12, big * 12, 1);
    this.ground.position.y = -0.05;
    const sun = this.sun;
    sun.position.set(big * 1.2, big * 2.4, big * 1.6);
    sun.target.position.set(0, size.y / 2, 0);
    const cam = sun.shadow.camera, e = big * 2.2;
    cam.left = -e; cam.right = e; cam.top = e; cam.bottom = -e; cam.near = big * 0.1; cam.far = big * 8;
    cam.updateProjectionMatrix();
    if (refit) this.fit();
  }

  fit() {
    const s = this.size, big = Math.max(s.x, s.y, s.z);
    const dist = (big / (2 * Math.tan((this.camera.fov * Math.PI) / 360))) * 1.9;
    const dir = new T.Vector3(0.85, 0.62, 1.35).normalize();
    this.controls.target.set(0, s.y * 0.45, 0);
    this.camera.position.copy(dir.multiplyScalar(dist)).add(this.controls.target);
    this.camera.near = Math.max(0.5, dist / 100);
    this.camera.far = dist * 40;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = big * 0.4;
    this.controls.maxDistance = dist * 6;
    this.controls.update();
    this.dirty = true;
  }

  setFold(t) {
    this.fold = t;
    this.applyFold(t);
    this.dirty = true;
  }

  applyFold(t) {
    const m = this.model;
    if (!m) return;
    if (m.kind === 'wrap') return this.bendWrap(t);
    if (m.kind === 'pouch') return this.morphPouch(t);
    if (m.kind === 'tube') return this.morphTube(t);
    const R = new T.Matrix4(), A = new T.Matrix4(), B = new T.Matrix4(), L = new T.Matrix4(), axis = new T.Vector3();
    for (const { q, node } of this.nodes) {
      const mat = node.matrix.identity();
      if (q.fold) {
        const k = panelProgress(q, t, m.maxSeq);
        const ang = q.fold.sign * (q.angle * Math.PI / 180) * k;
        axis.set(q.fold.u[0], q.fold.u[1], 0);
        A.makeTranslation(q.fold.a[0], q.fold.a[1], 0);
        R.makeRotationAxis(axis, ang);
        B.makeTranslation(-q.fold.a[0], -q.fold.a[1], 0);
        mat.multiply(A).multiply(R).multiply(B);
      }
      // Stack overlapping flaps toward the inside. Past 90° a panel's printed face turns
      // inward, so "inside" flips from its local -z to +z.
      if (q.layer) mat.multiply(L.makeTranslation(0, 0, (q.angle > 90 ? 1 : -1) * this.eps * q.layer * Math.min(1, t * 4)));
      node.matrixWorldNeedsUpdate = true;
    }
  }

  bendWrap(t) {
    const { geo, flat, r, xc, seam } = this.wrap;
    const pos = geo.attributes.position, k = Math.max(1e-5, t) / r;
    for (let i = 0; i < flat.length; i++) {
      const [x, y] = flat[i];
      const rr = r + 0.35 + (x > seam ? 0.3 : 0);
      if (t < 1e-4) { pos.setXYZ(i, x - xc, y, rr); continue; }
      const R = 1 / k + (rr - r), th = (x - xc) / R;
      pos.setXYZ(i, R * Math.sin(th), y, R * Math.cos(th) - R + rr);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  setArtwork(canvas) {
    if (this.tex) this.tex.dispose();
    const tex = this.tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.frontMat.map = tex;
    this.frontMat.needsUpdate = true;
    this.dirty = true;
  }

  snapshot(scale = 2) {
    const r = this.renderer, size = r.getSize(new T.Vector2()), pr = r.getPixelRatio();
    r.setPixelRatio(pr * scale);
    r.setSize(size.x, size.y, false);
    r.render(this.scene, this.camera);
    const url = r.domElement.toDataURL('image/png');
    r.setPixelRatio(pr);
    r.setSize(size.x, size.y, false);
    this.dirty = true;
    return url;
  }

  exportGLB() {
    return new Promise((resolve, reject) => {
      this.root.updateMatrixWorld(true);
      new T.GLTFExporter().parse(this.root, resolve, reject, { binary: true, onlyVisible: true });
    });
  }
}

// Turned container bodies from lathe profiles (radius, height).
function containerMeshes(s) {
  const { r, H } = s, V = (x, y) => new T.Vector2(Math.max(0, x), y), out = [];
  if (s.body === 'can') {
    const metal = new T.MeshStandardMaterial({ color: 0xd5d9de, metalness: 1, roughness: 0.32 });
    const body = new T.Mesh(new T.CylinderGeometry(r, r, H, 72, 1, true), metal);
    body.position.y = H / 2;
    const top = new T.Mesh(new T.CircleGeometry(r, 72), new T.MeshStandardMaterial({ color: 0xc4c9cf, metalness: 1, roughness: 0.25 }));
    top.rotation.x = -Math.PI / 2; top.position.y = H;
    const rim = new T.Mesh(new T.TorusGeometry(r - 0.8, 1.2, 12, 72), metal);
    rim.rotation.x = Math.PI / 2; rim.position.y = H;
    out.push(body, top, rim);
  } else if (s.body === 'papertube') {
    const kraft = new T.MeshStandardMaterial({ color: 0xb98b5d, roughness: 0.85 });
    const body = new T.Mesh(new T.CylinderGeometry(r - 0.2, r - 0.2, H - 2, 72, 1, true), kraft);
    body.position.y = H / 2;
    const base = new T.Mesh(new T.CircleGeometry(r, 72), kraft);
    base.rotation.x = Math.PI / 2; base.position.y = 0.5;
    const lidMat = new T.MeshStandardMaterial({ color: 0x23302d, roughness: 0.6 });
    const lid = new T.Mesh(new T.CylinderGeometry(r + 1.4, r + 1.4, s.lidH, 72), lidMat);
    lid.position.y = H - s.lidH / 2;
    out.push(body, base, lid);
  } else if (s.body === 'bottle') {
    const shoulder = Math.max(s.labelY + s.labelH + 6, H * 0.5), neckR = Math.max(9, r * 0.3), neck0 = Math.min(H * 0.8, shoulder + r * 1.4), capY = H * 0.9;
    const pts = [V(0, 0), V(r - 3, 0), V(r, 3), V(r, shoulder)];
    for (let i = 1; i <= 12; i++) {
      const k = i / 12, e = (1 - Math.cos(Math.PI * k)) / 2;
      pts.push(V(r + (neckR - r) * e, shoulder + (neck0 - shoulder) * k));
    }
    pts.push(V(neckR, capY + 1), V(neckR - 1.5, capY + 1), V(0.01, capY));
    const glass = new T.MeshPhysicalMaterial({ color: 0x5a2a0c, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
    out.push(new T.Mesh(new T.LatheGeometry(pts, 72), glass));
    const cap = new T.Mesh(new T.CylinderGeometry(neckR + 1.2, neckR + 1.2, H - capY, 48), new T.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.9, roughness: 0.35 }));
    cap.position.y = capY + (H - capY) / 2;
    out.push(cap);
  } else {
    const lidH = Math.min(16, H * 0.16), neckY = H - lidH - 2;
    const pts = [V(0, 0), V(r - 4, 0), V(r, 4), V(r, neckY - 4), V(r - 3, neckY), V(r - 3, H - lidH), V(0.01, H - lidH)];
    const glass = new T.MeshPhysicalMaterial({ color: 0xe6eeec, roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.5, depthWrite: false });
    out.push(new T.Mesh(new T.LatheGeometry(pts, 72), glass));
    const lid = new T.Mesh(new T.CylinderGeometry(r + 0.6, r + 0.6, lidH, 64), new T.MeshStandardMaterial({ color: 0x1f2a2e, metalness: 0.4, roughness: 0.4 }));
    lid.position.y = H - lidH / 2;
    out.push(lid);
  }
  return out;
}

function polyGeometry(pts, art) {
  const pos = [], uv = [], nrm = [];
  const P = ([x, y]) => { pos.push(x, y, 0); uv.push((x - art.minX) / art.w, (y - art.minY) / art.h); nrm.push(0, 0, 1); };
  for (let i = 1; i < pts.length - 1; i++) { P(pts[0]); P(pts[i]); P(pts[i + 1]); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return g;
}
