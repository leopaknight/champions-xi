// Interface: estrutura da tela, mapa 3D, gaveta de detalhes, busca e modos.
import { Scene3D } from './scene.js';
import { buildFarm, CONFIG_PADRAO, plantPos, gotejadorEm, rowPointAt } from './farm.js';
import { makeDemo } from './demo.js';
import { TAREFA, FASE, STATUS_OS, STATUS_ATIVO, STATUS_PLANTA, TIPOS_EQUIP, PRAGAS } from './catalog.js';
import { estagio, faseAtual, taxaMmH } from './agro.js';
import { telemetriaBomba, telemetriaRele, nivelReservatorio, setorIrrigando } from './sim.js';
import { esc, num, brl, pct, fmtDate, fmtDateShort, geo, isoDate, compressRanges, expandRanges, debounce, uid, hash, sum, addDays } from './util.js';
import { ic, chip, STCLS, STNOME, ramp, RAMPA_RISCO, RAMPA_PROD, RAMPA_AGUA, corCat, lineChart } from './dom.js';
import { VIEWS, NAV } from './views.js';
import { Forms } from './forms.js';

const MODOS = [
  { id: 'manejo', nome: 'Manejo' },
  { id: 'irrigacao', nome: 'Irrigação' },
  { id: 'colheita', nome: 'Colheita' },
];
const CORES = {
  manejo: [['plano', 'Plano do ciclo'], ['hoje', 'Trabalho de hoje'], ['ultima', 'Dias sem operação'], ['falhas', 'Falhas de estande'], ['fito', 'Pressão de pragas'], ['variedade', 'Cultivar'], ['idade', 'Idade'], ['regiao', 'Região']],
  irrigacao: [['setor', 'Setor'], ['irrigando', 'Irrigando agora'], ['cud', 'Uniformidade (CUD)']],
  colheita: [['previsao', 'Previsão (sc/ha)'], ['producao', 'Colhido (sc/ha)'], ['colhidas', 'Ruas colhidas'], ['maturacao', 'Maturação (% verde)']],
};

export class UI {
  constructor(store, model, sim) {
    this.store = store; this.model = model; this.sim = sim;
    this.mode = 'manejo';
    this.view = 'mapa';
    this.cor = { manejo: 'plano', irrigacao: 'setor', colheita: 'previsao' };
    this.sel = [];
    this.plantaSel = null;
    this.multi = false;
    this.drawer = null;
    this.drawerTab = 'resumo';
    this.safraColheita = null;
    this.seguir = null;
    this.camModo = 'atras';
    this.forms = new Forms(this);
  }

