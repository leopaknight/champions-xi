// Rastreamento de equipamentos (GPS) e telemetria da irrigação.
// Fontes: simulação (padrão, para demonstração), arquivo (GPX/CSV/NMEA) e
// tempo real via window.fazendaGPS.push({...}) para integrar um rastreador.
import { TIPOS_EQUIP } from './catalog.js';
import { geo, rng, hash, clamp, expandRanges } from './util.js';

export class Sim {
  constructor(model) {
    this.model = model;
    this.machines = [];
    this.escala = 30;
    this.rodando = true;
    this.live = new Map(); // posições reais recebidas
    this.listeners = [];
    window.fazendaGPS = {
      push: (p) => this.pushReal(p),
      ajuda: 'fazendaGPS.push({ id: "COL-01", lat: -18.62, lon: -48.24, vel: 1.2, t: Date.now() })',
    };
  }
  onUpdate(fn) { this.listeners.push(fn); }

  setup(modo) {
    const m = this.model, farm = m.farm;
    const eqs = m.equipList();
    const sede = farm.sede;
    const prev = new Map(this.machines.map((x) => [x.id, x]));
    this.machines = [];
    const regs = farm.regions;
    const assign = new Map();
    if (modo === 'colheita') {
      const prod = regs.filter((r) => m.safra - r.plantio >= 2);
      const cols = eqs.filter((e) => e.tipo === 'colhedora');
      const bzs = eqs.filter((e) => e.tipo === 'bazuca');
      cols.forEach((e, i) => { const r = prod[i % Math.max(1, prod.length)]; if (r) assign.set(e.id, { rows: r.rows, tarefa: 'CL01', nome: 'Colheita mecanizada' }); });
      bzs.forEach((e, i) => { if (cols[i]) assign.set(e.id, { segue: cols[i].id, tarefa: 'CL04', nome: 'Transbordo' }); });
      const rec = eqs.find((e) => e.tipo === 'recolhedora');
      const r3 = prod[cols.length % Math.max(1, prod.length)] || prod[0];
      if (rec && r3) assign.set(rec.id, { rows: r3.rows.slice(0, Math.ceil(r3.rows.length / 2)), tarefa: 'CL03', nome: 'Recolhimento' });
    } else {
      for (const os of m.emExecucao()) {
        if (!os.equip) continue;
        const rows = m.rowsOf(os);
        if (rows.length) assign.set(os.equip, { rows, tarefa: os.tarefa, os: os.id });
      }
    }
    let park = 0;
    for (const e of eqs) {
      const tipo = TIPOS_EQUIP[e.tipo] ? e.tipo : 'trator';
      const a = assign.get(e.id);
      const old = prev.get(e.id);
      const mc = {
        id: e.id, nome: e.nome, tipo, x: sede[0] - 20 + (park % 5) * 9, y: sede[1] + 26 + Math.floor(park / 5) * 9, heading: 0, vel: 0,
        estado: 'parado', trail: old && old.modo === modo ? old.trail : [], path: null, seg: 0, off: 0, rua: null, dist: 0, litros: 0, carga: 0,
        tarefa: a?.tarefa || null, os: a?.os || null, segue: a?.segue || null, fonte: 'Simulação', modo,
        velNom: TIPOS_EQUIP[tipo].vel, rastreador: e.rastreador,
      };
      if (!a) park++;
      if (a?.rows) {
        mc.path = this.serpentina(a.rows, tipo);
        const frac = 0.25 + rng(hash(e.id + modo))() * 0.3;
        this.avancarFracao(mc, frac);
        mc.estado = 'operando';
      }
      if (this.live.has(e.id)) Object.assign(mc, this.live.get(e.id), { fonte: 'Tempo real' });
      this.machines.push(mc);
    }
    for (const mc of this.machines) if (mc.segue) { mc.estado = 'acompanhando'; this.seguir(mc, 0); }
    this.emit();
  }

  serpentina(rows, tipo) {
    const farm = this.model.farm;
    const pts = [];
    const sede = farm.sede;
    const sorted = [...rows].sort((a, b) => a.reg === b.reg ? a.idx - b.idx : a.reg.localeCompare(b.reg));
    const off = tipo === 'colhedora' || tipo === 'recolhedora' ? 0 : 0.5; // tratores andam na entrelinha
    pts.push({ x: sede[0], y: sede[1], rua: null });
    sorted.forEach((r, k) => {
      const reg = farm.regionById.get(r.reg);
      const ox = reg.v[0] * reg.espLinha * off, oy = reg.v[1] * reg.espLinha * off;
      const a = [r.x1 + ox, r.y1 + oy], b = [r.x2 + ox, r.y2 + oy];
      const [p, q] = k % 2 ? [b, a] : [a, b];
      // cabeceira: sai alguns metros para manobrar
      pts.push({ x: p[0] - reg.u[0] * (k % 2 ? -8 : 8), y: p[1] - reg.u[1] * (k % 2 ? -8 : 8), rua: null });
      pts.push({ x: p[0], y: p[1], rua: null });
      pts.push({ x: q[0], y: q[1], rua: r.id, esp: reg.espLinha });
    });
    return pts;
  }

