// Camada de dados derivados: índices por rua, plano do ciclo, colheita por rua,
// previsões, fitossanidade, estado de ativos. Recalcula sob demanda (cache por versão).
import { expandRanges, anoSafra, isoDate, addDays, daysBetween, mean, sum } from './util.js';
import { planoSafra, statusOcorrencia, estagio, estimar, recomendar, PARAM_PADRAO, custoOS, cud, previsaoMaturacao } from './agro.js';
import { TAREFA, INSUMOS, PRAGAS } from './catalog.js';
import { demoPlantas } from './demo.js';

export class Model {
  constructor(store) {
    this.store = store;
    this.farm = null;
    this.hoje = isoDate();
    this.v = 0;
    this.cache = {};
    store.addEventListener('change', () => { this.v++; this.cache = {}; });
  }
  setFarm(f) { this.farm = f; this.v++; this.cache = {}; }
  memo(k, fn) { if (!(k in this.cache)) this.cache[k] = fn(); return this.cache[k]; }

  get safra() { return anoSafra(this.hoje); }
  params() { return { ...PARAM_PADRAO, ...(this.store.config().params || {}) }; }
  precos() {
    const p = Object.fromEntries(INSUMOS.map((i) => [i.id, i.preco]));
    return { ...p, ...(this.store.config().precos || {}) };
  }
  insumos() {
    const extra = this.store.config().insumosExtra || [];
    const pr = this.precos();
    return [...INSUMOS, ...extra].map((i) => ({ ...i, preco: pr[i.id] ?? i.preco }));
  }
  equipList() { return this.store.all('equip').sort((a, b) => a.id.localeCompare(b.id)); }
  equipMap() { return this.memo('eqm', () => Object.fromEntries(this.equipList().map((e) => [e.id, e]))); }

