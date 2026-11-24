// Geometria da fazenda: regiões, ruas, plantas, rede de irrigação e ativos.
// Tudo é gerado a partir da configuração (polígonos + espaçamentos), então trocar
// os polígonos de demonstração pelos limites reais (GeoJSON/KML) regera ruas,
// cruzetas, gotejadores e inventário automaticamente.
import {
  polyArea, scalePoly, scanSegments, bbox, centroid, polylineLength, rng, hash, clamp, geo,
} from './util.js';

export const CONFIG_PADRAO = {
  nome: 'Fazenda Café Cerrado',
  municipio: 'Araguari – MG',
  origem: { lat: -18.624, lon: -48.242 },
  demo: true,
  regioes: [
    { id: 'R1', nome: 'Região 1', cor: '#c96f3b', alvoHa: 36, angulo: 0, espLinha: 3.8, espPlanta: 0.6, variedade: 'Catuaí Vermelho IAC 144', plantio: 2019, setores: 3, gotEsp: 0.5, gotVazao: 1.6,
      poly: [[40, 720], [770, 720], [770, 1230], [300, 1285], [60, 1150]] },
    { id: 'R2', nome: 'Região 2', cor: '#5f8f4e', alvoHa: 34, angulo: 90, espLinha: 3.8, espPlanta: 0.6, variedade: 'Mundo Novo IAC 379-19', plantio: 2021, setores: 3, gotEsp: 0.5, gotVazao: 1.6,
      poly: [[835, 725], [1640, 725], [1700, 1050], [1500, 1190], [835, 1190]] },
    { id: 'R3', nome: 'Região 3', cor: '#d6a43c', alvoHa: 33, angulo: 0, espLinha: 3.8, espPlanta: 0.6, variedade: 'Catuaí Amarelo IAC 62', plantio: 2023, setores: 3, gotEsp: 0.5, gotVazao: 1.6,
      poly: [[40, 140], [700, 80], [770, 615], [60, 615]] },
    { id: 'R4', nome: 'Região 4', cor: '#4f86a8', alvoHa: 32, angulo: 90, espLinha: 3.6, espPlanta: 0.5, variedade: 'Arara', plantio: 2026, setores: 2, gotEsp: 0.5, gotVazao: 1.6,
      poly: [[835, 60], [1420, 60], [1420, 615], [835, 615]] },
    { id: 'R5', nome: 'Região 5', cor: '#9a5fa3', alvoHa: 32, angulo: 0, espLinha: 3.8, espPlanta: 0.6, variedade: 'Topázio MG 1190', plantio: 2026, setores: 3, gotEsp: 0.5, gotVazao: 1.6,
      poly: [[1490, 80], [2050, 140], [2010, 640], [1490, 640]] },
  ],
  reservatorio: { x: 790, y: 668, w: 72, h: 36, prof: 3.5 },
  casaBombas: { x: 862, y: 668 },
  sede: { x: 1452, y: 680 },
  acude: { x: 1960, y: 1250, rx: 85, ry: 50 },
  app: [[1760, 1100], [2160, 1040], [2260, 1400], [1810, 1460]],
};

const ALTURA = (idade) => clamp(0.45 + 0.42 * idade, 0.45, 2.3);
const LARGURA = (idade) => clamp(0.35 + 0.38 * idade, 0.35, 1.9);

