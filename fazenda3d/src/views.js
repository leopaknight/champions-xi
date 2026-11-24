// Telas em painel: Painel, Agenda, Solo, Fitossanidade, Irrigação, Colheita,
// Equipamentos, Manutenção, Levantamento, Relatórios e Ajustes.
import { TAREFA, TAREFAS, FASES, FASE, PRAGAS, STATUS_OS, STATUS_ATIVO, TIPOS_EQUIP, VARIEDADES } from './catalog.js';
import { estagio, faseAtual, interpretar, ATRIBUTOS, DERIV, etoHargreaves, taxaMmH, kr, PARAM_PADRAO, estimar } from './agro.js';
import { telemetriaBomba, telemetriaRele, nivelReservatorio, setorIrrigando } from './sim.js';
import { esc, num, brl, pct, fmtDate, fmtDateShort, geo, isoDate, addDays, parseISO, MESES, DIAS, sum, groupBy, anoSafra, daysBetween, compressRanges, toCSV, mean } from './util.js';
import { ic, chip, STCLS, STNOME, lineChart, barH, corCat, baixar, lerArquivo } from './dom.js';
import { RELATORIOS } from './reports.js';
import { polysFromGeoJSON, polysFromKML, CONFIG_PADRAO } from './farm.js';

export const NAV = [
  { id: 'mapa', nome: 'Mapa 3D', curto: 'Mapa', ic: 'mapa', mob: true },
  { id: 'painel', nome: 'Painel', ic: 'painel', mob: true },
  { id: 'agenda', nome: 'Agenda e ordens de serviço', curto: 'Agenda', ic: 'agenda', mob: true },
  { id: 'colheita', nome: 'Colheita e previsão', curto: 'Colheita', ic: 'colheita', mob: true },
  { id: 'solo', nome: 'Solo e nutrição', curto: 'Solo', ic: 'solo' },
  { id: 'fitossanidade', nome: 'Pragas e doenças', curto: 'Pragas', ic: 'fito' },
  { id: 'irrigacao', nome: 'Irrigação', ic: 'irrig' },
  { id: 'equipamentos', nome: 'Máquinas e GPS', curto: 'Máquinas', ic: 'equip' },
  { id: 'manutencao', nome: 'Manutenção', ic: 'manut' },
  { id: 'inventario', nome: 'Levantamento', ic: 'invent' },
  { id: 'relatorios', nome: 'Relatórios', ic: 'relat' },
  { id: 'ajustes', nome: 'Ajustes', ic: 'config' },
];

const vs = {}; // estado das telas
const S = (k, d) => (vs[k] ??= d);
const regOpts = (ui, sel, todas = true) => `${todas ? `<option value="">Todas as regiões</option>` : ''}${ui.farm.regions.map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}`;
const head = (t, sub, acts = '') => `<header class="vh"><div><h1>${esc(t)}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="vh-a">${acts}</div></header>`;
const card = (t, body, extra = '', cls = '') => `<section class="card ${cls}">${t ? `<div class="card-h"><h3>${esc(t)}</h3>${extra}</div>` : ''}${body}</section>`;
const ruasJ = (o) => esc(JSON.stringify(o));
const regRuas = (reg) => ({ [reg.id]: compressRanges(reg.rows.map((r) => r.idx)) });
const demoTag = (o) => (o?.demo ? ` ${chip('exemplo')}` : '');

function faseBar(hoje) {
  const ord = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  const d = parseISO(hoje);
  const pos = ((ord.indexOf(d.getMonth() + 1) + (d.getDate() - 1) / 31) / 12) * 100;
  const fases = ['POS', 'POS', 'COR', 'FLO', 'DES', 'DES', 'GRA', 'GRA', 'GRA', 'MAT', 'COL', 'COL'];
  return `<div class="fbar">${ord.map((m, i) => `<div class="fb-m" style="background:${FASE[fases[i]].cor}" title="${esc(FASE[fases[i]].nome)}"><span>${MESES[m - 1]}</span></div>`).join('')}<i class="fb-now" style="left:${pos}%"></i></div>`;
}