  // ------------------------------------------------------------------ início
  start() {
    document.getElementById('root').innerHTML = this.shell();
    this.$ = (s) => document.querySelector(s);
    this.scene = new Scene3D(this.$('#map3d'), {
      onPick: (hit, e) => this.onPick(hit, e),
      onHover: (hit, e) => this.onHover(hit, e),
    });
    this.rebuildFarm();
    this.bind();
    this.store.addEventListener('change', debounce((e) => this.onStore(e), 120));
    this.sim.onUpdate((ms) => this.onSim(ms));
    let last = performance.now();
    const tick = (t) => { const dt = (t - last) / 1000; last = t; this.sim.tick(dt); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setInterval(() => { if (this.mode === 'irrigacao') this.colorir(); if (this.view === 'irrigacao' || this.view === 'painel') this.renderView(); }, 60000);
    const h = (location.hash || '').slice(1);
    if (h && NAV.some((n) => n.id === h)) this.go(h); else this.go('mapa');
    window.addEventListener('hashchange', () => { const v = location.hash.slice(1) || 'mapa'; if (v !== this.view && NAV.some((n) => n.id === v)) this.go(v, false); });
  }

  farmConfig() {
    const c = this.store.config().fazenda || {};
    return { ...CONFIG_PADRAO, ...c, regioes: c.regioes && c.regioes.length ? c.regioes : CONFIG_PADRAO.regioes };
  }

  rebuildFarm() {
    const farm = buildFarm(this.farmConfig(), this.model.hoje);
    this.farm = farm;
    this.model.setFarm(farm);
    const demo = makeDemo(farm, this.model.hoje);
    for (const [k, v] of Object.entries(demo)) this.store.setDemo(k, v);
    this.model.v++; this.model.cache = {};
    this.scene.build(farm, this.model);
    this.sel = this.sel.filter((id) => farm.rowById.has(id));
    this.scene.setMode(this.mode);
    this.sim.setup(this.mode);
    this.refreshAll();
  }

  shell() {
    const nav = NAV.map((n) => `<button class="nav-b" data-act="go" data-v="${n.id}" title="${esc(n.nome)}" aria-label="${esc(n.nome)}">${ic(n.ic)}<span>${esc(n.curto || n.nome)}</span></button>`).join('');
    return `
<div id="app">
  <header class="top">
    <div class="brand"><div class="brand-mark">${ic('planta')}</div><div class="brand-t"><b id="farmName"></b><small id="farmSub"></small></div></div>
    <div class="modes" role="tablist">${MODOS.map((m) => `<button role="tab" class="mode-b" data-act="modo" data-m="${m.id}">${m.nome}</button>`).join('')}</div>
    <div class="search"><span class="search-ic">${ic('busca')}</span><input id="q" type="search" placeholder="Rua, planta, cruzeta, bomba… (ex.: R2-L047)" autocomplete="off"><div id="qres" class="qres" hidden></div></div>
    <label class="day" title="Dia de trabalho"><span>Dia</span><input id="dia" type="date"></label>
    <span id="sync" class="sync"></span>
  </header>
  <nav class="rail">${nav}</nav>
  <main id="stage">
    <div id="map3d"></div>
    <div id="hud" class="hud">
      <div class="hud-top">
        <div class="hud-card" id="hudSel"></div>
        <div class="hud-card hud-follow" id="hudFollow" hidden></div>
        <div class="hud-card hud-right" id="hudSim"></div>
      </div>
      <div class="hud-bottom">
        <div class="hud-card legend" id="legend"></div>
        <div class="hud-card tools" id="tools"></div>
      </div>
      <div id="tip" class="tip" hidden></div>
    </div>
    <section id="view" class="view" hidden></section>
    <aside id="drawer" class="drawer" hidden></aside>
  </main>
  <nav class="bottom">${NAV.filter((n) => n.mob).map((n) => `<button class="nav-b" data-act="go" data-v="${n.id}">${ic(n.ic)}<span>${esc(n.curto || n.nome)}</span></button>`).join('')}<button class="nav-b" data-act="maisMenu">${ic('menu')}<span>Mais</span></button></nav>
  <div id="maisMenu" class="mais" hidden>${NAV.filter((n) => !n.mob).map((n) => `<button data-act="go" data-v="${n.id}">${ic(n.ic)} ${esc(n.nome)}</button>`).join('')}</div>
  <div id="modal" class="modal" hidden></div>
  <div id="toast" class="toast" hidden></div>
</div>`;
  }

  // ------------------------------------------------------------------ eventos
  bind() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) { if (!e.target.closest('.search')) this.$('#qres').hidden = true; if (!e.target.closest('#maisMenu') && !e.target.closest('[data-act="maisMenu"]')) this.$('#maisMenu').hidden = true; return; }
      const fn = this.acts[a.dataset.act];
      if (fn) { e.preventDefault(); fn.call(this, a.dataset, a, e); }
    });
    document.addEventListener('change', (e) => {
      const a = e.target.closest('[data-chg]');
      if (a && this.chg[a.dataset.chg]) this.chg[a.dataset.chg].call(this, e.target, e);
    });
    const q = this.$('#q');
    q.addEventListener('input', debounce(() => this.buscar(q.value), 120));
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { this.buscar(q.value); const f = this.$('#qres [data-act]'); if (f) f.click(); } if (e.key === 'Escape') { this.$('#qres').hidden = true; q.blur(); } });
    const dia = this.$('#dia');
    dia.value = this.model.hoje;
    dia.addEventListener('change', () => { if (!dia.value) return; this.model.hoje = dia.value; this.model.v++; this.model.cache = {}; this.rebuildFarm(); this.toast(`Dia de trabalho: ${fmtDate(dia.value)}`); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!this.$('#modal').hidden) this.closeModal(); else if (this.drawer) this.closeDrawer(); }
    });
  }

  acts = {
    go(d) { this.go(d.v); this.$('#maisMenu').hidden = true; },
    maisMenu() { const m = this.$('#maisMenu'); m.hidden = !m.hidden; },
    modo(d) { this.setMode(d.m); },
    cor(d) { this.cor[this.mode] = d.c; this.colorir(); this.renderHud(); },
    layer(d) { this.scene.setLayer(d.l, !this.scene.layers[d.l]); this.renderHud(); },
    verTudo() { this.scene.frameAll(); },
    multi() { this.multi = !this.multi; this.renderHud(); this.toast(this.multi ? 'Seleção múltipla ligada: toque nas ruas para somar.' : 'Seleção múltipla desligada.'); },
    limparSel() { this.selecionar([]); this.closeDrawer(); },
    selRegiao(d) { const r = this.farm.regionById.get(d.r); if (!r) return; this.selecionar(r.rows.map((x) => x.id)); this.scene.flyToXY(r.centro[0], r.centro[1], Math.sqrt(r.areaHa * 1e4) * 1.4); this.openDrawer({ tipo: 'selecao' }); },
    selSetor(d) { const st = this.farm.regions.flatMap((r) => r.setores).find((s) => s.id === d.s); if (!st) return; this.selecionar(st.rows.map((x) => x.id)); this.openDrawer({ tipo: 'selecao' }); this.go('mapa'); },
    selRuas(d) { const ids = []; for (const [reg, rg] of Object.entries(JSON.parse(d.ruas))) { const R = this.farm.regionById.get(reg); const s = new Set(expandRanges(rg)); R?.rows.forEach((r) => s.has(r.idx) && ids.push(r.id)); } this.selecionar(ids); this.go('mapa'); this.openDrawer({ tipo: 'selecao' }); },
    rua(d) { this.focarRua(d.id); },
    planta(d) { this.focarPlanta(d.row, +d.j); },
    ativo(d) { this.focarAtivo(d.id); },
    equip(d) { this.focarEquip(d.id); },
    manut(d) { this.focarManut(d.id); },
    tab(d) { this.drawerTab = d.t; this.renderDrawer(); },
    fecharDrawer() { this.closeDrawer(); },
    novaOS(d) { this.forms.os({ ruas: d.ruas ? JSON.parse(d.ruas) : this.selRuasObj(), tarefa: d.tarefa, ativo: d.ativo, data: d.data || undefined, insumos: d.insumos ? JSON.parse(d.insumos) : [] }); },
    setModeIrr() { this.go('mapa'); this.setMode('irrigacao'); },
    abrirOS(d) { const o = this.model.osList().find((x) => x.id === d.id); if (o) this.forms.os(o); },
    novaManut(d) { this.forms.manut({ ativo: d.ativo, rua: d.rua, metro: d.metro != null ? +d.metro : undefined, x: d.x != null ? +d.x : undefined, y: d.y != null ? +d.y : undefined }); },
    abrirManut(d) { const o = this.store.get('manut', d.id); if (o) this.forms.manut(o); },
    novaContagem(d) { this.forms.contagem({ reg: d.reg }); },
    abrirContagem(d) { const o = this.store.get('contagens', d.id); if (o) this.forms.contagem(o); },
    novaCarga(d) { this.forms.carga({ ruas: d.ruas ? JSON.parse(d.ruas) : this.selRuasObj() }); },
    abrirCarga(d) { const o = this.store.get('colheita', d.id); if (o) this.forms.carga(o); },
    novoLote() { this.forms.lote({}); },
    abrirLote(d) { const o = this.store.get('lotes', d.id); if (o) this.forms.lote(o); },
    novoSolo(d) { this.forms.solo({ reg: d.reg }); },
    abrirSolo(d) { const o = this.store.get('solo', d.id); if (o) this.forms.solo(o); },
    novoEquip() { this.forms.equip({}); },
    abrirEquip(d) { const o = this.store.get('equip', d.id); if (o) this.forms.equip(o); },
    statusAtivo(d) { this.forms.statusAtivo(d.id); },
    relatorio(d) { this.forms.relatorio(d.id); },
    fecharModal() { this.closeModal(); },
    seguirEquip(d) { if (this.seguir === d.id) this.pararSeguir(); else this.acompanhar(d.id); },
    acompanhar(d) { this.acompanhar(d.id); },
    camModo(d) { this.camModo = d.m; this.renderHud(); },
    pararSeguir() { this.pararSeguir(); },
    importarTrilha(d) { this.forms.importarTrilha(d.id); },
    simPlay() { this.sim.rodando = !this.sim.rodando; this.renderHud(); },
    simVel(d) { this.sim.escala = +d.v; this.renderHud(); if (this.view !== 'mapa') this.renderView(); },
    plantaStatus(d) { this.setPlantaStatus(d.row, +d.j, d.st); },
    planoLancar(d) { this.forms.os({ ruas: this.selRuasObj(), tarefa: d.tarefa }); },
    pularPlanta(d) { const r = this.farm.rowById.get(d.row); const j = Math.max(0, Math.min(r.nPl - 1, +d.j)); this.focarPlanta(d.row, j, false); },
    copiar(d) { navigator.clipboard?.writeText(d.txt).then(() => this.toast('Copiado.'), () => this.toast(d.txt)); },
    viewAct(d, el, e) { const v = VIEWS[this.view]; v?.act?.(this, d, el, e); },
  };
  chg = {
    viewChg(t, e) { const v = VIEWS[this.view]; v?.chg?.(this, t, e); },
    buscaPlanta(t) { const [row] = this.sel; const r = this.farm.rowById.get(row); const j = Math.max(1, Math.min(r.nPl, +t.value)) - 1; this.focarPlanta(row, j); },
  };

  // ------------------------------------------------------------------ navegação
  go(v, push = true) {
    this.view = v;
    if (push) { try { history.replaceState(null, '', v === 'mapa' ? location.pathname + location.search : '#' + v); } catch { /* ignore */ } }
    document.querySelectorAll('.nav-b').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    const viewEl = this.$('#view');
    this.scene.labelRenderer.domElement.style.visibility = v === 'mapa' ? '' : 'hidden';
    if (v === 'mapa') { viewEl.hidden = true; this.scene.paused = false; this.scene.dirty = true; this.scene.resize(); }
    else { viewEl.hidden = false; this.renderView(); this.scene.paused = true; }
  }
  setMode(m) {
    this.mode = m;
    document.querySelectorAll('.mode-b').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    this.scene.setMode(m);
    this.sim.setup(m);
    this.colorir();
    this.renderHud();
    if (this.drawer) this.renderDrawer();
    if (this.view !== 'mapa') this.renderView();
  }

  refreshAll() {
    const cfg = this.farmConfig();
    this.$('#farmName').textContent = cfg.nome;
    this.$('#farmSub').textContent = `${num(this.farm.totais.areaHa, 1)} ha · ${this.farm.regions.length} regiões · ${num(this.farm.totais.ruas)} ruas`;
    document.querySelectorAll('.mode-b').forEach((b) => b.classList.toggle('on', b.dataset.m === this.mode));
    this.colorir();
    this.scene.setAssetStatus((id) => this.model.assetStatus(id));
    this.updateMarkers();
    this.renderHud();
    this.renderSync();
    if (this.view !== 'mapa') this.renderView();
    if (this.drawer && !this.$('#drawer').contains(document.activeElement)) this.renderDrawer();
  }
  onStore(e) {
    this.model.cache = {};
    const col = e?.detail?.col;
    if (col === 'config' || col === '*') {
      const sig = JSON.stringify(this.store.config().fazenda || {}) + this.store.demoOn();
      if (sig !== this._cfgSig) { this._cfgSig = sig; this.rebuildFarm(); return; }
    }
    if (col === 'equip') this.sim.setup(this.mode);
    if (col === 'os' && this.mode !== 'colheita') this.sim.setup(this.mode);
    if (col === 'plantas' && this.sel.length) this.scene.setSelection(this.sel, { plantaSel: this.plantaSel });
    this.refreshAll();
  }
  renderSync() {
    const s = this.$('#sync');
    const m = this.store.mode;
    const txt = m === 'compartilhado' ? 'Compartilhado' : m === 'conectando' ? 'Conectando…' : 'Neste aparelho';
    s.className = 'sync ' + (m === 'compartilhado' ? 'ok' : m === 'conectando' ? 'wait' : 'loc');
    s.textContent = txt;
    s.title = m === 'compartilhado' ? 'Os dados ficam no banco do artifact e aparecem para todos com acesso.' : m === 'conectando' ? 'Conectando ao banco compartilhado.' : 'Os dados ficam salvos só neste navegador. Faça backup em Ajustes.';
    if (this.store.erro) { s.className = 'sync bad'; s.title = this.store.erro; }
  }

  renderView() {
    const v = VIEWS[this.view];
    const el = this.$('#view');
    if (!v) return;
    const st = el.scrollTop;
    try { el.innerHTML = `<div class="view-in">${v.render(this)}</div>`; }
    catch (err) { console.error(err); el.innerHTML = `<div class="view-in"><p class="erro">Não consegui montar esta tela: ${esc(err.message)}</p></div>`; }
    el.scrollTop = st;
    v.after?.(this, el);
  }

  // ------------------------------------------------------------------ mapa: cores
  colorir() {
    const m = this.model, cm = this.cor[this.mode];
    const farm = this.farm;
    let fn;
    const safraCol = this.safraColheita || m.safra;
    switch (cm) {
      case 'plano': fn = (r) => { const s = m.rowPlanSummary(r); return s.atrasadas ? '#ff4f3a' : s.agora ? '#f2b630' : '#4fa65e'; }; break;
      case 'hoje': {
        const mp = new Map();
        m.osDoDia().forEach((o, i) => m.rowsOf(o).forEach((r) => mp.set(r.id, corCat(hash(o.tarefa) % 12))));
        fn = (r) => mp.get(r.id) || '#8b9488';
        break;
      }
      case 'ultima': fn = (r) => { const l = (m.rowIndex().get(r.id) || []).filter((x) => x.status === 'concluida' && x.tarefa !== 'IR01' && x.tarefa !== 'AD02' && x.tarefa !== 'MN01').map((x) => x.data).sort(); const u = l[l.length - 1]; if (!u) return '#d2452f'; const d = (new Date(m.hoje) - new Date(u)) / 864e5; return ramp(d / 45, RAMPA_RISCO); }; break;
      case 'falhas': fn = (r) => ramp(m.rowFalhasPct(r) / 5, RAMPA_RISCO); break;
      case 'fito': fn = (r) => { const f = m.fitoAtual(r.reg); if (!f) return '#8b9488'; const mx = Math.max(0, ...PRAGAS.map((p) => (f.vals[p.k] ?? 0) / p.nc)); return ramp(mx, RAMPA_RISCO); }; break;
      case 'variedade': { const vs = [...new Set(farm.regions.map((r) => r.variedade))]; fn = (r) => corCat(vs.indexOf(farm.regionById.get(r.reg).variedade)); break; }
      case 'idade': fn = (r) => ramp(farm.regionById.get(r.reg).idade / 8, RAMPA_PROD); break;
      case 'regiao': fn = (r) => farm.regionById.get(r.reg).cor; break;
      case 'setor': { const ss = farm.regions.flatMap((r) => r.setores.map((s) => s.id)); fn = (r) => corCat(ss.indexOf(r.setor) + 2); break; }
      case 'irrigando': { const ss = farm.regions.flatMap((r) => r.setores); const on = new Set(ss.filter((s, i) => setorIrrigando(i, ss.length)).map((s) => s.id)); fn = (r) => on.has(r.setor) ? '#1f8fd6' : '#a9b0a6'; break; }
      case 'cud': fn = (r) => { const c = m.cudSetor(r.setor); return c ? ramp((c.val - 70) / 25, [[0, '#d2452f'], [0.5, '#e0a526'], [1, '#1f8fd6']]) : '#a9b0a6'; }; break;
      case 'previsao': fn = (r) => { const v = m.rowPrevisao(r); return v == null ? '#b9b2a2' : ramp(v / 65, RAMPA_PROD); }; break;
      case 'producao': { const S = m.safrasColhidas().find((s) => m.cargas(s).length) || m.safra - 1; this._safraProd = S; fn = (r) => { const v = m.rowScHa(r, S); return v == null ? '#b9b2a2' : ramp(v / 65, RAMPA_PROD); }; break; }
      case 'colhidas': { const { litros } = m.litrosPorRua(m.safra); const sim = new Set(this.sim.machines.filter((x) => x.tipo === 'colhedora').flatMap((x) => (x.path || []).slice(0, x.seg + 1).map((p) => p.rua).filter(Boolean))); fn = (r) => litros.has(r.id) ? '#5f9a48' : sim.has(r.id) ? '#9cc37a' : '#c8bfa8'; break; }
      case 'maturacao': { const S = m.safrasColhidas().find((s) => m.cargas(s).length) || m.safra - 1; const { mat } = m.litrosPorRua(S); fn = (r) => { const x = mat.get(r.id); return x ? ramp(x.verde / 30, [[0, '#b23a2b'], [0.5, '#d98f3a'], [1, '#6f9a54']]) : '#b9b2a2'; }; break; }
      default: fn = () => '#3f7a46';
    }
    this.scene.setRowColors(fn);
  }

  legendHTML() {
    const cm = this.cor[this.mode];
    const it = (c, t) => `<span class="lg"><i style="background:${c}"></i>${esc(t)}</span>`;
    const grad = (stops, a, b) => `<span class="lg-grad"><i style="background:linear-gradient(90deg,${stops.map(([t, c]) => `${c} ${t * 100}%`).join(',')})"></i><small>${esc(a)}</small><small>${esc(b)}</small></span>`;
    switch (cm) {
      case 'plano': return it('#ff4f3a', 'Com atraso') + it('#f2b630', 'Operação na janela') + it('#4fa65e', 'Em dia');
      case 'hoje': return this.model.osDoDia().map((o) => it(corCat(hash(o.tarefa) % 12), TAREFA[o.tarefa]?.nome || o.tarefa)).join('') || '<small>Nenhuma operação lançada para o dia.</small>';
      case 'ultima': return grad(RAMPA_RISCO, '0 dia', '45+ dias');
      case 'falhas': return grad(RAMPA_RISCO, '0%', '5%+ de falhas');
      case 'fito': return grad(RAMPA_RISCO, 'Sem pressão', 'No nível de controle');
      case 'variedade': return [...new Set(this.farm.regions.map((r) => r.variedade))].map((v, i) => it(corCat(i), v)).join('');
      case 'idade': return grad(RAMPA_PROD, 'Recém-plantada', '8+ anos');
      case 'regiao': return this.farm.regions.map((r) => it(r.cor, r.nome)).join('');
      case 'setor': return '<small>Cada cor é um setor de irrigação (válvula).</small>';
      case 'irrigando': return it('#1f8fd6', 'Setor irrigando agora') + it('#a9b0a6', 'Fechado') + '<small> Rodízio noturno simulado (21h30–5h30).</small>';
      case 'cud': return grad([[0, '#d2452f'], [0.5, '#e0a526'], [1, '#1f8fd6']], 'CUD 70%', '95%');
      case 'previsao': return grad(RAMPA_PROD, '0', '65 sc/ha') + `<small>Última contagem de cada região, ajustada pelo histórico da rua.</small>`;
      case 'producao': return grad(RAMPA_PROD, '0', '65 sc/ha') + `<small>Safra ${this._safraProd || ''}</small>`;
      case 'colhidas': return it('#5f9a48', 'Colhida (registrada)') + it('#9cc37a', 'Colhida pela máquina (GPS)') + it('#c8bfa8', 'A colher');
      case 'maturacao': return grad([[0, '#b23a2b'], [0.5, '#d98f3a'], [1, '#6f9a54']], '0% verde', '30%+ verde');
    }
    return '';
  }

  renderHud() {
    const cm = this.cor[this.mode];
    const L = this.scene.layers;
    this.$('#legend').innerHTML = `<div class="lg-head"><select aria-label="Colorir ruas por">${CORES[this.mode].map(([k, n]) => `<option value="${k}" ${k === cm ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div><div class="lg-items">${this.legendHTML()}</div>`;
    this.$('#tools').innerHTML = `
      <button class="tb ${this.multi ? 'on' : ''}" data-act="multi" title="Seleção múltipla">${ic('check')}<span>Várias ruas</span></button>
      <button class="tb" data-act="verTudo" title="Ver a fazenda inteira">${ic('alvo')}<span>Ver tudo</span></button>
      <span class="tb-sep"></span>
      ${[['rotulos', 'Rótulos'], ['ativos', 'Ativos'], ['equipamentos', 'Máquinas'], ['manutencao', 'Manutenção'], ['irrigacao', 'Rede'], ['cruzetas', 'Cruzetas']].map(([k, n]) => `<button class="tb tb-l ${L[k] ? 'on' : ''}" data-act="layer" data-l="${k}">${esc(n)}</button>`).join('')}`;
    const s = this.sim;
    const ativos = s.machines.filter((x) => x.estado !== 'parado').length;
    this.$('#hudSim').innerHTML = `<div class="sim-h">${ic('gps')}<b>GPS</b><span class="muted">${ativos} em operação · ${esc(s.machines.some((m) => m.fonte === 'Tempo real') ? 'tempo real' : 'simulação')}</span></div>
      <div class="sim-c"><button class="tb" data-act="simPlay" aria-label="${s.rodando ? 'Pausar' : 'Continuar'}">${ic(s.rodando ? 'pause' : 'play')}</button>${[1, 10, 30, 120].map((v) => `<button class="tb ${s.escala === v ? 'on' : ''}" data-act="simVel" data-v="${v}">${v}×</button>`).join('')}</div>`;
    const trabalhando = s.machines.filter((x) => x.estado !== 'parado');
    this.$('#hudSim').innerHTML += trabalhando.length ? `<div class="sim-l">${trabalhando.map((x) => `<button class="sim-m ${this.seguir === x.id ? 'on' : ''}" data-act="acompanhar" data-id="${x.id}" title="Acompanhar em 3D"><i style="background:${TIPOS_EQUIP[x.tipo]?.cor}"></i>${esc(x.nome)}</button>`).join('')}</div>` : '';
    const hf = this.$('#hudFollow');
    const mf = this.seguir ? s.machines.find((x) => x.id === this.seguir) : null;
    if (mf) {
      hf.hidden = false;
      hf.innerHTML = `<div class="fl-h"><span class="fl-dot" style="background:${TIPOS_EQUIP[mf.tipo]?.cor}"></span><b>${esc(mf.nome)}</b><button class="tb" data-act="pararSeguir">${ic('fechar')}<span>Parar</span></button></div>
        <div class="fl-l" id="flLive"></div>
        <div class="fl-c">${[['atras', 'Atrás'], ['lateral', 'Lateral'], ['cima', 'De cima'], ['livre', 'Livre']].map(([k, n]) => `<button class="tb ${this.camModo === k ? 'on' : ''}" data-act="camModo" data-m="${k}">${n}</button>`).join('')}</div>`;
      this.liveFollow(s.machines);
    } else { hf.hidden = true; hf.innerHTML = ''; }
    const sel = this.sel;
    const regs = this.farm.regions.map((r) => `<button class="mini" data-act="selRegiao" data-r="${r.id}" style="--c:${r.cor}">${esc(r.id)}</button>`).join('');
    this.$('#hudSel').innerHTML = sel.length
      ? `<div class="sel-h"><b>${sel.length === 1 ? esc(sel[0]) : `${sel.length} ruas`}</b><button class="tb" data-act="limparSel">${ic('fechar')}<span>Limpar</span></button></div>`
      : `<div class="sel-h"><span class="muted">Toque numa rua ou escolha a região</span></div><div class="mini-row">${regs}</div>`;
    const selEl = this.$('#legend select');
    if (selEl) selEl.onchange = () => { this.cor[this.mode] = selEl.value; this.colorir(); this.renderHud(); };
  }

  liveFollow(ms) {
    const el = document.getElementById('flLive');
    const mc = ms.find((x) => x.id === this.seguir);
    if (!el || !mc) return;
    const pr = this.sim.progresso(mc);
    el.innerHTML = `${mc.tarefa ? esc(TAREFA[mc.tarefa]?.nome || mc.tarefa) + ' · ' : ''}${mc.rua ? `rua <b class="mono">${esc(mc.rua)}</b>` : 'manobra / deslocamento'} · <b>${num(mc.vel, 1)}</b> km/h${pr ? ` · ${pr.feitas}/${pr.total} ruas` : ''}`;
  }

  updateMarkers() {
    const items = this.model.manutAbertas().map((mt) => {
      if (mt.ativo) { const a = this.farm.assetById.get(mt.ativo); if (a) return { ...mt, x: a.x, y: a.y }; }
      return mt;
    }).filter((x) => x.x != null);
    this.scene.updateMarkers(items);
  }

  // ------------------------------------------------------------------ seleção
  selRuasObj() {
    const o = {};
    for (const id of this.sel) { const r = this.farm.rowById.get(id); if (!r) continue; (o[r.reg] = o[r.reg] || []).push(r.idx); }
    for (const k of Object.keys(o)) o[k] = compressRanges(o[k]);
    return o;
  }
  selecionar(ids, plantaSel = null) {
    this.sel = ids;
    this.plantaSel = plantaSel;
    this.scene.setSelection(ids, { plantaSel });
    this.renderHud();
  }

  onPick(hit, e) {
    if (!hit) { if (!this.multi) { this.selecionar([]); this.closeDrawer(); } return; }
    if (hit.tipo === 'rua') {
      if (this.multi || e?.shiftKey || e?.ctrlKey || e?.metaKey) {
        const s = new Set(this.sel);
        if (s.has(hit.id)) s.delete(hit.id); else s.add(hit.id);
        if (e?.shiftKey && this.sel.length) {
          const a = this.farm.rowById.get(this.sel[this.sel.length - 1]), b = this.farm.rowById.get(hit.id);
          if (a && b && a.reg === b.reg) { const reg = this.farm.regionById.get(a.reg); for (let i = Math.min(a.idx, b.idx); i <= Math.max(a.idx, b.idx); i++) s.add(reg.rows[i - 1].id); }
        }
        this.selecionar([...s]);
        this.openDrawer(this.sel.length === 1 ? { tipo: 'rua', id: this.sel[0] } : { tipo: 'selecao' });
      } else {
        this.selecionar([hit.id]);
        this.drawerTab = this.drawer?.tipo === 'rua' ? this.drawerTab : 'resumo';
        this.openDrawer({ tipo: 'rua', id: hit.id });
      }
    } else if (hit.tipo === 'planta') this.focarPlanta(hit.row, hit.j, false);
    else if (hit.tipo === 'ativo') this.openDrawer({ tipo: 'ativo', id: hit.id });
    else if (hit.tipo === 'equip') this.openDrawer({ tipo: 'equip', id: hit.id });
    else if (hit.tipo === 'manut') this.openDrawer({ tipo: 'manut', id: hit.id });
    else if (hit.tipo === 'tubo') this.openDrawer({ tipo: 'tubo', id: hit.id });
  }
  onHover(hit, e) {
    const tip = this.$('#tip');
    if (!hit || hit.tipo !== 'rua') { tip.hidden = true; this.scene.setHover(null); return; }
    const r = this.farm.rowById.get(hit.id);
    this.scene.setHover(r);
    const s = this.model.rowPlanSummary(r);
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(r.id)}</b> · ${num(r.len, 0)} m · ${num(r.nPl)} plantas<br><span class="muted">${esc(r.setor)}${s.atrasadas ? ` · ${s.atrasadas} atrasada(s)` : ''}</span>`;
    const rect = this.$('#stage').getBoundingClientRect();
    tip.style.left = Math.min(rect.width - 220, e.clientX - rect.left + 14) + 'px';
    tip.style.top = (e.clientY - rect.top + 14) + 'px';
  }

  focarRua(id, voar = true) {
    const r = this.farm.rowById.get(id);
    if (!r) return this.toast(`Rua ${id} não encontrada.`);
    this.go('mapa');
    this.selecionar([id]);
    if (voar) this.scene.flyToRow(r);
    this.drawerTab = 'resumo';
    this.openDrawer({ tipo: 'rua', id });
  }
  focarPlanta(rowId, j, voar = true) {
    const r = this.farm.rowById.get(rowId);
    if (!r) return;
    const reg = this.farm.regionById.get(r.reg);
    this.go('mapa');
    const ids = this.sel.includes(rowId) && this.sel.length <= 6 ? this.sel : [rowId];
    this.selecionar(ids, { row: rowId, j });
    if (voar) { const [x, y] = plantPos(r, reg, j); this.scene.flyToXY(x, y, 15, true, 0.15); }
    this.openDrawer({ tipo: 'planta', row: rowId, j });
  }
  focarAtivo(id) {
    const a = this.farm.assetById.get(id);
    if (!a) return this.toast(`Ativo ${id} não encontrado.`);
    this.go('mapa');
    if (a.tipo === 'cruzeta' && !this.scene.layers.cruzetas) this.scene.setLayer('cruzetas', true);
    if (!this.scene.layers.ativos) this.scene.setLayer('ativos', true);
    this.scene.flyToXY(a.x, a.y, a.tipo === 'reservatorio' || a.tipo === 'acude' ? 220 : 40, true, 0.6);
    if (a.rua) this.selecionar([a.rua]);
    this.openDrawer({ tipo: 'ativo', id });
    this.renderHud();
  }
  focarEquip(id) {
    const mc = this.sim.machines.find((x) => x.id === id);
    this.go('mapa');
    if (mc) this.scene.flyToXY(mc.x, mc.y, 80, true, 0.6);
    this.openDrawer({ tipo: 'equip', id });
  }
  acompanhar(id) {
    const mc = this.sim.machines.find((x) => x.id === id);
    if (!mc) return this.toast('Máquina não encontrada.');
    this.go('mapa');
    this.seguir = id;
    if (this.sim.escala > 5) this.sim.escala = 5;
    if (!this.scene.layers.equipamentos) this.scene.setLayer('equipamentos', true);
    this.scene.stopFollow();
    this.scene.flyToXY(mc.x, mc.y, 45, true, 0.6);
    if (window.innerWidth > 760) this.openDrawer({ tipo: 'equip', id }); else this.closeDrawer();
    this.renderHud();
    this.toast(`Acompanhando ${mc.nome}. Velocidade da simulação: ${this.sim.escala}×.`);
  }
  pararSeguir() {
    this.seguir = null;
    this.scene.stopFollow();
    this.renderHud();
    if (this.drawer?.tipo === 'equip') this.renderDrawer();
  }
  focarManut(id) {
    const mt = this.store.get('manut', id);
    if (!mt) return;
    const a = mt.ativo ? this.farm.assetById.get(mt.ativo) : null;
    const x = a ? a.x : mt.x, y = a ? a.y : mt.y;
    this.go('mapa');
    if (x != null) this.scene.flyToXY(x, y, 45, true, 0.6);
    if (mt.rua) this.selecionar([mt.rua]);
    this.openDrawer({ tipo: 'manut', id });
  }

  // ------------------------------------------------------------------ busca
  buscar(q) {
    const box = this.$('#qres');
    q = q.trim().toUpperCase();
    if (!q) { box.hidden = true; return; }
    const res = [];
    const farm = this.farm;
    let m = q.match(/^R?(\d)[\s\-_]*L?(\d{1,3})(?:[\s\-_]*P?(\d{1,4}))?$/);
    if (m) {
      const id = `R${m[1]}-L${m[2].padStart(3, '0')}`;
      const r = farm.rowById.get(id);
      if (r) {
        if (m[3]) { const j = Math.min(r.nPl, Math.max(1, +m[3])) - 1; res.push({ act: 'planta', row: id, j, t: `Planta ${id}-P${String(j + 1).padStart(4, '0')}`, s: `${r.setor}` }); }
        res.push({ act: 'rua', id, t: `Rua ${id}`, s: `${num(r.len, 0)} m · ${num(r.nPl)} plantas · ${r.setor}` });
      }
    }
    const exato = farm.assetById.get(q);
    if (exato) res.push({ act: 'ativo', id: exato.id, t: exato.id, s: exato.nome });
    for (const a of farm.assets) {
      if (res.length > 12) break;
      if (a !== exato && (a.id.toUpperCase().includes(q) || a.nome.toUpperCase().includes(q))) res.push({ act: 'ativo', id: a.id, t: a.id, s: a.nome });
    }
    for (const e of this.model.equipList()) if (e.id.toUpperCase().includes(q) || e.nome.toUpperCase().includes(q)) res.push({ act: 'equip', id: e.id, t: e.id, s: e.nome });
    for (const r of farm.regions) if (r.id === q || r.nome.toUpperCase().includes(q)) res.push({ act: 'selRegiao', r: r.id, t: r.nome, s: `${num(r.areaHa, 1)} ha · ${r.nRows} ruas` });
    box.innerHTML = res.length ? res.slice(0, 14).map((x) => `<button data-act="${x.act}" ${x.id ? `data-id="${esc(x.id)}"` : ''} ${x.row ? `data-row="${esc(x.row)}" data-j="${x.j}"` : ''} ${x.r ? `data-r="${x.r}"` : ''}><b>${esc(x.t)}</b><small>${esc(x.s)}</small></button>`).join('') : `<p class="muted">Nada encontrado. Exemplos: R2-L047, R2 47 312, CZ-R1-L088, B-01, VS-R3-S2.</p>`;
    box.hidden = false;
    box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { box.hidden = true; this.$('#q').value = ''; }));
  }

  // ------------------------------------------------------------------ gaveta
  openDrawer(d) {
    this.drawer = d;
    if (d.tipo !== 'rua') this.drawerTab = d.tipo === 'planta' ? 'resumo' : this.drawerTab;
    this.renderDrawer();
  }
  closeDrawer() { this.drawer = null; this.$('#drawer').hidden = true; this.$('#stage').classList.remove('has-drawer'); }
  renderDrawer() {
    const d = this.drawer;
    const el = this.$('#drawer');
    if (!d) { el.hidden = true; return; }
    let html = '';
    try {
      if (d.tipo === 'rua') html = this.drRua(d.id);
      else if (d.tipo === 'selecao') html = this.drSelecao();
      else if (d.tipo === 'planta') html = this.drPlanta(d.row, d.j);
      else if (d.tipo === 'ativo') html = this.drAtivo(d.id);
      else if (d.tipo === 'equip') html = this.drEquip(d.id);
      else if (d.tipo === 'manut') html = this.drManut(d.id);
      else if (d.tipo === 'tubo') html = this.drTubo(d.id);
    } catch (e) { console.error(e); html = `<p class="erro">${esc(e.message)}</p>`; }
    el.innerHTML = `<button class="dr-x" data-act="fecharDrawer" aria-label="Fechar">${ic('fechar')}</button>${html}`;
    el.hidden = false;
    this.$('#stage').classList.add('has-drawer');
  }

  kv(pairs) {
    return `<dl class="kv">${pairs.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }
  tabs(list) {
    return `<div class="tabs" role="tablist">${list.map(([k, n]) => `<button role="tab" class="${this.drawerTab === k ? 'on' : ''}" data-act="tab" data-t="${k}">${esc(n)}</button>`).join('')}</div>`;
  }

  drRua(id) {
    const m = this.model, r = this.farm.rowById.get(id);
    if (!r) return '<p>Rua não encontrada.</p>';
    const reg = this.farm.regionById.get(r.reg);
    const st = estagio(reg, m.safra);
    const ruasJ = esc(JSON.stringify({ [r.reg]: String(r.idx) }));
    const sum0 = m.rowPlanSummary(r);
    const head = `<div class="dr-h"><div class="dr-eyebrow" style="--c:${reg.cor}">${esc(reg.nome)} · ${esc(r.setor)}</div><h2 class="mono">${esc(r.id)}</h2>
      <div class="chips">${chip(reg.variedade)}${chip(`Plantio ${reg.plantio}`)}${chip(st === 'P' ? 'Produção' : 'Formação', st === 'P' ? 'st-ok' : 'st-fut')}${sum0.atrasadas ? chip(`${sum0.atrasadas} atrasada(s)`, 'st-bad') : ''}${sum0.agora ? chip(`${sum0.agora} na janela`, 'st-warn') : ''}</div>
      <div class="dr-actions"><button class="btn pri" data-act="novaOS" data-ruas="${ruasJ}">${ic('mais')} Lançar trabalho</button><button class="btn" data-act="planta" data-row="${r.id}" data-j="0">${ic('planta')} Pé a pé</button></div></div>`;
    const t = this.drawerTab;
    let body = '';
    const tabs = this.tabs([['resumo', 'Resumo'], ['plano', 'Plano do ciclo'], ['hist', 'Histórico'], ['pe', 'Pé a pé'], ['irrig', 'Irrigação'], ['colheita', 'Colheita']]);
    if (t === 'resumo') {
      const pl = m.plantas(r);
      const fal = (pl.falhas?.length || 0) + (pl.morta?.length || 0);
      const hist = m.rowHistory(r.id).filter((o) => o.status === 'concluida' && !['IR01', 'AD02', 'MN01'].includes(o.tarefa));
      const prev = m.rowPrevisao(r);
      const ant = m.rowScHa(r, m.safra - 1);
      body = this.kv([
        ['Comprimento', `${num(r.len, 1)} m`], ['Área', `${num(r.areaHa, 3)} ha`], ['Espaçamento', `${reg.espLinha} × ${reg.espPlanta} m`],
        ['Covas', num(r.nPl)], ['Falhas', `${fal} (${pct((fal / r.nPl) * 100, 2)})`], ['Replantadas', num(pl.replantadas?.length || 0)],
        ['Início da rua', `<span class="mono">${geo.fmt(r.x1, r.y1)}</span>`], ['Fim da rua', `<span class="mono">${geo.fmt(r.x2, r.y2)}</span>`],
        ['Última operação', hist[0] ? `${esc(TAREFA[hist[0].tarefa]?.nome)} · ${fmtDate(hist[0].data)}` : '—'],
        ['Previsão da safra', prev != null ? `${num(prev, 1)} sc/ha · ${num(prev * r.areaHa, 2)} sc` : '—'],
        ['Colheita anterior', ant != null ? `${num(ant, 1)} sc/ha` : '—'],
        ['Análise de solo', m.soloAtual(r.reg) ? `${fmtDate(m.soloAtual(r.reg).data)} (região)` : '—'],
      ]);
    } else if (t === 'plano') {
      const p = m.rowPlan(r);
      body = `<p class="muted small">Ciclo ${m.safra - 1}/${m.safra}: do pós-colheita de ${m.safra - 1} à colheita de ${m.safra}. Toque em Lançar para registrar a operação nesta rua.</p><ul class="plan">${p.map((o) => `<li class="${STCLS[o.st]}"><span class="pl-dot"></span><div><b>${esc(o.nome)}</b><small>${fmtDateShort(o.ini)} a ${fmtDateShort(o.fim)}${o.recorrente ? ` · a cada ${o.recorrente} dias` : ''}${o.ult ? ` · última: ${fmtDate(o.ult)}` : ''}</small></div>${chip(STNOME[o.st], STCLS[o.st])}${o.st !== 'feita' && o.st !== 'futura' ? `<button class="mini" data-act="planoLancar" data-tarefa="${o.tarefa}">Lançar</button>` : ''}</li>`).join('')}</ul>`;
    } else if (t === 'hist') {
      const h = m.rowHistory(r.id);
      body = h.length ? `<ul class="list">${h.slice(0, 80).map((o) => `<li><button data-act="abrirOS" data-id="${o.id}"><span>${fmtDate(o.data)}</span><b>${esc(TAREFA[o.tarefa]?.nome || o.tarefa)}</b>${chip(STATUS_OS[o.status]?.nome || o.status, STATUS_OS[o.status]?.cls)}</button></li>`).join('')}</ul>` : '<p class="muted">Nenhum trabalho registrado nesta rua.</p>';
    } else if (t === 'pe') body = this.peAPe(r);
    else if (t === 'irrig') {
      const stObj = reg.setores.find((s) => s.id === r.setor);
      const vs = stObj ? this.farm.assetById.get(stObj.valvula) : null;
      const rl = this.farm.assetById.get(`RL-${r.setor}`);
      const ss = this.farm.regions.flatMap((x) => x.setores);
      const on = setorIrrigando(ss.indexOf(stObj), ss.length);
      const mm = taxaMmH(reg);
      body = this.kv([
        ['Setor', `${esc(r.setor)} ${on ? chip('Irrigando agora', 'st-info') : chip('Fechado', 'st-cancel')}`],
        ['Válvula', vs ? `<button class="link" data-act="ativo" data-id="${vs.id}">${vs.id}</button> ${chip(STATUS_ATIVO[m.assetStatus(vs.id)].nome, STATUS_ATIVO[m.assetStatus(vs.id)].cls)}` : '—'],
        ['Relé de sinal', rl ? `<button class="link" data-act="ativo" data-id="${rl.id}">${rl.id}</button> ${chip(STATUS_ATIVO[m.assetStatus(rl.id)].nome, STATUS_ATIVO[m.assetStatus(rl.id)].cls)}` : '—'],
        ['Conexão na derivação', `<button class="link" data-act="ativo" data-id="${r.cz}">${r.cz}</button> (${r.czTipo})`],
        ['Coordenada da conexão', `<span class="mono">${geo.fmt(r.cx, r.cy)}</span>`],
        ['Lateral A (até o início)', `${num(r.lat1, 1)} m`], ['Lateral B (até o fim)', `${num(r.lat2, 1)} m`],
        ['Gotejadores', `${num(r.nGot)} a cada ${reg.gotEsp} m · ${reg.gotVazao} L/h`],
        ['Vazão da rua', `${num((r.nGot * reg.gotVazao), 0)} L/h`], ['Taxa de aplicação', `${num(mm, 2)} mm/h`],
      ]) + `<div class="dr-actions"><button class="btn" data-act="novaManut" data-rua="${r.id}" data-metro="${Math.round(r.len / 2)}">${ic('manut')} Registrar problema na linha</button><button class="btn" data-act="novaOS" data-ruas="${ruasJ}" data-tarefa="IR06">Lançar reparo</button></div>`;
    } else if (t === 'colheita') {
      const safras = m.safrasColhidas();
      const prev = m.rowPrevisao(r);
      body = this.kv([['Previsão ' + m.safra, prev != null ? `${num(prev, 1)} sc/ha (${num(prev * r.areaHa, 2)} sc)` : 'Sem contagem na região']]) +
        `<table class="tbl sm"><thead><tr><th>Safra</th><th>Litros</th><th>Sacas</th><th>sc/ha</th><th>% verde</th></tr></thead><tbody>${safras.map((s) => { const L = m.litrosPorRua(s).litros.get(r.id); const mt = m.litrosPorRua(s).mat.get(r.id); return L ? `<tr><td>${s}</td><td>${num(L)}</td><td>${num(L / m.params().rendimento, 2)}</td><td>${num(L / m.params().rendimento / r.areaHa, 1)}</td><td>${mt ? mt.verde + '%' : '—'}</td></tr>` : ''; }).join('') || '<tr><td colspan="5" class="muted">Sem colheita registrada.</td></tr>'}</tbody></table>
        <div class="dr-actions"><button class="btn" data-act="novaCarga" data-ruas="${ruasJ}">${ic('colheita')} Registrar carga desta rua</button></div>`;
    }
    return head + tabs + `<div class="dr-b">${body}</div>`;
  }

  peAPe(r) {
    const m = this.model, pl = m.plantas(r);
    const cells = [];
    for (let j = 0; j < r.nPl; j++) {
      const st = m.plantStatus(pl, j);
      cells.push(`<i class="pc pc-${st}${this.plantaSel && this.plantaSel.row === r.id && this.plantaSel.j === j ? ' sel' : ''}" data-act="planta" data-row="${r.id}" data-j="${j}" title="P${j + 1}"></i>`);
    }
    return `<p class="muted small">Cada quadrado é uma cova, do início (P1) ao fim (P${r.nPl}) da rua. Toque para abrir a planta.</p>
      <label class="fld inline"><span>Ir para a planta nº</span><input type="number" min="1" max="${r.nPl}" data-chg="buscaPlanta" inputmode="numeric"></label>
      <div class="pe-legend">${Object.entries(STATUS_PLANTA).map(([k, v]) => `<span class="lg"><i class="pc pc-${k}"></i>${esc(v.nome)}</span>`).join('')}</div>
      <div class="pe-grid">${cells.join('')}</div>`;
  }

  drSelecao() {
    const m = this.model;
    const rows = this.sel.map((id) => this.farm.rowById.get(id)).filter(Boolean);
    const area = sum(rows, (r) => r.areaHa), pls = sum(rows, (r) => r.nPl), len = sum(rows, (r) => r.len);
    const obj = this.selRuasObj();
    const ruasJ = esc(JSON.stringify(obj));
    const pend = new Map();
    for (const r of rows) for (const o of m.rowPlan(r)) if (o.st === 'atrasada' || o.st === 'agora') { const k = o.key; pend.set(k, { ...o, n: (pend.get(k)?.n || 0) + 1 }); }
    return `<div class="dr-h"><div class="dr-eyebrow">Seleção</div><h2>${rows.length} ruas</h2>
      <div class="chips">${Object.entries(obj).map(([k, v]) => chip(`${k}: ${v}`)).join('')}</div>
      <div class="dr-actions"><button class="btn pri" data-act="novaOS" data-ruas="${ruasJ}">${ic('mais')} Lançar trabalho na seleção</button><button class="btn" data-act="novaCarga" data-ruas="${ruasJ}">${ic('colheita')} Registrar carga</button></div></div>
      <div class="dr-b">${this.kv([['Área', `${num(area, 2)} ha`], ['Comprimento de ruas', `${num(len / 1000, 2)} km`], ['Covas', num(pls)], ['Gotejadores', num(sum(rows, (r) => r.nGot))]])}
      <h4>Pendências do plano nesta seleção</h4>
      ${pend.size ? `<ul class="plan">${[...pend.values()].map((o) => `<li class="${STCLS[o.st]}"><span class="pl-dot"></span><div><b>${esc(o.nome)}</b><small>${o.n} rua(s) · até ${fmtDate(o.fim)}</small></div>${chip(STNOME[o.st], STCLS[o.st])}<button class="mini" data-act="planoLancar" data-tarefa="${o.tarefa}">Lançar</button></li>`).join('')}</ul>` : '<p class="muted">Nada pendente.</p>'}
      <h4>Ruas</h4><div class="chips">${rows.slice(0, 120).map((r) => `<button class="chip" data-act="rua" data-id="${r.id}">${r.id}</button>`).join('')}${rows.length > 120 ? chip(`+${rows.length - 120}`) : ''}</div></div>`;
  }

  drPlanta(rowId, j) {
    const m = this.model, r = this.farm.rowById.get(rowId);
    const reg = this.farm.regionById.get(r.reg);
    const pl = m.plantas(r);
    const st = m.plantStatus(pl, j);
    const [x, y, dist] = plantPos(r, reg, j);
    const g = gotejadorEm(r, reg, dist);
    const pid = `${r.id}-P${String(j + 1).padStart(4, '0')}`;
    const nota = pl.notas?.[j];
    return `<div class="dr-h"><div class="dr-eyebrow" style="--c:${reg.cor}">${esc(reg.nome)} · rua <button class="link" data-act="rua" data-id="${r.id}">${r.id}</button></div><h2 class="mono">${pid}</h2>
      <div class="chips">${chip(STATUS_PLANTA[st].nome, st === 'ok' ? 'st-ok' : st === 'replantada' ? 'st-fut' : 'st-bad')}${pl.demo ? chip('exemplo') : ''}</div>
      <div class="dr-actions"><button class="btn" data-act="pularPlanta" data-row="${r.id}" data-j="${j - 1}">${ic('voltar')} P${j}</button><button class="btn" data-act="pularPlanta" data-row="${r.id}" data-j="${j + 1}">P${j + 2} ${ic('seta')}</button><button class="btn" data-act="copiar" data-txt="${pid} ${geo.fmt(x, y)}">Copiar posição</button></div></div>
      <div class="dr-b">${this.kv([
        ['Posição na rua', `${num(dist, 1)} m do início · planta ${j + 1} de ${r.nPl}`],
        ['Coordenada', `<span class="mono">${geo.fmt(x, y)}</span>`],
        ['Gotejador mais próximo', `nº ${num(g.n)} da rua · lateral ${g.lateral} · ${num(g.dist, 2)} m`],
        ['Cultivar', esc(reg.variedade)], ['Idade', `${num(reg.idade, 1)} anos`],
        nota ? ['Observação', esc(nota)] : null,
      ])}
      <h4>Situação da planta</h4>
      <div class="seg">${Object.entries(STATUS_PLANTA).map(([k, v]) => `<button class="${k === st ? 'on' : ''}" data-act="plantaStatus" data-row="${r.id}" data-j="${j}" data-st="${k}">${esc(v.nome)}</button>`).join('')}</div>
      <label class="fld"><span>Observação desta planta</span><textarea id="notaPlanta" rows="2" placeholder="Ex.: ataque de cochonilha na roseta">${esc(nota || '')}</textarea></label>
      <div class="dr-actions"><button class="btn" data-act="plantaStatus" data-row="${r.id}" data-j="${j}" data-st="${st}">Salvar observação</button><button class="btn" data-act="novaManut" data-rua="${r.id}" data-metro="${dist.toFixed(1)}">${ic('manut')} Problema no gotejamento aqui</button></div></div>`;
  }

  async setPlantaStatus(rowId, j, st) {
    const r = this.farm.rowById.get(rowId);
    const base = this.model.plantas(r);
    const doc = { id: rowId, falhas: [...(base.falhas || [])], replantadas: [...(base.replantadas || [])], doentes: [...(base.doentes || [])], baixa: [...(base.baixa || [])], morta: [...(base.morta || [])], notas: { ...(base.notas || {}) } };
    for (const k of ['falhas', 'replantadas', 'doentes', 'baixa', 'morta']) doc[k] = doc[k].filter((x) => x !== j);
    const map = { falha: 'falhas', replantada: 'replantadas', doente: 'doentes', baixa: 'baixa', morta: 'morta' };
    if (map[st]) doc[map[st]].push(j);
    const nota = document.getElementById('notaPlanta')?.value?.trim();
    if (nota) doc.notas[j] = nota; else delete doc.notas[j];
    try { await this.store.put('plantas', doc); this.toast(`Planta P${j + 1}: ${STATUS_PLANTA[st].nome}.`); } catch { this.toast('Não foi salvo.'); }
    this.plantaSel = { row: rowId, j };
    this.scene.setSelection(this.sel, { plantaSel: this.plantaSel });
    this.renderDrawer();
  }

  drAtivo(id) {
    const m = this.model, a = this.farm.assetById.get(id);
    if (!a) return '<p>Ativo não encontrado.</p>';
    const st = m.assetStatus(id);
    const ov = this.store.get('ativos', id);
    const mts = this.store.all('manut').filter((x) => x.ativo === id).sort((p, q) => (p.abertoEm < q.abertoEm ? 1 : -1));
    let tele = '';
    if (a.tipo === 'bomba') {
      const t = telemetriaBomba(a, st);
      tele = `<h4>Funcionamento ${chip(t.ligada ? 'Ligada' : 'Desligada', t.ligada ? 'st-ok' : 'st-cancel')}</h4>
        <div class="gauges"><div><span>Vazão</span><b>${num(t.vazao, 0)}</b><small>m³/h</small></div><div><span>Pressão</span><b>${num(t.pressao, 1)}</b><small>bar</small></div><div><span>Corrente</span><b>${num(t.corrente, 0)}</b><small>A</small></div><div><span>Potência</span><b>${num(t.kw, 1)}</b><small>kW</small></div></div>
        ${lineChart([{ cor: 'var(--agua)', area: true, pts: t.serie.map((s) => [s.h, s.vazao]) }], { h: 140, xLabels: [[0, '0h'], [6, '6h'], [12, '12h'], [18, '18h'], [23.5, '24h']] })}
        <p class="muted small">Vazão nas últimas 24 h. Horas ligada hoje: ${num(t.horasDia, 1)} h · ${num(t.kwhDia, 0)} kWh · horímetro ${num(t.horimetro)} h. Valores simulados até conectar o CLP/multimedidor.</p>`;
    } else if (a.tipo === 'rele') {
      const t = telemetriaRele(a, st);
      tele = `<h4>Comunicação ${chip(t.online ? 'Online' : 'Sem comunicação', t.online ? 'st-ok' : 'st-bad')}</h4>${this.kv([['Sinal (RSSI)', t.rssi != null ? `${t.rssi} dBm ${t.rssi < -100 ? chip('fraco', 'st-warn') : ''}` : '—'], ['Bateria', `${t.bateria} V`], ['Último contato', t.ultimoContato.toLocaleString('pt-BR')], ['Saída', t.estadoSaida]])}`;
    } else if (a.tipo === 'valvula') {
      const ss = this.farm.regions.flatMap((x) => x.setores);
      const s = ss.find((x) => x.id === a.setor);
      const on = setorIrrigando(ss.indexOf(s), ss.length);
      const c = m.cudSetor(a.setor);
      tele = `<h4>Operação ${chip(on ? 'Aberta (irrigando)' : 'Fechada', on ? 'st-info' : 'st-cancel')}</h4>${this.kv([['Setor', `<button class="link" data-act="selSetor" data-s="${a.setor}">${a.setor}</button> · ${s?.rows.length} ruas`], ['Pressão a jusante', on ? `${num(st === 'alerta' ? 11 : 15, 0)} mca` : '0 mca'], ['CUD', c ? `${num(c.val, 1)}% (${c.cls}) · ${fmtDate(c.data)}` : '—']])}`;
    } else if (a.tipo === 'reservatorio') {
      const n = nivelReservatorio();
      tele = `<h4>Nível</h4><div class="level"><span style="height:${n}%"></span><b>${num(n, 0)}%</b></div><p class="muted small">Nível simulado: enche de dia pela captação (BC-01) e baixa à noite com a irrigação.</p>`;
    } else if (a.tipo === 'cruzeta' && a.rua) {
      tele = `<div class="dr-actions"><button class="btn" data-act="rua" data-id="${a.rua}">Abrir rua ${a.rua}</button></div>`;
    }
    const specs = Object.entries(a.specs || {}).map(([k, v]) => [k, esc(v)]);
    return `<div class="dr-h"><div class="dr-eyebrow">${esc(a.sub || a.tipo)}${a.reg ? ' · ' + esc(a.reg) : ''}${a.setor ? ' · ' + esc(a.setor) : ''}</div><h2 class="mono">${esc(a.id)}</h2><p>${esc(a.nome)}</p>
      <div class="chips">${chip(STATUS_ATIVO[st].nome, STATUS_ATIVO[st].cls)}${ov?.obs ? chip(ov.obs) : ''}</div>
      <div class="dr-actions"><button class="btn" data-act="statusAtivo" data-id="${a.id}">${ic('editar')} Alterar status</button><button class="btn" data-act="novaManut" data-ativo="${a.id}">${ic('manut')} Abrir manutenção</button><button class="btn" data-act="copiar" data-txt="${a.id} ${geo.fmt(a.x, a.y)}">Copiar posição</button></div></div>
      <div class="dr-b">${this.kv([['Coordenada', `<span class="mono">${geo.fmt(a.x, a.y)}</span>`], ...specs])}${tele}
      <h4>Manutenções</h4>${mts.length ? `<ul class="list">${mts.map((x) => `<li><button data-act="abrirManut" data-id="${x.id}"><span>${fmtDate(x.abertoEm)}</span><b>${esc(x.titulo)}</b>${chip(x.status, x.status === 'concluida' ? 'st-ok' : 'st-warn')}</button></li>`).join('')}</ul>` : '<p class="muted">Nenhuma registrada.</p>'}</div>`;
  }

  drTubo(id) {
    const p = this.farm.pipes.find((x) => x.id === id);
    if (!p) return '';
    return `<div class="dr-h"><div class="dr-eyebrow">Tubulação · ${esc(p.tipo)}</div><h2 class="mono">${esc(p.id)}</h2><p>${esc(p.nome)}</p></div><div class="dr-b">${this.kv([['Material', esc(p.material)], ['Diâmetro', esc(p.dn)], ['Comprimento', `${num(p.len, 0)} m`], ['Início', `<span class="mono">${geo.fmt(...p.pts[0])}</span>`], ['Fim', `<span class="mono">${geo.fmt(...p.pts[p.pts.length - 1])}</span>`]])}</div>`;
  }

  drEquip(id) {
    const e = this.model.equipMap()[id];
    const mc = this.sim.machines.find((x) => x.id === id);
    if (!e) return '<p>Equipamento não encontrado.</p>';
    const r = mc?.rua ? this.farm.rowById.get(mc.rua) : null;
    return `<div class="dr-h"><div class="dr-eyebrow">${esc(TIPOS_EQUIP[e.tipo]?.nome || e.tipo)}</div><h2>${esc(e.nome)}</h2><p class="mono">${esc(e.id)} · rastreador ${esc(e.rastreador || '—')}</p>
      <div class="chips">${chip(mc?.estado || 'parado', mc?.estado === 'parado' ? 'st-cancel' : 'st-ok')}${chip('GPS: ' + (mc?.fonte || '—'))}</div>
      <div class="dr-actions"><button class="btn ${this.seguir === id ? 'pri' : ''}" data-act="seguirEquip" data-id="${id}">${ic('alvo')} ${this.seguir === id ? 'Seguindo' : 'Seguir com a câmera'}</button><button class="btn" data-act="importarTrilha" data-id="${id}">${ic('gps')} Importar trilha</button><button class="btn" data-act="abrirEquip" data-id="${id}">${ic('editar')} Cadastro</button></div></div>
      <div class="dr-b" id="eqLive">${this.eqLive(e, mc, r)}</div>`;
  }
  eqLive(e, mc, r) {
    if (!mc) return '';
    return this.kv([
      ['Velocidade', `${num(mc.vel, 1)} km/h`], ['Rua atual', r ? `<button class="link" data-act="rua" data-id="${r.id}">${r.id}</button>` : 'Fora das ruas / manobra'],
      ['Coordenada', `<span class="mono">${geo.fmt(mc.x, mc.y)}</span>`], ['Operação', mc.tarefa ? esc(TAREFA[mc.tarefa]?.nome || mc.tarefa) : '—'],
      ['Percorrido em ruas (sessão)', `${num((mc.dist || 0) / 1000, 2)} km · ${num(mc.area || 0, 2)} ha`],
      mc.tipo === 'colhedora' ? ['Colhido (sessão)', `${num(mc.litros, 0)} L · ${num(mc.litros / this.model.params().rendimento, 1)} sc`] : null,
      mc.tipo === 'bazuca' ? ['Carga atual', `${num(mc.carga, 0)} de 8.000 L · ${mc.cargas || 0} descargas`] : null,
      ['Horímetro', `${num(e.horimetro)} h`], ['Consumo', `${e.consumo || '—'} L/h`], ['Custo/hora', brl(e.custoHora)],
    ]);
  }

  drManut(id) {
    const mt = this.store.get('manut', id);
    if (!mt) return '<p>Ocorrência não encontrada.</p>';
    const a = mt.ativo ? this.farm.assetById.get(mt.ativo) : null;
    const x = a ? a.x : mt.x, y = a ? a.y : mt.y;
    return `<div class="dr-h"><div class="dr-eyebrow">Manutenção · ${esc(mt.tipo || '')}</div><h2>${esc(mt.titulo)}</h2>
      <div class="chips">${chip(mt.prioridade || '', mt.prioridade === 'Alta' ? 'st-bad' : mt.prioridade === 'Média' ? 'st-warn' : 'st-info')}${chip(mt.status, mt.status === 'concluida' ? 'st-ok' : 'st-warn')}${mt.demo ? chip('exemplo') : ''}</div>
      <div class="dr-actions"><button class="btn pri" data-act="abrirManut" data-id="${id}">${ic('editar')} Atualizar</button>${mt.rua ? `<button class="btn" data-act="novaOS" data-ruas='${esc(JSON.stringify({ [mt.rua.split('-')[0]]: String(+mt.rua.split('L')[1]) }))}' data-tarefa="IR06">Lançar reparo</button>` : ''}</div></div>
      <div class="dr-b">${this.kv([['Aberta em', fmtDate(mt.abertoEm)], ['Ativo', a ? `<button class="link" data-act="ativo" data-id="${a.id}">${a.id}</button> · ${esc(a.nome)}` : '—'], ['Rua', mt.rua ? `<button class="link" data-act="rua" data-id="${mt.rua}">${mt.rua}</button>` : (a?.rua || '—')], ['Posição', mt.metro != null ? `${num(mt.metro, 1)} m do início da rua` : '—'], ['Coordenada', x != null ? `<span class="mono">${geo.fmt(x, y)}</span>` : '—'], ['Descrição', esc(mt.descricao || '')], ['Responsável', esc(mt.responsavel || '')], mt.fechadoEm ? ['Concluída em', fmtDate(mt.fechadoEm)] : null, mt.custo ? ['Custo', brl(mt.custo)] : null])}</div>`;
  }

  onSim(ms) {
    this.scene.updateEquip(ms);
    if (this.seguir && this.view === 'mapa') { const mc = ms.find((x) => x.id === this.seguir); if (mc && !this.scene.anim) this.scene.follow(mc, this.camModo); }
    const now = performance.now();
    if (now - (this._lastLive || 0) > 500) {
      this._lastLive = now;
      if (this.drawer?.tipo === 'equip') {
        const el = document.getElementById('eqLive');
        const mc = ms.find((x) => x.id === this.drawer.id);
        const e = this.model.equipMap()[this.drawer.id];
        if (el && e) el.innerHTML = this.eqLive(e, mc, mc?.rua ? this.farm.rowById.get(mc.rua) : null);
      }
      if (this.view === 'equipamentos') VIEWS.equipamentos.live?.(this);
      if (this.view === 'trabalho') VIEWS.trabalho.live?.(this);
      if (this.seguir) this.liveFollow(ms);
      if (this.mode === 'colheita' && this.cor.colheita === 'colhidas' && now - (this._lastCol || 0) > 3000) { this._lastCol = now; this.colorir(); }
    }
  }

  // ------------------------------------------------------------------ modal / toast
  modal(html, cls = '') {
    const el = this.$('#modal');
    el.innerHTML = `<div class="modal-bg" data-act="fecharModal"></div><div class="modal-box ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    el.hidden = false;
    return el.querySelector('.modal-box');
  }
  closeModal() { const el = this.$('#modal'); el.hidden = true; el.innerHTML = ''; }
  toast(t) {
    const el = this.$('#toast');
    el.textContent = t; el.hidden = false;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => (el.hidden = true), 3200);
  }
}