export function buildFarm(cfg, hojeIso) {
  geo.setOrigin(cfg.origem);
  const hoje = new Date(hojeIso);
  const anoFrac = hoje.getFullYear() + hoje.getMonth() / 12;
  const farm = { cfg, regions: [], rows: [], rowById: new Map(), assets: [], assetById: new Map(), pipes: [], regionById: new Map() };
  const PH = [cfg.casaBombas.x, cfg.casaBombas.y];
  farm.pumpHouse = PH;
  farm.sede = [cfg.sede.x, cfg.sede.y];

  const addAsset = (a) => { farm.assets.push(a); farm.assetById.set(a.id, a); return a; };

  for (const rc of cfg.regioes) {
    let poly = rc.poly.map((p) => [+p[0], +p[1]]);
    if (rc.alvoHa && !rc.polyReal) poly = scalePoly(poly, Math.sqrt((rc.alvoHa * 1e4) / polyArea(poly)));
    const idade = Math.max(0.3, anoFrac - (rc.plantio + 0.1));
    const reg = {
      ...rc, poly, areaHa: polyArea(poly) / 1e4, idade,
      altura: ALTURA(idade), largCopa: LARGURA(idade),
      rows: [], setores: [], bbox: bbox(poly), centro: centroid(poly),
    };
    const theta = (rc.angulo * Math.PI) / 180;
    const { segs, ux, uy, vx, vy } = scanSegments(poly, theta, rc.espLinha, 6, 2);
    reg.u = [ux, uy]; reg.v = [vx, vy]; reg.theta = theta;
    const toXY = (a, b) => [a * ux + b * vx, a * uy + b * vy];
    // linha de derivação: cruza as ruas na mediana dos pontos médios
    const mids = segs.map((s) => (s.a1 + s.a2) / 2).sort((m, n) => m - n);
    const cMid = mids.length ? mids[Math.floor(mids.length / 2)] : 0;
    segs.forEach((s, i) => {
      const idx = i + 1;
      const id = `${rc.id}-L${String(idx).padStart(3, '0')}`;
      const len = s.a2 - s.a1;
      const nPl = Math.floor(len / rc.espPlanta) + 1;
      const ca = clamp(cMid, s.a1 + 1, s.a2 - 1);
      const [x1, y1] = toXY(s.a1, s.b);
      const [x2, y2] = toXY(s.a2, s.b);
      const [cx, cy] = toXY(ca, s.b);
      const row = {
        id, reg: rc.id, idx, b: s.b, a1: s.a1, a2: s.a2, len, x1, y1, x2, y2, cx, cy, ca,
        nPl, nGot: Math.floor(len / rc.gotEsp), areaHa: (len * rc.espLinha) / 1e4,
        czTipo: ca - s.a1 > 3 && s.a2 - ca > 3 ? 'Cruzeta' : 'Tê',
        lat1: ca - s.a1, lat2: s.a2 - ca,
      };
      reg.rows.push(row); farm.rows.push(row); farm.rowById.set(id, row);
    });
    // setores: divide as ruas em grupos contíguos
    const nS = Math.max(1, rc.setores | 0);
    const per = Math.ceil(reg.rows.length / nS);
    for (let k = 0; k < nS; k++) {
      const rs = reg.rows.slice(k * per, (k + 1) * per);
      if (!rs.length) continue;
      const sid = `${rc.id}-S${k + 1}`;
      rs.forEach((r) => (r.setor = sid));
      const area = rs.reduce((s, r) => s + r.areaHa, 0);
      const ngot = rs.reduce((s, r) => s + r.nGot, 0);
      reg.setores.push({ id: sid, reg: rc.id, nome: `Setor ${k + 1}`, rows: rs, areaHa: area, nGot: ngot,
        vazao: (ngot * rc.gotVazao) / 1000, plantas: rs.reduce((s, r) => s + r.nPl, 0) });
    }
    // estatísticas
    reg.nRows = reg.rows.length;
    reg.compRuas = reg.rows.reduce((s, r) => s + r.len, 0);
    reg.plantas = reg.rows.reduce((s, r) => s + r.nPl, 0);
    reg.gotejadores = reg.rows.reduce((s, r) => s + r.nGot, 0);
    reg.plantasHa = reg.plantas / reg.areaHa;
    farm.regions.push(reg); farm.regionById.set(rc.id, reg);

    // ----- rede de irrigação da região -----
    if (!reg.rows.length) continue;
    const first = reg.rows[0], last = reg.rows[reg.rows.length - 1];
    const dFirst = Math.hypot(first.cx - PH[0], first.cy - PH[1]);
    const dLast = Math.hypot(last.cx - PH[0], last.cy - PH[1]);
    const ordem = dFirst <= dLast ? reg.rows : [...reg.rows].reverse();
    const sentido = dFirst <= dLast ? -1 : 1; // para fora da região ao longo de v
    const o0 = ordem[0];
    const head = [o0.cx + sentido * vx * 10, o0.cy + sentido * vy * 10];
    reg.head = head;
    // adutora: casa de bombas -> cabeçal da região (em L pelos carreadores)
    const adPts = [PH, [head[0], PH[1]], head];
    farm.pipes.push({ id: `AD-${rc.id}`, tipo: 'adutora', nome: `Adutora até ${reg.nome}`, pts: adPts, dn: 'DN 150', material: 'PVC PN80 / PEAD', len: polylineLength(adPts), reg: rc.id });
    addAsset({ id: `CZ-AD-${rc.id}`, tipo: 'cruzeta', sub: 'Cruzeta da adutora', nome: `Derivação da adutora para ${reg.nome}`, x: head[0], y: PH[1], reg: rc.id,
      specs: { 'Tipo': 'Tê/cruzeta de derivação', 'Diâmetro': 'DN 150 × DN 100', 'Material': 'PVC soldável / ferro fundido' } });
    // ventosas ao longo da adutora a cada ~250 m
    const L = polylineLength(adPts);
    for (let d = 250, n = 1; d < L - 30; d += 250, n++) {
      const p = pointAt(adPts, d);
      addAsset({ id: `VT-AD-${rc.id}-${n}`, tipo: 'ventosa', nome: `Ventosa ${n} da adutora ${rc.id}`, x: p[0], y: p[1], reg: rc.id, specs: { 'Tipo': 'Ventosa de duplo efeito 2"', 'Função': 'Expulsão e admissão de ar' } });
    }
    addAsset({ id: `CAB-${rc.id}`, tipo: 'cabecal', nome: `Cabeçal de controle ${reg.nome}`, x: head[0], y: head[1], reg: rc.id,
      specs: { 'Registro geral': 'Válvula borboleta DN 100', 'Filtro de linha': 'Tela 120 mesh 4"', 'Manômetros': 'Entrada e saída (glicerina, 0–10 kgf/cm²)', 'Ventosa': 'Duplo efeito 2"' } });
    addAsset({ id: `PLV-${rc.id}`, tipo: 'pluviometro', nome: `Pluviômetro ${reg.nome}`, x: head[0] + 6, y: head[1] + 6, reg: rc.id, specs: { 'Tipo': 'Pluviômetro de leitura direta (mm)' } });

    // linha principal interna: cabeçal -> válvulas dos setores
    const setoresOrd = sentido === -1 ? reg.setores : [...reg.setores].reverse();
    const mainPts = [head];
    setoresOrd.forEach((st, k) => {
      const rs = sentido === -1 ? st.rows : [...st.rows].reverse();
      const r0 = rs[0];
      const vp = [r0.cx + sentido * vx * (rc.espLinha / 2), r0.cy + sentido * vy * (rc.espLinha / 2)];
      mainPts.push(vp);
      st.valvula = `VS-${st.id}`;
      addAsset({ id: `VS-${st.id}`, tipo: 'valvula', nome: `Válvula do ${st.nome} (${rc.id})`, x: vp[0], y: vp[1], reg: rc.id, setor: st.id,
        specs: { 'Tipo': 'Válvula hidráulica 3" com solenoide', 'Solenoide': 'Latch 12 V DC', 'Regulagem de pressão': 'Piloto redutor', 'Área do setor': `${st.areaHa.toFixed(2)} ha`, 'Vazão do setor': `${st.vazao.toFixed(1)} m³/h`, 'Gotejadores': st.nGot.toLocaleString('pt-BR') } });
      addAsset({ id: `RL-${st.id}`, tipo: 'rele', nome: `Relé de sinal ${st.id}`, x: vp[0] + ux * 2, y: vp[1] + uy * 2, reg: rc.id, setor: st.id,
        specs: { 'Tipo': 'Módulo de campo via rádio (LoRa)', 'Saídas': '2 solenoides latch', 'Alimentação': 'Bateria + painel solar', 'Comanda': `VS-${st.id}` } });
      addAsset({ id: `MAN-${st.id}`, tipo: 'manometro', nome: `Transdutor de pressão ${st.id}`, x: vp[0] - ux * 2, y: vp[1] - uy * 2, reg: rc.id, setor: st.id,
        specs: { 'Tipo': 'Transdutor 4–20 mA, 0–10 bar', 'Ponto': 'Jusante da válvula' } });
      // derivação do setor passando pelas conexões das ruas
      const dPts = [vp, ...rs.map((r) => [r.cx, r.cy])];
      farm.pipes.push({ id: `DV-${st.id}`, tipo: 'derivacao', nome: `Linha de derivação ${st.id}`, pts: dPts, dn: 'DN 75', material: 'PVC PN40 enterrado', len: polylineLength(dPts), reg: rc.id, setor: st.id });
      const rl = rs[rs.length - 1];
      addAsset({ id: `FDL-${st.id}`, tipo: 'final', nome: `Final de linha / dreno ${st.id}`, x: rl.cx - sentido * vx * 2, y: rl.cy - sentido * vy * 2, reg: rc.id, setor: st.id,
        specs: { 'Tipo': 'Registro de dreno 2"', 'Uso': 'Flushing da derivação' } });
      if (k === 0 || true) addAsset({ id: `VT-${st.id}`, tipo: 'ventosa', nome: `Ventosa ${st.id}`, x: vp[0] + vx * 3 * -sentido, y: vp[1] + vy * 3 * -sentido, reg: rc.id, setor: st.id, specs: { 'Tipo': 'Ventosa de duplo efeito 1"' } });
      // cruzetas: uma por rua, onde as duas laterais saem da derivação
      for (const r of st.rows) {
        r.cz = `CZ-${r.id}`;
        addAsset({ id: `CZ-${r.id}`, tipo: 'cruzeta', sub: r.czTipo, nome: `${r.czTipo} da rua ${r.id}`, x: r.cx, y: r.cy, reg: rc.id, setor: st.id, rua: r.id,
          specs: { 'Tipo': r.czTipo === 'Cruzeta' ? 'Cruzeta (derivação + 2 laterais)' : 'Tê (derivação + 1 lateral)', 'Conexão': 'Inicial de linha 16 mm com anel de vedação', 'Lateral A': `${r.lat1.toFixed(1)} m`, 'Lateral B': `${r.lat2.toFixed(1)} m` } });
      }
    });
    farm.pipes.push({ id: `PR-${rc.id}`, tipo: 'principal', nome: `Linha principal ${reg.nome}`, pts: mainPts, dn: 'DN 100', material: 'PVC PN60 enterrado', len: polylineLength(mainPts), reg: rc.id });
    // tensiômetros: 2 por região em setores distintos
    const R = rng(hash(rc.id + 'ts'));
    [0, reg.setores.length - 1].forEach((si, k) => {
      const st = reg.setores[si];
      if (!st) return;
      const r = st.rows[Math.floor(st.rows.length * (0.3 + 0.4 * R()))];
      const t = 0.25 + 0.5 * R();
      addAsset({ id: `TS-${rc.id}-${k + 1}`, tipo: 'tensiometro', nome: `Bateria de tensiômetros ${rc.id}-${k + 1}`, x: r.x1 + (r.x2 - r.x1) * t, y: r.y1 + (r.y2 - r.y1) * t, reg: rc.id, setor: st.id, rua: r.id,
        specs: { 'Profundidades': '20 e 40 cm', 'Leitura': 'Tensímetro digital (kPa)', 'Rua': r.id } });
    });
  }

  // ----- Captação, reservatório e casa de bombas -----
  const rv = cfg.reservatorio;
  const ac = cfg.acude;
  addAsset({ id: 'RES-01', tipo: 'reservatorio', nome: 'Reservatório revestido', x: rv.x, y: rv.y, specs: { 'Revestimento': 'Geomembrana PEAD 1 mm', 'Dimensões (crista)': `${rv.w} × ${rv.h} m`, 'Profundidade': `${rv.prof} m`, 'Volume útil aprox.': `${Math.round(rv.w * rv.h * rv.prof * 0.8).toLocaleString('pt-BR')} m³`, 'Cerca': 'Alambrado perimetral' } });
  addAsset({ id: 'RES-02', tipo: 'acude', nome: 'Açude de captação', x: ac.x, y: ac.y, specs: { 'Tipo': 'Barramento em curso d’água', 'Área do espelho': `${Math.round(Math.PI * ac.rx * ac.ry / 1e4 * 10) / 10} ha`, 'Outorga': 'Informar nº da portaria IGAM' } });
  addAsset({ id: 'BC-01', tipo: 'bomba', nome: 'Motobomba de captação', x: ac.x - ac.rx - 6, y: ac.y - 10, specs: { 'Potência': '30 cv', 'Vazão nominal': '90 m³/h', 'AMT': '48 mca', 'Partida': 'Soft-starter', 'Destino': 'Reservatório RES-01' }, pot: 30, q: 90, amt: 48 });
  const capPts = [[ac.x - ac.rx - 6, ac.y - 10], [ac.x - ac.rx - 6, rv.y + 40], [rv.x + rv.w / 2 + 4, rv.y + 40], [rv.x + rv.w / 2 + 4, rv.y + rv.h / 2]];
  farm.pipes.push({ id: 'AD-CAP', tipo: 'captacao', nome: 'Adutora de recalque (captação → reservatório)', pts: capPts, dn: 'DN 125', material: 'PEAD PN10', len: polylineLength(capPts) });
  const [px, py] = PH;
  addAsset({ id: 'CB-01', tipo: 'casa', nome: 'Casa de bombas e cabeçal central', x: px, y: py, specs: { 'Estrutura': 'Alvenaria, cobertura metálica', 'Abriga': 'Bombas B-01 a B-03, filtros, injetor, quadro, controlador' } });
  const bombas = [
    { id: 'B-01', nome: 'Motobomba principal 1', pot: 75, q: 200, amt: 62 },
    { id: 'B-02', nome: 'Motobomba principal 2', pot: 75, q: 200, amt: 62 },
    { id: 'B-03', nome: 'Motobomba reserva', pot: 50, q: 130, amt: 60 },
  ];
  bombas.forEach((b, i) => addAsset({ ...b, tipo: 'bomba', x: px - 4 + i * 4, y: py + 7, specs: { 'Potência': `${b.pot} cv`, 'Vazão nominal': `${b.q} m³/h`, 'AMT': `${b.amt} mca`, 'Acionamento': i < 2 ? 'Inversor de frequência' : 'Partida estrela-triângulo', 'Rotor': 'Centrífuga monoestágio' } }));
  addAsset({ id: 'FL-01', tipo: 'filtro', nome: 'Bateria de filtros de disco', x: px + 9, y: py + 2, specs: { 'Elementos': '6 × filtros de disco 3"', 'Malha': '120 mesh (130 µm)', 'Retrolavagem': 'Automática por ΔP (0,4 bar) ou tempo' } });
  addAsset({ id: 'INJ-01', tipo: 'injetor', nome: 'Injetor de fertilizantes', x: px + 9, y: py - 5, specs: { 'Tipo': 'Bomba dosadora elétrica', 'Vazão de injeção': 'até 400 L/h', 'Tanques': '2 × 5.000 L (separar cálcio de sulfatos/fosfatos)' } });
  addAsset({ id: 'QE-01', tipo: 'quadro', nome: 'Quadro elétrico de comando', x: px - 8, y: py - 5, specs: { 'Proteções': 'Disjuntor motor, relé de falta de fase, relé de nível', 'Medição': 'Multimedidor de energia (kWh, A, V, FP)' } });
  addAsset({ id: 'CTR-01', tipo: 'controlador', nome: 'Controlador de irrigação', x: px - 8, y: py + 1, specs: { 'Tipo': 'CLP com rádio LoRa', 'Comanda': 'Relés de campo, bombas, injetor, retrolavagem', 'Programação': 'Por setor, por horário, por lâmina' } });
  ['B-01', 'B-02', 'B-03', 'BC-01', 'INJ-01'].forEach((bid) => {
    const b = farm.assetById.get(bid);
    addAsset({ id: `RL-${bid}`, tipo: 'rele', nome: `Relé de partida ${bid}`, x: b.x + 1.5, y: b.y + 1.5, specs: { 'Tipo': bid.startsWith('BC') ? 'Módulo rádio remoto' : 'Saída digital do CLP + contator', 'Comanda': bid } });
  });
  addAsset({ id: 'EM-01', tipo: 'estacao', nome: 'Estação meteorológica', x: px + 30, y: py - 30, specs: { 'Sensores': 'Temperatura, UR, vento, radiação, chuva', 'Uso': 'ETo diária (Penman-Monteith) e janelas de pulverização' } });
  addAsset({ id: 'TERR-01', tipo: 'terreiro', nome: 'Terreiro / lavador / secadores', x: farm.sede[0], y: farm.sede[1], specs: { 'Terreiro': 'Concreto', 'Lavador': 'Separador de bóia e cereja', 'Secadores': '2 × rotativos' } });

  farm.cruzetas = farm.assets.filter((a) => a.tipo === 'cruzeta');
  const all = farm.regions.flatMap((r) => r.poly);
  farm.bounds = bbox(all);
  farm.totais = {
    areaHa: farm.regions.reduce((s, r) => s + r.areaHa, 0),
    ruas: farm.rows.length,
    plantas: farm.regions.reduce((s, r) => s + r.plantas, 0),
    gotejadores: farm.regions.reduce((s, r) => s + r.gotejadores, 0),
    compRuas: farm.regions.reduce((s, r) => s + r.compRuas, 0),
    setores: farm.regions.reduce((s, r) => s + r.setores.length, 0),
  };
  return farm;
}