  avancarFracao(mc, f) {
    let total = 0;
    const p = mc.path;
    for (let i = 1; i < p.length; i++) total += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    this.mover(mc, total * f, true);
  }

  mover(mc, d, silencioso = false) {
    const p = mc.path;
    while (d > 0 && p) {
      if (mc.seg >= p.length - 1) { mc.seg = 0; mc.off = 0; }
      const a = p[mc.seg], b = p[mc.seg + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 0.001;
      const rest = L - mc.off;
      const step = Math.min(rest, d);
      mc.off += step; d -= step;
      const t = mc.off / L;
      mc.x = a.x + (b.x - a.x) * t; mc.y = a.y + (b.y - a.y) * t;
      mc.heading = Math.atan2(b.y - a.y, b.x - a.x);
      mc.rua = b.rua;
      if (b.rua && !silencioso) { mc.dist += step; mc.area = (mc.area || 0) + (step * (b.esp || 3.8)) / 1e4; }
      if (!silencioso) this.trail(mc);
      if (mc.off >= L - 1e-6) { mc.seg++; mc.off = 0; }
    }
  }

  trail(mc) {
    const t = mc.trail;
    const l = t[t.length - 1];
    if (!l || Math.hypot(l[0] - mc.x, l[1] - mc.y) > 3) { t.push([mc.x, mc.y]); if (t.length > 3000) t.shift(); }
  }

  seguir(mc, dt) {
    const alvo = this.machines.find((x) => x.id === mc.segue);
    if (!alvo) return;
    const farm = this.model.farm;
    const sede = farm.sede;
    const cap = 8000;
    if (mc.estado === 'acompanhando') {
      const r = alvo.rua ? farm.rowById.get(alvo.rua) : null;
      const reg = r ? farm.regionById.get(r.reg) : null;
      const ox = reg ? reg.v[0] * reg.espLinha : 4, oy = reg ? reg.v[1] * reg.espLinha : 0;
      mc.x = alvo.x + ox; mc.y = alvo.y + oy; mc.heading = alvo.heading; mc.vel = alvo.vel;
      mc.rua = alvo.rua;
      this.trail(mc);
      if (mc.carga >= cap) { mc.estado = 'descarregando'; mc.destino = [sede[0] + 30, sede[1]]; }
    } else if (mc.estado === 'descarregando' || mc.estado === 'retornando') {
      const [tx, ty] = mc.estado === 'descarregando' ? mc.destino : [alvo.x, alvo.y];
      const d = Math.hypot(tx - mc.x, ty - mc.y);
      const step = (mc.velNom / 3.6) * dt * this.escala;
      mc.vel = mc.velNom;
      if (d <= step + 2) {
        if (mc.estado === 'descarregando') { mc.litros += mc.carga; mc.carga = 0; mc.estado = 'retornando'; mc.cargas = (mc.cargas || 0) + 1; }
        else mc.estado = 'acompanhando';
      } else {
        mc.x += ((tx - mc.x) / d) * step; mc.y += ((ty - mc.y) / d) * step;
        mc.heading = Math.atan2(ty - mc.y, tx - mc.x);
      }
      mc.rua = null;
      this.trail(mc);
    }
  }

  tick(dt) {
    if (!this.rodando || !this.machines.length) return;
    dt = Math.min(dt, 0.25);
    const m = this.model;
    for (const mc of this.machines) {
      if (mc.fonte === 'Tempo real') continue;
      if (mc.segue) continue;
      if (mc.fonte === 'Arquivo' && mc.path) { this.mover(mc, (mc.velArq || 4) / 3.6 * dt * this.escala); mc.vel = mc.velArq || 4; continue; }
      if (mc.estado !== 'operando' || !mc.path) { mc.vel = 0; continue; }
      const naRua = mc.rua != null;
      const vkm = naRua ? mc.velNom : Math.max(mc.velNom, 6);
      mc.vel = vkm * (0.95 + 0.1 * Math.random());
      const d = (vkm / 3.6) * dt * this.escala;
      const before = mc.dist;
      this.mover(mc, d);
      if (mc.tipo === 'colhedora' && mc.dist > before) {
        const r = m.farm.rowById.get(mc.rua);
        const reg = r && m.farm.regionById.get(r.reg);
        const prev = reg ? (m.previsao(reg)?.scha || 35) : 35;
        const lpm = (prev * m.params().rendimento * (reg?.espLinha || 3.8)) / 1e4;
        const l = (mc.dist - before) * lpm;
        mc.litros += l;
        const bz = this.machines.find((x) => x.segue === mc.id && x.estado === 'acompanhando');
        if (bz) bz.carga += l;
      }
    }
    for (const mc of this.machines) if (mc.segue) this.seguir(mc, dt);
    this.emit();
  }

  emit() { for (const f of this.listeners) f(this.machines); }

  pushReal(p) {
    if (!p || !p.id) return false;
    const [x, y] = p.lat != null ? geo.fromLatLon(+p.lat, +p.lon) : [p.x, p.y];
    const mc = this.machines.find((m) => m.id === p.id || m.rastreador === p.id);
    const prev = mc ? [mc.x, mc.y] : null;
    const upd = { x, y, vel: +p.vel || 0, fonte: 'Tempo real', estado: (+p.vel || 0) > 0.3 ? 'operando' : 'parado', ultimo: p.t || Date.now() };
    if (prev) upd.heading = Math.atan2(y - prev[1], x - prev[0]);
    this.live.set(mc ? mc.id : p.id, upd);
    if (mc) {
      Object.assign(mc, upd);
      const row = this.rowAt(x, y);
      mc.rua = row ? row.id : null;
      this.trail(mc);
    }
    this.emit();
    return true;
  }

  rowAt(x, y) {
    const farm = this.model.farm;
    for (const reg of farm.regions) {
      const a = x * reg.u[0] + y * reg.u[1], b = x * reg.v[0] + y * reg.v[1];
      let best = null, bd = reg.espLinha / 2;
      for (const r of reg.rows) {
        const d = Math.abs(r.b - b);
        if (d < bd && a >= r.a1 - 2 && a <= r.a2 + 2) { bd = d; best = r; }
      }
      if (best) return best;
    }
    return null;
  }

  // Importação de trilha: GPX, CSV (lat;lon[;tempo]) ou NMEA ($GPRMC/$GPGGA)
  importarTrilha(id, texto, nomeArq = '') {
    const pts = parseTrilha(texto, nomeArq);
    if (pts.length < 2) throw new Error('Não encontrei pontos de GPS no arquivo.');
    const mc = this.machines.find((m) => m.id === id);
    if (!mc) throw new Error('Equipamento não encontrado.');
    mc.path = pts.map(([lat, lon]) => { const [x, y] = geo.fromLatLon(lat, lon); return { x, y, rua: null }; });
    // marca trechos dentro de ruas
    for (const p of mc.path) { const r = this.rowAt(p.x, p.y); p.rua = r ? r.id : null; if (r) p.esp = this.model.farm.regionById.get(r.reg).espLinha; }
    mc.seg = 0; mc.off = 0; mc.trail = []; mc.fonte = 'Arquivo'; mc.estado = 'operando';
    let dur = 0;
    if (pts[0][2] && pts[pts.length - 1][2]) dur = (pts[pts.length - 1][2] - pts[0][2]) / 1000;
    let L = 0;
    for (let i = 1; i < mc.path.length; i++) L += Math.hypot(mc.path[i].x - mc.path[i - 1].x, mc.path[i].y - mc.path[i - 1].y);
    mc.velArq = dur > 0 ? clamp((L / dur) * 3.6, 0.5, 40) : 4;
    this.emit();
    return { pontos: pts.length, comprimento: L, velMedia: mc.velArq };
  }
}

export function parseTrilha(txt, nome = '') {
  const out = [];
  if (/<gpx|<trkpt/i.test(txt)) {
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    doc.querySelectorAll('trkpt, rtept, wpt').forEach((p) => {
      const t = p.querySelector('time')?.textContent;
      out.push([+p.getAttribute('lat'), +p.getAttribute('lon'), t ? Date.parse(t) : null]);
    });
    return out.filter((p) => !Number.isNaN(p[0]));
  }
  if (/\$G[PN](RMC|GGA)/.test(txt)) {
    const dm = (v, h) => { if (!v) return NaN; const d = Math.floor(+v / 100); const m = +v - d * 100; const r = d + m / 60; return h === 'S' || h === 'W' ? -r : r; };
    for (const line of txt.split(/\r?\n/)) {
      const f = line.split(',');
      if (/RMC$/.test(f[0]) && f[2] === 'A') out.push([dm(f[3], f[4]), dm(f[5], f[6]), null]);
      if (/GGA$/.test(f[0]) && +f[6] > 0) out.push([dm(f[2], f[3]), dm(f[4], f[5]), null]);
    }
    return out.filter((p) => !Number.isNaN(p[0]));
  }
  for (const line of txt.split(/\r?\n/)) {
    const f = line.split(/[;,\t]/).map((s) => s.trim());
    const nums = f.map(Number);
    const iLat = nums.findIndex((v) => v < -5 && v > -35);
    const iLon = nums.findIndex((v) => v < -34 && v > -75);
    if (iLat < 0 || iLon < 0) continue;
    const tf = f.find((s) => /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s));
    out.push([nums[iLat], nums[iLon], tf ? Date.parse(tf.replace(' ', 'T')) : null]);
  }
  return out;
}

