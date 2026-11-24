// Cena 3D (Three.js): terreno, ruas (instanciadas), plantas pé a pé, rede de
// irrigação, ativos, equipamentos com rastro de GPS e marcadores de manutenção.
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { plantPos } from './farm.js';
import { STATUS_PLANTA, TIPOS_EQUIP } from './catalog.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scalePoly, rng, clamp } from './util.js';

const C = (h) => new THREE.Color(h);
const STATUS_COR = { ok: '#3fae5a', alerta: '#e0a526', falha: '#e04b3a', manutencao: '#8b7bd8', desligado: '#7d8590' };

export class Scene3D {
  constructor(container, hooks = {}) {
    this.el = container;
    this.hooks = hooks;
    this.dirty = true;
    this.mode = 'manejo';
    this.layers = { irrigacao: false, ativos: true, cruzetas: false, equipamentos: true, rotulos: true, manutencao: true };
    this.selected = new Set();
    this.plantRows = [];
    this.equipObjs = new Map();
    this.markerObjs = [];
    this.anim = null;

    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;
    const lr = new CSS2DRenderer();
    lr.domElement.className = 'labels3d';
    container.appendChild(lr.domElement);
    this.labelRenderer = lr;

    this.scene = new THREE.Scene();
    this.scene.background = C('#bcd3df');
    this.scene.fog = new THREE.Fog('#bcd3df', 2500, 7000);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 20000);
    this.camera.position.set(0, 1400, 1500);
    const hemi = new THREE.HemisphereLight('#eef6ff', '#6b4a2f', 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff3e0', 1.6);
    sun.position.set(-800, 1200, 600);
    this.scene.add(sun);

    const ctl = new MapControls(this.camera, lr.domElement);
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.12;
    ctl.screenSpacePanning = false;
    ctl.maxPolarAngle = Math.PI * 0.46;
    ctl.minDistance = 4;
    ctl.maxDistance = 6500;
    ctl.zoomSpeed = 1.2;
    ctl.addEventListener('change', () => { this.dirty = true; this.updateLabelVisibility(); });
    this.controls = ctl;

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(container);
    this.bindPointer();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  // mundo (x leste, y norte) -> three
  W(x, y, h = 0) { return new THREE.Vector3(x - this.ox, h, -(y - this.oy)); }

  // ---------------------------------------------------------------- construção
  build(farm, model) {
    this.farm = farm;
    this.model = model;
    // limpar
    while (this.root.children.length) {
      const o = this.root.children.pop();
      o.traverse?.((c) => { if (c.isCSS2DObject) c.element.remove(); c.geometry?.dispose?.(); });
    }
    this.equipObjs.clear();
    this.markerObjs = [];
    const b = farm.bounds;
    this.ox = (b.x0 + b.x1) / 2; this.oy = (b.y0 + b.y1) / 2;
    this.buildGround(farm);
    this.buildRows(farm);
    this.buildNetwork(farm);
    this.buildAssets(farm);
    this.buildRegionLabels(farm);
    this.plantGroup = new THREE.Group();
    this.root.add(this.plantGroup);
    this.nearGroup = new THREE.Group();
    this.root.add(this.nearGroup);
    this.fullRows = new Set();
    this.nearRows = new Set();
    this.nearKey = null;
    this.plantPick = [];
    this.nearPick = [];
    this.geoCache = new Map();
    this.stubMesh = new THREE.InstancedMesh(this.rowMesh.geometry, this.rowMesh.material, 64);
    this.stubMesh.count = 0;
    this.stubMesh.userData.rows = [];
    this.root.add(this.stubMesh);
    this.equipGroup = new THREE.Group();
    this.root.add(this.equipGroup);
    this.markerGroup = new THREE.Group();
    this.root.add(this.markerGroup);
    this.applyLayers();
    if (!this.framed) { this.frameAll(false); this.framed = true; }
    this.dirty = true;
  }

  flatShape(poly, y, color, opts = {}) {
    const s = new THREE.Shape(poly.map(([x, yy]) => new THREE.Vector2(x - this.ox, (yy - this.oy))));
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, ...opts }));
    m.position.y = y;
    return m;
  }

  stripeTexture(c1, c2, n = 64) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = c1; g.fillRect(0, 0, 256, 256);
    g.fillStyle = c2;
    for (let i = 0; i < n; i++) g.fillRect(0, (i * 256) / n, 256, 256 / n / 2.2);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  buildGround(farm) {
    const cfg = farm.cfg;
    const g = new THREE.PlaneGeometry(14000, 14000);
    g.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#8f8a55' }));
    ground.position.y = -0.3;
    this.root.add(ground);
    const b = farm.bounds;
    // lavouras vizinhas (milho/sorgo) para dar contexto, como no entorno real
    const vizinhas = [
      [[b.x0 - 900, b.y1 + 120], [b.x1 + 400, b.y1 + 120], [b.x1 + 400, b.y1 + 900], [b.x0 - 900, b.y1 + 900]],
      [[b.x0 - 900, b.y0 - 900], [b.x1 + 600, b.y0 - 900], [b.x1 + 600, b.y0 - 60], [b.x0 - 900, b.y0 - 60]],
      [[b.x1 + 90, b.y0 - 60], [b.x1 + 900, b.y0 - 60], [b.x1 + 900, b.y1 - 300], [b.x1 + 90, b.y1 - 300]],
    ];
    const tex = this.stripeTexture('#b9b45a', '#a39e47', 48);
    tex.repeat.set(30, 30);
    for (const p of vizinhas) {
      const m = this.flatShape(p, -0.2, '#ffffff', { map: tex });
      this.root.add(m);
    }
    // carreadores (contorno das regiões) e solo das regiões
    for (const reg of farm.regions) {
      const k = 1 + 14 / Math.sqrt(reg.areaHa * 1e4);
      this.root.add(this.flatShape(scalePoly(reg.poly, k), -0.1, '#b9683c'));
      this.root.add(this.flatShape(reg.poly, 0, '#7e4a2f'));
    }
    // carreadores principais (faixas)
    const roadMat = new THREE.MeshLambertMaterial({ color: '#c0713f' });
    const road = (x0, y0, x1, y1, w) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), roadMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      const c = this.W((x0 + x1) / 2, (y0 + y1) / 2, -0.05);
      m.position.copy(c);
      this.root.add(m);
    };
    const ph = farm.pumpHouse;
    road(b.x0 - 60, ph[1], b.x1 + 60, ph[1], 10);
    road(ph[0] - 34, b.y0 - 40, ph[0] - 34, b.y1 + 40, 9);
    // APP (mata) e açude
    if (cfg.app) {
      this.root.add(this.flatShape(cfg.app, -0.05, '#3c5a2c'));
      const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#2f4f25' }), 900);
      const bb = cfg.app.reduce((a, [x, y]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), y0: Math.min(a.y0, y), y1: Math.max(a.y1, y) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
      const mtx = new THREE.Matrix4();
      let n = 0, guard = 0;
      const col = new THREE.Color();
      while (n < 900 && guard++ < 6000) {
        const x = bb.x0 + Math.random() * (bb.x1 - bb.x0), y = bb.y0 + Math.random() * (bb.y1 - bb.y0);
        if (!inPoly(x, y, cfg.app)) continue;
        const ac = cfg.acude;
        if (ac && ((x - ac.x) / (ac.rx + 10)) ** 2 + ((y - ac.y) / (ac.ry + 10)) ** 2 < 1) continue;
        const s = 4 + Math.random() * 5;
        mtx.compose(this.W(x, y, s * 0.9), new THREE.Quaternion(), new THREE.Vector3(s, s * (1 + Math.random() * 0.6), s));
        trees.setMatrixAt(n, mtx);
        col.setHSL(0.27 + Math.random() * 0.05, 0.4, 0.2 + Math.random() * 0.1);
        trees.setColorAt(n, col);
        n++;
      }
      trees.count = n;
      this.root.add(trees);
    }
    if (cfg.acude) {
      const ac = cfg.acude;
      const pts = [];
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; pts.push([ac.x + Math.cos(a) * ac.rx * (1 + 0.08 * Math.sin(a * 3)), ac.y + Math.sin(a) * ac.ry]); }
      const w = this.flatShape(pts, 0.05, '#3f7f9e');
      w.userData = { pick: { tipo: 'ativo', id: 'RES-02' } };
      this.root.add(w);
      this.pickables = [w];
    } else this.pickables = [];
    // reservatório revestido
    const rv = cfg.reservatorio;
    const border = this.flatShape([[rv.x - rv.w / 2 - 6, rv.y - rv.h / 2 - 6], [rv.x + rv.w / 2 + 6, rv.y - rv.h / 2 - 6], [rv.x + rv.w / 2 + 6, rv.y + rv.h / 2 + 6], [rv.x - rv.w / 2 - 6, rv.y + rv.h / 2 + 6]], 0.02, '#c98a55');
    this.root.add(border);
    const lining = this.flatShape([[rv.x - rv.w / 2, rv.y - rv.h / 2], [rv.x + rv.w / 2, rv.y - rv.h / 2], [rv.x + rv.w / 2, rv.y + rv.h / 2], [rv.x - rv.w / 2, rv.y + rv.h / 2]], 0.06, '#2b3438');
    this.root.add(lining);
    const water = this.flatShape([[rv.x - rv.w / 2 + 2, rv.y - rv.h / 2 + 2], [rv.x + rv.w / 2 - 2, rv.y - rv.h / 2 + 2], [rv.x + rv.w / 2 - 2, rv.y + rv.h / 2 - 2], [rv.x - rv.w / 2 + 2, rv.y + rv.h / 2 - 2]], 0.1, '#1d4f60');
    water.userData = { pick: { tipo: 'ativo', id: 'RES-01' } };
    this.root.add(water);
    this.pickables.push(water);
    // sede / terreiro
    const sd = farm.sede;
    this.root.add(this.flatShape([[sd[0] - 30, sd[1] - 18], [sd[0] + 30, sd[1] - 18], [sd[0] + 30, sd[1] + 18], [sd[0] - 30, sd[1] + 18]], 0.05, '#cfc8bb'));
  }

  buildRows(farm) {
    const n = farm.rows.length;
    const geo = hedgeGeometry();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rowMesh = mesh;
    this.rowMatrices = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const col = new THREE.Color('#3f7a46');
    farm.rows.forEach((r, i) => {
      const reg = farm.regionById.get(r.reg);
      const c = this.W((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, 0);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), reg.theta);
      s.set(r.len, reg.altura, reg.largCopa);
      m.compose(c, q, s);
      mesh.setMatrixAt(i, m);
      this.rowMatrices.push(m.clone());
      mesh.setColorAt(i, col);
      r._i = i;
    });
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.kind = 'rows';
    this.root.add(mesh);
    // destaque de seleção
    const hmat = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.45, depthWrite: false });
    this.selMesh = new THREE.InstancedMesh(geo, hmat, n);
    this.selMesh.count = 0;
    this.selMesh.renderOrder = 2;
    this.root.add(this.selMesh);
    this.hoverMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.hoverMesh.visible = false;
    this.root.add(this.hoverMesh);
  }

  ribbon(pts, width, y, color) {
    const verts = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const nx = -dy * width / 2, ny = dx * width / 2;
      const a = this.W(pts[i][0] + nx, pts[i][1] + ny, y), b = this.W(pts[i][0] - nx, pts[i][1] - ny, y);
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  }

  buildNetwork(farm) {
    const grp = new THREE.Group();
    const spec = { adutora: [3, '#1565a8', 0.35], captacao: [2.6, '#1565a8', 0.35], principal: [2, '#1e88d0', 0.4], derivacao: [1.1, '#5fc0f0', 0.45] };
    for (const p of farm.pipes) {
      const [w, c, y] = spec[p.tipo] || [1, '#4af', 0.4];
      const m = this.ribbon(p.pts, w, y, c);
      m.userData = { pick: { tipo: 'tubo', id: p.id } };
      grp.add(m);
    }
    this.netGroup = grp;
    this.root.add(grp);
    // cruzetas instanciadas
    const cz = farm.cruzetas;
    const g = new THREE.OctahedronGeometry(0.9, 0);
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#ffffff' }), cz.length);
    const m = new THREE.Matrix4();
    cz.forEach((a, i) => {
      m.makeTranslation(...this.W(a.x, a.y, 0.9).toArray());
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, C(a.sub === 'Tê' ? '#9ad1ef' : '#e8f6ff'));
    });
    mesh.userData.kind = 'cruzetas';
    mesh.userData.list = cz;
    this.czMesh = mesh;
    this.root.add(mesh);
  }

  assetMesh(a) {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const add = (geo, c, y) => { const m = new THREE.Mesh(geo, mat(c)); m.position.y = y; g.add(m); return m; };
    switch (a.tipo) {
      case 'bomba': add(new THREE.CylinderGeometry(0.8, 0.8, 2.2, 14).rotateZ(Math.PI / 2), '#2c6fb7', 0.9); break;
      case 'valvula': add(new THREE.BoxGeometry(1.6, 1.2, 1.6), '#c0392b', 0.6); break;
      case 'rele': add(new THREE.BoxGeometry(0.8, 1.0, 0.5), '#e8b923', 1.4); add(new THREE.CylinderGeometry(0.05, 0.05, 2.6), '#444', 1.3); add(new THREE.CylinderGeometry(0.06, 0.06, 1.2), '#222', 3.2); break;
      case 'manometro': add(new THREE.CylinderGeometry(0.06, 0.06, 1.2), '#555', 0.6); add(new THREE.SphereGeometry(0.4, 10, 8), '#f4f4f4', 1.3); break;
      case 'ventosa': add(new THREE.ConeGeometry(0.6, 1.4, 10), '#2e8b57', 0.7); break;
      case 'final': add(new THREE.CylinderGeometry(0.4, 0.4, 1, 10), '#7f8c8d', 0.5); break;
      case 'tensiometro': add(new THREE.CylinderGeometry(0.12, 0.12, 1.6), '#ecf0f1', 0.8); add(new THREE.CylinderGeometry(0.12, 0.12, 1.2), '#ecf0f1', 0.6).position.x = 0.5; break;
      case 'pluviometro': add(new THREE.CylinderGeometry(0.05, 0.05, 1.5), '#555', 0.75); add(new THREE.CylinderGeometry(0.3, 0.25, 0.6, 12), '#dfe6e9', 1.7); break;
      case 'cabecal': add(new THREE.BoxGeometry(3, 1.2, 2), '#2471a3', 0.6); add(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 10).rotateZ(Math.PI / 2), '#5dade2', 1.4); break;
      case 'casa': add(new THREE.BoxGeometry(22, 4, 14), '#e9e4da', 2); add(new THREE.BoxGeometry(23, 0.5, 15.5), '#5d8aa8', 4.3); break;
      case 'filtro': for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 10), '#d35400', 0.7).position.x = i * 0.8 - 2; break;
      case 'injetor': add(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 16), '#f1c40f', 1.3); add(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 16), '#27ae60', 1.3).position.x = 3.2; break;
      case 'quadro': add(new THREE.BoxGeometry(1.6, 2, 0.6), '#95a5a6', 1); break;
      case 'controlador': add(new THREE.BoxGeometry(1.2, 1.6, 0.5), '#34495e', 0.8); break;
      case 'estacao': add(new THREE.CylinderGeometry(0.08, 0.08, 6), '#7f8c8d', 3); add(new THREE.BoxGeometry(0.8, 0.5, 0.5), '#ecf0f1', 5.5); add(new THREE.ConeGeometry(0.3, 0.6, 3).rotateZ(Math.PI / 2), '#bdc3c7', 6.2); break;
      case 'terreiro': add(new THREE.BoxGeometry(18, 5, 12), '#d5d0c4', 2.5).position.x = 38; add(new THREE.CylinderGeometry(2.5, 2.5, 9, 16).rotateZ(Math.PI / 2), '#a0a7ad', 3).position.set(38, 3, 12); break;
      default: return null;
    }
    return g;
  }

  buildAssets(farm) {
    const grp = new THREE.Group();
    this.assetObjs = new Map();
    for (const a of farm.assets) {
      if (a.tipo === 'cruzeta' && a.rua) continue;
      if (a.tipo === 'reservatorio' || a.tipo === 'acude') continue;
      let o = this.assetMesh(a);
      if (!o) {
        if (a.tipo !== 'cruzeta') continue;
        o = new THREE.Group();
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), new THREE.MeshLambertMaterial({ color: '#e8f6ff' }));
        m.position.y = 1; o.add(m);
      }
      o.position.copy(this.W(a.x, a.y, 0));
      o.traverse((c) => { c.userData.pick = { tipo: 'ativo', id: a.id }; });
      // anel de status
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3fae5a', transparent: true, opacity: 0.85 }));
      ring.position.y = 0.2;
      ring.userData.pick = { tipo: 'ativo', id: a.id };
      ring.visible = false;
      o.add(ring);
      o.userData.ring = ring;
      if (['bomba', 'valvula', 'rele', 'cabecal', 'casa', 'filtro', 'injetor', 'estacao', 'terreiro', 'controlador'].includes(a.tipo)) {
        const lab = this.label(a.id, 'lab lab-asset');
        lab.position.set(0, a.tipo === 'casa' ? 7 : 4, 0);
        lab.userData.minDist = a.tipo === 'casa' || a.tipo === 'terreiro' ? 3000 : 700;
        o.add(lab);
      }
      grp.add(o);
      this.assetObjs.set(a.id, o);
    }
    this.assetGroup = grp;
    this.root.add(grp);
  }

  label(text, cls = 'lab') {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    const o = new CSS2DObject(d);
    return o;
  }

  buildRegionLabels(farm) {
    this.regionLabels = [];
    for (const reg of farm.regions) {
      const l = this.label(reg.nome, 'lab lab-reg');
      l.element.style.setProperty('--c', reg.cor);
      l.position.copy(this.W(reg.centro[0], reg.centro[1], 12));
      l.userData.maxDist = 99999;
      l.userData.minDist = 0;
      this.root.add(l);
      this.regionLabels.push(l);
    }
  }

  // ---------------------------------------------------------------- estado visual
  setRowColors(fn) {
    if (!this.rowMesh) return;
    const c = new THREE.Color();
    this.farm.rows.forEach((r, i) => { c.set(fn(r) || '#3f7a46'); this.rowMesh.setColorAt(i, c); });
    this.rowMesh.instanceColor.needsUpdate = true;
    if (this.nearRows && this.nearRows.size) this.updateNear(true);
    this.dirty = true;
  }

  setAssetStatus(fnStatus) {
    if (!this.assetObjs) return;
    for (const [id, o] of this.assetObjs) {
      const st = fnStatus(id);
      const ring = o.userData.ring;
      if (!ring) continue;
      ring.material.color.set(STATUS_COR[st] || STATUS_COR.ok);
      ring.visible = this.mode === 'irrigacao' || st !== 'ok';
    }
    if (this.czMesh) {
      const c = new THREE.Color();
      this.farm.cruzetas.forEach((a, i) => {
        const st = fnStatus(a.id);
        c.set(st === 'ok' ? (a.sub === 'Tê' ? '#9ad1ef' : '#e8f6ff') : STATUS_COR[st]);
        this.czMesh.setColorAt(i, c);
      });
      this.czMesh.instanceColor.needsUpdate = true;
    }
    this.dirty = true;
  }

  setMode(mode) {
    this.mode = mode;
    this.layers.irrigacao = mode === 'irrigacao';
    this.layers.cruzetas = mode === 'irrigacao';
    this.applyLayers();
  }
  setLayer(k, v) { this.layers[k] = v; this.applyLayers(); }
  applyLayers() {
    if (this.netGroup) this.netGroup.visible = this.layers.irrigacao;
    if (this.czMesh) this.czMesh.visible = this.layers.cruzetas;
    if (this.assetGroup) this.assetGroup.visible = this.layers.ativos;
    if (this.equipGroup) this.equipGroup.visible = this.layers.equipamentos;
    if (this.markerGroup) this.markerGroup.visible = this.layers.manutencao;
    if (this.rowMesh) {
      this.rowMesh.material.transparent = this.mode === 'irrigacao';
      this.rowMesh.material.opacity = this.mode === 'irrigacao' ? 0.55 : 1;
      this.rowMesh.material.needsUpdate = true;
    }
    this.updateLabelVisibility();
    this.dirty = true;
  }

  updateLabelVisibility() {
    if (!this.farm) return;
    const cam = this.camera.position;
    const show = this.layers.rotulos;
    const vis = (o) => {
      if (!o.isCSS2DObject) return;
      const wp = o.getWorldPosition(new THREE.Vector3());
      const d = wp.distanceTo(cam);
      const minD = o.userData.minDist ?? 700;
      let parentVisible = true;
      let p = o.parent;
      while (p) { if (p.visible === false) { parentVisible = false; break; } p = p.parent; }
      o.visible = show && parentVisible && d < minD;
      o.element.style.display = o.visible ? '' : 'none';
    };
    this.root.traverse(vis);
    for (const l of this.regionLabels || []) { l.visible = true; l.element.style.display = ''; }
  }

  // seleção de ruas + plantas pé a pé
  setSelection(rowIds, opts = {}) {
    this.selected = new Set(rowIds);
    const rows = [...this.selected].map((id) => this.farm.rowById.get(id)).filter(Boolean);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const pe = rows.length <= 6;
    let k = 0;
    if (!pe) for (const r of rows) {
      this.rowMatrices[r._i].decompose(p, q, s);
      s.x += 0.6; s.y += 0.25; s.z += 0.5;
      m.compose(p, q, s);
      this.selMesh.setMatrixAt(k++, m);
    }
    this.selMesh.count = k;
    this.selMesh.instanceMatrix.needsUpdate = true;
    this.fullRows = new Set(pe ? rows.map((r) => r.id) : []);
    this.plantaSel = opts.plantaSel || null;
    this.plantGroup.clear();
    this.plantPick = [];
    this.plantRows = pe ? rows : [];
    if (pe && rows.length) this.plantPick = this.buildPlants(this.plantGroup, rows.map((r) => ({ r, j0: 0, j1: r.nPl - 1 })), { drip: true, emissores: rows.length <= 4 });
    this.updateNear(true);
    this.refreshRowMatrices();
    this.dirty = true;
  }

  refreshRowMatrices() {
    const zero = new THREE.Vector3(1, 0.0001, 0.0001);
    this.farm.rows.forEach((r, i) => {
      if (this.fullRows.has(r.id) || this.nearRows.has(r.id)) this.rowMesh.setMatrixAt(i, this.rowMatrices[i].clone().scale(zero));
      else this.rowMesh.setMatrixAt(i, this.rowMatrices[i]);
    });
    this.rowMesh.instanceMatrix.needsUpdate = true;
    this.rowMesh.computeBoundingSphere();
    this.dirty = true;
  }

  // Tipo de fruto/flor visível conforme o mês e o estágio da região
  frutaDe(reg) {
    const mes = new Date(this.model.hoje).getMonth() + 1;
    const jovem = this.model.safra - reg.plantio < 2;
    if (jovem) return null;
    const amarelo = /amarel/i.test(reg.variedade);
    if (mes === 9 || mes === 10) return { k: 'flor', cor: '#f6f3ea', n: 16, tam: 0.024 };
    if (mes === 11 || mes === 12 || mes === 1) return { k: 'chumbinho', cor: '#4f8a2c', n: 12, tam: 0.018 };
    if (mes === 2 || mes === 3) return { k: 'verde', cor: '#73a83a', n: 14, tam: 0.026 };
    if (mes === 4) return { k: 'cana', cor: amarelo ? '#c9b23a' : '#c46a2a', n: 14, tam: 0.028 };
    return { k: amarelo ? 'amarelo' : 'cereja', cor: amarelo ? '#e3b51c' : '#b3231c', n: 16, tam: 0.03 };
  }
  geoPe(fruta, variante) {
    const key = `${fruta ? fruta.k : 'nada'}-${variante}`;
    if (!this.geoCache.has(key)) this.geoCache.set(key, coffeeGeometry(1000 + variante * 7919, fruta));
    return this.geoCache.get(key);
  }

  // specs: [{ r, j0, j1 }] — desenha cafeeiros da cova j0 à j1 de cada rua
  buildPlants(group, specs, { drip = false, emissores = false } = {}) {
    const buckets = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const col = new THREE.Color();
    const falhaPts = [], mortaPts = [];
    const dripPts = [];
    const sel = this.plantaSel;
    const up = new THREE.Vector3(0, 1, 0);
    for (const { r, j0, j1 } of specs) {
      const reg = this.farm.regionById.get(r.reg);
      const pl = this.model.plantas(r);
      const fruta = this.frutaDe(reg);
      for (let j = j0; j <= j1; j++) {
        const [x, y] = plantPos(r, reg, j);
        const st = this.model.plantStatus(pl, j);
        if (st === 'falha') { falhaPts.push([x, y]); continue; }
        const hsh = ((j + 1) * 2654435761 + r.idx * 40503) >>> 0;
        const varI = hsh % 3;
        let h = reg.altura, w = reg.largCopa;
        const jit = 0.88 + ((hsh >>> 8) % 100) / 400;
        let fr = fruta;
        if (st === 'replantada') { h = Math.min(h, 0.45); w = Math.min(w, 0.35); fr = null; }
        else if (st === 'baixa') { h *= 0.72; w *= 0.72; }
        else if (st === 'morta') { h *= 0.5; w *= 0.45; fr = null; mortaPts.push([x, y]); }
        const key = `${fr ? fr.k : 'nada'}|${varI}`;
        if (!buckets.has(key)) buckets.set(key, { geo: this.geoPe(fr, varI), mats: [], cols: [], idx: [] });
        const b = buckets.get(key);
        q.setFromAxisAngle(up, (hsh % 628) / 100);
        s.set(w * jit, h * jit, w * jit * (0.92 + (hsh % 17) / 100));
        m.compose(this.W(x, y, 0), q, s);
        b.mats.push(m.clone());
        if (sel && sel.row === r.id && sel.j === j) col.set('#ffe066');
        else if (st === 'doente') col.set('#e6c766');
        else if (st === 'baixa') col.set('#d6cfa0');
        else if (st === 'morta') col.set('#7a5a40');
        else { const v = 0.86 + ((hsh >>> 4) % 20) / 100; col.setRGB(v, v * (0.98 + ((hsh >>> 12) % 5) / 100), v); }
        b.cols.push(col.clone());
        b.idx.push([r, j]);
      }
      if (drip) dripPts.push(this.W(r.x1, r.y1, 0.05), this.W(r.x2, r.y2, 0.05));
    }
    const mat = this._peMat || (this._peMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const pick = [];
    for (const b of buckets.values()) {
      const im = new THREE.InstancedMesh(b.geo, mat, b.mats.length);
      b.mats.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, b.cols[i]); });
      im.userData.index = b.idx;
      im.computeBoundingSphere();
      group.add(im);
      pick.push(im);
    }
    // palhada/terra fofa sob a linha e linha gotejadora
    if (drip && dripPts.length) group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(dripPts), new THREE.LineBasicMaterial({ color: '#111111' })));
    if (falhaPts.length) {
      const fm = new THREE.InstancedMesh(new THREE.RingGeometry(0.2, 0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e04b3a' }), falhaPts.length);
      falhaPts.forEach(([x, y], k) => { m.makeTranslation(...this.W(x, y, 0.06).toArray()); fm.setMatrixAt(k, m); });
      group.add(fm);
    }
    if (sel) {
      const r = this.farm.rowById.get(sel.row);
      if (r && specs.some((sp) => sp.r === r && sel.j >= sp.j0 && sel.j <= sp.j1)) {
        const [x, y] = plantPos(r, this.farm.regionById.get(r.reg), sel.j);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a' }));
        ring.position.copy(this.W(x, y, 0.07));
        group.add(ring);
      }
    }
    if (emissores) {
      const pts = [];
      for (const { r } of specs) {
        const reg = this.farm.regionById.get(r.reg);
        for (let g = 0; g < r.nGot; g++) {
          const t = (reg.gotEsp / 2 + g * reg.gotEsp) / r.len;
          pts.push(this.W(r.x1 + (r.x2 - r.x1) * t, r.y1 + (r.y2 - r.y1) * t, 0.08));
        }
      }
      group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: '#4fc3f7', size: 0.16, sizeAttenuation: true })));
    }
    return pick;
  }

  // Pés de café automáticos ao redor do ponto de vista quando a câmera chega perto do chão
  updateNear(force = false) {
    if (!this.farm || !this.nearGroup) return;
    const t = this.controls.target;
    const dist = this.camera.position.distanceTo(t);
    const limpar = () => {
      if (this.nearKey === null && !this.nearRows.size) return;
      this.nearKey = null; this.nearGroup.clear(); this.nearPick = []; this.nearRows = new Set();
      this.stubMesh.count = 0; this.refreshRowMatrices();
    };
    if (dist > 140 || this.paused) { limpar(); return; }
    const wx = t.x + this.ox, wy = -t.z + this.oy;
    const reg = this.farm.regions.find((r) => inPoly(wx, wy, r.poly));
    if (!reg) { limpar(); return; }
    const a = wx * reg.u[0] + wy * reg.u[1], b = wx * reg.v[0] + wy * reg.v[1];
    const key = `${reg.id}:${Math.round(b / reg.espLinha)}:${Math.round(a / 15)}:${[...this.fullRows].join(',')}:${this.plantaSel ? this.plantaSel.row + this.plantaSel.j : ''}`;
    if (!force && key === this.nearKey) return;
    this.nearKey = key;
    const WIN = 95, N = 6;
    const specs = [];
    for (const r of reg.rows) {
      if (Math.abs(r.b - b) > (N + 0.5) * reg.espLinha || this.fullRows.has(r.id)) continue;
      if (a < r.a1 - WIN || a > r.a2 + WIN) continue;
      const used = (r.nPl - 1) * reg.espPlanta, off = (r.len - used) / 2;
      const j0 = clamp(Math.floor((a - WIN - r.a1 - off) / reg.espPlanta), 0, r.nPl - 1);
      const j1 = clamp(Math.ceil((a + WIN - r.a1 - off) / reg.espPlanta), 0, r.nPl - 1);
      if (j1 > j0) specs.push({ r, j0, j1, off });
    }
    this.nearGroup.clear();
    this.nearPick = specs.length ? this.buildPlants(this.nearGroup, specs, { drip: true }) : [];
    // trechos da rua fora da janela continuam como renque
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const col = new THREE.Color();
    let k = 0;
    this.stubMesh.userData.rows = [];
    for (const sp of specs) {
      const r = sp.r;
      this.rowMatrices[r._i].decompose(p, q, s);
      this.rowMesh.getColorAt(r._i, col);
      const esp = reg.espPlanta;
      const cortes = [[0, sp.off + sp.j0 * esp - esp / 2], [sp.off + sp.j1 * esp + esp / 2, r.len]];
      for (const [d0, d1] of cortes) {
        if (d1 - d0 < 0.5 || k >= 64) continue;
        const mid = (d0 + d1) / 2 / r.len;
        const c = this.W(r.x1 + (r.x2 - r.x1) * mid, r.y1 + (r.y2 - r.y1) * mid, 0);
        m.compose(c, q, new THREE.Vector3(d1 - d0, s.y, s.z));
        this.stubMesh.setMatrixAt(k, m);
        this.stubMesh.setColorAt(k, col);
        this.stubMesh.userData.rows[k] = r.id;
        k++;
      }
    }
    this.stubMesh.count = k;
    this.stubMesh.instanceMatrix.needsUpdate = true;
    if (this.stubMesh.instanceColor) this.stubMesh.instanceColor.needsUpdate = true;
    this.stubMesh.computeBoundingSphere();
    this.nearRows = new Set(specs.map((sp) => sp.r.id));
    this.refreshRowMatrices();
  }

  setHover(row) {
    if (!row) { if (this.hoverMesh.visible) { this.hoverMesh.visible = false; this.dirty = true; } return; }
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    this.rowMatrices[row._i].decompose(p, q, s);
    s.x += 0.4; s.y += 0.15; s.z += 0.4;
    this.hoverMesh.position.copy(p); this.hoverMesh.quaternion.copy(q); this.hoverMesh.scale.copy(s);
    this.hoverMesh.visible = true;
    this.dirty = true;
  }

  // ---------------------------------------------------------------- equipamentos
  equipMesh(tipo) {
    const g = new THREE.Group();
    const cor = TIPOS_EQUIP[tipo]?.cor || '#888';
    const L = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const mat = L(cor), dark = L('#222222'), metal = L('#9aa3ab'), glass = new THREE.MeshLambertMaterial({ color: '#a9d8ff', transparent: true, opacity: 0.55 }), aro = L('#d9d4c7');
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    const box = (w, h, d, m, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    const wheels = [];
    const roda = (r, larg, x, z) => {
      const w = new THREE.Group();
      const pneu = new THREE.Mesh(new THREE.CylinderGeometry(r, r, larg, 18).rotateX(Math.PI / 2), dark);
      const cubo = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, larg + 0.02, 10).rotateX(Math.PI / 2), aro);
      const raio = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 0.18, larg + 0.04), dark);
      w.add(pneu, cubo, raio);
      w.position.set(x, r, z);
      w.userData.r = r;
      g.add(w); wheels.push(w);
      return w;
    };
    const cabine = (x, y, w = 1.3, h = 1.4, d = 1.3) => {
      for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) box(0.07, h, 0.07, dark, x + dx * w / 2, y + h / 2, dz * d / 2);
      box(w + 0.15, 0.1, d + 0.15, mat, x, y + h, 0);
      box(w, h * 0.92, d, glass, x, y + h * 0.46, 0);
      box(0.4, 0.5, 0.6, dark, x + 0.2, y + 0.25, 0);
    };
    const trator = () => {
      box(1.9, 0.75, 0.9, mat, 1.0, 1.15, 0);           // capô
      box(0.12, 0.6, 0.85, dark, 1.98, 1.1, 0);         // grade
      box(1.2, 0.35, 1.0, mat, -0.2, 0.95, 0);          // carcaça
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), metal, 1.5, 1.9, 0.3);  // escapamento
      cabine(-0.2, 1.1);
      roda(0.82, 0.45, -0.25, 0.95); roda(0.82, 0.45, -0.25, -0.95);
      roda(0.48, 0.3, 1.45, 0.85); roda(0.48, 0.3, 1.45, -0.85);
      box(0.3, 0.2, 0.3, metal, -1.0, 0.6, 0);          // engate
    };
    if (tipo === 'colhedora') {
      // pórtico que passa por cima da rua de café
      const amar = mat;
      for (const z of [-1.7, 1.7]) {
        box(4.6, 0.6, 0.55, amar, 0, 3.7, z);
        box(4.4, 2.6, 0.5, amar, 0, 2.1, z);
        roda(0.55, 0.35, 1.7, z); roda(0.55, 0.35, -1.7, z);
      }
      box(4.8, 0.45, 3.9, amar, 0, 4.15, 0);
      box(1.2, 0.8, 1.2, metal, -1.6, 4.8, 0.9);         // graneleiro
      add(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8).rotateZ(Math.PI / 2.6), metal, -2.4, 4.5, 1.7);
      cabine(1.4, 4.4, 1.3, 1.3, 1.2);
      // cilindros vibratórios (varetas) dos dois lados da rua
      for (const z of [-0.65, 0.65]) add(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 12), L('#5c5c5c'), 0, 2.0, z);
    } else if (tipo === 'caminhao') {
      box(2.0, 2.0, 2.3, mat, 3.0, 1.6, 0); box(0.6, 1.0, 2.2, glass, 4.0, 2.0, 0);
      box(5.8, 2.3, 2.45, L('#d5d0c4'), -1.0, 1.85, 0);
      roda(0.5, 0.35, 3.0, 1.1); roda(0.5, 0.35, 3.0, -1.1); roda(0.5, 0.35, -2.4, 1.1); roda(0.5, 0.35, -2.4, -1.1); roda(0.5, 0.35, -1.3, 1.1); roda(0.5, 0.35, -1.3, -1.1);
    } else if (tipo === 'recolhedora') {
      box(3.6, 1.6, 1.9, mat, 0, 1.3, 0); cabine(1.1, 2.1, 1.1, 1.1, 1.1);
      box(1.0, 0.3, 2.2, metal, 2.2, 0.25, 0);
      roda(0.55, 0.35, -1.0, 1.0); roda(0.55, 0.35, -1.0, -1.0); roda(0.45, 0.3, 1.1, 1.0); roda(0.45, 0.3, 1.1, -1.0);
    } else {
      trator();
      if (tipo === 'pulverizador') {
        add(new THREE.CylinderGeometry(0.75, 0.75, 2.2, 16).rotateZ(Math.PI / 2), L('#f2f2f2'), -2.6, 1.25, 0);
        add(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 16).rotateZ(Math.PI / 2), L('#4a4a4a'), -3.9, 1.25, 0); // ventilador
        roda(0.4, 0.25, -2.6, 0.85); roda(0.4, 0.25, -2.6, -0.85);
        const nevoa = new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.35, depthWrite: false });
        const spray = [];
        for (const sgn of [-1, 1]) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 14, 1, true), nevoa);
          c.rotation.x = sgn * Math.PI / 2;
          c.position.set(-3.9, 1.6, sgn * 1.7);
          g.add(c); spray.push(c);
        }
        g.userData.spray = spray;
      }
      if (tipo === 'adubadora') { box(1.6, 1.0, 1.5, L('#d35400'), -2.2, 1.6, 0); add(new THREE.ConeGeometry(0.7, 0.6, 4).rotateX(Math.PI), L('#d35400'), -2.2, 0.85, 0); add(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10), metal, -2.2, 0.45, 0); }
      if (tipo === 'rocadeira') { box(1.3, 0.35, 2.8, L('#f39c12'), -1.9, 0.35, 0.4); }
      if (tipo === 'esparramadora') { box(1.1, 0.7, 2.6, L('#b08d57'), -1.9, 0.55, 0); }
      if (tipo === 'bazuca') {
        box(4.2, 0.2, 2.0, metal, -3.6, 0.95, 0);
        add(new THREE.CylinderGeometry(1.05, 0.9, 3.6, 16).rotateZ(Math.PI / 2), mat, -3.6, 2.0, 0);
        add(new THREE.CylinderGeometry(0.15, 0.15, 3.4, 8).rotateZ(-Math.PI / 4), metal, -2.2, 3.4, 1.0);
        roda(0.55, 0.35, -3.6, 1.05); roda(0.55, 0.35, -3.6, -1.05);
      }
    }
    g.userData.wheels = wheels;
    return g;
  }

  updateEquip(machines) {
    if (!this.equipGroup) return;
    const seen = new Set();
    const now = performance.now();
    for (const mc of machines) {
      seen.add(mc.id);
      let o = this.equipObjs.get(mc.id);
      if (!o) {
        const body = this.equipMesh(mc.tipo);
        body.traverse((c) => (c.userData.pick = { tipo: 'equip', id: mc.id }));
        const lab = this.label('', 'lab lab-eq');
        lab.position.set(0, mc.tipo === 'colhedora' ? 7.5 : 5, 0);
        lab.userData.minDist = 2500;
        body.add(lab);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 3000), 3));
        trailGeo.setDrawRange(0, 0);
        const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: TIPOS_EQUIP[mc.tipo]?.cor || '#fff' }));
        this.equipGroup.add(body);
        this.equipGroup.add(trail);
        o = { body, lab, trail, last: null };
        this.equipObjs.set(mc.id, o);
      }
      const pos = this.W(mc.x, mc.y, 0);
      const moved = o.last ? pos.distanceTo(o.last) : 0;
      o.last = pos.clone();
      o.body.position.copy(pos);
      o.body.rotation.y = mc.heading;
      for (const w of o.body.userData.wheels || []) w.rotation.z -= moved / (w.userData.r || 0.5);
      const spray = o.body.userData.spray;
      if (spray) { const on = mc.estado === 'operando' && !!mc.rua; for (const c of spray) { c.visible = on; c.material.opacity = 0.22 + 0.12 * Math.sin(now / 90 + c.position.z); } }
      o.lab.element.textContent = `${mc.nome} · ${mc.vel.toFixed(1)} km/h`;
      o.lab.element.dataset.st = mc.estado;
      o.lab.userData.minDist = mc.estado === 'parado' ? 260 : 2500;
      const tr = mc.trail;
      const arr = o.trail.geometry.attributes.position.array;
      const n = Math.min(tr.length, 3000);
      for (let i = 0; i < n; i++) {
        const p = tr[tr.length - n + i];
        arr[i * 3] = p[0] - this.ox; arr[i * 3 + 1] = 0.3; arr[i * 3 + 2] = -(p[1] - this.oy);
      }
      o.trail.geometry.attributes.position.needsUpdate = true;
      o.trail.geometry.setDrawRange(0, n);
      o.trail.geometry.computeBoundingSphere();
    }
    for (const [id, o] of this.equipObjs) if (!seen.has(id)) { this.equipGroup.remove(o.body); this.equipGroup.remove(o.trail); o.lab.element.remove(); this.equipObjs.delete(id); }
    this.dirty = true;
  }

  // Câmera acompanhando uma máquina: 'atras', 'lateral', 'cima' ou 'livre'
  follow(mc, modo = 'atras') {
    const T = this.W(mc.x, mc.y, 0);
    this._fh = this._fh == null ? mc.heading : lerpAngle(this._fh, mc.heading, 0.04);
    const dir = new THREE.Vector3(Math.cos(this._fh), 0, -Math.sin(this._fh));
    const alvo = T.clone().add(new THREE.Vector3(0, mc.tipo === 'colhedora' ? 2.5 : 1.3, 0));
    if (modo === 'livre') {
      const d = alvo.clone().sub(this.controls.target);
      this.camera.position.add(d);
      this.controls.target.copy(alvo);
    } else {
      let off;
      if (modo === 'lateral') off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(14).add(new THREE.Vector3(0, 4.5, 0)).add(dir.clone().multiplyScalar(-3));
      else if (modo === 'cima') off = new THREE.Vector3(0, 48, 0).add(dir.clone().multiplyScalar(-4));
      else off = dir.clone().multiplyScalar(mc.tipo === 'colhedora' ? -19 : -15).add(new THREE.Vector3(0, mc.tipo === 'colhedora' ? 9 : 6.5, 0));
      this.camera.position.lerp(alvo.clone().add(off), 0.07);
      this.controls.target.lerp(alvo, 0.18);
    }
    this.dirty = true;
  }
  stopFollow() { this._fh = null; }

  updateMarkers(items) {
    if (!this.markerGroup) return;
    for (const o of this.markerObjs) { this.markerGroup.remove(o); o.traverse((c) => c.isCSS2DObject && c.element.remove()); }
    this.markerObjs = [];
    for (const it of items) {
      const g = new THREE.Group();
      const pin = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 12).rotateX(Math.PI), new THREE.MeshLambertMaterial({ color: it.prioridade === 'Alta' ? '#e04b3a' : it.prioridade === 'Média' ? '#e0a526' : '#5fa8d3' }));
      pin.position.y = 5;
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), pin.material);
      head.position.y = 7.5;
      g.add(pin, head);
      g.position.copy(this.W(it.x, it.y, 0));
      g.traverse((c) => (c.userData.pick = { tipo: 'manut', id: it.id }));
      const lab = this.label(it.titulo, 'lab lab-mt');
      lab.position.set(0, 10, 0);
      lab.userData.minDist = 900;
      g.add(lab);
      this.markerGroup.add(g);
      this.markerObjs.push(g);
    }
    this.updateLabelVisibility();
    this.dirty = true;
  }

  // ---------------------------------------------------------------- câmera
  frameAll(anim = true) {
    const b = this.farm.bounds;
    const w = Math.max(b.w, b.h);
    this.flyToXY((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 - w * 0.05, w * 1.05 * Math.max(1, 1.25 / (this.camera.aspect || 1)), anim, 0.9);
  }
  flyToXY(x, y, dist = 120, anim = true, tilt = 0.75) {
    const target = this.W(x, y, 0);
    const pos = target.clone().add(new THREE.Vector3(0, dist * Math.cos(1 - tilt) * 0.9, dist * 0.55));
    if (!anim) { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); this.dirty = true; return; }
    this.anim = { t0: performance.now(), dur: 900, p0: this.camera.position.clone(), p1: pos, q0: this.controls.target.clone(), q1: target };
  }
  flyToRow(row) {
    const reg = this.farm.regionById.get(row.reg);
    this.flyToXY((row.x1 + row.x2) / 2, (row.y1 + row.y2) / 2, Math.min(260, row.len * 0.6 + 30));
    return reg;
  }

  // ---------------------------------------------------------------- interação
  bindPointer() {
    const el = this.labelRenderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 7 && performance.now() - down.t < 600) {
        const hit = this.pick(e.clientX, e.clientY);
        this.hooks.onPick?.(hit, e);
      }
      down = null;
    });
    let last = 0;
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || down) return;
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      const hit = this.pick(e.clientX, e.clientY, true);
      this.hooks.onHover?.(hit, e);
    });
    el.addEventListener('pointerleave', () => this.hooks.onHover?.(null));
  }

  pick(cx, cy, hoverOnly = false) {
    if (!this.farm) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (!hoverOnly) {
      const objs = [];
      if (this.equipGroup.visible) objs.push(this.equipGroup);
      if (this.markerGroup.visible) objs.push(this.markerGroup);
      if (this.assetGroup.visible) objs.push(this.assetGroup);
      let hits = this.ray.intersectObjects(objs, true).filter((h) => h.object.userData.pick && h.object.visible);
      if (hits.length) return hits[0].object.userData.pick;
      if (this.czMesh.visible) {
        hits = this.ray.intersectObject(this.czMesh);
        if (hits.length) return { tipo: 'ativo', id: this.farm.cruzetas[hits[0].instanceId].id };
      }
      const pm = [...(this.plantPick || []), ...(this.nearPick || [])];
      if (pm.length) {
        hits = this.ray.intersectObjects(pm);
        if (hits.length) { const [r, j] = hits[0].object.userData.index[hits[0].instanceId]; return { tipo: 'planta', row: r.id, j }; }
      }
      if (this.stubMesh.count) {
        hits = this.ray.intersectObject(this.stubMesh);
        if (hits.length) return { tipo: 'rua', id: this.stubMesh.userData.rows[hits[0].instanceId] };
      }
    }
    const hits = this.ray.intersectObject(this.rowMesh);
    if (hits.length) return { tipo: 'rua', id: this.farm.rows[hits[0].instanceId].id };
    if (!hoverOnly) {
      const h2 = this.ray.intersectObjects(this.pickables || []);
      if (h2.length) return h2[0].object.userData.pick;
      if (this.netGroup.visible) {
        const h3 = this.ray.intersectObjects(this.netGroup.children);
        if (h3.length) return h3[0].object.userData.pick;
      }
    }
    return null;
  }

  // ponto do chão sob o cursor (para posicionar registros)
  groundPoint(cx, cy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const p = new THREE.Vector3();
    this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    return [p.x + this.ox, -p.z + this.oy];
  }

  loop(t) {
    requestAnimationFrame(this.loop);
    if (this.paused) return;
    if (this.anim) {
      const a = this.anim;
      const k = Math.min(1, (t - a.t0) / a.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(a.p0, a.p1, e);
      this.controls.target.lerpVectors(a.q0, a.q1, e);
      if (k >= 1) { this.anim = null; this.updateLabelVisibility(); }
      this.dirty = true;
    }
    this.controls.update();
    if (t - (this._nearT || 0) > 250) { this._nearT = t; this.updateNear(); }
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}

function inPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + d * t;
}