export const VIEWS = {
  // =========================================================== PAINEL
  painel: {
    render(ui) {
      const m = ui.model, farm = ui.farm;
      const f = FASE[faseAtual(m.hoje)];
      const hoje = m.osDoDia();
      const atrasRuas = farm.rows.filter((r) => m.rowPlanSummary(r).atrasadas).length;
      const fitoAl = farm.regions.flatMap((r) => (m.fitoAtual(r.id)?.alertas || []).map((a) => ({ ...a, reg: r })));
      const ativosAl = farm.assets.filter((a) => m.assetStatus(a.id) !== 'ok');
      const mts = m.manutAbertas();
      const prevTot = sum(farm.regions, (r) => m.previsao(r)?.total || 0);
      const nivel = nivelReservatorio();
      const bombas = farm.assets.filter((a) => a.tipo === 'bomba');
      const ss = farm.regions.flatMap((r) => r.setores);
      const irrig = ss.filter((s, i) => setorIrrigando(i, ss.length));
      const kpi = (l, v, s, cls = '', act = '') => `<button class="tile ${cls}" ${act}><span>${esc(l)}</span><b>${v}</b><small>${s}</small></button>`;
      return `${head(`${DIAS[parseISO(m.hoje).getDay()]}, ${fmtDate(m.hoje)}`, `${esc(ui.farmConfig().nome)} · ${esc(ui.farmConfig().municipio || '')}`, `<button class="btn pri" data-act="novaOS">${ic('mais')} Lançar trabalho</button>`)}
      ${!ui.store.demoOn() ? '' : `<div class="banner">${ic('aviso')}<div><b>Dados de exemplo.</b> Polígonos, ruas, análises, operações e colheitas são simulados para mostrar o sistema funcionando. Troque pelos limites reais e comece a lançar em <button class="link" data-act="go" data-v="ajustes">Ajustes</button>.</div></div>`}
      <section class="card fase"><div class="card-h"><h3>Fase do ciclo: ${esc(f.nome)}</h3>${chip(`Ciclo ${m.safra - 1}/${m.safra}`)}</div><p>${esc(f.desc)}</p>${faseBar(m.hoje)}</section>
      <div class="tiles">
        ${kpi('Área de café', num(farm.totais.areaHa, 1) + ' ha', `${num(farm.totais.ruas)} ruas · ${num(farm.totais.plantas)} covas`)}
        ${kpi('Trabalho de hoje', hoje.length, `${hoje.filter((o) => o.status === 'execucao').length} em execução`, '', 'data-act="go" data-v="agenda"')}
        ${kpi('Ruas com atraso', num(atrasRuas), `${pct((atrasRuas / farm.rows.length) * 100, 0)} das ruas`, atrasRuas ? 'warn' : 'ok', 'data-act="viewAct" data-a="mapaPlano"')}
        ${kpi('Pragas e doenças', fitoAl.length, fitoAl.length ? 'acima do nível de controle' : 'abaixo do nível', fitoAl.length ? 'bad' : 'ok', 'data-act="go" data-v="fitossanidade"')}
        ${kpi('Manutenção aberta', mts.length, `${mts.filter((x) => x.prioridade === 'Alta').length} de prioridade alta`, mts.some((x) => x.prioridade === 'Alta') ? 'bad' : '', 'data-act="go" data-v="manutencao"')}
        ${kpi(`Previsão ${m.safra}`, num(prevTot, 0) + ' sc', prevTot ? brl(prevTot * m.params().precoSaca) + ' estimados' : 'sem contagem', '', 'data-act="go" data-v="colheita"')}
      </div>
      <div class="grid2">
        ${card('Trabalho de hoje', hoje.length ? `<ul class="list">${hoje.map((o) => `<li><button data-act="abrirOS" data-id="${o.id}"><b>${esc(TAREFA[o.tarefa]?.nome)}</b><span>${esc(Object.entries(o.ruas || {}).map(([k, v]) => `${k} ${v}`).join(' · ') || o.ativo || '')}</span>${chip(STATUS_OS[o.status].nome, STATUS_OS[o.status].cls)}</button></li>`).join('')}</ul>` : '<p class="muted">Nada lançado para hoje.</p>', `<button class="mini" data-act="viewAct" data-a="mapaHoje">Ver no mapa</button>`)}
        ${(() => { const al = [
          ...fitoAl.map((a) => `<li class="al bad"><b>${esc(a.nome)} · ${esc(a.reg.nome)}</b><span>${num(a.v, 1)} ${esc(a.un)} (nível ${a.nc})</span></li>`),
          ...ativosAl.map((a) => `<li class="al ${m.assetStatus(a.id) === 'falha' ? 'bad' : 'warn'}"><button class="link" data-act="ativo" data-id="${a.id}">${esc(a.id)}</button><span>${esc(STATUS_ATIVO[m.assetStatus(a.id)].nome)} · ${esc(a.nome)}</span></li>`),
          ...mts.filter((x) => x.prioridade === 'Alta').map((x) => `<li class="al bad"><button class="link" data-act="manut" data-id="${x.id}">${esc(x.titulo)}</button><span>${esc(x.rua || x.ativo || '')}</span></li>`),
        ]; return card('Alertas', al.length ? `<ul class="alerts">${al.join('')}</ul>` : '<p class="muted">Sem alertas.</p>'); })()}
        ${card('Irrigação agora', `<div class="irr-now"><div class="level sm"><span style="height:${nivel}%"></span><b>${num(nivel, 0)}%</b></div><div>${bombas.map((b) => { const t = telemetriaBomba(b, m.assetStatus(b.id)); return `<div class="pump-l"><button class="link" data-act="ativo" data-id="${b.id}">${b.id}</button> ${chip(t.ligada ? 'Ligada' : m.assetStatus(b.id) === 'manutencao' ? 'Manutenção' : 'Desligada', t.ligada ? 'st-ok' : m.assetStatus(b.id) === 'manutencao' ? 'st-plan' : 'st-cancel')} <small>${t.ligada ? `${num(t.vazao, 0)} m³/h · ${num(t.pressao, 1)} bar` : ''}</small></div>`; }).join('')}<p class="small">${irrig.length ? `Irrigando: ${irrig.map((s) => s.id).join(', ')}` : 'Nenhum setor irrigando neste horário (rodízio 21h30–5h30).'}</p></div></div>`, `<button class="mini" data-act="go" data-v="irrigacao">Abrir</button>`)}
        ${card('Pendências do plano por região', barH(farm.regions.map((r) => { const p = m.pendenciasRegiao(r); return { l: r.nome, v: p.filter((x) => x.st === 'atrasada').length, txt: `${p.filter((x) => x.st === 'atrasada').length} atrasadas · ${p.filter((x) => x.st === 'agora').length} na janela`, cor: 'var(--bad)' }; })), `<button class="mini" data-act="viewAct" data-a="pend">Detalhar</button>`)}
        ${card(`Previsão ${m.safra} × colheita ${m.safra - 1} (sc/ha)`, barH(farm.regions.filter((r) => estagio(r, m.safra) === 'P').map((r) => { const p = m.previsao(r); const c = m.colheitaRegiao(r, m.safra - 1); return { l: r.nome, v: p?.scha || 0, ref: c.schaTotal || null, txt: p ? `${num(p.scha, 1)} (ant. ${num(c.schaTotal, 1)})` : 'sem contagem', cor: 'var(--folha)' }; }), { max: 70 }) + '<p class="muted small">Barra: previsão da última contagem. Traço: colheita da safra anterior.</p>')}
        ${card('Florada e maturação prevista', `<table class="tbl sm"><thead><tr><th>Região</th><th>Florada principal</th><th>Maturação prevista</th></tr></thead><tbody>${farm.regions.map((r) => { const fl = m.floradaPrincipal(r); return `<tr><td>${esc(r.nome)}</td><td>${fl ? fmtDate(fl) : '—'}</td><td>${fl ? fmtDate(m.maturacaoPrevista(r)) : estagio(r, m.safra) === 'F' ? 'Formação' : '—'}</td></tr>`; }).join('')}</tbody></table><p class="muted small">Florada + dias até maturação da cultivar (ajustável). Confirme com a avaliação de maturação a partir de março.</p>`)}
      </div>`;
    },
    act(ui, d) {
      if (d.a === 'mapaHoje') { ui.go('mapa'); ui.setMode('manejo'); ui.cor.manejo = 'hoje'; ui.colorir(); ui.renderHud(); }
      if (d.a === 'mapaPlano') { ui.go('mapa'); ui.setMode('manejo'); ui.cor.manejo = 'plano'; ui.colorir(); ui.renderHud(); }
      if (d.a === 'pend') { vs.agendaAba = 'pend'; ui.go('agenda'); }
    },
  },

  // =========================================================== AGENDA
  agenda: {
    render(ui) {
      const m = ui.model;
      const aba = S('agendaAba', 'dia');
      const tabs = [['dia', 'Dia'], ['plano', 'Plano do ciclo'], ['pend', 'Pendências'], ['lista', 'Todas as ordens']];
      let body = '';
      if (aba === 'dia') {
        const dia = S('agendaDia', m.hoje);
        const ini = addDays(dia, -3);
        const dias = Array.from({ length: 7 }, (_, i) => addDays(ini, i));
        const lst = m.osList().filter((o) => o.data === dia);
        body = `<div class="week">${`<button class="wk-nav" data-act="viewAct" data-a="dia" data-d="${addDays(dia, -7)}">${ic('voltar')}</button>`}${dias.map((d) => { const n = m.osList().filter((o) => o.data === d && o.status !== 'cancelada').length; return `<button class="wk ${d === dia ? 'on' : ''} ${d === m.hoje ? 'today' : ''}" data-act="viewAct" data-a="dia" data-d="${d}"><small>${DIAS[parseISO(d).getDay()]}</small><b>${parseISO(d).getDate()}</b><i>${n || ''}</i></button>`; }).join('')}<button class="wk-nav" data-act="viewAct" data-a="dia" data-d="${addDays(dia, 7)}">${ic('seta')}</button></div>
        <div class="card-h"><h3>${fmtDate(dia)}</h3><button class="btn pri" data-act="novaOS" data-data="${dia}">${ic('mais')} Nova ordem neste dia</button></div>
        ${lst.length ? `<div class="oslist">${lst.map((o) => osCard(ui, o)).join('')}</div>` : '<p class="muted">Nenhuma ordem de serviço neste dia.</p>'}`;
      } else if (aba === 'plano') {
        const rid = S('planoReg', ui.farm.regions[0].id);
        const reg = ui.farm.regionById.get(rid);
        const plano = m.plano(reg);
        const ord = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
        const t0 = parseISO(`${m.safra - 1}-07-01`), t1 = parseISO(`${m.safra}-08-31`);
        const X = (d) => ((parseISO(d) - t0) / (t1 - t0)) * 100;
        const agg = new Map();
        for (const r of reg.rows) for (const o of m.rowPlan(r)) { const a = agg.get(o.key) || { feita: 0, atrasada: 0, agora: 0, futura: 0, opcional: 0 }; a[o.st]++; agg.set(o.key, a); }
        body = `<div class="filters"><label class="fld inline"><span>Região</span><select data-chg="viewChg" data-k="planoReg">${regOpts(ui, rid, false)}</select></label>${chip(estagio(reg, m.safra) === 'P' ? 'Lavoura em produção' : 'Lavoura em formação')}</div>
        <div class="gantt"><div class="g-head">${ord.map((mm) => `<span>${MESES[mm - 1]}</span>`).join('')}</div>
        <i class="g-now" style="left:calc(var(--gl) + (100% - var(--gl)) * ${X(m.hoje) / 100})"></i>
        ${plano.map((o) => { const a = agg.get(o.key) || {}; const tot = reg.rows.length; const st = a.atrasada ? 'atrasada' : a.agora ? 'agora' : a.feita === tot ? 'feita' : a.feita ? 'agora' : o.opcional ? 'opcional' : 'futura'; return `<div class="g-row"><div class="g-l"><b>${esc(o.nome)}</b><small>${esc(FASE[o.fase].nome)}${a.feita ? ` · feita em ${a.feita}/${tot} ruas` : ''}</small></div><div class="g-t"><span class="g-bar ${STCLS[st]}" style="left:${X(o.ini)}%;width:${Math.max(1.2, X(o.fim) - X(o.ini))}%" title="${fmtDate(o.ini)} a ${fmtDate(o.fim)}"></span></div><button class="mini" data-act="novaOS" data-ruas="${ruasJ(regRuas(reg))}" data-tarefa="${o.tarefa}">Lançar</button></div>`; }).join('')}</div>
        <p class="muted small">Barras: janela recomendada de cada operação no ciclo ${m.safra - 1}/${m.safra}. Cor = situação nas ruas da região. As janelas seguem o calendário do café irrigado no Cerrado Mineiro e podem ser ajustadas na lavoura.</p>`;
      } else if (aba === 'pend') {
        body = ui.farm.regions.map((reg) => { const p = m.pendenciasRegiao(reg); return card(reg.nome, p.length ? `<table class="tbl"><thead><tr><th>Operação</th><th>Situação</th><th>Janela</th><th>Ruas</th><th></th></tr></thead><tbody>${p.map((o) => { const rj = ruasJ({ [reg.id]: compressRanges(o.ruas) }); return `<tr><td>${esc(o.nome)}</td><td>${chip(STNOME[o.st], STCLS[o.st])}</td><td>${fmtDateShort(o.ini)} – ${fmtDateShort(o.fim)}</td><td class="mono small">${o.ruas.length === reg.rows.length ? 'todas' : esc(compressRanges(o.ruas))}</td><td class="nowrap"><button class="mini" data-act="selRuas" data-ruas="${rj}">Ver</button> <button class="mini" data-act="novaOS" data-ruas="${rj}" data-tarefa="${o.tarefa}">Lançar</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Sem pendências.</p>'); }).join('');
      } else {
        const fr = S('listaReg', ''), ft = S('listaTar', ''), fs = S('listaSt', '');
        const l = m.osList().filter((o) => (!fr || o.ruas?.[fr]) && (!ft || o.tarefa === ft) && (!fs || o.status === fs));
        body = `<div class="filters"><select data-chg="viewChg" data-k="listaReg">${regOpts(ui, fr)}</select><select data-chg="viewChg" data-k="listaTar"><option value="">Todas as operações</option>${TAREFAS.map((t) => `<option value="${t.id}" ${t.id === ft ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select><select data-chg="viewChg" data-k="listaSt"><option value="">Todos os status</option>${Object.entries(STATUS_OS).map(([k, v]) => `<option value="${k}" ${k === fs ? 'selected' : ''}>${v.nome}</option>`).join('')}</select><span class="muted">${l.length} ordens</span></div>
        <div class="tbl-wrap"><table class="tbl click"><thead><tr><th>Data</th><th>Operação</th><th>Ruas</th><th>Área</th><th>Equip.</th><th>Status</th><th>Custo</th></tr></thead><tbody>${l.slice(0, 300).map((o) => `<tr data-act="abrirOS" data-id="${o.id}"><td>${fmtDate(o.data)}</td><td>${esc(TAREFA[o.tarefa]?.nome || o.tarefa)}${demoTag(o)}</td><td class="small">${esc(Object.entries(o.ruas || {}).map(([k, v]) => `${k}: ${v.length > 18 ? v.slice(0, 18) + '…' : v}`).join(' · ') || o.ativo || '')}</td><td>${num(m.areaOS(o), 1)} ha</td><td>${esc(o.equip || '')}</td><td>${chip(STATUS_OS[o.status]?.nome || o.status, STATUS_OS[o.status]?.cls)}</td><td>${brl(m.custo(o).total)}</td></tr>`).join('')}</tbody></table></div>`;
      }
      return `${head('Agenda e ordens de serviço', 'Planeje o dia, acompanhe o plano do ciclo e lance cada trabalho com as características da operação.', `<button class="btn pri" data-act="novaOS">${ic('mais')} Nova ordem</button>`)}
      <div class="tabs big">${tabs.map(([k, n]) => `<button class="${aba === k ? 'on' : ''}" data-act="viewAct" data-a="aba" data-t="${k}">${n}</button>`).join('')}</div>${body}`;
    },
    act(ui, d) {
      if (d.a === 'aba') vs.agendaAba = d.t;
      if (d.a === 'dia') vs.agendaDia = d.d;
      if (d.a === 'osSt') {
        const o = ui.model.osList().find((x) => x.id === d.id);
        if (o) ui.store.put('os', { ...o, status: d.st }).then(() => ui.toast(`Ordem: ${STATUS_OS[d.st].nome}.`)).catch(() => ui.toast('Não foi salvo.'));
        return;
      }
      ui.renderView();
    },
    chg(ui, t) { vs[t.dataset.k] = t.value; ui.renderView(); },
  },

  // =========================================================== SOLO
  solo: {
    render(ui) {
      const m = ui.model;
      const rid = S('soloReg', ui.farm.regions[0].id);
      const reg = ui.farm.regionById.get(rid);
      const rc = m.recomendacao(reg);
      const hist = ui.store.all('solo').filter((s) => s.reg === rid).sort((a, b) => (a.data < b.data ? 1 : -1));
      const tabs = `<div class="tabs big">${ui.farm.regions.map((r) => `<button class="${r.id === rid ? 'on' : ''}" data-act="viewAct" data-a="reg" data-r="${r.id}">${esc(r.nome)}</button>`).join('')}</div>`;
      if (!rc) return `${head('Solo e nutrição', 'Análises por região e recomendação de corretivos e adubos.', `<button class="btn pri" data-act="novoSolo" data-reg="${rid}">${ic('mais')} Nova análise</button>`)}${tabs}<p class="muted">Nenhuma análise de solo para ${esc(reg.nome)}. Lance a primeira.</p>`;
      const s = rc.solo, r = rc.rec;
      const i1 = interpretar(s.a020), i2 = s.a2040 ? interpretar(s.a2040) : null;
      const linha = (at, val, c) => `<tr><td>${esc(at.l)}</td><td class="num">${val == null || val === '' ? '—' : num(val, val < 10 ? 2 : 0)}</td><td>${c ? chip(c.nome, clsCor(c.i, at.inverso)) : ''}</td></tr>`;
      const tab = (a, it) => `<table class="tbl sm"><tbody>${ATRIBUTOS.map((at) => linha(at, a[at.k], it.cls[at.k])).join('')}${DERIV.map((at) => linha(at, it.d[at.k], it.cls[at.k])).join('')}</tbody></table>`;
      const area = reg.areaHa;
      const parc = (v) => (v ? `${num(v, 0)} kg/ha · ${num((v * area) / 1000, 2)} t na região` : '0 kg/ha (teor suficiente pela tabela)');
      const insCal = [{ id: r.calcario.startsWith('Dolom') ? 'calc-dol' : 'calc-calc', dose: +r.calagem.toFixed(2) }];
      const ruas = ruasJ(regRuas(reg));
      const serie = hist.slice().reverse().map((h) => ({ d: h.data, ...interpretar(h.a020).d, k: +h.a020.k, p: +h.a020.p }));
      return `${head('Solo e nutrição', 'Análises por região, interpretação (5ª Aproximação, CFSEMG) e recomendação.', `<button class="btn pri" data-act="novoSolo" data-reg="${rid}">${ic('mais')} Nova análise</button>`)}${tabs}
      <div class="grid2">
        ${card(`Análise de ${fmtDate(s.data)}`, `<p class="muted small">${esc(s.laboratorio || '')} · protocolo ${esc(s.protocolo || '—')}</p><div class="grid2 tight"><div><h4>0–20 cm</h4>${tab(s.a020, i1)}</div>${i2 ? `<div><h4>20–40 cm</h4>${tab(s.a2040, i2)}</div>` : ''}</div>`, `${demoTag(s)}<button class="mini" data-act="abrirSolo" data-id="${s.id}">Editar</button>`)}
        <div class="stack">
          ${card('Recomendação para o ciclo', `${ui.kv([
            ['Produtividade usada', `${num(rc.sc, 0)} sc/ha ${s.scEsperada ? '(informada)' : '(previsão)'}`],
            ['Calcário', `<b>${num(r.calagem, 2)} t/ha</b> · ${num(r.calagem * area, 1)} t na região<br><small>${esc(r.calcario)} · V atual ${num(r.d.V, 0)}% → alvo ${m.params().v2}%</small>`],
            ['Gesso', r.gessagem == null ? '—' : r.gessagem ? `<b>${num(r.gessagem, 0)} kg/ha</b> · ${num((r.gessagem * area) / 1000, 1)} t na região<br><small>${esc(r.motivoGesso)}</small>` : `Não indicado<br><small>${esc(r.motivoGesso)}</small>`],
            ['N', r.N != null ? `<b>${parc(r.N)}</b><br><small>ureia ≈ ${num(r.N / 0.45, 0)} kg/ha · em 3–4 parcelas</small>` : '—'],
            ['P₂O₅', r.P2O5 != null ? `<b>${parc(r.P2O5)}</b><br><small>P ${esc(r.pClasse)} · MAP ≈ ${num(r.P2O5 / 0.52, 0)} kg/ha</small>` : '—'],
            ['K₂O', r.K2O != null ? `<b>${parc(r.K2O)}</b><br><small>K ${esc(r.kClasse)} · KCl ≈ ${num(r.K2O / 0.6, 0)} kg/ha</small>` : '—'],
            r.exportacao ? ['Exportação pelos grãos', `${num(r.exportacao.N, 0)} kg N e ${num(r.exportacao.K2O, 0)} kg K₂O por ha`] : null,
          ])}
          ${r.alertas.length || r.notas.length ? `<ul class="alerts">${[...r.alertas, ...r.notas].map((a) => `<li class="al warn"><span>${esc(a)}</span></li>`).join('')}</ul>` : ''}
          <div class="dr-actions"><button class="btn" data-act="novaOS" data-ruas="${ruas}" data-tarefa="CR01" data-insumos='${esc(JSON.stringify(insCal))}'>Lançar calagem</button>${r.gessagem ? `<button class="btn" data-act="novaOS" data-ruas="${ruas}" data-tarefa="CR02" data-insumos='${esc(JSON.stringify([{ id: 'gesso', dose: +(r.gessagem / 1000).toFixed(2) }]))}'>Lançar gessagem</button>` : ''}<button class="btn" data-act="novaOS" data-ruas="${ruas}" data-tarefa="AD01">Lançar adubação</button></div>
          <p class="nota small">Cálculo pelas tabelas de Ajustes (base 5ª Aproximação). É ponto de partida: confirme com o agrônomo responsável antes de comprar e aplicar.</p>`)}
          ${serie.length > 1 ? card('Evolução', lineChart([{ cor: 'var(--folha)', pts: serie.map((x, i) => [i, x.V]) }, { cor: 'var(--terra)', pts: serie.map((x, i) => [i, x.k / 2]) }], { h: 150, xLabels: serie.map((x, i) => [i, fmtDate(x.d).slice(3)]) }) + `<p class="small"><span class="sw" style="background:var(--folha)"></span> V% <span class="sw" style="background:var(--terra)"></span> K (mg/dm³ ÷ 2)</p>`) : ''}
        </div>
      </div>
      ${card('Histórico de análises', `<table class="tbl click"><thead><tr><th>Data</th><th>pH</th><th>P</th><th>K</th><th>Ca</th><th>Mg</th><th>V%</th><th>m%</th><th>B</th><th>Zn</th></tr></thead><tbody>${hist.map((h) => { const d = interpretar(h.a020).d; return `<tr data-act="abrirSolo" data-id="${h.id}"><td>${fmtDate(h.data)}${demoTag(h)}</td><td>${h.a020.ph}</td><td>${h.a020.p}</td><td>${h.a020.k}</td><td>${h.a020.ca}</td><td>${h.a020.mg}</td><td>${num(d.V, 0)}</td><td>${num(d.m, 0)}</td><td>${h.a020.b ?? '—'}</td><td>${h.a020.zn ?? '—'}</td></tr>`; }).join('')}</tbody></table>`)}`;
    },
    act(ui, d) { if (d.a === 'reg') { vs.soloReg = d.r; ui.renderView(); } },
  },

  // =========================================================== FITOSSANIDADE
  fitossanidade: {
    render(ui) {
      const m = ui.model;
      const praga = S('fitoPraga', 'mineiro');
      const P = PRAGAS.find((p) => p.k === praga);
      const series = ui.farm.regions.map((r, i) => ({ cor: r.cor, nome: r.nome, pts: m.monitoramentos(r.id).map((o) => [parseISO(o.data).getTime(), +o.campos?.[praga] || 0]) }));
      const allT = series.flatMap((s) => s.pts.map((p) => p[0]));
      const t0 = Math.min(...allT), t1 = Math.max(...allT);
      const xl = [];
      if (allT.length) for (let t = t0; t <= t1; t += 30 * 864e5) xl.push([t, MESES[new Date(t).getMonth()]]);
      return `${head('Pragas e doenças', 'Monitoramento mensal comparado ao nível de controle. Cada leitura vem da ordem "Monitoramento fitossanitário".', `<button class="btn pri" data-act="novaOS" data-tarefa="MN01" data-ruas="${ruasJ(regRuas(ui.farm.regions[0]))}">${ic('mais')} Lançar monitoramento</button>`)}
      <div class="grid3">${ui.farm.regions.map((r) => { const f = m.fitoAtual(r.id); return card(r.nome, f ? barH(PRAGAS.map((p) => ({ l: p.nome, v: f.vals[p.k] ?? 0, ref: p.nc, txt: `${num(f.vals[p.k] ?? 0, 1)}%`, cor: (f.vals[p.k] ?? 0) >= p.nc ? 'var(--bad)' : (f.vals[p.k] ?? 0) >= p.nc * 0.7 ? 'var(--warn)' : 'var(--ok)' })), { max: 40 }) + `<p class="muted small">Leitura de ${fmtDate(f.data)}. Traço = nível de controle.</p>` : '<p class="muted">Sem leitura.</p>', `<button class="mini" data-act="novaOS" data-tarefa="MN01" data-ruas="${ruasJ(regRuas(r))}">Lançar</button>`); }).join('')}</div>
      ${card('Evolução por região', `<div class="filters"><select data-chg="viewChg">${PRAGAS.map((p) => `<option value="${p.k}" ${p.k === praga ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select><span class="muted">${esc(P.un)}</span></div>${lineChart(series, { h: 220, xLabels: xl, refLines: [{ y: P.nc, l: `nível de controle ${P.nc}`, cor: 'var(--bad)' }] })}<p class="small">${series.map((s) => `<span class="sw" style="background:${s.cor}"></span>${esc(s.nome)}`).join(' ')}</p>`)}
      ${card('Níveis de controle usados', `<table class="tbl"><thead><tr><th>Alvo</th><th>Unidade</th><th>Nível</th><th>Critério</th></tr></thead><tbody>${PRAGAS.map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.un)}</td><td>${p.nc}</td><td class="small">${esc(p.desc)}</td></tr>`).join('')}</tbody></table>`)}`;
    },
    chg(ui, t) { vs.fitoPraga = t.value; ui.renderView(); },
  },

  // =========================================================== IRRIGAÇÃO
  irrigacao: {
    render(ui) {
      const m = ui.model, farm = ui.farm;
      const nivel = nivelReservatorio();
      const bombas = farm.assets.filter((a) => a.tipo === 'bomba');
      const ss = farm.regions.flatMap((r) => r.setores);
      const calc = S('irrCalc', { tmax: 31, tmin: 17, eto: '', chuva: 0 });
      const lat = ui.farmConfig().origem.lat;
      const etoH = etoHargreaves(+calc.tmax, +calc.tmin, lat, m.hoje);
      const eto = calc.eto !== '' && calc.eto != null ? +calc.eto : etoH;
      const reles = farm.assets.filter((a) => a.tipo === 'rele');
      const turnos = m.osList().filter((o) => o.tarefa === 'IR01').slice(0, 14);
      return `${head('Irrigação', 'Bombas, reservatório, setores, relés, uniformidade e cálculo da lâmina.', `<button class="btn" data-act="novaOS" data-tarefa="IR01">Lançar turno</button><button class="btn" data-act="novaOS" data-tarefa="IR02" data-ativo="FL-01">Retrolavagem</button><button class="btn pri" data-act="setModeIrr">${ic('mapa')} Ver rede no mapa</button>`)}
      <div class="grid4">
        ${card('Reservatório RES-01', `<div class="level"><span style="height:${nivel}%"></span><b>${num(nivel, 0)}%</b></div><p class="small muted">${esc(farm.assetById.get('RES-01')?.specs['Volume útil aprox.'] || '')}</p>`, `<button class="mini" data-act="ativo" data-id="RES-01">Abrir</button>`)}
        ${bombas.map((b) => { const st = m.assetStatus(b.id); const t = telemetriaBomba(b, st); return card(b.id, `<p class="small">${esc(b.nome)} · ${b.pot} cv</p><div class="chips">${chip(t.ligada ? 'Ligada' : STATUS_ATIVO[st].nome === 'Operando normal' ? 'Desligada' : STATUS_ATIVO[st].nome, t.ligada ? 'st-ok' : st === 'ok' ? 'st-cancel' : STATUS_ATIVO[st].cls)}</div><div class="gauges sm"><div><span>Vazão</span><b>${num(t.vazao, 0)}</b><small>m³/h</small></div><div><span>Pressão</span><b>${num(t.pressao, 1)}</b><small>bar</small></div><div><span>Corrente</span><b>${num(t.corrente, 0)}</b><small>A</small></div></div>${lineChart([{ cor: 'var(--agua)', area: true, pts: t.serie.map((s) => [s.h, s.vazao]) }], { h: 90, xLabels: [[0, '0h'], [12, '12h'], [23.5, '24h']] })}`, `<button class="mini" data-act="ativo" data-id="${b.id}">Abrir</button>`); }).join('')}
      </div>
      ${card('Setores', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Setor</th><th>Agora</th><th>Área</th><th>Ruas</th><th>Gotejadores</th><th>Vazão</th><th>Taxa</th><th>Tempo p/ ETc</th><th>Válvula</th><th>Relé</th><th>CUD</th></tr></thead><tbody>${ss.map((s, i) => { const reg = farm.regionById.get(s.reg); const on = setorIrrigando(i, ss.length); const c = m.cudSetor(s.id); const etc = Math.max(0, eto * (estagio(reg, m.safra) === 'P' ? m.params().kcProducao : m.params().kcFormacao) * kr(reg) - (+calc.chuva || 0) * 0.8); const tmp = etc / (taxaMmH(reg) * m.params().eficienciaIrrig); const vst = m.assetStatus(`VS-${s.id}`), rst = m.assetStatus(`RL-${s.id}`); return `<tr><td><button class="link" data-act="selSetor" data-s="${s.id}">${s.id}</button></td><td>${on ? chip('Irrigando', 'st-info') : chip('Fechado', 'st-cancel')}</td><td>${num(s.areaHa, 2)} ha</td><td>${s.rows.length}</td><td>${num(s.nGot)}</td><td>${num(s.vazao, 1)} m³/h</td><td>${num(taxaMmH(reg), 2)} mm/h</td><td>${num(tmp, 1)} h</td><td><button class="link" data-act="ativo" data-id="VS-${s.id}">VS</button> ${chip(STATUS_ATIVO[vst].nome, STATUS_ATIVO[vst].cls)}</td><td><button class="link" data-act="ativo" data-id="RL-${s.id}">RL</button> ${chip(STATUS_ATIVO[rst].nome, STATUS_ATIVO[rst].cls)}</td><td>${c ? `${num(c.val, 1)}% ${chip(c.cls, c.val >= 90 ? 'st-ok' : c.val >= 80 ? 'st-info' : 'st-warn')}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>`)}
      <div class="grid2">
        ${card('Cálculo da lâmina do dia', `<div class="form-grid">
            <label class="fld"><span>T máx (°C)</span><input type="number" step="0.1" value="${calc.tmax}" data-chg="viewChg" data-k="tmax"></label>
            <label class="fld"><span>T mín (°C)</span><input type="number" step="0.1" value="${calc.tmin}" data-chg="viewChg" data-k="tmin"></label>
            <label class="fld"><span>ETo medida (mm) — opcional</span><input type="number" step="0.1" value="${calc.eto ?? ''}" placeholder="${num(etoH, 1)}" data-chg="viewChg" data-k="eto"></label>
            <label class="fld"><span>Chuva (mm)</span><input type="number" step="0.1" value="${calc.chuva}" data-chg="viewChg" data-k="chuva"></label></div>
          ${ui.kv([['ETo (Hargreaves-Samani)', `${num(etoH, 2)} mm/dia`], ['ETo usada', `${num(eto, 2)} mm/dia`]])}
          <table class="tbl sm"><thead><tr><th>Região</th><th>Kc</th><th>Kr</th><th>ETc líquida</th><th>Tempo por setor</th></tr></thead><tbody>${farm.regions.map((reg) => { const kc = estagio(reg, m.safra) === 'P' ? m.params().kcProducao : m.params().kcFormacao; const k2 = kr(reg); const etc = Math.max(0, eto * kc * k2 - (+calc.chuva || 0) * 0.8); return `<tr><td>${esc(reg.nome)}</td><td>${kc}</td><td>${num(k2, 2)}</td><td>${num(etc, 2)} mm</td><td>${num(etc / (taxaMmH(reg) * m.params().eficienciaIrrig), 1)} h</td></tr>`; }).join('')}</tbody></table>
          <p class="muted small">ETc = ETo × Kc × Kr − 80% da chuva. Kr pela cobertura da copa (Keller). Durante o déficit hídrico programado (jul–ago) não irrigar a lavoura em produção.</p>`)}
        ${card('Relés de sinal', `<table class="tbl sm"><thead><tr><th>Relé</th><th>Status</th><th>Sinal</th><th>Bateria</th><th>Último contato</th></tr></thead><tbody>${reles.map((a) => { const st = m.assetStatus(a.id); const t = telemetriaRele(a, st); return `<tr><td><button class="link" data-act="ativo" data-id="${a.id}">${a.id}</button></td><td>${chip(t.online ? 'Online' : 'Sem sinal', t.online ? 'st-ok' : 'st-bad')}</td><td>${t.rssi ?? '—'} dBm</td><td>${t.bateria} V</td><td>${t.ultimoContato.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td></tr>`; }).join('')}</tbody></table>`)}
      </div>
      ${card('Últimos turnos de rega', `<table class="tbl click"><thead><tr><th>Data</th><th>Setores</th><th>Horas</th><th>Lâmina</th><th>Volume</th><th>Energia</th></tr></thead><tbody>${turnos.map((o) => `<tr data-act="abrirOS" data-id="${o.id}"><td>${fmtDate(o.data)}</td><td>${esc(o.campos?.setor || '')}</td><td>${o.campos?.horas ?? ''}</td><td>${o.campos?.lamina ?? ''} mm</td><td>${num(o.campos?.volume)} m³</td><td>${num(o.campos?.kwh)} kWh</td></tr>`).join('')}</tbody></table>`)}
      <p class="muted small">Telemetria de bombas, relés e nível é simulada até a integração com o controlador/CLP. A estrutura (pontos, IDs, coordenadas) já é a do inventário real gerado do traçado.</p>`;
    },
    act(ui, d) { if (d.a === 'x') ui.renderView(); },
    chg(ui, t) { const c = S('irrCalc', {}); c[t.dataset.k] = t.value; ui.renderView(); },
  },

  // =========================================================== COLHEITA
  colheita: {
    render(ui) {
      const m = ui.model, farm = ui.farm, p = m.params();
      const safras = m.safrasColhidas();
      const sr = S('colSafra', safras.find((s) => m.cargas(s).length) || m.safra - 1);
      const prodRegs = farm.regions.filter((r) => estagio(r, m.safra) === 'P');
      const prevTot = sum(prodRegs, (r) => m.previsao(r)?.total || 0);
      const lo = sum(prodRegs, (r) => m.previsao(r)?.totalLo || 0), hi = sum(prodRegs, (r) => m.previsao(r)?.totalHi || 0);
      const colTot = sum(farm.regions, (r) => m.colheitaRegiao(r, sr).sacas);
      const cont = m.contagens(null, null).slice().reverse();
      const cargas = m.cargas(sr).sort((a, b) => (a.data < b.data ? 1 : -1));
      const lotes = ui.store.all('lotes').sort((a, b) => (a.codigo < b.codigo ? 1 : -1));
      const series = prodRegs.map((r) => ({ cor: r.cor, nome: r.nome, pts: m.contagens(r.id).filter((c) => +c.safra === m.safra || +c.safra === m.safra - 1).map((c) => { const e = estimar(c, r, m.estande(r).pctFalhas, p); return [parseISO(c.data).getTime(), e ? e.scha : 0]; }) }));
      const allT = series.flatMap((s) => s.pts.map((x) => x[0]));
      const xl = [];
      if (allT.length) { const t0 = Math.min(...allT), t1 = Math.max(...allT); for (let t = t0; t <= t1; t += 61 * 864e5) xl.push([t, `${MESES[new Date(t).getMonth()]}/${String(new Date(t).getFullYear()).slice(2)}`]); }
      return `${head('Colheita e previsão', 'Estimativa por contagem, produção por rua, cargas, lotes e máquinas.', `<button class="btn" data-act="novaContagem">${ic('mais')} Nova contagem</button><button class="btn" data-act="novaCarga">${ic('mais')} Registrar carga</button><button class="btn pri" data-act="viewAct" data-a="modo">${ic('mapa')} Modo colheita no mapa</button>`)}
      <div class="tiles">
        <div class="tile"><span>Previsão ${m.safra}</span><b>${num(prevTot, 0)} sc</b><small>IC 95%: ${num(lo, 0)} a ${num(hi, 0)} sc</small></div>
        <div class="tile"><span>Receita prevista</span><b>${brl(prevTot * p.precoSaca)}</b><small>a ${brl(p.precoSaca)}/saca</small></div>
        <div class="tile"><span>Colhido em ${sr}</span><b>${num(colTot, 0)} sc</b><small>${num(colTot / (sum(prodRegs, (r) => r.areaHa) || 1), 1)} sc/ha nas áreas em produção</small></div>
        <div class="tile"><span>Rendimento usado</span><b>${p.rendimento} L/sc</b><small>${p.frutosPorLitro} frutos por litro</small></div>
      </div>
      ${card('Por região', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Região</th><th>Área</th><th>Estágio</th><th>Última contagem</th><th>Previsão sc/ha</th><th>IC 95%</th><th>Previsão total</th><th>Colhido ${sr}</th><th>Florada</th><th>Maturação prevista</th></tr></thead><tbody>${farm.regions.map((r) => { const pv = m.previsao(r); const c = m.colheitaRegiao(r, sr); const fl = m.floradaPrincipal(r); return `<tr><td><button class="link" data-act="selRegiao" data-r="${r.id}">${esc(r.nome)}</button></td><td>${num(r.areaHa, 1)} ha</td><td>${estagio(r, m.safra) === 'P' ? 'Produção' : 'Formação'}</td><td>${pv ? `${fmtDate(pv.data)} · ${esc(pv.fase || '')}` : '—'}</td><td><b>${pv ? num(pv.scha, 1) : '—'}</b></td><td>${pv ? `${num(pv.ciLo, 1)}–${num(pv.ciHi, 1)}` : '—'}</td><td>${pv ? num(pv.total, 0) + ' sc' : '—'}</td><td>${c.sacas ? `${num(c.sacas, 0)} sc · ${num(c.schaTotal, 1)} sc/ha` : '—'}</td><td>${fl ? fmtDate(fl) : '—'}</td><td>${fl ? fmtDate(m.maturacaoPrevista(r)) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`, `<select data-chg="viewChg" data-k="colSafra">${safras.map((s) => `<option value="${s}" ${s === sr ? 'selected' : ''}>Colheita ${s}</option>`).join('')}</select>`)}
      <div class="grid2">
        ${card('Evolução das estimativas (sc/ha)', `${lineChart(series, { h: 200, xLabels: xl })}<p class="small">${series.map((s) => `<span class="sw" style="background:${s.cor}"></span>${esc(s.nome)}`).join(' ')}</p><p class="muted small">Cada ponto é uma contagem. Compare com a colheita registrada no relatório "Estimativa × realizado".</p>`)}
        ${card('Contagens', cont.length ? `<ul class="list">${cont.slice(0, 12).map((c) => { const r = farm.regionById.get(c.reg); const e = r ? estimar(c, r, m.estande(r).pctFalhas, p) : null; return `<li><button data-act="abrirContagem" data-id="${c.id}"><span>${fmtDate(c.data)}</span><b>${esc(r?.nome || c.reg)} · ${esc(c.fase || '')}${demoTag(c)}</b><span>${e ? `${num(e.scha, 1)} sc/ha · ${e.n} plantas` : ''}</span></button></li>`; }).join('')}</ul>` : '<p class="muted">Nenhuma contagem.</p>', `<button class="mini" data-act="novaContagem">Nova</button>`)}
      </div>
      <div class="grid2">
        ${card(`Cargas da colheita ${sr}`, cargas.length ? `<div class="tbl-wrap"><table class="tbl click sm"><thead><tr><th>Data</th><th>Região</th><th>Ruas</th><th>Passada</th><th>Litros</th><th>Verde</th><th>Lote</th></tr></thead><tbody>${cargas.slice(0, 60).map((c) => `<tr data-act="abrirCarga" data-id="${c.id}"><td>${fmtDate(c.data)}</td><td>${c.reg}</td><td class="mono">${esc(c.ruas)}</td><td>${esc(c.passada || '')}</td><td>${num(c.litros)}</td><td>${c.maturacao?.verde ?? '—'}%</td><td>${esc(c.lote || '')}</td></tr>`).join('')}</tbody></table></div>${cargas.length > 60 ? `<p class="muted small">${cargas.length} cargas no total. Veja todas no relatório de colheita.</p>` : ''}` : '<p class="muted">Nenhuma carga registrada nesta safra.</p>', `<button class="mini" data-act="novaCarga">Registrar</button>`)}
        ${card('Lotes', lotes.length ? `<table class="tbl click sm"><thead><tr><th>Lote</th><th>Origem</th><th>Sacas</th><th>Processo</th><th>Classificação</th></tr></thead><tbody>${lotes.slice(0, 30).map((l) => `<tr data-act="abrirLote" data-id="${l.id}"><td class="mono">${esc(l.codigo)}</td><td>${esc(l.origem)}</td><td>${num(l.sacas)}</td><td>${esc(l.processo || '')}</td><td class="small">${esc(l.classificacao || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhum lote.</p>', `<button class="mini" data-act="novoLote">Novo</button>`)}
      </div>`;
    },
    act(ui, d) { if (d.a === 'modo') { ui.go('mapa'); ui.setMode('colheita'); } },
    chg(ui, t) { vs[t.dataset.k] = +t.value; ui.renderView(); },
  },

  // =========================================================== EQUIPAMENTOS
  equipamentos: {
    render(ui) {
      const eqs = ui.model.equipList();
      return `${head('Máquinas e GPS', 'Cadastro, posição e operação de cada máquina. A posição vem do rastreador, de um arquivo de trilha ou da simulação.', `<button class="btn pri" data-act="novoEquip">${ic('mais')} Cadastrar máquina</button>`)}
      ${card('Agora', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Máquina</th><th>Tipo</th><th>Estado</th><th>Velocidade</th><th>Rua</th><th>Operação</th><th>Fonte GPS</th><th></th></tr></thead><tbody id="eqRows">${eqRows(ui)}</tbody></table></div>`)}
      <div class="grid2">
        ${card('Cadastro', `<table class="tbl click sm"><thead><tr><th>ID</th><th>Nome</th><th>Horímetro</th><th>Consumo</th><th>Custo/h</th><th>Rastreador</th></tr></thead><tbody>${eqs.map((e) => `<tr data-act="abrirEquip" data-id="${e.id}"><td class="mono">${e.id}</td><td>${esc(e.nome)}${demoTag(e)}</td><td>${num(e.horimetro)} h</td><td>${e.consumo || '—'} L/h</td><td>${brl(e.custoHora)}</td><td class="mono">${esc(e.rastreador || '')}</td></tr>`).join('')}</tbody></table>`)}
        ${card('Integração do GPS', `<ol class="steps"><li><b>Arquivo de trilha</b>: na gaveta da máquina, "Importar trilha" aceita GPX, CSV (latitude; longitude; data/hora) e NMEA ($GPRMC/$GPGGA) exportados do rastreador ou do monitor da colhedora. A trilha é reproduzida no mapa e as ruas percorridas são identificadas.</li><li><b>Tempo real</b>: a versão instalada na fazenda pode receber posições do servidor de rastreamento chamando <code>fazendaGPS.push({ id, lat, lon, vel })</code> a cada leitura. O <code>id</code> pode ser o código da máquina ou do rastreador.</li><li><b>Identificação de rua</b>: cada posição é cruzada com o traçado; a rua aparece na gaveta e nos relatórios.</li></ol><p class="muted small">Dentro do claude.ai a página não pode abrir conexões para servidores externos; o tempo real funciona na cópia HTML aberta no navegador da fazenda.</p>`)}
      </div>`;
    },
    live(ui) { const el = document.getElementById('eqRows'); if (el) el.innerHTML = eqRows(ui); },
  },

  // =========================================================== MANUTENÇÃO
  manutencao: {
    render(ui) {
      const f = S('mtFiltro', 'abertas');
      const all = ui.store.all('manut').sort((a, b) => (a.abertoEm < b.abertoEm ? 1 : -1));
      const l = f === 'abertas' ? all.filter((x) => x.status !== 'concluida') : all;
      return `${head('Manutenção', 'Cada ocorrência fica presa a um ativo (bomba, válvula, relé, cruzeta) ou a um ponto exato da rua, com coordenada.', `<button class="btn pri" data-act="novaManut">${ic('mais')} Nova ocorrência</button>`)}
      <div class="tabs big"><button class="${f === 'abertas' ? 'on' : ''}" data-act="viewAct" data-a="f" data-f="abertas">Abertas (${all.filter((x) => x.status !== 'concluida').length})</button><button class="${f === 'todas' ? 'on' : ''}" data-act="viewAct" data-a="f" data-f="todas">Todas (${all.length})</button></div>
      <div class="oslist">${l.map((x) => { const a = x.ativo ? ui.farm.assetById.get(x.ativo) : null; const X = a ? a.x : x.x, Y = a ? a.y : x.y; return `<article class="os-card pri-${(x.prioridade || '').toLowerCase()}"><div class="os-top"><b>${esc(x.titulo)}</b>${chip(x.prioridade || '', x.prioridade === 'Alta' ? 'st-bad' : x.prioridade === 'Média' ? 'st-warn' : 'st-info')}${chip(x.status, x.status === 'concluida' ? 'st-ok' : 'st-warn')}${demoTag(x)}</div><p class="small">${esc(x.descricao || '')}</p><p class="small muted">${fmtDate(x.abertoEm)} · ${esc(x.tipo || '')} · ${a ? esc(a.id) : x.rua ? `${esc(x.rua)}, ${num(x.metro, 0)} m` : ''}${X != null ? ` · <span class="mono">${geo.fmt(X, Y)}</span>` : ''}</p><div class="os-act"><button class="mini" data-act="manut" data-id="${x.id}">Ver no mapa</button><button class="mini" data-act="abrirManut" data-id="${x.id}">Atualizar</button></div></article>`; }).join('') || '<p class="muted">Nenhuma ocorrência.</p>'}</div>`;
    },
    act(ui, d) { if (d.a === 'f') { vs.mtFiltro = d.f; ui.renderView(); } },
  },

  // =========================================================== LEVANTAMENTO
  inventario: {
    render(ui) {
      const farm = ui.farm, m = ui.model;
      const q = S('invQ', ''), tp = S('invTipo', '');
      const tipos = [...new Set(farm.assets.map((a) => a.sub || a.tipo))].sort();
      const lista = farm.assets.filter((a) => (!tp || (a.sub || a.tipo) === tp) && (!q || a.id.toUpperCase().includes(q.toUpperCase()) || a.nome.toUpperCase().includes(q.toUpperCase())));
      const regRows = farm.regions.map((r) => { const e = m.estande(r); const cz = farm.assets.filter((a) => a.reg === r.id && a.tipo === 'cruzeta' && a.rua); return `<tr><td>${esc(r.nome)}</td><td>${num(r.areaHa, 2)}</td><td>${r.nRows}</td><td>${num(r.compRuas / 1000, 2)}</td><td>${r.espLinha} × ${r.espPlanta}</td><td>${num(r.plantas)}</td><td>${num(r.plantasHa, 0)}</td><td>${num(e.falhas + e.mortas)}</td><td>${num(r.gotejadores)}</td><td>${cz.filter((a) => a.sub === 'Cruzeta').length}</td><td>${cz.filter((a) => a.sub === 'Tê').length}</td><td>${r.setores.length}</td></tr>`; }).join('');
      const t = farm.totais;
      const pipes = [...groupBy(farm.pipes, (p) => p.tipo)].map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v[0].material)}</td><td>${esc(v[0].dn)}</td><td>${num(sum(v, (p) => p.len), 0)} m</td></tr>`).join('') + `<tr><td>laterais (tubo gotejador)</td><td>PEBD</td><td>16 mm</td><td>${num(t.compRuas, 0)} m</td></tr>`;
      return `${head('Levantamento', 'Tudo o que existe na lavoura, contado a partir do traçado: ruas, covas, gotejadores, cruzetas, válvulas, relés e tubulações, com coordenadas.', `<button class="btn" data-act="relatorio" data-id="invent">${ic('relat')} Relatório</button><button class="btn pri" data-act="viewAct" data-a="csv">${ic('baixar')} Exportar CSV</button>`)}
      <div class="tiles">
        <div class="tile"><span>Área</span><b>${num(t.areaHa, 2)} ha</b><small>${farm.regions.length} regiões · ${t.setores} setores</small></div>
        <div class="tile"><span>Ruas</span><b>${num(t.ruas)}</b><small>${num(t.compRuas / 1000, 1)} km de linhas</small></div>
        <div class="tile"><span>Covas</span><b>${num(t.plantas)}</b><small>${num(t.plantas / t.areaHa, 0)} por ha</small></div>
        <div class="tile"><span>Gotejadores</span><b>${num(t.gotejadores)}</b><small>${num(farm.cruzetas.length)} cruzetas e tês</small></div>
      </div>
      ${card('Por região', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Região</th><th>ha</th><th>Ruas</th><th>km</th><th>Espaç. (m)</th><th>Covas</th><th>Covas/ha</th><th>Falhas</th><th>Gotejadores</th><th>Cruzetas</th><th>Tês</th><th>Setores</th></tr></thead><tbody>${regRows}</tbody></table></div>`)}
      ${card('Tubulações', `<table class="tbl sm"><thead><tr><th>Tipo</th><th>Material</th><th>Diâmetro</th><th>Comprimento</th></tr></thead><tbody>${pipes}</tbody></table>`)}
      ${card(`Ativos (${lista.length})`, `<div class="filters"><input type="search" placeholder="Filtrar por ID ou nome" value="${esc(q)}" data-chg="viewChg" data-k="invQ"><select data-chg="viewChg" data-k="invTipo"><option value="">Todos os tipos</option>${tipos.map((x) => `<option ${x === tp ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <div class="tbl-wrap"><table class="tbl click sm"><thead><tr><th>ID</th><th>Tipo</th><th>Nome</th><th>Setor</th><th>Status</th><th>Coordenada</th></tr></thead><tbody>${lista.slice(0, 400).map((a) => { const st = m.assetStatus(a.id); return `<tr data-act="ativo" data-id="${a.id}"><td class="mono">${a.id}</td><td>${esc(a.sub || a.tipo)}</td><td>${esc(a.nome)}</td><td>${esc(a.setor || '')}</td><td>${chip(STATUS_ATIVO[st].nome, STATUS_ATIVO[st].cls)}</td><td class="mono small">${geo.fmt(a.x, a.y)}</td></tr>`; }).join('')}</tbody></table></div>${lista.length > 400 ? `<p class="muted small">Mostrando 400 de ${lista.length}. Use o filtro ou exporte o CSV.</p>` : ''}`)}`;
    },
    act(ui, d) {
      if (d.a === 'csv') {
        const m = ui.model;
        const rows = ui.farm.assets.map((a) => { const [la, lo] = geo.toLatLon(a.x, a.y); return { id: a.id, tipo: a.sub || a.tipo, nome: a.nome, regiao: a.reg || '', setor: a.setor || '', rua: a.rua || '', status: m.assetStatus(a.id), latitude: la.toFixed(7), longitude: lo.toFixed(7) }; });
        const ruas = ui.farm.rows.map((r) => { const [la1, lo1] = geo.toLatLon(r.x1, r.y1); const [la2, lo2] = geo.toLatLon(r.x2, r.y2); return { id: r.id, tipo: 'rua', nome: `Rua ${r.idx}`, regiao: r.reg, setor: r.setor, rua: r.id, status: '', latitude: la1.toFixed(7), longitude: lo1.toFixed(7), lat_fim: la2.toFixed(7), lon_fim: lo2.toFixed(7), comprimento_m: r.len.toFixed(1), covas: r.nPl, gotejadores: r.nGot }; });
        baixar(`levantamento-${isoDate()}.csv`, toCSV([...rows.map((x) => ({ ...x, lat_fim: '', lon_fim: '', comprimento_m: '', covas: '', gotejadores: '' })), ...ruas]), 'text/csv').then((s) => s === 'salvo' && ui.toast('CSV gerado.'));
      }
    },
    chg(ui, t) { vs[t.dataset.k] = t.value; ui.renderView(); },
  },

  // =========================================================== RELATÓRIOS
  relatorios: {
    render() {
      const g = groupBy(RELATORIOS, (r) => r.grupo);
      return `${head('Relatórios', 'Escolha o relatório, ajuste os filtros e exporte em CSV (planilha) ou HTML (para imprimir ou enviar).')}
      ${[...g].map(([k, v]) => `<h2 class="sec">${esc(k)}</h2><div class="grid3">${v.map((r) => `<button class="rep" data-act="relatorio" data-id="${r.id}">${ic('relat')}<b>${esc(r.nome)}</b><span>${esc(r.desc)}</span></button>`).join('')}</div>`).join('')}`;
    },
  },

  // =========================================================== AJUSTES
  ajustes: {
    render(ui) {
      const cfg = ui.farmConfig();
      const p = ui.model.params();
      const precos = ui.model.precos();
      const conf = S('ajConf', '');
      const sm = ui.store.mode;
      return `${head('Ajustes', 'Fazenda, regiões, limites reais, parâmetros agronômicos, preços e dados.')}
      ${card('Fazenda', `<form class="form-grid" data-form="faz">
        <label class="fld"><span>Nome</span><input name="nome" value="${esc(cfg.nome)}" required></label>
        <label class="fld"><span>Município</span><input name="municipio" value="${esc(cfg.municipio || '')}"></label>
        <label class="fld"><span>Latitude de referência</span><input name="lat" type="number" step="0.000001" value="${cfg.origem.lat}"></label>
        <label class="fld"><span>Longitude de referência</span><input name="lon" type="number" step="0.000001" value="${cfg.origem.lon}"></label>
        <div class="form-act"><button class="btn pri" data-act="viewAct" data-a="salvarFaz">Salvar</button></div></form>`)}
      ${card('Regiões', `<p class="muted small">Alterar espaçamento, ângulo, setores ou área regera as ruas, as plantas, as cruzetas e o inventário. Os registros por rua usam o número da rua: mudar o traçado depois de lançar dados pode deslocar o histórico.</p>
        <div class="tbl-wrap"><table class="tbl edit"><thead><tr><th>ID</th><th>Nome</th><th>Cultivar</th><th>Plantio</th><th>Área alvo (ha)</th><th>Entrelinha (m)</th><th>Entre plantas (m)</th><th>Ângulo das ruas (°)</th><th>Setores</th><th>Gotejador (m)</th><th>Vazão (L/h)</th><th>Cor</th></tr></thead><tbody>${cfg.regioes.map((r, i) => `<tr data-i="${i}"><td class="mono">${r.id}</td><td><input data-f="nome" value="${esc(r.nome)}"></td><td><input data-f="variedade" list="dlVar" value="${esc(r.variedade)}"></td><td><input data-f="plantio" type="number" value="${r.plantio}"></td><td><input data-f="alvoHa" type="number" step="0.01" value="${r.polyReal ? '' : r.alvoHa}" ${r.polyReal ? 'disabled placeholder="limite real"' : ''}></td><td><input data-f="espLinha" type="number" step="0.05" value="${r.espLinha}"></td><td><input data-f="espPlanta" type="number" step="0.05" value="${r.espPlanta}"></td><td><input data-f="angulo" type="number" step="1" value="${r.angulo}"></td><td><input data-f="setores" type="number" min="1" max="12" value="${r.setores}"></td><td><input data-f="gotEsp" type="number" step="0.05" value="${r.gotEsp}"></td><td><input data-f="gotVazao" type="number" step="0.1" value="${r.gotVazao}"></td><td><input data-f="cor" type="color" value="${r.cor}"></td></tr>`).join('')}</tbody></table></div>
        <datalist id="dlVar">${VARIEDADES.map((v) => `<option value="${esc(v.nome)}">`).join('')}</datalist>
        <div class="form-act"><button class="btn pri" data-act="viewAct" data-a="salvarReg">Salvar e regerar ruas</button><button class="btn" data-act="viewAct" data-a="addReg">${ic('mais')} Adicionar região</button></div>`)}
      ${card('Limites reais (GeoJSON ou KML)', `<p class="small">Exporte os talhões do Google Earth (KML), do QGIS ou do software de topografia (GeoJSON) com um polígono por região. O sistema converte as coordenadas, gera as ruas no ângulo de cada região e recalcula o inventário.</p>
        <div class="form-act"><button class="btn" data-act="viewAct" data-a="importLim">${ic('baixar')} Escolher arquivo</button>${cfg.regioes.some((r) => r.polyReal) ? `<button class="btn" data-act="viewAct" data-a="limDemo">Voltar aos polígonos de exemplo</button>` : ''}</div>
        <div id="limRes">${vs.limites ? limitesHTML(ui) : ''}</div>`)}
      ${card('Parâmetros agronômicos', `<form class="form-grid" data-form="par">
        ${[['v2', 'Saturação por bases desejada (V2, %)'], ['prnt', 'PRNT do calcário (%)'], ['fracaoCalagem', 'Fração da área que recebe calcário (0–1)'], ['rendimento', 'Litros colhidos por saca beneficiada'], ['frutosPorLitro', 'Frutos por litro'], ['precoSaca', 'Preço da saca (R$)'], ['custoHoraPessoa', 'Custo da mão de obra (R$/h/pessoa)'], ['kcProducao', 'Kc lavoura em produção'], ['kcFormacao', 'Kc lavoura em formação'], ['eficienciaIrrig', 'Eficiência da irrigação (0–1)']].map(([k, l]) => `<label class="fld"><span>${l}</span><input name="${k}" type="number" step="any" value="${p[k]}"></label>`).join('')}
        <label class="fld wide"><span>Tabelas de N, P₂O₅ e K₂O por classe de produtividade (JSON)</span><textarea name="tabelas" rows="6" class="mono">${esc(JSON.stringify({ classesProd: p.classesProd, tabN: p.tabN, tabP: p.tabP, tabK: p.tabK }, null, 1))}</textarea></label>
        <div class="form-act"><button class="btn pri" data-act="viewAct" data-a="salvarPar">Salvar parâmetros</button><button class="btn" data-act="viewAct" data-a="parPadrao">Restaurar padrão</button></div></form>`)}
      ${card('Preços de insumos', `<div class="tbl-wrap"><table class="tbl edit sm"><thead><tr><th>Insumo</th><th>Categoria</th><th>Unidade</th><th>Preço (R$)</th></tr></thead><tbody>${ui.model.insumos().map((i) => `<tr><td>${esc(i.nome)}</td><td>${esc(i.cat)}</td><td>${esc(i.un)}</td><td><input data-preco="${i.id}" type="number" step="0.01" value="${precos[i.id]}"></td></tr>`).join('')}</tbody></table></div><div class="form-act"><button class="btn pri" data-act="viewAct" data-a="salvarPrecos">Salvar preços</button></div><p class="muted small">Preços de referência para cálculo de custo. Atualize com as notas de compra.</p>`)}
      ${card('Dados', `${ui.kv([['Onde os dados ficam', sm === 'compartilhado' ? 'Banco compartilhado do artifact: todos com acesso de edição veem e lançam.' : sm === 'conectando' ? 'Conectando…' : 'Somente neste navegador. Faça backup com frequência.'], ['Registros salvos', `${ui.store.data.os.size} ordens · ${ui.store.data.colheita.size} cargas · ${ui.store.data.contagens.size} contagens · ${ui.store.data.manut.size} manutenções · ${ui.store.data.plantas.size} ruas com registro pé a pé`], ['Dados de exemplo', ui.store.demoOn() ? 'Visíveis' : 'Ocultos']])}
        <div class="form-act"><button class="btn" data-act="viewAct" data-a="backup">${ic('baixar')} Exportar backup (JSON)</button><button class="btn" data-act="viewAct" data-a="restore">Importar backup</button><button class="btn ${ui.store.demoOn() ? 'pri' : ''}" data-act="viewAct" data-a="demo">${ui.store.demoOn() ? 'Ocultar dados de exemplo e começar com dados reais' : 'Mostrar dados de exemplo'}</button></div>
        ${conf === 'apagar' ? `<div class="confirm"><p><b>Apagar todos os registros salvos?</b> Ordens, cargas, contagens, análises, manutenções e registros pé a pé serão removidos. Não dá para desfazer.</p><button class="btn bad" data-act="viewAct" data-a="apagarSim">Apagar tudo</button><button class="btn" data-act="viewAct" data-a="apagarNao">Cancelar</button></div>` : `<button class="btn ghost bad" data-act="viewAct" data-a="apagar">Apagar todos os registros…</button>`}`)}`;
    },
    async act(ui, d) {
      const st = ui.store;
      const cfgAtual = () => ({ ...(st.config().fazenda || {}) });
      try {
        if (d.a === 'salvarFaz') {
          const f = new FormData(document.querySelector('[data-form="faz"]'));
          await st.setConfig({ fazenda: { ...cfgAtual(), nome: f.get('nome'), municipio: f.get('municipio'), origem: { lat: +f.get('lat'), lon: +f.get('lon') } } });
          ui.toast('Fazenda salva.');
        }
        if (d.a === 'salvarReg' || d.a === 'addReg') {
          const regs = ui.farmConfig().regioes.map((r) => ({ ...r }));
          document.querySelectorAll('.tbl.edit tr[data-i]').forEach((tr) => {
            const r = regs[+tr.dataset.i];
            tr.querySelectorAll('input[data-f]').forEach((inp) => { const k = inp.dataset.f; if (inp.disabled) return; r[k] = inp.type === 'number' ? +inp.value : inp.value; });
          });
          if (d.a === 'addReg') {
            const n = regs.length + 1;
            const b = ui.farm.bounds;
            regs.push({ id: `R${n}`, nome: `Região ${n}`, cor: corCat(n + 3), alvoHa: 20, angulo: 0, espLinha: 3.8, espPlanta: 0.6, variedade: VARIEDADES[0].nome, plantio: new Date().getFullYear(), setores: 2, gotEsp: 0.5, gotVazao: 1.6, poly: [[b.x1 + 80, b.y0], [b.x1 + 580, b.y0], [b.x1 + 580, b.y0 + 400], [b.x1 + 80, b.y0 + 400]] });
          }
          await st.setConfig({ fazenda: { ...cfgAtual(), regioes: regs } });
          ui.toast('Regiões salvas. Ruas regeradas.');
        }
        if (d.a === 'importLim') {
          const f = await lerArquivo('.geojson,.json,.kml');
          if (!f) return;
          let polys = [];
          if (/\.kml$/i.test(f.nome) || f.texto.includes('<kml')) polys = polysFromKML(f.texto);
          else polys = polysFromGeoJSON(JSON.parse(f.texto));
          if (!polys.length) { ui.toast('Nenhum polígono encontrado no arquivo.'); return; }
          vs.limites = polys;
          ui.renderView();
        }
        if (d.a === 'aplicarLim') {
          const polys = vs.limites;
          const map = [...document.querySelectorAll('[data-lim]')].map((s) => s.value);
          const all = polys.flatMap((p) => p.ring);
          const lat0 = mean(all.map((c) => c[1])), lon0 = mean(all.map((c) => c[0]));
          geo.setOrigin({ lat: lat0, lon: lon0 });
          const regs = ui.farmConfig().regioes.map((r) => ({ ...r }));
          polys.forEach((p, i) => {
            const rid = map[i];
            if (!rid) return;
            const poly = p.ring.map(([lon, lat]) => geo.fromLatLon(lat, lon));
            if (poly.length > 3 && poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1]) poly.pop();
            let r = regs.find((x) => x.id === rid);
            if (!r) { r = { id: rid, nome: p.nome || `Região ${rid.slice(1)}`, cor: corCat(regs.length + 3), angulo: 0, espLinha: 3.8, espPlanta: 0.6, variedade: VARIEDADES[0].nome, plantio: new Date().getFullYear() - 3, setores: 3, gotEsp: 0.5, gotVazao: 1.6 }; regs.push(r); }
            r.poly = poly; r.polyReal = true; r.alvoHa = null;
          });
          // reposiciona estruturas centrais no centro das regiões importadas
          const xs = regs.flatMap((r) => r.poly.map((q) => q[0])), ys = regs.flatMap((r) => r.poly.map((q) => q[1]));
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          await st.setConfig({ fazenda: { ...cfgAtual(), regioes: regs, origem: { lat: lat0, lon: lon0 }, reservatorio: { ...CONFIG_PADRAO.reservatorio, x: cx - 60, y: cy }, casaBombas: { x: cx + 10, y: cy }, sede: { x: cx + 120, y: cy + 30 }, acude: null, app: null } });
          vs.limites = null;
          ui.toast('Limites aplicados. Ruas geradas a partir dos polígonos reais.');
        }
        if (d.a === 'limDemo') { const c = cfgAtual(); delete c.regioes; delete c.reservatorio; delete c.casaBombas; delete c.sede; delete c.acude; delete c.app; delete c.origem; await st.setConfig({ fazenda: c }); ui.toast('Polígonos de exemplo restaurados.'); }
        if (d.a === 'salvarPar' || d.a === 'parPadrao') {
          if (d.a === 'parPadrao') { await st.setConfig({ params: {} }); ui.toast('Parâmetros padrão restaurados.'); }
          else {
            const f = new FormData(document.querySelector('[data-form="par"]'));
            const params = {};
            for (const k of ['v2', 'prnt', 'fracaoCalagem', 'rendimento', 'frutosPorLitro', 'precoSaca', 'custoHoraPessoa', 'kcProducao', 'kcFormacao', 'eficienciaIrrig']) params[k] = +f.get(k);
            let tab;
            try { tab = JSON.parse(f.get('tabelas')); } catch { ui.toast('As tabelas não são um JSON válido.'); return; }
            await st.setConfig({ params: { ...params, ...tab } });
            ui.toast('Parâmetros salvos.');
          }
        }
        if (d.a === 'salvarPrecos') {
          const pr = {};
          document.querySelectorAll('[data-preco]').forEach((i) => (pr[i.dataset.preco] = +i.value));
          await st.setConfig({ precos: pr });
          ui.toast('Preços salvos.');
        }
        if (d.a === 'backup') { const s = await baixar(`fazenda-backup-${isoDate()}.json`, JSON.stringify(st.exportAll(), null, 1), 'application/json'); if (s === 'salvo') ui.toast('Backup gerado.'); }
        if (d.a === 'restore') {
          const f = await lerArquivo('.json');
          if (!f) return;
          let obj;
          try { obj = JSON.parse(f.texto); } catch { ui.toast('Arquivo inválido.'); return; }
          await st.importAll(obj);
          ui.toast('Backup importado.');
        }
        if (d.a === 'demo') { await st.setConfig({ demoOff: st.demoOn() }); ui.toast(st.demoOn() ? 'Exemplos visíveis.' : 'Exemplos ocultos. Comece a lançar os dados reais.'); }
        if (d.a === 'apagar') vs.ajConf = 'apagar';
        if (d.a === 'apagarNao') vs.ajConf = '';
        if (d.a === 'apagarSim') {
          vs.ajConf = '';
          for (const c of ['os', 'solo', 'contagens', 'colheita', 'lotes', 'manut', 'ativos', 'plantas', 'equip']) for (const id of [...st.data[c].keys()]) await st.del(c, id);
          ui.toast('Registros apagados.');
        }
      } catch (e) { console.error(e); ui.toast('Não foi possível concluir: ' + (e.message || e.code || 'erro')); }
      ui.renderView();
    },
  },
};

function limitesHTML(ui) {
  const regs = ui.farmConfig().regioes;
  return `<table class="tbl sm"><thead><tr><th>Polígono do arquivo</th><th>Vértices</th><th>Usar como</th></tr></thead><tbody>${vs.limites.map((p, i) => `<tr><td>${esc(p.nome || `Polígono ${i + 1}`)}</td><td>${p.ring.length}</td><td><select data-lim="${i}"><option value="">Ignorar</option>${regs.map((r, k) => `<option value="${r.id}" ${k === i ? 'selected' : ''}>${esc(r.id)} · ${esc(r.nome)}</option>`).join('')}<option value="R${regs.length + 1 + i}">Nova região</option></select></td></tr>`).join('')}</tbody></table><div class="form-act"><button class="btn pri" data-act="viewAct" data-a="aplicarLim">Aplicar limites</button></div>`;
}

function eqRows(ui) {
  return ui.model.equipList().map((e) => {
    const mc = ui.sim.machines.find((x) => x.id === e.id);
    return `<tr><td><button class="link" data-act="equip" data-id="${e.id}">${esc(e.nome)}</button></td><td>${esc(TIPOS_EQUIP[e.tipo]?.nome || e.tipo)}</td><td>${chip(mc?.estado || 'parado', !mc || mc.estado === 'parado' ? 'st-cancel' : 'st-ok')}</td><td>${num(mc?.vel || 0, 1)} km/h</td><td>${mc?.rua ? `<button class="link" data-act="rua" data-id="${mc.rua}">${mc.rua}</button>` : '—'}</td><td>${mc?.tarefa ? esc(TAREFA[mc.tarefa]?.nome || mc.tarefa) : '—'}</td><td>${esc(mc?.fonte || '—')}</td><td><button class="mini" data-act="equip" data-id="${e.id}">Mapa</button></td></tr>`;
  }).join('');
}

function osCard(ui, o) {
  const t = TAREFA[o.tarefa];
  const c = ui.model.custo(o);
  const next = o.status === 'planejada' ? ['execucao', 'Iniciar'] : o.status === 'execucao' ? ['concluida', 'Concluir'] : null;
  return `<article class="os-card"><div class="os-top"><span class="os-fase" style="background:${FASE[t?.fase]?.cor || '#888'}"></span><b>${esc(t?.nome || o.tarefa)}</b>${chip(STATUS_OS[o.status]?.nome || o.status, STATUS_OS[o.status]?.cls)}${demoTag(o)}</div>
    <p class="small">${esc(Object.entries(o.ruas || {}).map(([k, v]) => `${k}: ruas ${v}`).join(' · ') || (o.ativo ? `Ativo ${o.ativo}` : ''))}</p>
    <p class="small muted">${num(ui.model.areaOS(o), 1)} ha · ${esc(o.equip || 'sem máquina')} · ${esc(o.operador || '')} · ${brl(c.total)}</p>
    <div class="os-act"><button class="mini" data-act="abrirOS" data-id="${o.id}">Abrir</button>${o.ruas ? `<button class="mini" data-act="selRuas" data-ruas="${ruasJ(o.ruas)}">Ver no mapa</button>` : ''}${next ? `<button class="mini pri" data-act="viewAct" data-a="osSt" data-id="${o.id}" data-st="${next[0]}">${next[1]}</button>` : ''}</div></article>`;
}

function clsCor(i, inverso) {
  const k = inverso ? 4 - i : i;
  return k <= 0 ? 'st-bad' : k === 1 ? 'st-warn' : k === 2 ? 'st-info' : 'st-ok';
}