  // ---------- OS ----------
  osList() { return this.memo('os', () => this.store.all('os').sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))); }
  rowsOf(os) {
    const out = [];
    if (!os.ruas) return out;
    for (const [reg, rg] of Object.entries(os.ruas)) {
      const R = this.farm.regionById.get(reg);
      if (!R) continue;
      const set = new Set(expandRanges(rg));
      for (const r of R.rows) if (set.has(r.idx)) out.push(r);
    }
    return out;
  }
  areaOS(os) { return sum(this.rowsOf(os), (r) => r.areaHa); }
  regioesOS(os) { return Object.keys(os.ruas || {}); }
  custo(os) {
    return custoOS(os, this.areaOS(os), this.precos(), this.equipMap(), this.params());
  }
  // índice: rowId -> [{tarefa, data, osId, status}]
  rowIndex() {
    return this.memo('ridx', () => {
      const m = new Map();
      for (const os of this.osList()) {
        if (os.status === 'cancelada') continue;
        for (const r of this.rowsOf(os)) {
          if (!m.has(r.id)) m.set(r.id, []);
          m.get(r.id).push({ tarefa: os.tarefa, data: os.data, os: os.id, status: os.status });
        }
      }
      return m;
    });
  }
  rowHistory(rowId) {
    const ids = new Set((this.rowIndex().get(rowId) || []).map((x) => x.os));
    return this.osList().filter((o) => ids.has(o.id));
  }

  // ---------- Plano do ciclo ----------
  plano(reg, safra = this.safra) {
    return this.memo(`plano-${reg.id}-${safra}`, () => planoSafra(safra, estagio(reg, safra)));
  }
  rowPlan(row, safra = this.safra) {
    const reg = this.farm.regionById.get(row.reg);
    const idx = this.rowIndex().get(row.id) || [];
    const feitas = {};
    for (const x of idx) if (x.status === 'concluida' || x.status === 'execucao') (feitas[x.tarefa] = feitas[x.tarefa] || []).push(x.data);
    return this.plano(reg, safra).map((oc) => ({ ...oc, ...statusOcorrencia(oc, feitas[oc.tarefa] || [], this.hoje) }));
  }
  rowPlanSummary(row) {
    const k = `rps-${row.id}`;
    return this.memo(k, () => {
      const p = this.rowPlan(row);
      return { atrasadas: p.filter((x) => x.st === 'atrasada').length, agora: p.filter((x) => x.st === 'agora').length, feitas: p.filter((x) => x.st === 'feita').length, total: p.length };
    });
  }
  pendenciasRegiao(reg) {
    return this.memo(`pend-${reg.id}`, () => {
      const m = new Map();
      for (const r of reg.rows) {
        for (const oc of this.rowPlan(r)) {
          if (oc.st !== 'atrasada' && oc.st !== 'agora') continue;
          const k = oc.key;
          if (!m.has(k)) m.set(k, { ...oc, ruas: [] });
          m.get(k).ruas.push(r.idx);
        }
      }
      return [...m.values()].sort((a, b) => (a.st === b.st ? (a.fim < b.fim ? -1 : 1) : a.st === 'atrasada' ? -1 : 1));
    });
  }
  osDoDia(d = this.hoje) { return this.osList().filter((o) => o.data === d && o.status !== 'cancelada'); }
  emExecucao() { return this.osList().filter((o) => o.status === 'execucao'); }

  // ---------- Pé a pé ----------
  plantas(row) {
    const st = this.store.data.plantas.get(row.id);
    if (st) return st;
    if (this.store.demoOn()) {
      const k = `pl-${row.id}`;
      return this.memo(k, () => demoPlantas(row, this.farm.regionById.get(row.reg), this.hoje));
    }
    return { id: row.id, falhas: [], replantadas: [], doentes: [], baixa: [], morta: [], notas: {} };
  }
  plantStatus(pl, j) {
    if (pl.falhas?.includes(j)) return 'falha';
    if (pl.morta?.includes(j)) return 'morta';
    if (pl.doentes?.includes(j)) return 'doente';
    if (pl.baixa?.includes(j)) return 'baixa';
    if (pl.replantadas?.includes(j)) return 'replantada';
    return 'ok';
  }
  estande(reg) {
    return this.memo(`est-${reg.id}`, () => {
      let falhas = 0, repl = 0, doentes = 0, mortas = 0;
      for (const r of reg.rows) {
        const p = this.plantas(r);
        falhas += p.falhas?.length || 0; repl += p.replantadas?.length || 0; doentes += p.doentes?.length || 0; mortas += p.morta?.length || 0;
      }
      return { falhas, repl, doentes, mortas, vivas: reg.plantas - falhas - mortas, pctFalhas: ((falhas + mortas) / reg.plantas) * 100 };
    });
  }
  rowFalhasPct(row) { const p = this.plantas(row); return (((p.falhas?.length || 0) + (p.morta?.length || 0)) / row.nPl) * 100; }

  // ---------- Fitossanidade (a partir das OS MN01) ----------
  monitoramentos(regId) {
    return this.osList().filter((o) => o.tarefa === 'MN01' && (!regId || o.ruas?.[regId])).sort((a, b) => (a.data < b.data ? -1 : 1));
  }
  fitoAtual(regId) {
    return this.memo(`fito-${regId}`, () => {
      const l = this.monitoramentos(regId);
      const u = l[l.length - 1];
      if (!u) return null;
      const out = { data: u.data, vals: {}, alertas: [] };
      for (const p of PRAGAS) {
        const v = u.campos?.[p.k];
        if (v == null || v === '') continue;
        out.vals[p.k] = +v;
        if (+v >= p.nc) out.alertas.push({ ...p, v: +v });
      }
      return out;
    });
  }

  // ---------- Solo ----------
  soloAtual(regId) {
    return this.store.all('solo').filter((s) => s.reg === regId).sort((a, b) => (a.data < b.data ? 1 : -1))[0] || null;
  }
  recomendacao(reg) {
    const s = this.soloAtual(reg.id);
    if (!s) return null;
    const prev = this.previsao(reg);
    const sc = +s.scEsperada || (prev ? prev.scha : 0) || 30;
    return { solo: s, sc, rec: recomendar(s.a020, s.a2040, sc, this.params(), estagio(reg, this.safra)) };
  }

  // ---------- Colheita ----------
  cargas(safra) { return this.store.all('colheita').filter((c) => +c.safra === +safra); }
  safrasColhidas() {
    const s = new Set(this.store.all('colheita').map((c) => +c.safra));
    s.add(this.safra);
    return [...s].sort((a, b) => b - a);
  }
  // litros por rua (rateio da carga pelo comprimento das ruas)
  litrosPorRua(safra) {
    return this.memo(`lpr-${safra}`, () => {
      const m = new Map();
      const mat = new Map();
      for (const c of this.cargas(safra)) {
        const reg = this.farm.regionById.get(c.reg);
        if (!reg) continue;
        const set = new Set(expandRanges(c.ruas));
        const rs = reg.rows.filter((r) => set.has(r.idx));
        const L = sum(rs, (r) => r.len) || 1;
        for (const r of rs) {
          m.set(r.id, (m.get(r.id) || 0) + (c.litros * r.len) / L);
          if (c.maturacao) mat.set(r.id, c.maturacao);
        }
      }
      return { litros: m, mat };
    });
  }
  colheitaRegiao(reg, safra) {
    const { litros } = this.litrosPorRua(safra);
    let L = 0, ruas = 0, area = 0;
    for (const r of reg.rows) { const v = litros.get(r.id); if (v) { L += v; ruas++; area += r.areaHa; } }
    const p = this.params();
    const sc = L / p.rendimento;
    return { litros: L, sacas: sc, ruasColhidas: ruas, pct: (ruas / reg.rows.length) * 100, scha: area ? sc / area : 0, schaTotal: sc / reg.areaHa };
  }
  rowScHa(row, safra) {
    const L = this.litrosPorRua(safra).litros.get(row.id);
    if (!L) return null;
    return L / this.params().rendimento / row.areaHa;
  }
  contagens(regId, safra) {
    return this.store.all('contagens').filter((c) => (!regId || c.reg === regId) && (!safra || +c.safra === +safra)).sort((a, b) => (a.data < b.data ? -1 : 1));
  }
  previsao(reg, safra = this.safra) {
    return this.memo(`prev-${reg.id}-${safra}`, () => {
      const l = this.contagens(reg.id, safra);
      const u = l[l.length - 1];
      if (!u) return null;
      const e = estimar(u, reg, this.estande(reg).pctFalhas, this.params());
      return e ? { ...e, data: u.data, fase: u.fase, contagem: u } : null;
    });
  }
  // previsão por rua = previsão da região × vigor relativo da rua (histórico)
  rowPrevisao(row, safra = this.safra) {
    const reg = this.farm.regionById.get(row.reg);
    const p = this.previsao(reg, safra);
    if (!p) return null;
    const ant = this.rowScHa(row, safra - 1);
    const antReg = this.colheitaRegiao(reg, safra - 1).scha;
    const fator = ant && antReg ? Math.max(0.6, Math.min(1.4, ant / antReg)) : 1;
    const falha = 1 - this.rowFalhasPct(row) / 100;
    return p.scha * fator * falha / (1 - this.estande(reg).pctFalhas / 100 || 1);
  }

  // ---------- Florada / maturação ----------
  floradaPrincipal(reg, safra = this.safra) {
    const fl = this.osList().filter((o) => o.tarefa === 'FL03' && o.ruas?.[reg.id] && anoSafra(o.data) === safra);
    const pr = fl.find((o) => o.campos?.principal) || fl.sort((a, b) => (a.data < b.data ? -1 : 1))[0];
    return pr ? pr.data : null;
  }
  maturacaoPrevista(reg) { return previsaoMaturacao(this.floradaPrincipal(reg), reg.variedade); }

  // ---------- Ativos ----------
  assetStatus(id) {
    const o = this.store.get('ativos', id);
    return o?.status || 'ok';
  }
  manutAbertas() { return this.store.all('manut').filter((m) => m.status !== 'concluida'); }
  cudSetor(setorId) {
    const l = this.osList().filter((o) => o.tarefa === 'IR05' && o.campos?.setor === setorId);
    const u = l[0];
    if (!u) return null;
    const r = cud(String(u.campos.vazoes || '').split(/[,;\s]+/));
    return r ? { ...r, data: u.data } : null;
  }
}
