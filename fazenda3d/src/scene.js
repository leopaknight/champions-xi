// Cena 3D (Three.js): terreno, ruas (instanciadas), plantas pé a pé, rede de
// irrigação, ativos, equipamentos com rastro de GPS e marcadores de manutenção.
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { plantPos } from './farm.js';
import { STATUS_PLANTA, TIPOS_EQUIP } from './catalog.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { scalePoly, rng, clamp } from './util.js';

const C = (h) => new THREE.Color(h);
export const QUALIDADES = {
  ultra: { nome: 'Ultra', pr: 2, sombra: 4096, ao: true, msaa: 4, std: true, folhas: true, raioFolhas: 32, vento: true, janela: 110, linhas: 7 },
  alta: { nome: 'Alta', pr: 1.5, sombra: 2048, ao: false, msaa: 4, std: true, folhas: true, raioFolhas: 20, vento: false, janela: 95, linhas: 6 },
  leve: { nome: 'Leve', pr: 1, sombra: 0, ao: false, msaa: 0, std: false, folhas: false, raioFolhas: 0, vento: false, janela: 70, linhas: 4 },
};
const TEMPO = { value: 0 };
const NOISE_GLSL = `
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`;
const F = (x) => Number(x).toFixed(4);
// Variação procedural de cor no espaço do mundo (textura sem imagem) e balanço ao vento
function detalhe(mat, { escala = 0.1, forca = 0.15, escala2 = 0.8, forca2 = 0.06, vento = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    if (vento) sh.uniforms.uTime = TEMPO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\n${vento ? 'uniform float uTime;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${vento ? `#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
#else
  float ph = 0.0;
#endif
  float hh = max(position.y - 0.3, 0.0);
  transformed.x += sin(uTime * 1.4 + ph) * 0.03 * hh;
  transformed.z += cos(uTime * 1.1 + ph * 1.3) * 0.025 * hh;` : ''}
#ifdef USE_INSTANCING
  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float nA = fbm(vWPos.xz * ${F(escala)});
  float nB = vnoise(vWPos.xz * ${F(escala2)} + vWPos.y * 0.7);
  diffuseColor.rgb *= (1.0 + (nA - 0.5) * ${F(forca * 2)}) * (1.0 + (nB - 0.5) * ${F(forca2 * 2)});`);
  };
  mat.customProgramCacheKey = () => `det-${escala}-${forca}-${escala2}-${forca2}-${vento}`;
  return mat;
}

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
    this.qNome = QUALIDADES[hooks.qualidade] ? hooks.qualidade : 'alta';
    this.q = QUALIDADES[this.qNome];
    this.solDir = new THREE.Vector3(-0.55, 0.72, -0.38).normalize();

    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.renderer = r;
    this.pmrem = new THREE.PMREMGenerator(r);
    const lr = new CSS2DRenderer();
    lr.domElement.className = 'labels3d';
    container.appendChild(lr.domElement);
    this.labelRenderer = lr;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#d3dfe5', 3000, 12000);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 20000);
    this.camera.position.set(0, 1400, 1500);
    this.hemi = new THREE.HemisphereLight('#dde9f5', '#6e4a30', 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d8', 2);
    this.sun.shadow.bias = -0.0003;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const ctl = new MapControls(this.camera, lr.domElement);
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.12;
    ctl.screenSpacePanning = false;
    ctl.maxPolarAngle = Math.PI * 0.47;
    ctl.minDistance = 3;
    ctl.maxDistance = 6500;
    ctl.zoomSpeed = 1.2;
    ctl.addEventListener('change', () => { this.dirty = true; this.updateLabelVisibility(); this.hooks.onCamera?.(); });
    this.controls = ctl;

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.plantPick = [];
    this.nearPick = [];
    this.geoCache = new Map();
    this.frames = [];

    this.setQualidade(this.qNome);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(container);
    this.bindPointer();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // Ajusta renderização, luz, céu e pós-processamento ao nível de qualidade.
  // Materiais dependem do nível: depois de chamar, a cena precisa ser reconstruída (build).
  setQualidade(nome) {
    this.qNome = QUALIDADES[nome] ? nome : 'alta';
    this.q = QUALIDADES[this.qNome];
    const q = this.q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    this.renderer.toneMappingExposure = q.std ? 1.12 : 1.05;
    this.renderer.shadowMap.enabled = q.sombra > 0;
    this.sun.castShadow = q.sombra > 0;
    if (q.sombra) {
      this.sun.shadow.mapSize.set(q.sombra, q.sombra);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.intensity = q.std ? 2.6 : 1.9;
    this.hemi.intensity = q.std ? 0.75 : 1.05;
    this.criarCeu();
    this.configurarPos();
    this._peMat = null;
    this.frames = [];
    this.lentoAvisado = false;
    this.dirty = true;
  }

  criarCeu() {
    const W = 1024, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#3d75b2'); gr.addColorStop(0.3, '#78a6d2'); gr.addColorStop(0.46, '#c7dbe8'); gr.addColorStop(0.5, '#dfe7e8');
    gr.addColorStop(0.52, '#b8b597'); gr.addColorStop(1, '#7f7b58');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // nuvens leves
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * W, y = H * (0.22 + Math.random() * 0.24), rr = 20 + Math.random() * 70;
      const cg = g.createRadialGradient(x, y, 0, x, y, rr);
      cg.addColorStop(0, 'rgba(255,255,255,0.32)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, rr * 2.2, rr * 0.55, 0, 0, Math.PI * 2); g.fill();
    }
    const d = this.solDir;
    const u = Math.atan2(d.z, d.x) / (2 * Math.PI) + 0.5, v = Math.asin(d.y) / Math.PI + 0.5;
    const cx = u * W, cy = (1 - v) * H;
    const sg = g.createRadialGradient(cx, cy, 0, cx, cy, 110);
    sg.addColorStop(0, 'rgba(255,252,240,1)'); sg.addColorStop(0.08, 'rgba(255,246,220,0.9)'); sg.addColorStop(0.3, 'rgba(255,236,200,0.25)'); sg.addColorStop(1, 'rgba(255,236,200,0)');
    g.fillStyle = sg; g.fillRect(cx - 120, cy - 120, 240, 240);
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background?.dispose?.();
    this.scene.background = tex;
    this.scene.environment?.dispose?.();
    this.scene.environment = this.q.std ? this.pmrem.fromEquirectangular(tex).texture : null;
  }

  configurarPos() {
    this.composer?.dispose?.();
    this.composer = null; this.gtao = null;
    if (!this.q.ao) return;
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    const pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: this.q.msaa });
    const c = new EffectComposer(this.renderer, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    const ao = new GTAOPass(this.scene, this.camera, w, h);
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = 0.9;
    ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
    c.addPass(ao);
    c.addPass(new OutputPass());
    c.setPixelRatio(pr);
    c.setSize(w, h);
    this.composer = c; this.gtao = ao; this.aoRaio = 1.2;
  }

  // Material conforme a qualidade: PBR (Standard) ou Lambert
  M(p = {}) {
    if (this.q.std) return new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: 0.6, ...p });
    const { roughness, metalness, envMapIntensity, normalMap, normalScale, ...rest } = p;
    return new THREE.MeshLambertMaterial(rest);
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.labelRenderer.setSize(w, h);
    this.composer?.setSize(w, h);
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
    this._peMat = null;
    this.stubMesh = new THREE.InstancedMesh(this.rowMesh.geometry, this.rowMesh.material, 64);
    this.stubMesh.count = 0;
    this.stubMesh.castShadow = this.stubMesh.receiveShadow = true;
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
    const { det, ...o } = opts;
    const mat = this.M({ color, ...o });
    if (det) detalhe(mat, det);
    const m = new THREE.Mesh(g, mat);
    m.position.y = y;
    m.receiveShadow = true;
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
    const ground = new THREE.Mesh(g, detalhe(this.M({ color: '#8d8a56' }), { escala: 0.004, forca: 0.2, escala2: 0.09, forca2: 0.08 }));
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    this.root.add(ground);
    this.root.add(this.morros());
    const b = farm.bounds;
    // lavouras vizinhas (milho/sorgo) para dar contexto, como no entorno real
    const vizinhas = [
      [[b.x0 - 900, b.y1 + 120], [b.x1 + 400, b.y1 + 120], [b.x1 + 400, b.y1 + 900], [b.x0 - 900, b.y1 + 900]],
      [[b.x0 - 900, b.y0 - 900], [b.x1 + 600, b.y0 - 900], [b.x1 + 600, b.y0 - 60], [b.x0 - 900, b.y0 - 60]],
      [[b.x1 + 90, b.y0 - 60], [b.x1 + 900, b.y0 - 60], [b.x1 + 900, b.y1 - 300], [b.x1 + 90, b.y1 - 300]],
    ];
    const tex = this.stripeTexture('#bdb65c', '#9e9844', 48);
    tex.repeat.set(30, 30);
    tex.anisotropy = 8;
    for (const p of vizinhas) this.root.add(this.flatShape(p, -0.2, '#ffffff', { map: tex, det: { escala: 0.006, forca: 0.18, escala2: 0.5, forca2: 0.06 } }));
    // carreadores (contorno das regiões) e solo das regiões (latossolo vermelho, com torrões)
    for (const reg of farm.regions) {
      const k = 1 + 14 / Math.sqrt(reg.areaHa * 1e4);
      this.root.add(this.flatShape(scalePoly(reg.poly, k), -0.1, '#bf6c3e', { det: { escala: 0.03, forca: 0.14, escala2: 1.4, forca2: 0.1 } }));
      this.root.add(this.flatShape(reg.poly, 0, '#82492d', { det: { escala: 0.025, forca: 0.16, escala2: 2.2, forca2: 0.14 } }));
    }
    // carreadores principais (faixas)
    const roadMat = detalhe(this.M({ color: '#c47645' }), { escala: 0.05, forca: 0.15, escala2: 1.8, forca2: 0.1 });
    const road = (x0, y0, x1, y1, w) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), roadMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      m.position.copy(this.W((x0 + x1) / 2, (y0 + y1) / 2, -0.05));
      m.receiveShadow = true;
      this.root.add(m);
    };
    const ph = farm.pumpHouse;
    road(b.x0 - 60, ph[1], b.x1 + 60, ph[1], 10);
    road(ph[0] - 34, b.y0 - 40, ph[0] - 34, b.y1 + 40, 9);
    // APP (mata) e açude
    if (cfg.app) {
      this.root.add(this.flatShape(cfg.app, -0.05, '#3a5428', { det: { escala: 0.05, forca: 0.2 } }));
      const trees = new THREE.InstancedMesh(arvoreGeometry(), detalhe(this.M({ vertexColors: true, roughness: 0.85 }), { escala: 0.3, forca: 0.1, escala2: 2, forca2: 0.06 }), 1100);
      const bb = cfg.app.reduce((a, [x, y]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), y0: Math.min(a.y0, y), y1: Math.max(a.y1, y) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
      const mtx = new THREE.Matrix4();
      let n = 0, guard = 0;
      const col = new THREE.Color();
      const R = rng(4242);
      while (n < 1100 && guard++ < 8000) {
        const x = bb.x0 + R() * (bb.x1 - bb.x0), y = bb.y0 + R() * (bb.y1 - bb.y0);
        if (!inPoly(x, y, cfg.app)) continue;
        const ac = cfg.acude;
        if (ac && ((x - ac.x) / (ac.rx + 10)) ** 2 + ((y - ac.y) / (ac.ry + 10)) ** 2 < 1) continue;
        const s = 6 + R() * 8;
        mtx.compose(this.W(x, y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28), new THREE.Vector3(s * (0.8 + R() * 0.4), s * (0.9 + R() * 0.5), s * (0.8 + R() * 0.4)));
        trees.setMatrixAt(n, mtx);
        col.setHSL(0.24 + R() * 0.07, 0.25 + R() * 0.2, 0.75 + R() * 0.3);
        trees.setColorAt(n, col);
        n++;
      }
      trees.count = n;
      trees.castShadow = trees.receiveShadow = true;
      this.root.add(trees);
    }
    const aguaMat = () => this.M({ color: '#1b4651', roughness: 0.07, metalness: 0.05, envMapIntensity: 1.4, normalMap: this.aguaNormal(), normalScale: new THREE.Vector2(0.35, 0.35) });
    this.aguas = [];
    if (cfg.acude) {
      const ac = cfg.acude;
      const pts = [];
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push([ac.x + Math.cos(a) * ac.rx * (1 + 0.08 * Math.sin(a * 3)), ac.y + Math.sin(a) * ac.ry]); }
      this.root.add(this.flatShape(pts.map(([x, y]) => [ac.x + (x - ac.x) * 1.08, ac.y + (y - ac.y) * 1.12]), 0.02, '#8a7a52', { det: { escala: 0.1, forca: 0.2 } }));
      const w = new THREE.Mesh(this.flatShape(pts, 0.08, '#fff').geometry, aguaMat());
      w.position.y = 0.08;
      w.userData = { pick: { tipo: 'ativo', id: 'RES-02' } };
      this.root.add(w);
      this.aguas.push(w);
      this.pickables = [w];
    } else this.pickables = [];
    // reservatório revestido (talude, geomembrana e lâmina d'água)
    const rv = cfg.reservatorio;
    const ret = (m) => [[rv.x - rv.w / 2 - m, rv.y - rv.h / 2 - m], [rv.x + rv.w / 2 + m, rv.y - rv.h / 2 - m], [rv.x + rv.w / 2 + m, rv.y + rv.h / 2 + m], [rv.x - rv.w / 2 - m, rv.y + rv.h / 2 + m]];
    this.root.add(this.flatShape(ret(7), 0.02, '#c98a55', { det: { escala: 0.08, forca: 0.15, escala2: 2, forca2: 0.1 } }));
    const talude = new THREE.Mesh(new THREE.BoxGeometry(rv.w + 2, 1.2, rv.h + 2), this.M({ color: '#23292c', roughness: 0.55, metalness: 0.1 }));
    talude.position.copy(this.W(rv.x, rv.y, 0.55));
    talude.castShadow = talude.receiveShadow = true;
    this.root.add(talude);
    const wr = new THREE.Mesh(this.flatShape(ret(-1.5), 0, '#fff').geometry, aguaMat());
    wr.position.y = 1.22;
    wr.userData = { pick: { tipo: 'ativo', id: 'RES-01' } };
    this.root.add(wr);
    this.aguas.push(wr);
    this.pickables.push(wr);
    // cerca do reservatório
    const postes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), this.M({ color: '#cfcfcf', metalness: 0.6, roughness: 0.4 }), 200);
    let np = 0;
    const per = ret(5);
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = per[i], [x1, y1] = per[(i + 1) % 4];
      const L = Math.hypot(x1 - x0, y1 - y0), n2 = Math.floor(L / 3);
      for (let k = 0; k < n2 && np < 200; k++) { const t = k / n2; const mm = new THREE.Matrix4().makeTranslation(...this.W(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.8).toArray()); postes.setMatrixAt(np++, mm); }
    }
    postes.count = np; postes.castShadow = true;
    this.root.add(postes);
    // sede / terreiro
    const sd = farm.sede;
    this.root.add(this.flatShape([[sd[0] - 30, sd[1] - 18], [sd[0] + 30, sd[1] - 18], [sd[0] + 30, sd[1] + 18], [sd[0] - 30, sd[1] + 18]], 0.05, '#d3ccbf', { det: { escala: 0.2, forca: 0.06 } }));
  }

  // morros suaves no horizonte (Cerrado), esmaecidos pela névoa
  morros() {
    const seg = 96, an = [4200, 6200, 9000];
    const pos = [], idx = [];
    const R = rng(77);
    const alt = [];
    for (let i = 0; i <= seg; i++) alt.push(80 + R() * 260 + 120 * Math.sin(i * 0.37) + 90 * Math.sin(i * 0.11 + 2));
    alt[seg] = alt[0];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const hs = [0, alt[i], alt[i] * 0.4];
      an.forEach((r, k) => pos.push(Math.cos(a) * r, hs[k] - 2, Math.sin(a) * r));
    }
    for (let i = 0; i < seg; i++) for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = (i + 1) * 3 + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, detalhe(this.M({ color: '#7f8857', side: THREE.DoubleSide }), { escala: 0.003, forca: 0.25, escala2: 0.02, forca2: 0.1 }));
    return m;
  }

  aguaNormal() {
    if (this._aguaN) return this._aguaN;
    const N = 256, cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const g = cv.getContext('2d');
    const img = g.createImageData(N, N);
    const h = (x, y) => Math.sin(x * 0.19 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin(y * 0.23 + x * 0.05) * 0.35 + Math.sin((x + y) * 0.41) * 0.15;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx, ny = -dy, nz = 1, l = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    this._aguaN = t;
    return t;
  }

  buildRows(farm) {
    const n = farm.rows.length;
    const geo = hedgeGeometry();
    const mat = detalhe(this.M({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.35 }), { escala: 0.5, forca: 0.16, escala2: 2.6, forca2: 0.14 });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = mesh.receiveShadow = true;
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
    const mat = (c) => this.M({ color: c, roughness: 0.55, metalness: 0.25, envMapIntensity: 0.9 });
    const add = (geo, c, y) => { const m = new THREE.Mesh(geo, mat(c)); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
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
    this.regionLabelById = new Map();
    for (const reg of farm.regions) {
      const l = this.label('', 'lab lab-reg');
      l.element.innerHTML = `<span class="lr-pin"><svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 00-14 0c0 5 7 11 7 11z"/></svg></span><span class="lr-t"><b></b><small></small></span><span class="lr-go">›</span>`;
      l.element.querySelector('b').textContent = reg.nome;
      l.element.querySelector('small').textContent = `${reg.areaHa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ha`;
      l.element.style.setProperty('--c', reg.cor);
      l.element.addEventListener('pointerdown', (e) => e.stopPropagation());
      l.element.addEventListener('click', (e) => { e.stopPropagation(); this.hooks.onRegion?.(reg.id); });
      l.position.copy(this.W(reg.centro[0], reg.centro[1], 12));
      l.userData.minDist = 0;
      this.root.add(l);
      this.regionLabels.push(l);
      this.regionLabelById.set(reg.id, l);
    }
  }

  // Região em destaque: preenchimento verde translúcido e contorno luminoso
  setRegiaoDestaque(id) {
    if (this.destaque) { this.root.remove(this.destaque); this.destaque.traverse((o) => o.geometry?.dispose?.()); this.destaque = null; }
    for (const [rid, l] of this.regionLabelById || []) l.element.classList.toggle('sel', rid === id);
    if (!id || !this.farm) { this.dirty = true; return; }
    const reg = this.farm.regionById.get(id);
    if (!reg) return;
    const g = new THREE.Group();
    const y = reg.altura + 0.25;
    const fill = this.flatShape(reg.poly, y, '#6dff3c');
    fill.material = new THREE.MeshBasicMaterial({ color: '#7dff4a', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    fill.receiveShadow = false;
    g.add(fill);
    const anel = [...reg.poly, reg.poly[0]];
    const larg = Math.max(2.5, Math.sqrt(reg.areaHa) * 0.6);
    for (const [w, op] of [[larg * 3, 0.22], [larg, 0.95]]) {
      const r = this.ribbon(anel, w, y + 0.05, '#c4ff9a');
      r.material = new THREE.MeshBasicMaterial({ color: '#c8ffa0', transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      g.add(r);
    }
    g.renderOrder = 3;
    this.destaque = g;
    this.root.add(g);
    this.dirty = true;
  }

  // Vista panorâmica oblíqua (como foto de drone): fazenda inteira ou uma região
  vistaPanoramica(regId = null, anim = true) {
    if (!this.farm) return;
    const b = this.farm.bounds;
    const reg = regId ? this.farm.regionById.get(regId) : null;
    const cx = reg ? reg.centro[0] : (b.x0 + b.x1) / 2, cy = reg ? reg.centro[1] : (b.y0 + b.y1) / 2;
    const base = reg ? Math.sqrt(reg.areaHa * 1e4) * 2.3 : Math.max(b.w, b.h) * 0.78;
    const d = base * Math.max(1, 1.15 / (this.camera.aspect || 1));
    const alvo = this.W(cx, cy - (reg ? 0 : b.h * 0.04), 0);
    const pos = alvo.clone().add(new THREE.Vector3(-0.32, 0.5, 0.8).normalize().multiplyScalar(d));
    if (!anim) { this.camera.position.copy(pos); this.controls.target.copy(alvo); this.controls.update(); this.dirty = true; this.updateLabelVisibility(); return; }
    this.anim = { t0: performance.now(), dur: 900, p0: this.camera.position.clone(), p1: pos, q0: this.controls.target.clone(), q1: alvo };
  }

  setRegiaoStatus(fn) {
    if (!this.regionLabelById || !this.farm) return;
    for (const [id, l] of this.regionLabelById) {
      const st = fn(this.farm.regionById.get(id));
      l.element.classList.remove('st-bom', 'st-atencao', 'st-critico');
      l.element.classList.add('st-' + st);
    }
  }
  // Alterna entre vista oblíqua (3D) e vista de cima (2D)
  alternar3D() {
    const t = this.controls.target.clone();
    const off = this.camera.position.clone().sub(t);
    const d = off.length();
    const polar = Math.acos(Math.min(1, off.y / d));
    const az = this.controls.getAzimuthalAngle();
    const novoPolar = polar < 0.35 ? 0.95 : 0.05;
    const p = new THREE.Vector3(Math.sin(novoPolar) * Math.sin(az), Math.cos(novoPolar), Math.sin(novoPolar) * Math.cos(az)).multiplyScalar(d).add(t);
    this.anim = { t0: performance.now(), dur: 700, p0: this.camera.position.clone(), p1: p, q0: t.clone(), q1: t.clone() };
  }

  zoom(f) {
    const t = this.controls.target;
    const v = this.camera.position.clone().sub(t).multiplyScalar(f);
    const d = clamp(v.length(), this.controls.minDistance, this.controls.maxDistance);
    v.setLength(d);
    this.anim = { t0: performance.now(), dur: 350, p0: this.camera.position.clone(), p1: t.clone().add(v), q0: t.clone(), q1: t.clone() };
  }
  azimute() { return this.controls.getAzimuthalAngle(); }
  metrosPorPixel() {
    const d = this.camera.position.distanceTo(this.controls.target);
    const h = this.el.clientHeight || 1;
    return (2 * d * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
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
    for (const l of this.regionLabels || []) { l.visible = show; l.element.style.display = show ? '' : 'none'; }
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
    this.plantRows = pe ? rows : [];
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
  geoPe(fruta, variante, lod = 's') {
    const key = `${fruta ? fruta.k : 'nada'}-${variante}-${lod}`;
    if (!this.geoCache.has(key)) this.geoCache.set(key, lod === 'f' ? coffeeFolhas(2000 + variante * 7919, fruta) : coffeeGeometry(1000 + variante * 7919, fruta));
    return this.geoCache.get(key);
  }

  // specs: [{ r, j0, j1 }] — desenha cafeeiros da cova j0 à j1 de cada rua
  buildPlants(group, specs, { drip = false, emissores = false, centro = null } = {}) {
    const raio2 = this.q.folhas && centro ? this.q.raioFolhas ** 2 : -1;
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
        const lod = raio2 > 0 && (x - centro[0]) ** 2 + (y - centro[1]) ** 2 < raio2 ? 'f' : 's';
        const key = `${fr ? fr.k : 'nada'}|${varI}|${lod}`;
        if (!buckets.has(key)) buckets.set(key, { geo: this.geoPe(fr, varI, lod), mats: [], cols: [], idx: [] });
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
    const mat = this._peMat || (this._peMat = detalhe(this.M({ vertexColors: true, roughness: 0.45, envMapIntensity: 0.95 }), { escala: 0.12, forca: 0.07, escala2: 1.3, forca2: 0.05, vento: this.q.vento }));
    const pick = [];
    for (const b of buckets.values()) {
      const im = new THREE.InstancedMesh(b.geo, mat, b.mats.length);
      b.mats.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, b.cols[i]); });
      im.userData.index = b.idx;
      im.castShadow = im.receiveShadow = true;
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

  // Pés de café: ruas selecionadas inteiras e, quando a câmera chega perto do chão,
  // as ruas ao redor do ponto de vista. Pés mais próximos ganham o modelo folha a folha.
  updateNear(force = false) {
    if (!this.farm || !this.nearGroup) return;
    const t = this.controls.target;
    const dist = this.camera.position.distanceTo(t);
    const wx = t.x + this.ox, wy = -t.z + this.oy;
    const perto = dist <= 150 && !this.paused;
    const reg = perto ? this.farm.regions.find((r) => inPoly(wx, wy, r.poly)) : null;
    let a = 0, b = 0, key = 'longe';
    if (reg) { a = wx * reg.u[0] + wy * reg.u[1]; b = wx * reg.v[0] + wy * reg.v[1]; key = `${reg.id}:${Math.round(b / reg.espLinha)}:${Math.round(a / 10)}`; }
    const fullKey = `${[...this.fullRows].join(',')}|${this.plantaSel ? this.plantaSel.row + ':' + this.plantaSel.j : ''}|${this.qNome}`;
    const k = key + '#' + fullKey;
    if (!force && k === this.nearKey) return;
    this.nearKey = k;
    const centro = reg ? [wx, wy] : null;
    this.plantGroup.clear();
    this.plantPick = [];
    if (this.fullRows.size) {
      const rows = [...this.fullRows].map((id) => this.farm.rowById.get(id)).filter(Boolean);
      this.plantPick = this.buildPlants(this.plantGroup, rows.map((r) => ({ r, j0: 0, j1: r.nPl - 1 })), { drip: true, emissores: rows.length <= 4, centro });
    }
    this.nearGroup.clear();
    this.nearPick = [];
    const specs = [];
    if (reg) {
      const WIN = this.q.janela, N = this.q.linhas;
      for (const r of reg.rows) {
        if (Math.abs(r.b - b) > (N + 0.5) * reg.espLinha || this.fullRows.has(r.id)) continue;
        if (a < r.a1 - WIN || a > r.a2 + WIN) continue;
        const used = (r.nPl - 1) * reg.espPlanta, off = (r.len - used) / 2;
        const j0 = clamp(Math.floor((a - WIN - r.a1 - off) / reg.espPlanta), 0, r.nPl - 1);
        const j1 = clamp(Math.ceil((a + WIN - r.a1 - off) / reg.espPlanta), 0, r.nPl - 1);
        if (j1 > j0) specs.push({ r, j0, j1, off });
      }
      if (specs.length) this.nearPick = this.buildPlants(this.nearGroup, specs, { drip: true, centro });
    }
    // trechos da rua fora da janela continuam como renque
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const col = new THREE.Color();
    let kk = 0;
    this.stubMesh.userData.rows = [];
    for (const sp of specs) {
      const r = sp.r;
      this.rowMatrices[r._i].decompose(p, q, s);
      this.rowMesh.getColorAt(r._i, col);
      const esp = reg.espPlanta;
      const cortes = [[0, sp.off + sp.j0 * esp - esp / 2], [sp.off + sp.j1 * esp + esp / 2, r.len]];
      for (const [d0, d1] of cortes) {
        if (d1 - d0 < 0.5 || kk >= 64) continue;
        const mid = (d0 + d1) / 2 / r.len;
        const c = this.W(r.x1 + (r.x2 - r.x1) * mid, r.y1 + (r.y2 - r.y1) * mid, 0);
        m.compose(c, q, new THREE.Vector3(d1 - d0, s.y, s.z));
        this.stubMesh.setMatrixAt(kk, m);
        this.stubMesh.setColorAt(kk, col);
        this.stubMesh.userData.rows[kk] = r.id;
        kk++;
      }
    }
    this.stubMesh.count = kk;
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
    const L = (c, o = {}) => this.M({ color: c, roughness: 0.38, metalness: 0.3, envMapIntensity: 1.1, ...o });
    const mat = L(cor), dark = L('#1e1e1e', { roughness: 0.92, metalness: 0 }), metal = L('#a7afb6', { roughness: 0.3, metalness: 0.85 }), aro = L('#d9d4c7', { roughness: 0.5, metalness: 0.4 });
    const glass = this.M({ color: '#9fd0f5', transparent: true, opacity: 0.38, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6 });
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
        const N = 160, pts = new Float32Array(N * 3), sem = [];
        for (let i = 0; i < N; i++) sem.push([Math.random(), Math.random(), Math.random(), Math.random() < 0.5 ? -1 : 1]);
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const nuvem = new THREE.Points(pg, new THREE.PointsMaterial({ map: gotaTextura(), color: '#f4fbff', size: 0.9, transparent: true, opacity: 0.32, depthWrite: false, sizeAttenuation: true }));
        nuvem.userData.sem = sem;
        nuvem.frustumCulled = false;
        g.add(nuvem);
        const spray = [nuvem];
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
    g.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
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
      if (spray) {
        const on = mc.estado === 'operando' && !!mc.rua;
        for (const c of spray) {
          c.visible = on;
          if (!on) continue;
          const arr = c.geometry.attributes.position.array, sem = c.userData.sem;
          for (let i = 0; i < sem.length; i++) {
            const [a, b, d, lado] = sem[i];
            const k = ((now / 900) + a) % 1; // vida da gota
            const r = 0.4 + k * 2.6;
            const ang = (b - 0.5) * 1.6;
            arr[i * 3] = -3.9 - k * 0.6 + Math.sin(ang) * 0.3;
            arr[i * 3 + 1] = 1.3 + Math.sin(ang) * r * 0.9 + d * 0.3;
            arr[i * 3 + 2] = lado * (0.6 + Math.cos(ang) * r);
          }
          c.geometry.attributes.position.needsUpdate = true;
          c.material.opacity = 0.34;
        }
      }
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
    const agora = performance.now();
    const dt = Math.min(0.5, (agora - (this._fT || agora)) / 1000) || 0.016;
    this._fT = agora;
    const kPos = 1 - Math.exp(-dt * 4), kAlvo = 1 - Math.exp(-dt * 9);
    this._fh = this._fh == null ? mc.heading : lerpAngle(this._fh, mc.heading, 1 - Math.exp(-dt * 2.5));
    const dir = new THREE.Vector3(Math.cos(this._fh), 0, -Math.sin(this._fh));
    const alvo = T.clone().add(new THREE.Vector3(0, mc.tipo === 'colhedora' ? 2.5 : 1.3, 0));
    if (modo === 'livre') {
      const d = alvo.clone().sub(this.controls.target);
      this.camera.position.add(d);
      this.controls.target.copy(alvo);
    } else {
      let off;
      const z = this.followZoom || 1;
      if (modo === 'lateral') off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(14).add(new THREE.Vector3(0, 4.5, 0)).add(dir.clone().multiplyScalar(-3));
      else if (modo === 'cima') off = new THREE.Vector3(0, 48, 0).add(dir.clone().multiplyScalar(-4));
      else off = dir.clone().multiplyScalar(mc.tipo === 'colhedora' ? -19 : -15).add(new THREE.Vector3(0, mc.tipo === 'colhedora' ? 9 : 6.5, 0));
      off.multiplyScalar(z);
      this.camera.position.lerp(alvo.clone().add(off), kPos);
      this.controls.target.lerp(alvo, kAlvo);
    }
    this.dirty = true;
  }
  stopFollow() { this._fh = null; this._fT = null; }

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

  updateSol() {
    const t = this.controls.target;
    const d = this.camera.position.distanceTo(t);
    if (this.sun.castShadow) {
      const half = clamp(d * 1.1, 18, 3000);
      const off = Math.max(400, half * 2.2);
      this.sun.position.copy(t).addScaledVector(this.solDir, off);
      this.sun.target.position.copy(t);
      this.sun.target.updateMatrixWorld();
      const sc = this.sun.shadow.camera;
      if (Math.abs(sc.right - half) > half * 0.05) {
        sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
        sc.near = 1; sc.far = off + half * 2.5;
        sc.updateProjectionMatrix();
        this.sun.shadow.normalBias = clamp(half * 0.0012, 0.015, 1.8);
      }
    } else {
      this.sun.position.copy(t).addScaledVector(this.solDir, 1000);
      this.sun.target.position.copy(t);
      this.sun.target.updateMatrixWorld();
    }
    if (this.gtao) {
      const r = clamp(d * 0.006, 0.5, 10);
      if (Math.abs(r - this.aoRaio) > this.aoRaio * 0.1) { this.aoRaio = r; this.gtao.updateGtaoMaterial({ radius: r }); }
    }
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
    if (this.q.vento && (this.plantPick.length || this.nearPick.length)) this.dirty = true;
    if (this.q.std && this.aguas?.length && this.camera.position.distanceTo(this.controls.target) < 600) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    TEMPO.value = t / 1000;
    if (this._aguaN) { this._aguaN.offset.set(t * 0.00002, t * 0.000013); }
    this.updateSol();
    const t0 = performance.now();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    // medição de fluidez: se o aparelho não acompanha, sugere reduzir a qualidade
    if (this._lastFrame && t - this._lastFrame < 400) this.frames.push(t - this._lastFrame);
    this._lastFrame = t;
    if (this.frames.length >= 150) {
      const media = this.frames.reduce((x, y) => x + y, 0) / this.frames.length;
      this.frames = [];
      if (media > 55 && !this.lentoAvisado && this.qNome !== 'leve') { this.lentoAvisado = true; this.hooks.onLento?.(this.qNome, media); }
    }
    void t0;
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
  const escuro = new THREE.Color('#2b5e31'), claro = new THREE.Color('#76b562'), novo = new THREE.Color('#a0cf6a');
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

// Árvore do Cerrado/mata ciliar: tronco e copa em volumes (altura 1)
function arvoreGeometry() {
  const parts = [];
  const pinta = (geo, cor) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.normal) g.deleteAttribute('normal');
    const c = new THREE.Color(cor), arr = [];
    for (let i = 0; i < g.attributes.position.count; i++) arr.push(c.r, c.g, c.b);
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  };
  parts.push(pinta(new THREE.CylinderGeometry(0.03, 0.05, 0.55, 6).translate(0, 0.27, 0), '#4b3424'));
  const R = rng(99);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.IcosahedronGeometry(0.28 + R() * 0.12, 1);
    g.translate((R() - 0.5) * 0.3, 0.62 + R() * 0.25, (R() - 0.5) * 0.3);
    parts.push(pinta(g, i % 2 ? '#2f4f24' : '#3b5e2b'));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

// Cafeeiro folha a folha (altura 1, diâmetro 1): tronco, miolo escuro, ramos
// plagiotrópicos em camadas com pares de folhas opostas e rosetas de frutos.
function coffeeFolhas(seed, fruta) {
  const R = rng(seed);
  const P = [], N = [], C = [];
  const up = new THREE.Vector3(0, 1, 0);
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), out = new THREE.Vector3();
  const tri = (a, b, c, ca, cb, cc, centro, peso = 0.6) => {
    ab.subVectors(b, a); ac.subVectors(c, a);
    const n = new THREE.Vector3().crossVectors(ab, ac).normalize();
    for (const [p, col] of [[a, ca], [b, cb], [c, cc]]) {
      out.subVectors(p, centro); out.y *= 0.6;
      if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
      out.normalize();
      const nn = n.clone();
      if (nn.dot(out) < 0) nn.negate();
      nn.multiplyScalar(1 - peso).addScaledVector(out, peso).normalize();
      P.push(p.x, p.y, p.z); N.push(nn.x, nn.y, nn.z); C.push(col.r, col.g, col.b);
    }
  };
  const triGeo = (geo, cor, centro, varia = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pa = g.attributes.position;
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let i = 0; i < pa.count; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pa, i + k);
      const c = cor.clone();
      if (varia) c.offsetHSL(0, 0, (R() - 0.5) * varia);
      tri(v[0], v[1], v[2], c, c, c, centro, 0.5);
    }
  };
  triGeo(new THREE.CylinderGeometry(0.022, 0.045, 0.5, 6).translate(0, 0.25, 0), new THREE.Color('#563a26'), new THREE.Vector3(0, 0.25, 0));
  for (const [cy, r, hh] of [[0.3, 0.32, 0.17], [0.54, 0.26, 0.16], [0.77, 0.15, 0.12]]) {
    triGeo(new THREE.IcosahedronGeometry(1, 0).scale(r, hh, r).translate(0, cy, 0), new THREE.Color('#244f2b'), new THREE.Vector3(0, cy, 0), 0.04);
  }
  const corA = new THREE.Color('#2e6a34'), corB = new THREE.Color('#57a04a'), corN = new THREE.Color('#9dcc68');
  const rosetas = [];
  const folha = (base, f, sz, k, tt) => {
    const lado = new THREE.Vector3().crossVectors(f, up);
    if (lado.lengthSq() < 1e-4) lado.set(1, 0, 0);
    lado.normalize();
    const nUp = new THREE.Vector3().crossVectors(lado, f).normalize();
    const w = sz * 0.46;
    const B = base.clone(), T = base.clone().addScaledVector(f, sz);
    const M = base.clone().addScaledVector(f, sz * 0.45);
    const Lp = M.clone().addScaledVector(lado, w / 2).addScaledVector(nUp, -sz * 0.09);
    const Rp = M.clone().addScaledVector(lado, -w / 2).addScaledVector(nUp, -sz * 0.09);
    const base0 = corA.clone().lerp(corB, Math.min(1, Math.max(0, 0.25 + 0.5 * (k / 7) + (R() - 0.5) * 0.35)));
    const cB = base0.clone().multiplyScalar(0.8), cT = base0.clone(), cM = base0.clone().multiplyScalar(1.12);
    if (k >= 5 && tt > 0.6 && R() < 0.55) cT.lerp(corN, 0.65);
    const centro = new THREE.Vector3(0, base.y, 0);
    tri(B, Lp, T, cB, cM, cT, centro);
    tri(B, T, Rp, cB, cT, cM, centro);
  };
  const camadas = [[0.17, 0.5], [0.3, 0.52], [0.43, 0.49], [0.56, 0.43], [0.68, 0.35], [0.8, 0.26], [0.9, 0.16], [0.975, 0.07]];
  camadas.forEach(([cy, r], k) => {
    const nb = Math.max(3, 9 - k);
    const a0 = R() * Math.PI * 2;
    for (let bI = 0; bI < nb; bI++) {
      const ang = a0 + (bI * 2 * Math.PI) / nb + (R() - 0.5) * 0.5;
      const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const L = r * (0.85 + R() * 0.25);
      const queda = 0.05 + R() * 0.06;
      const nf = k > 5 ? 2 : 4;
      for (let i = 1; i <= nf; i++) {
        const t = i / (nf + 0.6);
        const p = dir.clone().multiplyScalar(L * t);
        p.y = cy - queda * t * t;
        for (const sgn of [-1, 1]) {
          const f = dir.clone().applyAxisAngle(up, sgn * (0.9 + R() * 0.35));
          f.y = -0.28 + R() * 0.3;
          f.normalize();
          folha(p, f, 0.075 * (0.8 + R() * 0.4) * (k > 5 ? 0.8 : 1), k, i / nf);
        }
        if (k < 6 && i < nf && R() < 0.85) rosetas.push(p.clone());
      }
      const pt = dir.clone().multiplyScalar(L);
      pt.y = cy - queda;
      const ft = dir.clone(); ft.y = 0.12; ft.normalize();
      folha(pt, ft, 0.06, k, 1);
    }
  });
  if (fruta) {
    const base = new THREE.Color(fruta.cor);
    const n = Math.min(rosetas.length, Math.round(fruta.n * 1.8));
    for (let i = 0; i < n; i++) {
      const p = rosetas[Math.floor(R() * rosetas.length)];
      const c = base.clone(); c.offsetHSL(0, 0, (R() - 0.5) * 0.1);
      triGeo(new THREE.OctahedronGeometry(fruta.tam * (1.1 + R() * 0.5), 0).translate(p.x, p.y - 0.012, p.z), c, p.clone(), 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere();
  return g;
}

function gotaTextura() {
  if (gotaTextura.t) return gotaTextura.t;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  gotaTextura.t = new THREE.CanvasTexture(cv);
  return gotaTextura.t;
}