// Renque de café visto de longe: perfil arredondado (mais largo no meio, copa no alto)
function hedgeGeometry() {
  const prof = [[-0.16, 0], [-0.4, 0.1], [-0.5, 0.34], [-0.48, 0.6], [-0.38, 0.82], [-0.2, 0.96], [0, 1], [0.2, 0.96], [0.38, 0.82], [0.48, 0.6], [0.5, 0.34], [0.4, 0.1], [0.16, 0]];
  const pos = [], col = [];
  const tom = (y) => 0.5 + 0.5 * y;
  const v = (x, z, y) => { pos.push(x, y, z); const k = tom(y); col.push(k * 0.96, k, k * 0.94); };
  const n = prof.length;
  for (let i = 0; i < n; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[(i + 1) % n];
    v(-0.5, z0, y0); v(0.5, z0, y0); v(0.5, z1, y1);
    v(-0.5, z0, y0); v(0.5, z1, y1); v(-0.5, z1, y1);
  }
  for (const x of [-0.5, 0.5]) for (let i = 0; i < n; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[(i + 1) % n];
    v(x, 0, 0.5); v(x, z0, y0); v(x, z1, y1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Cafeeiro estilizado (altura 1, diâmetro 1): tronco, saias de folhagem em camadas
// afinando para o topo e frutos/flores conforme a fase.
function coffeeGeometry(seed, fruta) {
  const R = rng(seed);
  const parts = [];
  const pinta = (geo, fn) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.normal) g.deleteAttribute('normal');
    const p = g.attributes.position, c = [];
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), tmp); c.push(tmp.r, tmp.g, tmp.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    return g;
  };
  parts.push(pinta(new THREE.CylinderGeometry(0.028, 0.05, 0.42, 6).translate(0, 0.21, 0), (x, y, z, c) => c.set('#5a3b26')));
  const escuro = new THREE.Color('#214f2a'), claro = new THREE.Color('#67a956'), novo = new THREE.Color('#93c65e');
  // [altura do centro, raio, meia-altura] — mais largo na saia, afinando no ponteiro
  const camadas = [[0.19, 0.48, 0.11], [0.33, 0.5, 0.115], [0.47, 0.46, 0.115], [0.61, 0.39, 0.11], [0.75, 0.29, 0.1], [0.88, 0.18, 0.08], [0.975, 0.07, 0.05]];
  const info = [];
  for (const [cy, r, hh] of camadas) {
    let g = new THREE.IcosahedronGeometry(1, 0);
    const p = g.attributes.position;
    const off = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!off.has(k)) off.set(k, 1 + (R() - 0.5) * 0.3);
      const f = off.get(k);
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * (0.75 + 0.5 * (f - 0.79)), p.getZ(i) * f);
    }
    const rx = r * (0.92 + R() * 0.16), rz = r * (0.92 + R() * 0.16);
    g.scale(rx, hh, rz);
    g.rotateY(R() * Math.PI * 2);
    const dx = (R() - 0.5) * 0.03, dz = (R() - 0.5) * 0.03;
    g.translate(dx, cy, dz);
    info.push({ cy, r: Math.min(rx, rz), hh });
    g = pinta(g, (x, y, z, c) => {
      const t = Math.max(0, Math.min(1, (y - (cy - hh)) / (2 * hh)));
      c.copy(escuro).lerp(claro, 0.25 + 0.55 * t + cy * 0.15);
      if (t > 0.8 && R() < 0.35) c.lerp(novo, 0.5);
      c.offsetHSL(0, 0, (R() - 0.5) * 0.05);
    });
    parts.push(g);
  }
  if (fruta) {
    const base = new THREE.Color(fruta.cor);
    for (let k = 0; k < fruta.n; k++) {
      const L = info[Math.floor(R() * Math.min(5, info.length))];
      const a = R() * Math.PI * 2;
      const rr = L.r * (0.86 + R() * 0.12);
      const y = L.cy + (R() - 0.5) * L.hh * 0.9;
      const cl = new THREE.OctahedronGeometry(fruta.tam * (0.8 + R() * 0.5), 0).translate(Math.cos(a) * rr, y, Math.sin(a) * rr);
      parts.push(pinta(cl, (x, yy, z, c) => { c.copy(base); c.offsetHSL(0, 0, (R() - 0.5) * 0.08); }));
    }
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}
