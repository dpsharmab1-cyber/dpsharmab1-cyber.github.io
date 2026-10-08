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
  }

  buildWrap(model) {
    const s = model.spec, r = s.r;
    const metal = new T.MeshStandardMaterial({ color: 0xd5d9de, metalness: 1, roughness: 0.32 });
    const body = new T.Mesh(new T.CylinderGeometry(r, r, s.canH, 72, 1, true), metal);
    body.position.y = s.canH / 2;
    const capGeo = new T.CircleGeometry(r, 72);
    const top = new T.Mesh(capGeo, new T.MeshStandardMaterial({ color: 0xc4c9cf, metalness: 1, roughness: 0.25 }));
    top.rotation.x = -Math.PI / 2; top.position.y = s.canH;
    const rim = new T.Mesh(new T.TorusGeometry(r - 0.8, 1.2, 12, 72), metal);
    rim.rotation.x = Math.PI / 2; rim.position.y = s.canH;
    for (const m of [body, top, rim]) { m.castShadow = true; this.root.add(m); }

    const W = s.circ + s.overlap, segs = 120;
    const geo = new T.PlaneGeometry(W, s.labelH, segs, 1);
    const pos = geo.attributes.position, uv = geo.attributes.uv, flat = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + W / 2, y = pos.getY(i) + s.labelH / 2;
      flat.push([x, y]);
      uv.setXY(i, (x - model.art.minX) / model.art.w, (y - model.art.minY) / model.art.h);
    }
    const label = new T.Group();
    label.position.y = (s.canH - s.labelH) / 2;
    const front = new T.Mesh(geo, this.frontMat), back = new T.Mesh(geo, this.backMat);
    front.castShadow = true;
    label.add(front, back);
    this.root.add(label);
    this.wrap = { geo, flat, r, circ: s.circ };
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
    const { geo, flat, r, circ } = this.wrap;
    const pos = geo.attributes.position, xc = circ / 2, k = Math.max(1e-5, t) / r;
    for (let i = 0; i < flat.length; i++) {
      const [x, y] = flat[i];
      const rr = r + 0.35 + (x > circ ? 0.3 : 0);
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