// --------------------------- Telemetria (simulada) ---------------------------
// Substituir por leitura do CLP/controlador quando houver integração.
const AGENDA = {
  'B-01': [[21.5, 24], [0, 5.5]],
  'B-02': [[22, 24], [0, 4]],
  'B-03': [],
  'BC-01': [[8, 16]],
  'INJ-01': [[22.5, 23.7]],
};
export function telemetriaBomba(a, status, d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  const on = (hh) => status !== 'manutencao' && status !== 'falha' && (AGENDA[a.id] || []).some(([i, f]) => hh >= i && hh < f);
  const R = rng(hash(a.id + d.toDateString()));
  const serie = [];
  for (let i = 0; i < 48; i++) {
    const hh = i / 2;
    const ligado = on(hh);
    serie.push({ h: hh, ligado, vazao: ligado ? (a.q || 100) * (0.88 + R() * 0.08) : 0, pressao: ligado ? (a.amt || 50) * (0.9 + R() * 0.06) : 0 });
  }
  const ligada = on(h);
  const pot = a.pot || 30;
  const kw = ligada ? pot * 0.736 * (0.82 + 0.05 * Math.sin(h)) : 0;
  const tensao = 380 + Math.round((R() - 0.5) * 12);
  const corrente = ligada ? (kw * 1000) / (Math.sqrt(3) * tensao * 0.86) : 0;
  const horasDia = serie.filter((s) => s.ligado).length / 2;
  return {
    ligada, kw, tensao, corrente, fp: ligada ? 0.86 : null,
    vazao: ligada ? (a.q || 100) * (0.9 + 0.04 * Math.sin(h * 3)) : 0,
    pressao: ligada ? ((a.amt || 50) * (0.92 + 0.03 * Math.cos(h * 2))) / 10.2 : 0, // bar
    horimetro: 8000 + (hash(a.id) % 6000), horasDia, kwhDia: horasDia * pot * 0.736 * 0.83, serie,
  };
}
export function telemetriaRele(a, status, d = new Date()) {
  const R = rng(hash(a.id));
  const off = status === 'falha';
  const min = off ? 60 * 24 * 3 + Math.floor(R() * 200) : Math.floor(R() * 9) + 1;
  return { online: !off, rssi: off ? null : -72 - Math.round(R() * 34), bateria: off ? 11.2 : +(12.4 + R() * 0.8).toFixed(2), ultimoContato: new Date(d - min * 60000), estadoSaida: off ? 'desconhecido' : 'fechada' };
}
export function nivelReservatorio(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  // esvazia à noite (irrigação), enche de dia (captação)
  let n = 86;
  if (h >= 21.5) n = 86 - (h - 21.5) * 6;
  else if (h < 5.5) n = 86 - (2.5 + h) * 6;
  else if (h < 8) n = 38;
  else if (h < 16) n = 38 + (h - 8) * 6;
  return clamp(n, 20, 95);
}
export function setorIrrigando(ordem, total, d = new Date()) {
  // rodízio noturno 21:30–05:30, 4 setores simultâneos (2 bombas principais)
  const h = d.getHours() + d.getMinutes() / 60;
  const hh = h < 12 ? h + 24 : h;
  const simult = 4;
  const grupos = Math.ceil(total / simult);
  const dur = 8 / grupos;
  const ini = 21.5 + Math.floor(ordem / simult) * dur;
  return hh >= ini && hh < ini + dur;
}
export { expandRanges };
