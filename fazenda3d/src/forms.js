// Formulários (modais): ordem de serviço, contagem, carga, lote, manutenção,
// análise de solo, máquina, status de ativo, relatórios e importação de trilha.
import { TAREFAS, TAREFA, FASES, FASE, STATUS_OS, STATUS_ATIVO, TIPOS_EQUIP } from './catalog.js';
import { ATRIBUTOS, estimar, cud, interpretar } from './agro.js';
import { esc, num, brl, fmtDate, uid, isoDate, expandRanges, compressRanges, sum, anoSafra } from './util.js';
import { ic, chip, baixar, lerArquivo } from './dom.js';
import { RELATORIOS, relatorioHTML, documentoHTML } from './reports.js';
import { toCSV } from './util.js';

const fld = (l, inner, cls = '') => `<label class="fld ${cls}"><span>${l}</span>${inner}</label>`;
const inp = (name, v, attrs = '') => `<input name="${name}" value="${esc(v ?? '')}" ${attrs}>`;
const sel = (name, opts, v, attrs = '') => `<select name="${name}" ${attrs}>${opts.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v ?? '') ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;

const limpo = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));
function ruasTexto(obj) { return Object.entries(obj || {}).map(([k, v]) => `${k}: ${v}`).join('\n'); }
function parseRuas(txt, farm) {
  const out = {};
  for (const line of String(txt || '').split(/[\n;]+/)) {
    const m = line.trim().match(/^(R\d+)\s*[:=]?\s*(.*)$/i);
    if (!m) continue;
    const reg = m[1].toUpperCase();
    const R = farm.regionById.get(reg);
    if (!R) continue;
    let rg = m[2].trim();
    if (!rg || /^tod/i.test(rg)) rg = `1-${R.rows.length}`;
    const nums = expandRanges(rg).filter((n) => n >= 1 && n <= R.rows.length);
    if (nums.length) out[reg] = compressRanges(nums);
  }
  return out;
}

export class Forms {
  constructor(ui) { this.ui = ui; }
  get m() { return this.ui.model; }
  get farm() { return this.ui.farm; }

  // ================================================================ ORDEM DE SERVIÇO
  os(base = {}) {
    base = limpo(base);
    const ui = this.ui, m = this.m;
    const editar = !!base.id && m.osList().some((o) => o.id === base.id);
    const o = { status: 'planejada', data: m.hoje, pessoas: 1, horas: '', insumos: [], campos: {}, ...base };
    if (!o.tarefa) o.tarefa = 'GN01';
    if (o.tarefa === 'ES01') { this.contagem({ reg: Object.keys(o.ruas || {})[0] }); return; }
    const fase = TAREFA[o.tarefa]?.fase || 'CON';
    const box = ui.modal(`<form id="fOS" class="mform">
      <div class="m-h"><div><div class="dr-eyebrow">${editar ? 'Ordem de serviço' : 'Nova ordem de serviço'}${o.demo ? ' · exemplo (salvar cria uma cópia sua)' : ''}</div><h2 id="osTitulo">${esc(TAREFA[o.tarefa]?.nome || '')}</h2></div><button type="button" class="dr-x" data-act="fecharModal" aria-label="Fechar">${ic('fechar')}</button></div>
      <div class="m-b">
        <div class="form-grid">
          ${fld('Fase do ciclo', sel('fase', FASES.map((f) => [f.id, f.nome]), fase, 'id="osFase"'))}
          ${fld('Operação', `<select name="tarefa" id="osTarefa"></select>`)}
          ${fld('Data', inp('data', o.data, 'type="date" required'))}
          ${fld('Status', sel('status', Object.entries(STATUS_OS).map(([k, v]) => [k, v.nome]), o.status))}
        </div>
        <details class="tec" id="osTec"></details>
        <div class="form-grid">
          ${fld('Ruas (uma região por linha: "R2: 1-45, 60")', `<textarea name="ruas" rows="2" class="mono" id="osRuas" placeholder="R1: todas">${esc(ruasTexto(o.ruas))}</textarea>`, 'wide')}
          ${fld('Ou ativo (bomba, filtro, válvula…)', `<input name="ativo" list="dlAtivos" value="${esc(o.ativo || '')}" placeholder="ex.: FL-01">`)}
          <div class="fld"><span>Área</span><b id="osArea">—</b></div>
        </div>
        <datalist id="dlAtivos">${this.farm.assets.filter((a) => a.tipo !== 'cruzeta' || !a.rua).map((a) => `<option value="${a.id}">${esc(a.nome)}</option>`).join('')}</datalist>
        <h4>Execução</h4>
        <div class="form-grid">
          ${fld('Responsável / operador', inp('operador', o.operador, 'list="dlOper"'))}
          ${fld('Pessoas', inp('pessoas', o.pessoas, 'type="number" min="0" step="1"'))}
          ${fld('Horas trabalhadas', inp('horas', o.horas, 'type="number" min="0" step="0.1"'))}
          ${fld('Máquina', sel('equip', [['', 'Nenhuma'], ...m.equipList().map((e) => [e.id, `${e.id} · ${e.nome}`])], o.equip))}
        </div>
        <datalist id="dlOper">${[...new Set(m.osList().map((x) => x.operador).filter(Boolean))].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
        <h4>Características da operação</h4>
        <div class="form-grid" id="osCampos"></div>
        <div id="osIns"></div>
        ${fld('Observações', `<textarea name="obs" rows="2">${esc(o.obs || '')}</textarea>`, 'wide')}
        <div class="custo" id="osCusto"></div>
      </div>
      <div class="m-f">${editar && !o.demo ? `<button type="button" class="btn ghost bad" id="osDel">${ic('lixo')} Excluir</button>` : ''}${editar ? `<button type="button" class="btn" id="osDup">Duplicar</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">${ic('check')} Salvar</button></div>
    </form>`, 'wide');
    const f = box.querySelector('#fOS');
    let insumos = (o.insumos || []).map((x) => ({ ...x }));
    const campos = { ...(o.campos || {}) };
    const fillTarefas = (fs, keep) => {
      const t = f.querySelector('#osTarefa');
      t.innerHTML = TAREFAS.filter((x) => x.fase === fs).map((x) => `<option value="${x.id}" ${x.id === keep ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
    };
    const area = () => { const r = parseRuas(f.ruas.value, this.farm); return sum(m.rowsOf({ ruas: r }), (x) => x.areaHa); };
    const renderTarefa = () => {
      const t = TAREFA[f.tarefa.value];
      box.querySelector('#osTitulo').textContent = t.nome;
      box.querySelector('#osTec').innerHTML = `<summary>${esc(t.desc)}</summary>${t.tec.length ? `<ul>${t.tec.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<p class="muted small">Unidade de trabalho: ${esc(t.unid)}${t.recorrente ? ` · rotina ${esc(t.recorrente)}` : ''}</p>`;
      const cs = box.querySelector('#osCampos');
      cs.innerHTML = (t.campos || []).map((c) => {
        const v = campos[c.k] ?? c.def ?? '';
        let inner;
        if (c.t === 'sel') inner = sel(`c_${c.k}`, ['', ...c.o], v);
        else if (c.t === 'chk') return `<label class="fld chk"><input type="checkbox" name="c_${c.k}" ${v ? 'checked' : ''}><span>${esc(c.l)}</span></label>`;
        else if (c.t === 'date') inner = inp(`c_${c.k}`, v, 'type="date"');
        else if (c.t === 'num') inner = `<div class="unit">${inp(`c_${c.k}`, v, 'type="number" step="any"')}${c.u ? `<i>${esc(c.u)}</i>` : ''}</div>`;
        else inner = inp(`c_${c.k}`, v, c.ph ? `placeholder="${esc(c.ph)}"` : '');
        return fld(esc(c.l), inner + `<small class="warn" data-warn="${c.k}"></small>`, c.k === 'vazoes' ? 'wide' : '');
      }).join('') || '<p class="muted small">Esta operação não tem campos específicos.</p>';
      box.querySelector('#osIns').innerHTML = t.insumos ? `<h4>Insumos (dose por hectare)</h4><div id="insRows"></div><button type="button" class="btn sm" id="insAdd">${ic('mais')} Adicionar insumo</button>` : '';
      if (t.insumos) { renderIns(); box.querySelector('#insAdd').onclick = () => { insumos.push({ id: m.insumos()[0].id, dose: '' }); renderIns(); }; }
      warn();
      if (t.id === 'IR05') showCud();
    };
    const renderIns = () => {
      const el = box.querySelector('#insRows');
      if (!el) return;
      const lst = m.insumos();
      const a = area();
      el.innerHTML = insumos.map((it, i) => {
        const p = lst.find((x) => x.id === it.id) || { un: '', preco: 0 };
        const tot = it.porHa === false ? +it.dose || 0 : (+it.dose || 0) * a;
        return `<div class="ins-row" data-i="${i}"><select data-k="id">${[...new Set(lst.map((x) => x.cat))].map((cat) => `<optgroup label="${esc(cat)}">${lst.filter((x) => x.cat === cat).map((x) => `<option value="${x.id}" ${x.id === it.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</optgroup>`).join('')}</select><div class="unit"><input data-k="dose" type="number" step="any" value="${esc(it.dose)}" placeholder="dose"><i>${esc(p.un)}/ha</i></div><span class="ins-tot">${num(tot, 2)} ${esc(p.un)} · ${brl(tot * p.preco)}</span><button type="button" class="mini" data-rm="${i}" aria-label="Remover">${ic('lixo')}</button></div>`;
      }).join('') || '<p class="muted small">Nenhum insumo.</p>';
      el.querySelectorAll('.ins-row').forEach((row) => {
        const i = +row.dataset.i;
        row.querySelector('[data-k="id"]').onchange = (e) => { insumos[i].id = e.target.value; renderIns(); };
        row.querySelector('[data-k="dose"]').onchange = (e) => { insumos[i].dose = +e.target.value; renderIns(); };
      });
      el.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { insumos.splice(+b.dataset.rm, 1); renderIns(); }));
      custo();
    };
    const warn = () => {
      const t = TAREFA[f.tarefa.value];
      for (const c of t.campos || []) {
        if (!c.warn) continue;
        const v = f[`c_${c.k}`]?.value;
        const w = box.querySelector(`[data-warn="${c.k}"]`);
        if (w) w.textContent = v === '' || v == null ? '' : c.warn(+v) || '';
      }
    };
    const showCud = () => {
      const v = f.c_vazoes?.value;
      const w = box.querySelector('[data-warn="vazoes"]');
      if (!w) return;
      const r = cud(String(v || '').split(/[,;\s]+/));
      w.className = r ? '' : 'warn';
      w.textContent = r ? `CUD = ${num(r.val, 1)}% (${r.cls}) · média ${num(r.media, 2)} L/h · ${r.n} gotejadores` : '';
    };
    const custo = () => {
      const a = area();
      box.querySelector('#osArea').textContent = a ? `${num(a, 2)} ha · ${m.rowsOf({ ruas: parseRuas(f.ruas.value, this.farm) }).length} ruas` : '—';
      const c = m.custo({ insumos, horas: +f.horas.value, pessoas: +f.pessoas.value, equip: f.equip.value, ruas: parseRuas(f.ruas.value, this.farm) });
      box.querySelector('#osCusto').innerHTML = `Custo estimado: <b>${brl(c.total)}</b> <small>(insumos ${brl(c.insumos)} · máquina ${brl(c.maquina)} · mão de obra ${brl(c.mao)})${a ? ` · ${brl(c.total / a)}/ha` : ''}</small>`;
    };
    fillTarefas(fase, o.tarefa);
    renderTarefa();
    f.fase.onchange = () => { fillTarefas(f.fase.value); renderTarefa(); };
    f.tarefa.onchange = renderTarefa;
    f.addEventListener('input', (e) => { if (e.target.name?.startsWith('c_')) { campos[e.target.name.slice(2)] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; warn(); if (e.target.name === 'c_vazoes') showCud(); } if (['ruas', 'horas', 'pessoas'].includes(e.target.name)) { renderIns(); custo(); } });
    f.equip.onchange = custo;
    custo();
    const coletar = () => {
      const t = TAREFA[f.tarefa.value];
      const cv = {};
      for (const c of t.campos || []) {
        const el = f[`c_${c.k}`];
        if (!el) continue;
        if (c.t === 'chk') cv[c.k] = el.checked;
        else if (c.t === 'num') cv[c.k] = el.value === '' ? null : +el.value;
        else cv[c.k] = el.value;
      }
      return {
        tarefa: t.id, data: f.data.value, status: f.status.value, ruas: parseRuas(f.ruas.value, this.farm), ativo: f.ativo.value.trim() || null,
        operador: f.operador.value.trim(), pessoas: +f.pessoas.value || 0, horas: +f.horas.value || 0, equip: f.equip.value || null,
        campos: cv, insumos: insumos.filter((x) => x.id && x.dose !== '' && x.dose != null), obs: f.obs.value.trim(),
      };
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = coletar();
      if (!Object.keys(d.ruas).length && !d.ativo) { ui.toast('Informe as ruas (ex.: R1: 1-40) ou um ativo.'); return; }
      const id = editar ? o.id : uid('os-');
      try {
        await ui.store.put('os', { ...d, id, criadoEm: o.criadoEm || new Date().toISOString() });
        ui.closeModal();
        ui.toast(editar ? 'Ordem atualizada.' : 'Ordem lançada.');
      } catch { ui.toast('Não foi salvo. Verifique sua permissão de edição.'); }
    };
    box.querySelector('#osDel')?.addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Toque de novo para excluir'; return; }
      await ui.store.del('os', o.id); ui.closeModal(); ui.toast('Ordem excluída.');
    });
    box.querySelector('#osDup')?.addEventListener('click', () => { const d = coletar(); ui.closeModal(); this.os({ ...d, status: 'planejada', data: m.hoje }); });
  }

  // ================================================================ CONTAGEM
  contagem(base = {}) {
    base = limpo(base);
    const ui = this.ui, m = this.m, p = m.params();
    const editar = !!base.id;
    const c = { reg: base.reg || this.farm.regions[0].id, data: m.hoje, safra: m.safra, fase: 'Granação', metodo: 'frutos', valores: [], ramos: [], fpl: p.frutosPorLitro, rend: p.rendimento, ...base };
    const box = ui.modal(`<form class="mform" id="fCt"><div class="m-h"><div><div class="dr-eyebrow">Estimativa de safra</div><h2>${editar ? 'Contagem' : 'Nova contagem'}</h2></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b">
        <details class="tec"><summary>Como contar</summary><ul>${TAREFA.ES01.tec.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
        <div class="form-grid">
          ${fld('Região', sel('reg', this.farm.regions.map((r) => [r.id, r.nome]), c.reg))}
          ${fld('Data', inp('data', c.data, 'type="date"'))}
          ${fld('Safra (ano da colheita)', inp('safra', c.safra, 'type="number"'))}
          ${fld('Fase', sel('fase', ['Chumbinho', 'Granação', 'Pré-colheita', 'Outra'], c.fase))}
          ${fld('Método', sel('metodo', [['frutos', 'Contagem de frutos por ramo'], ['litros', 'Derriça amostral (litros por planta)']], c.metodo))}
          ${fld('Responsável', inp('responsavel', c.responsavel))}
        </div>
        <div class="form-grid">
          ${fld('<span id="lblVal">Frutos por ramo (média dos 4 ramos), uma planta por valor</span>', `<textarea name="valores" rows="3" class="mono" placeholder="22, 31, 18, 27 …">${esc((c.valores || []).join(', '))}</textarea>`, 'wide')}
          ${fld('Ramos produtivos por planta (lista na mesma ordem, ou um número médio)', `<textarea name="ramos" rows="2" class="mono" placeholder="80">${esc(Array.isArray(c.ramos) ? c.ramos.join(', ') : c.ramos || '')}</textarea>`, 'wide ramos')}
          ${fld('Frutos por litro', inp('fpl', c.fpl, 'type="number" step="any"'))}
          ${fld('Litros por saca beneficiada', inp('rend', c.rend, 'type="number" step="any"'))}
        </div>
        <div class="custo" id="ctRes"></div>
      </div>
      <div class="m-f">${editar && !c.demo ? `<button type="button" class="btn ghost bad" id="ctDel">${ic('lixo')} Excluir</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">Salvar contagem</button></div></form>`, 'wide');
    const f = box.querySelector('#fCt');
    const nums = (s) => String(s || '').split(/[,;\s]+/).map(Number).filter((x) => !Number.isNaN(x) && x >= 0 && String(x) !== '');
    const ler = () => {
      const ramosL = nums(f.ramos.value);
      return { reg: f.reg.value, data: f.data.value, safra: +f.safra.value, fase: f.fase.value, metodo: f.metodo.value, valores: nums(f.valores.value), ramos: ramosL.length > 1 ? ramosL : ramosL[0] || 0, fpl: +f.fpl.value, rend: +f.rend.value, responsavel: f.responsavel.value };
    };
    const calc = () => {
      const d = ler();
      box.querySelector('#lblVal').textContent = d.metodo === 'litros' ? 'Litros por planta (derriça no pano), um valor por planta' : 'Frutos por ramo (média dos 4 ramos), uma planta por valor';
      box.querySelector('.ramos').hidden = d.metodo === 'litros';
      const reg = this.farm.regionById.get(d.reg);
      const e = estimar(d, reg, m.estande(reg).pctFalhas, m.params());
      box.querySelector('#ctRes').innerHTML = e ? `<b>${num(e.scha, 1)} sc/ha</b> (IC 95%: ${num(e.ciLo, 1)} a ${num(e.ciHi, 1)}) · <b>${num(e.total, 0)} sc</b> em ${num(reg.areaHa, 1)} ha<br><small>${e.n} plantas · ${num(e.lPlanta, 2)} L/planta · CV ${num(e.cv, 0)}% · ${num(e.plHa, 0)} plantas vivas/ha (descontadas as falhas)${e.cv > 35 ? ' · variação alta: amostre mais plantas' : ''}</small>` : 'Informe os valores das plantas amostradas.';
    };
    f.addEventListener('input', calc);
    calc();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = ler();
      if (!d.valores.length) { ui.toast('Informe ao menos uma planta.'); return; }
      try { await ui.store.put('contagens', { ...d, id: editar && !c.demo ? c.id : uid('ct-') }); ui.closeModal(); ui.toast('Contagem salva. Previsão atualizada.'); } catch { ui.toast('Não foi salvo.'); }
    };
    box.querySelector('#ctDel')?.addEventListener('click', async () => { await ui.store.del('contagens', c.id); ui.closeModal(); ui.toast('Contagem excluída.'); });
  }

  // ================================================================ CARGA
  carga(base = {}) {
    base = limpo(base);
    const ui = this.ui, m = this.m;
    const editar = !!base.id;
    const ruasObj = base.ruas && typeof base.ruas === 'object' ? base.ruas : base.reg ? { [base.reg]: base.ruas } : {};
    const c = { data: m.hoje, safra: +m.hoje.slice(0, 4), passada: '1ª', maturacao: {}, ...base };
    const box = ui.modal(`<form class="mform" id="fCg"><div class="m-h"><div><div class="dr-eyebrow">Colheita</div><h2>${editar ? 'Carga' : 'Registrar carga'}</h2></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b"><p class="muted small">Uma carga (bazuca, carreta ou medida) pode cobrir várias ruas. O volume é rateado entre elas pelo comprimento.</p>
      <div class="form-grid">
        ${fld('Data', inp('data', c.data, 'type="date"'))}
        ${fld('Safra (ano da colheita)', inp('safra', c.safra, 'type="number"'))}
        ${fld('Ruas (uma região: "R1: 10-16")', `<textarea name="ruas" rows="1" class="mono">${esc(ruasTexto(ruasObj))}</textarea>`, 'wide')}
        ${fld('Volume', `<div class="unit">${inp('litros', c.litros, 'type="number" step="1" required')}<i>L</i></div>`)}
        ${fld('Passada', sel('passada', ['1ª', '2ª', '3ª', 'Derriça manual', 'Varrição'], c.passada))}
        ${fld('Máquina', sel('maquina', [['', '—'], ...m.equipList().map((e) => [e.id, `${e.id} · ${e.nome}`])], c.maquina))}
        ${fld('Operador', inp('operador', c.operador))}
        ${fld('Lote de destino', inp('lote', c.lote))}
      </div>
      <h4>Maturação da carga (amostra de 1 L)</h4>
      <div class="form-grid">${['verde', 'cereja', 'passa', 'seco'].map((k) => fld(k[0].toUpperCase() + k.slice(1), `<div class="unit">${inp('m_' + k, c.maturacao?.[k], 'type="number" min="0" max="100"')}<i>%</i></div>`)).join('')}</div>
      <div class="custo" id="cgRes"></div></div>
      <div class="m-f">${editar && !c.demo ? `<button type="button" class="btn ghost bad" id="cgDel">${ic('lixo')} Excluir</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></form>`);
    const f = box.querySelector('#fCg');
    const calc = () => {
      const r = parseRuas(f.ruas.value, this.farm);
      const rows = m.rowsOf({ ruas: r });
      const a = sum(rows, (x) => x.areaHa);
      const sc = (+f.litros.value || 0) / m.params().rendimento;
      box.querySelector('#cgRes').innerHTML = rows.length ? `${rows.length} ruas · ${num(a, 2)} ha · <b>${num(sc, 1)} sc</b> · ${a ? num(sc / a, 1) : '—'} sc/ha` : 'Informe as ruas.';
    };
    f.addEventListener('input', calc); calc();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = parseRuas(f.ruas.value, this.farm);
      const regs = Object.keys(r);
      if (regs.length !== 1) { ui.toast('Informe as ruas de uma única região por carga.'); return; }
      const d = { data: f.data.value, safra: +f.safra.value, reg: regs[0], ruas: r[regs[0]], litros: +f.litros.value, passada: f.passada.value, maquina: f.maquina.value, operador: f.operador.value, lote: f.lote.value.trim(), maturacao: Object.fromEntries(['verde', 'cereja', 'passa', 'seco'].map((k) => [k, f['m_' + k].value === '' ? null : +f['m_' + k].value])) };
      try { await ui.store.put('colheita', { ...d, id: editar && !c.demo ? c.id : uid('cg-') }); ui.closeModal(); ui.toast('Carga registrada.'); } catch { ui.toast('Não foi salvo.'); }
    };
    box.querySelector('#cgDel')?.addEventListener('click', async () => { await ui.store.del('colheita', c.id); ui.closeModal(); ui.toast('Carga excluída.'); });
  }

  // ================================================================ LOTE
  lote(base = {}) {
    base = limpo(base);
    const ui = this.ui, m = this.m;
    const editar = !!base.id;
    const l = { safra: +m.hoje.slice(0, 4), umidade: 11.5, ...base };
    const campos = [['codigo', 'Código do lote', 'txt'], ['safra', 'Safra', 'num'], ['reg', 'Região', 'reg'], ['origem', 'Origem (região, passada, ruas)', 'txt'], ['litros', 'Volume colhido (L)', 'num'], ['processo', 'Processo', ['Natural', 'Cereja descascado (CD)', 'Despolpado', 'Fermentado', 'Natural (varrição)']], ['secagem', 'Secagem', ['Terreiro', 'Secador', 'Terreiro + secador', 'Terreiro suspenso']], ['umidade', 'Umidade final (%)', 'num'], ['sacas', 'Sacas beneficiadas', 'num'], ['classificacao', 'Classificação (tipo, peneira, bebida)', 'txt'], ['pontuacao', 'Pontuação SCA', 'num'], ['armazem', 'Armazém / tulha', 'txt']];
    const box = ui.modal(`<form class="mform" id="fLt"><div class="m-h"><div><div class="dr-eyebrow">Rastreabilidade</div><h2>${editar ? 'Lote ' + esc(l.codigo) : 'Novo lote'}</h2></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b"><div class="form-grid">${campos.map(([k, lab, t]) => fld(lab, Array.isArray(t) ? sel(k, ['', ...t], l[k]) : t === 'reg' ? sel(k, this.farm.regions.map((r) => [r.id, r.nome]), l[k]) : inp(k, l[k], t === 'num' ? 'type="number" step="any"' : ''))).join('')}</div></div>
      <div class="m-f">${editar && !l.demo ? `<button type="button" class="btn ghost bad" id="ltDel">${ic('lixo')} Excluir</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></form>`);
    const f = box.querySelector('#fLt');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = {};
      for (const [k, , t] of campos) d[k] = t === 'num' ? (f[k].value === '' ? null : +f[k].value) : f[k].value;
      if (!d.codigo) { ui.toast('Informe o código do lote.'); return; }
      try { await ui.store.put('lotes', { ...d, id: editar && !l.demo ? l.id : uid('lt-') }); ui.closeModal(); ui.toast('Lote salvo.'); } catch { ui.toast('Não foi salvo.'); }
    };
    box.querySelector('#ltDel')?.addEventListener('click', async () => { await ui.store.del('lotes', l.id); ui.closeModal(); ui.toast('Lote excluído.'); });
  }

  // ================================================================ MANUTENÇÃO
  manut(base = {}) {
    base = limpo(base);
    const ui = this.ui;
    const editar = !!base.id;
    const x = { prioridade: 'Média', status: 'aberta', abertoEm: this.m.hoje, tipo: 'Vazamento', ...base };
    const tipos = ['Vazamento', 'Entupimento', 'Hidráulica', 'Mecânica', 'Elétrica / comunicação', 'Filtragem', 'Estrutura', 'Outro'];
    const box = ui.modal(`<form class="mform" id="fMt"><div class="m-h"><div><div class="dr-eyebrow">Manutenção${x.demo ? ' · exemplo' : ''}</div><h2>${editar ? esc(x.titulo) : 'Nova ocorrência'}</h2></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b"><div class="form-grid">
        ${fld('Título', inp('titulo', x.titulo, 'required placeholder="ex.: Vazamento na lateral"'), 'wide')}
        ${fld('Tipo', sel('tipo', tipos, x.tipo))}
        ${fld('Prioridade', sel('prioridade', ['Alta', 'Média', 'Baixa'], x.prioridade))}
        ${fld('Status', sel('status', [['aberta', 'Aberta'], ['andamento', 'Em andamento'], ['concluida', 'Concluída']], x.status))}
        ${fld('Aberta em', inp('abertoEm', x.abertoEm, 'type="date"'))}
        ${fld('Ativo (opcional)', `<input name="ativo" list="dlAt2" value="${esc(x.ativo || '')}" placeholder="ex.: VS-R2-S1, CZ-R1-L088">`)}
        ${fld('Rua (opcional)', inp('rua', x.rua, 'placeholder="ex.: R2-L047"'))}
        ${fld('Posição na rua', `<div class="unit">${inp('metro', x.metro, 'type="number" step="0.1"')}<i>m do início</i></div>`)}
        ${fld('Responsável', inp('responsavel', x.responsavel))}
        ${fld('Descrição', `<textarea name="descricao" rows="3">${esc(x.descricao || '')}</textarea>`, 'wide')}
        ${fld('Concluída em', inp('fechadoEm', x.fechadoEm, 'type="date"'))}
        ${fld('Custo (R$)', inp('custo', x.custo, 'type="number" step="0.01"'))}
      </div><datalist id="dlAt2">${this.farm.assets.map((a) => `<option value="${a.id}">`).join('')}</datalist></div>
      <div class="m-f">${editar && !x.demo ? `<button type="button" class="btn ghost bad" id="mtDel">${ic('lixo')} Excluir</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></form>`);
    const f = box.querySelector('#fMt');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const rua = f.rua.value.trim().toUpperCase();
      const row = rua ? this.farm.rowById.get(rua) : null;
      const ativo = f.ativo.value.trim().toUpperCase();
      if (ativo && !this.farm.assetById.has(ativo)) { ui.toast(`Ativo ${ativo} não existe no inventário.`); return; }
      if (rua && !row) { ui.toast(`Rua ${rua} não existe.`); return; }
      const metro = f.metro.value === '' ? null : +f.metro.value;
      let X = x.x, Y = x.y;
      if (row) { const t = Math.min(1, Math.max(0, (metro ?? row.len / 2) / row.len)); X = row.x1 + (row.x2 - row.x1) * t; Y = row.y1 + (row.y2 - row.y1) * t; }
      const st = f.status.value;
      const d = { titulo: f.titulo.value.trim(), tipo: f.tipo.value, prioridade: f.prioridade.value, status: st, abertoEm: f.abertoEm.value, ativo: ativo || null, rua: rua || null, metro, x: X ?? null, y: Y ?? null, responsavel: f.responsavel.value, descricao: f.descricao.value, fechadoEm: f.fechadoEm.value || (st === 'concluida' ? this.m.hoje : null), custo: f.custo.value === '' ? null : +f.custo.value };
      try {
        await ui.store.put('manut', { ...d, id: editar && !x.demo ? x.id : uid('mt-') });
        if (d.ativo && st !== 'concluida' && this.m.assetStatus(d.ativo) === 'ok') await ui.store.put('ativos', { id: d.ativo, status: d.prioridade === 'Alta' ? 'falha' : 'alerta', obs: d.titulo });
        if (d.ativo && st === 'concluida') await ui.store.put('ativos', { id: d.ativo, status: 'ok', obs: '' });
        ui.closeModal(); ui.toast('Ocorrência salva.');
      } catch { ui.toast('Não foi salvo.'); }
    };
    box.querySelector('#mtDel')?.addEventListener('click', async () => { await ui.store.del('manut', x.id); ui.closeModal(); ui.toast('Ocorrência excluída.'); });
  }

  // ================================================================ SOLO
  solo(base = {}) {
    base = limpo(base);
    const ui = this.ui;
    const editar = !!base.id;
    const s = { reg: base.reg || this.farm.regions[0].id, data: this.m.hoje, a020: {}, a2040: {}, ...base };
    const attrs = ATRIBUTOS;
    const box = ui.modal(`<form class="mform" id="fSo"><div class="m-h"><div><div class="dr-eyebrow">Solo</div><h2>${editar ? 'Análise de solo' : 'Nova análise de solo'}</h2></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b"><div class="form-grid">
        ${fld('Região', sel('reg', this.farm.regions.map((r) => [r.id, r.nome]), s.reg))}
        ${fld('Data da coleta', inp('data', s.data, 'type="date"'))}
        ${fld('Laboratório', inp('laboratorio', s.laboratorio))}
        ${fld('Protocolo', inp('protocolo', s.protocolo))}
        ${fld('Produtividade esperada (sc/ha)', inp('scEsperada', s.scEsperada || '', 'type="number" step="1" placeholder="vazio = usar previsão"'))}
      </div>
      <div class="tbl-wrap"><table class="tbl edit sm"><thead><tr><th>Atributo</th><th>Unidade</th><th>0–20 cm</th><th>20–40 cm</th></tr></thead><tbody>${attrs.map((a) => `<tr><td>${esc(a.l)}</td><td>${esc(a.u)}</td><td><input name="a_${a.k}" type="number" step="any" value="${esc(s.a020?.[a.k] ?? '')}"></td><td><input name="b_${a.k}" type="number" step="any" value="${esc(s.a2040?.[a.k] ?? '')}"></td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">K em mg/dm³; Ca, Mg, Al e H+Al em cmolc/dm³ (se o laudo vier em mmolc/dm³, divida por 10). pH em água.</p></div>
      <div class="m-f">${editar && !s.demo ? `<button type="button" class="btn ghost bad" id="soDel">${ic('lixo')} Excluir</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">Salvar análise</button></div></form>`, 'wide');
    const f = box.querySelector('#fSo');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const a020 = {}, a2040 = {};
      for (const a of attrs) { const v1 = f[`a_${a.k}`].value, v2 = f[`b_${a.k}`].value; if (v1 !== '') a020[a.k] = +v1; if (v2 !== '') a2040[a.k] = +v2; }
      if (a020.ph == null || a020.k == null || a020.ca == null) { ui.toast('Preencha ao menos pH, K e Ca da camada 0–20 cm.'); return; }
      const d = { reg: f.reg.value, data: f.data.value, laboratorio: f.laboratorio.value, protocolo: f.protocolo.value, scEsperada: f.scEsperada.value === '' ? 0 : +f.scEsperada.value, a020, a2040: Object.keys(a2040).length ? a2040 : null };
      try { await ui.store.put('solo', { ...d, id: editar && !s.demo ? s.id : uid('so-') }); ui.closeModal(); ui.toast('Análise salva. Recomendação recalculada.'); } catch { ui.toast('Não foi salvo.'); }
    };
    box.querySelector('#soDel')?.addEventListener('click', async () => { await ui.store.del('solo', s.id); ui.closeModal(); ui.toast('Análise excluída.'); });
  }

  // ================================================================ MÁQUINA
  equip(base = {}) {
    base = limpo(base);
    const ui = this.ui;
    const editar = !!base.id;
    const e = { tipo: 'trator', ...base };
    const box = ui.modal(`<form class="mform" id="fEq"><div class="m-h"><div><div class="dr-eyebrow">Máquina</div><h2>${editar ? esc(e.nome) : 'Cadastrar máquina'}</h2></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b"><div class="form-grid">
        ${fld('Código', inp('id', e.id, `required ${editar ? 'readonly' : ''} placeholder="ex.: TR-07"`))}
        ${fld('Nome', inp('nome', e.nome, 'required'))}
        ${fld('Tipo', sel('tipo', Object.entries(TIPOS_EQUIP).map(([k, v]) => [k, v.nome]), e.tipo))}
        ${fld('Série / placa', inp('serie', e.serie))}
        ${fld('Horímetro (h)', inp('horimetro', e.horimetro, 'type="number"'))}
        ${fld('Consumo (L/h)', inp('consumo', e.consumo, 'type="number" step="0.1"'))}
        ${fld('Custo por hora (R$)', inp('custoHora', e.custoHora, 'type="number" step="0.01"'))}
        ${fld('ID do rastreador GPS', inp('rastreador', e.rastreador))}
      </div></div>
      <div class="m-f">${editar && !e.demo ? `<button type="button" class="btn ghost bad" id="eqDel">${ic('lixo')} Excluir</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></form>`);
    const f = box.querySelector('#fEq');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const id = f.id.value.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
      if (!id) return;
      const d = { id, nome: f.nome.value.trim(), tipo: f.tipo.value, serie: f.serie.value, horimetro: +f.horimetro.value || 0, consumo: +f.consumo.value || 0, custoHora: +f.custoHora.value || 0, rastreador: f.rastreador.value.trim() };
      try { await ui.store.put('equip', d); ui.closeModal(); ui.toast('Máquina salva.'); } catch { ui.toast('Não foi salvo.'); }
    };
    box.querySelector('#eqDel')?.addEventListener('click', async () => { await ui.store.del('equip', e.id); ui.closeModal(); ui.toast('Máquina removida.'); });
  }

  // ================================================================ STATUS DE ATIVO
  statusAtivo(id) {
    const ui = this.ui;
    const a = this.farm.assetById.get(id);
    const cur = ui.store.get('ativos', id) || { status: 'ok', obs: '' };
    const box = ui.modal(`<form class="mform" id="fSt"><div class="m-h"><div><div class="dr-eyebrow">${esc(a.nome)}</div><h2 class="mono">${esc(id)}</h2></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b"><div class="form-grid">${fld('Status', sel('status', Object.entries(STATUS_ATIVO).map(([k, v]) => [k, v.nome]), cur.status))}${fld('Observação', inp('obs', cur.obs), 'wide')}</div></div>
      <div class="m-f"><span class="sp"></span><button type="button" class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></form>`);
    const f = box.querySelector('#fSt');
    f.onsubmit = async (e) => { e.preventDefault(); try { await ui.store.put('ativos', { id, status: f.status.value, obs: f.obs.value }); ui.closeModal(); ui.toast('Status atualizado.'); } catch { ui.toast('Não foi salvo.'); } };
  }

  // ================================================================ RELATÓRIO
  relatorio(id) {
    const ui = this.ui, m = this.m;
    const rel = RELATORIOS.find((r) => r.id === id);
    const f = { safra: m.safra, safraColhida: m.safrasColhidas().find((s) => m.cargas(s).length) || m.safra - 1, ini: `${m.safra - 1}-07-01`, fim: m.hoje, reg: '', tarefa: '', status: '' };
    const filtrosHTML = () => rel.filtros.map((k) => {
      if (k === 'periodo') return fld('De', `<input type="date" data-f="ini" value="${f.ini}">`) + fld('Até', `<input type="date" data-f="fim" value="${f.fim}">`);
      if (k === 'regiao') return fld('Região', `<select data-f="reg"><option value="">Todas</option>${this.farm.regions.map((r) => `<option value="${r.id}">${esc(r.nome)}</option>`).join('')}</select>`);
      if (k === 'safra') return fld('Ciclo (safra)', `<select data-f="safra">${[m.safra, m.safra - 1, m.safra - 2].map((s) => `<option value="${s}">${s - 1}/${s}</option>`).join('')}</select>`);
      if (k === 'safraColhida') return fld('Colheita', `<select data-f="safraColhida">${m.safrasColhidas().map((s) => `<option value="${s}" ${s === f.safraColhida ? 'selected' : ''}>${s}</option>`).join('')}</select>`);
      if (k === 'tarefa') return fld('Operação', `<select data-f="tarefa"><option value="">Todas</option>${TAREFAS.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select>`);
      if (k === 'status') return fld('Status', `<select data-f="status"><option value="">Todos</option>${Object.entries(STATUS_OS).map(([k2, v]) => `<option value="${k2}">${v.nome}</option>`).join('')}</select>`);
      return '';
    }).join('');
    const box = ui.modal(`<div class="mform"><div class="m-h"><div><div class="dr-eyebrow">Relatório · ${esc(rel.grupo)}</div><h2>${esc(rel.nome)}</h2><p class="muted small">${esc(rel.desc)}</p></div><button type="button" class="dr-x" data-act="fecharModal">${ic('fechar')}</button></div>
      <div class="m-b">${rel.filtros.length ? `<div class="form-grid" id="relF">${filtrosHTML()}</div>` : ''}<div id="relOut" class="rel-out"></div></div>
      <div class="m-f"><span class="sp"></span><button class="btn" id="relCsv">${ic('baixar')} CSV</button><button class="btn pri" id="relHtml">${ic('baixar')} HTML para imprimir</button></div></div>`, 'xwide');
    let res;
    const run = () => {
      box.querySelectorAll('[data-f]').forEach((el) => (f[el.dataset.f] = el.value));
      try { res = rel.gerar(m, f); box.querySelector('#relOut').innerHTML = relatorioHTML(rel, res); }
      catch (e) { console.error(e); box.querySelector('#relOut').innerHTML = `<p class="erro">Erro ao gerar: ${esc(e.message)}</p>`; }
    };
    box.querySelector('#relF')?.addEventListener('change', run);
    run();
    const meta = () => ({ fazenda: ui.farmConfig().nome + (ui.store.demoOn() ? ' (inclui dados de exemplo)' : ''), filtros: Object.entries(f).filter(([k, v]) => v && rel.filtros.some((x) => k.startsWith(x === 'periodo' ? 'i' : x) || (x === 'periodo' && (k === 'ini' || k === 'fim')) || (x === 'regiao' && k === 'reg'))).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'sem filtros', quando: new Date().toLocaleString('pt-BR') });
    box.querySelector('#relCsv').onclick = async () => { const s = await baixar(`${rel.id}-${isoDate()}.csv`, toCSV(res.csv || []), 'text/csv'); if (s === 'salvo') ui.toast('CSV gerado.'); };
    box.querySelector('#relHtml').onclick = async () => { const s = await baixar(`${rel.id}-${isoDate()}.html`, documentoHTML(rel, res, meta()), 'text/html'); if (s === 'salvo') ui.toast('Arquivo gerado. Abra no navegador para imprimir ou salvar em PDF.'); };
  }

  // ================================================================ TRILHA GPS
  async importarTrilha(id) {
    const ui = this.ui;
    const f = await lerArquivo('.gpx,.csv,.txt,.nmea,.log');
    if (!f) return;
    try {
      const r = ui.sim.importarTrilha(id, f.texto, f.nome);
      ui.toast(`Trilha carregada: ${r.pontos} pontos, ${num(r.comprimento / 1000, 2)} km, ${num(r.velMedia, 1)} km/h.`);
      ui.renderDrawer();
    } catch (e) { ui.toast(e.message); }
  }
}