export function pointAt(pts, d) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg >= d) {
      const t = (d - acc) / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    acc += seg;
  }
  return pts[pts.length - 1];
}

// Posição da planta j (0-based) ao longo da rua
export function plantPos(row, reg, j) {
  const used = (row.nPl - 1) * reg.espPlanta;
  const off = (row.len - used) / 2;
  const t = (off + j * reg.espPlanta) / row.len;
  return [row.x1 + (row.x2 - row.x1) * t, row.y1 + (row.y2 - row.y1) * t, off + j * reg.espPlanta];
}
// Gotejador mais próximo de uma distância (m) a partir do início da rua
export function gotejadorEm(row, reg, dist) {
  const n = clamp(Math.round((dist - reg.gotEsp / 2) / reg.gotEsp), 0, row.nGot - 1);
  const d = reg.gotEsp / 2 + n * reg.gotEsp;
  const t = d / row.len;
  const lateral = d < row.ca - row.a1 ? 'A' : 'B';
  return { n: n + 1, dist: d, lateral, x: row.x1 + (row.x2 - row.x1) * t, y: row.y1 + (row.y2 - row.y1) * t };
}
export function rowPointAt(row, dist) {
  const t = clamp(dist / row.len, 0, 1);
  return [row.x1 + (row.x2 - row.x1) * t, row.y1 + (row.y2 - row.y1) * t];
}

// Leitura de GeoJSON com polígonos (lat/lon) -> polígonos locais em metros
export function polysFromGeoJSON(gj) {
  const feats = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : [{ geometry: gj, properties: {} }];
  const out = [];
  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : [];
    for (const ring of rings) out.push({ nome: f.properties?.name || f.properties?.nome || '', ring });
  }
  return out;
}
export function polysFromKML(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const out = [];
  doc.querySelectorAll('Placemark').forEach((pm) => {
    const nome = pm.querySelector('name')?.textContent || '';
    const coords = pm.querySelector('Polygon coordinates, outerBoundaryIs coordinates');
    if (!coords) return;
    const ring = coords.textContent.trim().split(/\s+/).map((t) => t.split(',').map(Number)).filter((c) => c.length >= 2);
    out.push({ nome, ring });
  });
  return out;
}
